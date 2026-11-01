import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyKkiapayTransaction } from '../_shared/kkiapay.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Configuration Supabase incomplète.' }, 503)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return jsonResponse({ error: 'Non autorisé.' }, 401)

  const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'Session invalide.' }, 401)

  let body: Record<string, unknown>
  try {
    const payload: unknown = await request.json()
    if (!isRecord(payload)) return jsonResponse({ error: 'Les références du paiement sont invalides.' }, 400)
    body = payload
  } catch {
    return jsonResponse({ error: 'Les références du paiement sont invalides.' }, 400)
  }
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId : ''
  const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : ''
  if (!paymentId || !transactionId) return jsonResponse({ error: 'Références de paiement manquantes.' }, 400)

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: payment, error: paymentError } = await admin.from('subscription_payments')
    .select('id, business_id, plan, amount, status, provider, provider_token, created_at')
    .eq('id', paymentId)
    .maybeSingle()
  if (paymentError) return jsonResponse({ error: paymentError.message }, 500)
  if (!payment) return jsonResponse({ error: 'Paiement introuvable.' }, 404)

  const { data: owner, error: ownerError } = await userClient.rpc('is_business_owner', { p_business_id: payment.business_id })
  if (ownerError) return jsonResponse({ error: ownerError.message }, 500)
  if (!owner) return jsonResponse({ error: 'Seul le propriétaire peut confirmer le paiement.' }, 403)

  if (payment.provider !== 'kkiapay') return jsonResponse({ error: 'Ce paiement ne provient pas de KKiaPay.' }, 409)
  if (payment.status === 'completed' && payment.provider_token === transactionId) {
    return jsonResponse({ status: 'completed' })
  }
  if (payment.status !== 'pending') return jsonResponse({ error: 'Ce paiement n’est plus en attente.' }, 409)
  if (new Date(payment.created_at).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return jsonResponse({ error: 'Cette tentative de paiement a expiré. Relancez le paiement.' }, 410)
  }

  let transaction
  try {
    transaction = await verifyKkiapayTransaction(transactionId)
  } catch (error) {
    console.error('Échec de vérification de la transaction KKiaPay.', error)
    return jsonResponse({ error: 'Impossible de vérifier la transaction auprès de KKiaPay. Réessayez dans quelques instants.' }, 502)
  }

  if (
    transaction.status !== 'SUCCESS' ||
    transaction.type !== 'DEBIT' ||
    transaction.amount !== Number(payment.amount) ||
    transaction.partnerId !== payment.id
  ) {
    return jsonResponse({ error: 'La transaction KKiaPay ne correspond pas au paiement attendu.' }, 409)
  }

  const { error: completionError } = await admin.rpc('complete_kkiapay_subscription_payment', {
    p_payment_id: payment.id,
    p_transaction_id: transaction.transactionId,
    p_confirmed_amount: transaction.amount,
    p_confirmation_data: {
      source: transaction.source,
      performed_at: transaction.performedAt,
      partner_id: transaction.partnerId,
    },
  })
  if (completionError) return jsonResponse({ error: completionError.message }, 409)

  return jsonResponse({ status: 'completed' })
})
