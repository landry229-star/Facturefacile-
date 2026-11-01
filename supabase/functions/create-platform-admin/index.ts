import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const appUrl = Deno.env.get('APP_URL')?.replace(/\/+$/, '')

if (!supabaseUrl || !serviceRoleKey) throw new Error('Configuration Supabase incomplète.')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const roles = ['super_admin', 'admin', 'support', 'finance', 'analyst'] as const
const modes = ['invite', 'auto_confirm'] as const

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405, headers: corsHeaders })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response('Non autorisé.', { status: 401, headers: corsHeaders })

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const actorClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } })
  const { data: actorData, error: actorError } = await actorClient.auth.getUser()
  if (actorError || !actorData.user) return new Response('Session invalide.', { status: 401, headers: corsHeaders })

  const { data: actorRole, error: roleError } = await admin.from('platform_admins').select('role').eq('user_id', actorData.user.id).maybeSingle()
  if (roleError) return new Response(roleError.message, { status: 500, headers: corsHeaders })
  if (actorRole?.role !== 'super_admin') return new Response('Accès super administrateur requis.', { status: 403, headers: corsHeaders })

  const body = await request.json() as { email?: string; fullName?: string; role?: string; mode?: string; password?: string }
  const email = body.email?.trim().toLowerCase()
  if (!email || !body.fullName?.trim() || !roles.includes(body.role as typeof roles[number]) || !modes.includes(body.mode as typeof modes[number])) {
    return new Response('Les informations du compte sont incomplètes.', { status: 400, headers: corsHeaders })
  }
  if (body.mode === 'auto_confirm' && (!body.password || body.password.length < 8)) {
    return new Response('Le mot de passe temporaire doit contenir au moins 8 caractères.', { status: 400, headers: corsHeaders })
  }

  const createResult = body.mode === 'invite'
    ? await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: body.fullName.trim() }, redirectTo: appUrl ? `${appUrl}/` : undefined })
    : await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { full_name: body.fullName.trim() } })
  if (createResult.error || !createResult.data.user) {
    return new Response(createResult.error?.message ?? 'Le compte n’a pas pu être créé.', { status: 400, headers: corsHeaders })
  }

  const { error: insertError } = await admin.from('platform_admins').insert({ user_id: createResult.data.user.id, role: body.role })
  if (insertError) {
    await admin.auth.admin.deleteUser(createResult.data.user.id)
    return new Response(insertError.message, { status: 400, headers: corsHeaders })
  }

  await admin.from('platform_audit_logs').insert({
    actor_id: actorData.user.id,
    action: 'create_platform_admin',
    resource_type: 'platform_admin',
    resource_id: createResult.data.user.id,
    result: 'success',
    context: { email, role: body.role, mode: body.mode },
  })

  return new Response(JSON.stringify({ userId: createResult.data.user.id, mode: body.mode }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
