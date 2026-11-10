import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const emailFrom = Deno.env.get('EMAIL_FROM')
const appUrl = Deno.env.get('APP_URL')
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405, headers: corsHeaders })
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom || !appUrl) {
    return new Response(JSON.stringify({ error: 'Configuration email incomplète. Configurez RESEND_API_KEY, EMAIL_FROM et APP_URL dans les secrets Supabase.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response('Non autorisé.', { status: 401, headers: corsHeaders })
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return new Response('Session invalide.', { status: 401, headers: corsHeaders })

  let body: { businessId?: string; quoteId?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Requête invalide.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  if (!body.businessId || !body.quoteId) return new Response(JSON.stringify({ error: 'Devis invalide.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const { data: role, error: roleError } = await userClient.rpc('get_business_role', { p_business_id: body.businessId })
  if (roleError || !['owner', 'admin', 'member'].includes(role)) return new Response('Accès refusé.', { status: 403, headers: corsHeaders })

  const { data: quote, error: quoteError } = await admin.from('quotes')
    .select('id, business_id, quote_number, issue_date, valid_until, subtotal, discount, tax, total, status, currency, businesses(name), clients(name, email), quote_items(description, quantity, unit_price, total)')
    .eq('id', body.quoteId)
    .eq('business_id', body.businessId)
    .single()
  if (quoteError || !quote) return new Response(JSON.stringify({ error: 'Devis introuvable.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  if (!['DRAFT', 'SENT'].includes(quote.status) || quote.valid_until < new Date().toISOString().slice(0, 10)) {
    return new Response(JSON.stringify({ error: 'Seul un devis ouvert et non expiré peut être envoyé.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const client = Array.isArray(quote.clients) ? quote.clients[0] : quote.clients
  const business = Array.isArray(quote.businesses) ? quote.businesses[0] : quote.businesses
  if (!client?.email) return new Response(JSON.stringify({ error: 'Ce client n’a pas d’adresse e-mail renseignée.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  let publicUrl: URL
  try {
    publicUrl = new URL(appUrl)
    if (publicUrl.protocol !== 'https:' && publicUrl.hostname !== 'localhost') throw new Error('URL non sécurisée.')
  } catch {
    return new Response(JSON.stringify({ error: 'APP_URL doit contenir l’adresse HTTPS de l’application.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
  const token = Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  const { error: shareError } = await userClient.rpc('create_quote_share_link', {
    p_business_id: body.businessId,
    p_quote_id: body.quoteId,
    p_token: token,
  })
  if (shareError) return new Response(JSON.stringify({ error: shareError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  publicUrl.pathname = `/devis/${token}`
  publicUrl.search = ''
  publicUrl.hash = ''
  const currency = quote.currency === 'EUR' || quote.currency === 'USD' ? quote.currency : 'FCFA'
  const amount = (value: number) => `${Number(value).toLocaleString('fr-FR')} ${currency}`
  const items = Array.isArray(quote.quote_items) ? quote.quote_items : []
  const rows = items.map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.description)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${Number(item.quantity).toLocaleString('fr-FR')}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${escapeHtml(amount(Number(item.total)))}</td></tr>`).join('')
  const quoteLink = escapeHtml(publicUrl.toString())
  const html = `<div style="font-family:Arial,sans-serif;color:#192b45;max-width:680px;margin:auto"><h1 style="color:#2475e8">Devis ${escapeHtml(quote.quote_number)}</h1><p>${escapeHtml(business?.name ?? 'Votre entreprise')} vous adresse une proposition commerciale.</p><p>Bonjour ${escapeHtml(client.name)},</p><p>Ce devis est valable jusqu’au ${escapeHtml(quote.valid_until)}.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Désignation</th><th style="text-align:left;padding:8px">Quantité</th><th style="text-align:right;padding:8px">Montant</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:right">Sous-total : ${escapeHtml(amount(Number(quote.subtotal)))}</p>${Number(quote.discount) ? `<p style="text-align:right">Remise : − ${escapeHtml(amount(Number(quote.discount)))}</p>` : ''}<p style="text-align:right">Taxes : ${escapeHtml(amount(Number(quote.tax)))}</p><p style="text-align:right;font-size:18px"><strong>Total proposé : ${escapeHtml(amount(Number(quote.total)))}</strong></p><p style="text-align:center;margin:28px 0"><a href="${quoteLink}" style="display:inline-block;padding:13px 20px;background:#2475e8;color:#fff;text-decoration:none;border-radius:7px">Consulter et répondre au devis</a></p><p>Vous pouvez accepter ou refuser la proposition depuis ce lien sécurisé.</p></div>`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: emailFrom,
      to: [client.email],
      subject: `Devis ${quote.quote_number} — ${business?.name ?? 'FactureFacile'}`,
      html,
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    return new Response(JSON.stringify({ error: `Le fournisseur e-mail a refusé l’envoi${detail ? ` : ${detail}` : '.'}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  return new Response(JSON.stringify({ sent: true, recipient: client.email, quoteUrl: publicUrl.toString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
