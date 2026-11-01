import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const kkiapayPublicKey = Deno.env.get('KKIAPAY_PUBLIC_KEY')?.trim()
const sandbox = Deno.env.get('KKIAPAY_SANDBOX')?.trim().toLowerCase() === 'true'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const prices = { starter: 5000, pro: 15000 } as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)
  if (!supabaseUrl || !serviceRoleKey || !kkiapayPublicKey) {
    return jsonResponse({ error: 'Configuration Supabase ou KKiaPay incomplète.' }, 503)
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization) return jsonResponse({ error: 'Non autorisé.' }, 401)

  const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'Session invalide.' }, 401)

  let body: Record<string, unknown>
  try {
    const payload: unknown = await request.json()
    if (!isRecord(payload)) return jsonResponse({ error: 'La demande de paiement est invalide.' }, 400)
    body = payload
  } catch {
    return jsonResponse({ error: 'La demande de paiement est invalide.' }, 400)
  }
  const businessId = typeof body.businessId === 'string' ? body.businessId : ''
  const plan = body.plan
  if (!businessId || (plan !== 'starter' && plan !== 'pro')) return jsonResponse({ error: 'Plan invalide.' }, 400)

  const { data: owner, error: ownerError } = await userClient.rpc('is_business_owner', { p_business_id: businessId })
  if (ownerError) return jsonResponse({ error: ownerError.message }, 500)
  if (!owner) return jsonResponse({ error: 'Seul le propriétaire peut payer un abonnement.' }, 403)

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const expirationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { error: expirationError } = await admin.from('subscription_payments')
    .update({ status: 'failed' })
    .eq('business_id', businessId)
    .eq('plan', plan)
    .eq('provider', 'kkiapay')
    .eq('status', 'pending')
    .lt('created_at', expirationCutoff)
  if (expirationError) return jsonResponse({ error: expirationError.message }, 500)

  const { data: business, error: businessError } = await admin.from('businesses')
    .select('name, email, phone')
    .eq('id', businessId)
    .single()
  if (businessError || !business) return jsonResponse({ error: 'Entreprise introuvable.' }, 404)

  const { data: pendingPayment, error: pendingError } = await admin.from('subscription_payments')
    .select('id, amount')
    .eq('business_id', businessId)
    .eq('plan', plan)
    .eq('provider', 'kkiapay')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (pendingError) return jsonResponse({ error: pendingError.message }, 500)

  let paymentId: string
  let amount: number
  if (pendingPayment) {
    paymentId = pendingPayment.id
    amount = Number(pendingPayment.amount)
  } else {
    const { data: payment, error: paymentError } = await admin.from('subscription_payments')
      .insert({ business_id: businessId, plan, amount: prices[plan], provider: 'kkiapay' })
      .select('id, amount')
      .single()
    if (paymentError?.code === '23505') {
      const { data: existingPayment, error: existingError } = await admin.from('subscription_payments')
        .select('id, amount')
        .eq('business_id', businessId)
        .eq('plan', plan)
        .eq('provider', 'kkiapay')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existingError) return jsonResponse({ error: existingError.message }, 500)
      if (!existingPayment) return jsonResponse({ error: paymentError.message }, 500)
      paymentId = existingPayment.id
      amount = Number(existingPayment.amount)
    } else if (paymentError || !payment) {
      return jsonResponse({ error: paymentError?.message ?? 'Impossible de préparer le paiement.' }, 500)
    } else {
      paymentId = payment.id
      amount = Number(payment.amount)
    }
  }

  return jsonResponse({
    paymentId,
    amount,
    publicKey: kkiapayPublicKey,
    sandbox,
    email: business.email ?? userData.user.email ?? undefined,
    name: business.name ?? String(userData.user.user_metadata?.full_name ?? ''),
  })
})
