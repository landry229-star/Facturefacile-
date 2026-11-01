import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const emailFrom = Deno.env.get('EMAIL_FROM')
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405, headers: corsHeaders })
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) {
    return new Response(JSON.stringify({ error: 'Configuration email incomplète. Configurez RESEND_API_KEY et EMAIL_FROM dans les secrets Supabase.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response('Non autorisé.', { status: 401, headers: corsHeaders })
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return new Response('Session invalide.', { status: 401, headers: corsHeaders })
  const body = await request.json() as { businessId?: string; invoiceNumber?: string }
  if (!body.businessId || !body.invoiceNumber) return new Response('Facture invalide.', { status: 400, headers: corsHeaders })
  const { data: role, error: roleError } = await userClient.rpc('get_business_role', { p_business_id: body.businessId })
  if (roleError || !['owner', 'admin', 'member'].includes(role)) return new Response('Accès refusé.', { status: 403, headers: corsHeaders })
  const { data: invoice, error: invoiceError } = await admin.from('invoices')
    .select('invoice_number, issue_date, due_date, total, businesses(name, email, currency), clients(name, email), invoice_items(description, quantity, total)')
    .eq('business_id', body.businessId).eq('invoice_number', body.invoiceNumber).single()
  if (invoiceError) return new Response('Facture introuvable.', { status: 404, headers: corsHeaders })
  const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
  const business = Array.isArray(invoice.businesses) ? invoice.businesses[0] : invoice.businesses
  if (!client?.email) return new Response('Ce client n’a pas d’adresse email.', { status: 400, headers: corsHeaders })
  const currency = business?.currency === 'EUR' ? 'EUR' : business?.currency === 'USD' ? 'USD' : 'FCFA'
  const amount = (value: number) => `${Number(value).toLocaleString('fr-FR')} ${currency}`
  const items = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : []
  const rows = items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${escapeHtml(amount(Number(item.total)))}</td></tr>`).join('')
  const html = `<div style="font-family:Arial;color:#192b45"><h1 style="color:#2475e8">Facture ${escapeHtml(invoice.invoice_number)}</h1><p>${escapeHtml(business?.name ?? 'Votre entreprise')} vous adresse cette facture.</p><p>Émise le ${escapeHtml(invoice.issue_date)} — Échéance : ${escapeHtml(invoice.due_date ?? '—')}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Désignation</th><th style="text-align:left">Qté</th><th style="text-align:left">Total</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:right;font-size:18px"><strong>Total : ${escapeHtml(amount(Number(invoice.total)))}</strong></p></div>`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: emailFrom, to: [client.email], subject: `Facture ${invoice.invoice_number} — ${business?.name ?? 'FactureFacile'}`, html }),
  })
  if (!response.ok) return new Response('Le fournisseur email a refusé l’envoi.', { status: 502, headers: corsHeaders })
  return new Response(JSON.stringify({ sent: true, recipient: client.email }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
