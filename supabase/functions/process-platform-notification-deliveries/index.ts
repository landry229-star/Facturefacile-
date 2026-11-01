import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const emailFrom = Deno.env.get('EMAIL_FROM')
const cronSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET')
const maxAttempts = 5

if (!supabaseUrl || !serviceRoleKey) throw new Error('Configuration Supabase absente.')

const admin = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405 })
  if (!cronSecret || request.headers.get('x-notification-worker-secret') !== cronSecret) return new Response('Non autorisé.', { status: 401 })
  const { data: deliveries, error: claimError } = await admin
    .from('platform_notification_deliveries')
    .select('id, notification_id, user_id, channel, attempts')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at')
    .limit(25)

  if (claimError) return new Response(claimError.message, { status: 500 })
  let processed = 0
  for (const delivery of deliveries ?? []) {
    const { data: claimed, error: claimRowError } = await admin
      .from('platform_notification_deliveries')
      .update({ status: 'processing', attempts: delivery.attempts + 1 })
      .eq('id', delivery.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle()
    if (claimRowError) throw claimRowError
    if (!claimed) continue

    const { data: notification, error: notificationError } = await admin
      .from('platform_notifications')
      .select('title, message, severity')
      .eq('id', delivery.notification_id)
      .single()
    if (notificationError) throw notificationError

    let failure = ''
    if (delivery.channel !== 'email') {
      failure = `Canal ${delivery.channel} non configuré.`
    } else if (!resendApiKey || !emailFrom) {
      failure = 'RESEND_API_KEY ou EMAIL_FROM absent.'
    } else {
      const user = await admin.auth.admin.getUserById(delivery.user_id)
      if (user.error || !user.data.user.email) {
        failure = 'Adresse e-mail du destinataire introuvable.'
      } else {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: emailFrom, to: [user.data.user.email], subject: notification.title, text: notification.message }),
        })
        if (!response.ok) failure = `Fournisseur e-mail: HTTP ${response.status}.`
      }
    }

    if (!failure) {
      const { error } = await admin.from('platform_notification_deliveries').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', delivery.id)
      if (error) throw error
    } else {
      const attempts = delivery.attempts + 1
      const terminal = attempts >= maxAttempts
      const { error } = await admin.from('platform_notification_deliveries').update({
        status: terminal ? 'failed' : 'pending',
        next_attempt_at: new Date(Date.now() + Math.min(60 * 60 * 1000, 2 ** attempts * 60 * 1000)).toISOString(),
        last_error: failure,
      }).eq('id', delivery.id)
      if (error) throw error
    }
    processed += 1
  }
  return Response.json({ processed })
})
