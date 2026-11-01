import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!url || !serviceKey) return new Response('Configuration Supabase incomplète.', { status: 503, headers: cors })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response('Non autorisé.', { status: 401, headers: cors })
  const admin = createClient(url, serviceKey)
  const userClient = createClient(url, serviceKey, { global: { headers: { Authorization: authorization } } })
  const { data: current, error: currentError } = await userClient.auth.getUser()
  if (currentError || !current.user) return new Response('Session invalide.', { status: 401, headers: cors })
  const body = await request.json() as { businessId?: string; firstName?: string; lastName?: string; email?: string; password?: string; role?: string }
  const firstName = body.firstName?.trim() ?? ''
  const lastName = body.lastName?.trim() ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  if (!body.businessId || !firstName || !lastName || !email || !body.password || !['admin', 'member', 'viewer'].includes(body.role ?? '') || body.password.length < 8) return new Response(JSON.stringify({ error: 'Renseignez tous les champs et utilisez un mot de passe de 8 caractères minimum.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  const { data: businessRole, error: roleError } = await userClient.rpc('get_business_role', { p_business_id: body.businessId })
  if (roleError) return new Response(JSON.stringify({ error: roleError.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (!['owner', 'admin'].includes(businessRole)) return new Response(JSON.stringify({ error: 'Accès refusé.' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
  const { data: subscription, error: subscriptionError } = await admin.from('business_subscriptions')
    .select('plan, status, expires_at')
    .eq('business_id', body.businessId)
    .maybeSingle()
  if (subscriptionError) return new Response(JSON.stringify({ error: subscriptionError.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  const expiresAt = subscription?.expires_at ? Date.parse(subscription.expires_at) : null
  if (
    !subscription ||
    !['pro', 'business'].includes(subscription.plan) ||
    !['active', 'trialing'].includes(subscription.status) ||
    (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now()))
  ) {
    return new Response(JSON.stringify({ error: 'La gestion de l’équipe nécessite un abonnement Pro ou Business actif.' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  const created = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { full_name: `${firstName} ${lastName}` } })
  const createdUser = created.data.user
  if (created.error || !createdUser) return new Response(JSON.stringify({ error: created.error?.message ?? 'Impossible de créer le compte.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  const invitation = await admin.from('business_invitations').insert({ business_id: body.businessId, email, full_name: `${firstName} ${lastName}`, role: body.role, invited_user_id: createdUser.id }).select('id, token').single()
  if (invitation.error) {
    await admin.auth.admin.deleteUser(createdUser.id)
    return new Response(JSON.stringify({ error: invitation.error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  return new Response(JSON.stringify({ invitationId: invitation.data.id, token: invitation.data.token, email, fullName: `${firstName} ${lastName}` }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
