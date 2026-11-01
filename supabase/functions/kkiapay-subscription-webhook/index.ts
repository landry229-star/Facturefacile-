import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyKkiapayTransaction } from '../_shared/kkiapay.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const webhookSecret = Deno.env.get('KKIAPAY_WEBHOOK_SECRET')?.trim()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-kkiapay-secret',
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

function validSecret(received: string | null, expected: string) {
  if (!received || received.length !== expected.length) return false
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= received.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return mismatch === 0
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405)
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return jsonResponse({ error: 'Configuration webhook KKiaPay incomplète.' }, 503)
  }
  if (!validSecret(request.headers.get('x-kkiapay-secret'), webhookSecret)) {
    return jsonResponse({ error: 'Signature KKiaPay invalide.' }, 401)
  }

  let event: Record<string, unknown>
  try {
    const payload: unknown = await request.json()
    if (!isRecord(payload)) return jsonResponse({ error: 'Événement KKiaPay invalide.' }, 400)
    event = payload
  } catch {
    return jsonResponse({ error: 'Événement KKiaPay invalide.' }, 400)
  }
  const partnerId = typeof event.partnerId === 'string' ? event.partnerId : ''
  const transactionId = typeof event.transactionId === 'string' ? event.transactionId.trim() : ''
  const eventName = typeof event.event === 'string' ? event.event : ''
  const paymentSucceeded = event.isPaymentSucces === true
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(partnerId)) {
    return jsonResponse({ error: 'Référence de paiement invalide.' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: payment, error: paymentError } = await admin.from('subscription_payments')
    .select('id, amount, status, provider, created_at')
    .eq('id', partnerId)
    .maybeSingle()
  if (paymentError) return jsonResponse({ error: paymentError.message }, 500)
  if (!payment || payment.provider !== 'kkiapay') return jsonResponse({ error: 'Paiement KKiaPay introuvable.' }, 404)
  if (!paymentSucceeded || eventName === 'transaction.failed') {
    if (payment.status === 'pending') {
      const { error: updateError } = await admin.from('subscription_payments')
        .update({ status: 'failed' })
        .eq('id', payment.id)
        .eq('status', 'pending')
      if (updateError) return jsonResponse({ error: updateError.message }, 500)
    }
    return jsonResponse({ received: true })
  }
  if (!transactionId) return jsonResponse({ error: 'Identifiant de transaction manquant.' }, 400)
  if (payment.status === 'completed') return jsonResponse({ received: true })
  if (payment.status !== 'pending') return jsonResponse({ received: true })
  if (new Date(payment.created_at).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    const { error: expirationError } = await admin.from('subscription_payments')
      .update({ status: 'failed' })
      .eq('id', payment.id)
      .eq('status', 'pending')
    if (expirationError) return jsonResponse({ error: expirationError.message }, 500)
    return jsonResponse({ received: true })
  }

  let transaction
  try {
    transaction = await verifyKkiapayTransaction(transactionId)
  } catch (error) {
    console.error('Échec de vérification du webhook KKiaPay.', error)
    return jsonResponse({ error: 'Transaction KKiaPay non vérifiée.' }, 502)
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
      webhook_event: eventName || null,
    },
  })
  if (completionError) return jsonResponse({ error: completionError.message }, 409)
  return jsonResponse({ received: true })
})
