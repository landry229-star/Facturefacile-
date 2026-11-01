import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const emailFrom = Deno.env.get('EMAIL_FROM')
const cronSecret = Deno.env.get('CRON_SECRET')

if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom || !cronSecret) {
  throw new Error('Configuration Supabase, Resend, EMAIL_FROM ou CRON_SECRET incomplète.')
}

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405, headers })
  if (request.headers.get('x-cron-secret') !== cronSecret) return new Response('Non autorisé.', { status: 401, headers })
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const today = new Date().toISOString().slice(0, 10)
  const { data: invoices, error } = await admin.from('invoices')
    .select('id, invoice_number, due_date, total, businesses(name), clients(name, email)')
    .lt('due_date', today)
    .not('status', 'in', '(PAID,CANCELLED,DRAFT)')
  if (error) return new Response(error.message, { status: 500, headers })

  let sent = 0
  let failed = 0
  let trackingFailed = 0
  for (const invoice of invoices ?? []) {
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
    const business = Array.isArray(invoice.businesses) ? invoice.businesses[0] : invoice.businesses
    if (!client?.email) continue
    const reminder = await admin.from('invoice_reminders').insert({ invoice_id: invoice.id, reminder_date: today }).select('id').maybeSingle()
    if (reminder.error || !reminder.data) continue
    let response: Response | null = null
    try {
      response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: emailFrom,
        to: [client.email],
        subject: `Rappel : facture ${invoice.invoice_number} en attente`,
        html: `<div style="font-family:Arial;color:#192b45"><h2>Rappel de paiement</h2><p>Bonjour ${escapeHtml(client.name ?? '')},</p><p>La facture <strong>${escapeHtml(invoice.invoice_number)}</strong> de ${Number(invoice.total).toLocaleString('fr-FR')} FCFA est échue depuis le ${escapeHtml(invoice.due_date)}.</p><p>Merci de régulariser votre paiement auprès de ${escapeHtml(business?.name ?? 'votre fournisseur')}.</p></div>`,
      }),
      })
    } catch (error) {
      console.error(`Échec de l’envoi de la relance ${invoice.invoice_number}.`, error)
    }
    const accepted = response?.ok ?? false
    let providerMessageId: string | null = null
    if (response?.ok) {
      const payload = await response.json().catch(() => null) as { id?: string } | null
      providerMessageId = payload?.id ?? null
    }
    const communication = await admin.from('invoice_communications').insert({
      invoice_id: invoice.id,
      event_type: 'overdue_reminder',
      status: accepted ? 'accepted' : 'failed',
      recipient: client.email,
      provider_message_id: providerMessageId,
    })
    if (communication.error) {
      trackingFailed += 1
      console.error(`Impossible d’enregistrer l’historique de la relance ${invoice.invoice_number}.`, communication.error)
    }
    if (accepted) sent += 1
    else failed += 1
  }
  return new Response(JSON.stringify({ processed: invoices?.length ?? 0, sent, failed, trackingFailed }), { headers: { ...headers, 'Content-Type': 'application/json' } })
})
