import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const emailFrom = Deno.env.get('EMAIL_FROM')
const cronSecret = Deno.env.get('CRON_SECRET')
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const relation = <T>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom || !cronSecret) {
    return jsonResponse({ error: 'Configuration des relances automatiques incomplète.' }, 503)
  }
  if (request.headers.get('x-cron-secret') !== cronSecret) {
    return jsonResponse({ error: 'Non autorisé.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: enabledSettings, error: settingsError } = await admin
    .from('invoice_reminder_settings')
    .select('business_id')
    .eq('enabled', true)
  if (settingsError) {
    console.error('Unable to load reminder opt-in settings:', settingsError.message)
    return jsonResponse({ error: 'Impossible de vérifier les autorisations de relance.' }, 500)
  }

  const businessIds = [...new Set((enabledSettings ?? []).map((setting) => setting.business_id))]
  if (businessIds.length === 0) {
    return jsonResponse({ processed: 0, sent: 0, failed: 0, skipped: 0, trackingFailed: 0, date: new Date().toISOString().slice(0, 10) })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data: invoiceRows, error: invoicesError } = await admin
    .from('invoices')
    .select('id, business_id, invoice_number, due_date, total, currency, status, invoice_type, benin_document_type, clients(name, email), businesses(name)')
    .in('business_id', businessIds)
    .lt('due_date', today)
    .not('due_date', 'is', null)
    .not('status', 'in', '("DRAFT","CANCELLED","PAID")')
  if (invoicesError) {
    console.error('Unable to load overdue invoices:', invoicesError.message)
    return jsonResponse({ error: 'Impossible de charger les factures à relancer.' }, 500)
  }

  const eligibleInvoices = (invoiceRows ?? []).filter((invoice) =>
    !['PROFORMA', 'CREDIT_NOTE'].includes(invoice.invoice_type)
    && invoice.benin_document_type !== 'proforma',
  )
  if (eligibleInvoices.length === 0) {
    return jsonResponse({ processed: 0, sent: 0, failed: 0, skipped: 0, trackingFailed: 0, date: today })
  }

  const invoiceIds = eligibleInvoices.map((invoice) => invoice.id)
  const { data: paymentRows, error: paymentsError } = await admin
    .from('payments')
    .select('invoice_id, effective_amount')
    .in('invoice_id', invoiceIds)
  if (paymentsError) {
    console.error('Unable to load invoice payments:', paymentsError.message)
    return jsonResponse({ error: 'Impossible de vérifier les soldes des factures.' }, 500)
  }
  const paidByInvoice = new Map<string, number>()
  for (const payment of paymentRows ?? []) {
    paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.effective_amount ?? 0))
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  let trackingFailed = 0
  for (const invoice of eligibleInvoices) {
    const client = relation(invoice.clients)
    const business = relation(invoice.businesses)
    const balance = Number(invoice.total) - (paidByInvoice.get(invoice.id) ?? 0)
    if (!client?.email || !Number.isFinite(balance) || balance <= 0) {
      skipped += 1
      continue
    }

    const { data: currentSetting, error: settingError } = await admin
      .from('invoice_reminder_settings')
      .select('enabled')
      .eq('business_id', invoice.business_id)
      .maybeSingle()
    if (settingError) {
      console.error(`Unable to recheck reminder opt-in for business ${invoice.business_id}:`, settingError.message)
      return jsonResponse({ error: 'Impossible de revérifier les autorisations de relance.', sent, skipped }, 500)
    }
    if (!currentSetting?.enabled) {
      skipped += 1
      continue
    }

    const { data: manualSentToday, error: manualReminderError } = await admin.from('manual_invoice_reminders')
      .select('id')
      .eq('invoice_id', invoice.id)
      .eq('reminder_date', today)
      .eq('status', 'sent')
      .limit(1)
      .maybeSingle()
    if (manualReminderError) {
      console.error(`Unable to check manual reminder history for invoice ${invoice.id}:`, manualReminderError.message)
      return jsonResponse({
        error: 'Impossible de vérifier l’historique manuel avant une relance automatique.',
        processed: eligibleInvoices.length,
        sent,
        failed,
        skipped,
        trackingFailed,
      }, 500)
    }
    if (manualSentToday) {
      skipped += 1
      continue
    }

    const { error: claimError } = await admin.from('invoice_reminders').insert({
      invoice_id: invoice.id,
      reminder_date: today,
      reminder_type: 'overdue',
    })
    if (claimError?.code === '23505') {
      skipped += 1
      continue
    }
    if (claimError) {
      console.error(`Unable to claim reminder for invoice ${invoice.id}:`, claimError.message)
      return jsonResponse({ error: 'Impossible de réserver une relance sans doublon.', sent, skipped }, 500)
    }

    const currency = invoice.currency === 'EUR' ? 'EUR' : invoice.currency === 'USD' ? 'USD' : 'FCFA'
    const formattedBalance = `${balance.toLocaleString('fr-FR')} ${currency}`
    const invoiceNumber = escapeHtml(invoice.invoice_number)
    const businessName = escapeHtml(business?.name ?? 'Votre entreprise')
    const clientName = escapeHtml(client.name ?? '')
    const html = `<div style="font-family:Arial,sans-serif;color:#192b45"><p>Bonjour ${clientName},</p><p>${businessName} vous rappelle que la facture <strong>${invoiceNumber}</strong>, arrivée à échéance le ${escapeHtml(invoice.due_date)}, présente un solde restant de <strong>${escapeHtml(formattedBalance)}</strong>.</p><p>Merci de procéder au règlement ou de contacter votre fournisseur si le paiement a déjà été effectué.</p><p>${businessName}</p></div>`
    let providerMessageId: string | null = null
    let response: Response
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: emailFrom,
          to: [client.email],
          subject: `Rappel de paiement — facture ${invoice.invoice_number}`,
          html,
        }),
      })
    } catch (cause) {
      console.error(`Email delivery status is uncertain for invoice ${invoice.id}:`, cause)
      return jsonResponse({
        error: 'État de l’envoi incertain; la réservation du jour est conservée pour éviter un doublon.',
        processed: eligibleInvoices.length,
        sent,
        failed,
        skipped,
        trackingFailed,
      }, 502)
    }

    if (response.ok) {
      const providerResult = await response.json() as { id?: string }
      providerMessageId = providerResult.id ?? null
      sent += 1
    } else {
      const { error: releaseError } = await admin.from('invoice_reminders')
        .delete()
        .eq('invoice_id', invoice.id)
        .eq('reminder_date', today)
        .eq('reminder_type', 'overdue')
      if (releaseError) {
        console.error(`Email failed and retry claim could not be released for invoice ${invoice.id}:`, releaseError.message)
        failed += 1
        return jsonResponse({
          error: 'Le fournisseur a refusé un e-mail et la réservation de relance n’a pas pu être libérée.',
          processed: eligibleInvoices.length,
          sent,
          failed,
          skipped,
          trackingFailed,
        }, 502)
      }
      failed += 1
      const { error: logError } = await admin.from('invoice_communications').insert({
        invoice_id: invoice.id,
        event_type: 'overdue_reminder',
        status: 'failed',
        recipient: client.email,
      })
      if (logError) {
        trackingFailed += 1
        console.error(`Unable to log failed reminder for invoice ${invoice.id}:`, logError.message)
        return jsonResponse({
          error: 'Impossible d’enregistrer l’échec de la relance.',
          processed: eligibleInvoices.length,
          sent,
          failed,
          skipped,
          trackingFailed,
        }, 500)
      }
      console.error(`Email provider rejected reminder for invoice ${invoice.id}:`, await response.text())
      skipped += 1
      continue
    }

    const { error: logError } = await admin.from('invoice_communications').insert({
      invoice_id: invoice.id,
      event_type: 'overdue_reminder',
      status: 'accepted',
      recipient: client.email,
      provider_message_id: providerMessageId,
    })
    if (logError) {
      trackingFailed += 1
      console.error(`Reminder was accepted but could not be logged for invoice ${invoice.id}:`, logError.message)
      return jsonResponse({
        error: 'Un e-mail a été accepté mais son historique n’a pas pu être enregistré.',
        processed: eligibleInvoices.length,
        sent,
        failed,
        skipped,
        trackingFailed,
      }, 500)
    }
  }

  return jsonResponse({ processed: eligibleInvoices.length, sent, failed, skipped, trackingFailed, date: today })
})
