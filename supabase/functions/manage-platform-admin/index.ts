import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !serviceRoleKey) throw new Error('Configuration Supabase incomplète.')
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405, headers: corsHeaders })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response('Non autorisé.', { status: 401, headers: corsHeaders })
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const actorClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } })
  const { data: actorData, error: actorError } = await actorClient.auth.getUser()
  if (actorError || !actorData.user) return new Response('Session invalide.', { status: 401, headers: corsHeaders })
  const { data: actor } = await admin.from('platform_admins').select('role').eq('user_id', actorData.user.id).maybeSingle()
  if (actor?.role !== 'super_admin') return new Response('Accès super administrateur requis.', { status: 403, headers: corsHeaders })
  const body = await request.json() as { userId?: string; action?: string }
  if (!body.userId || !['suspend', 'deactivate', 'delete'].includes(body.action ?? '')) return new Response('Action invalide.', { status: 400, headers: corsHeaders })
  if (body.userId === actorData.user.id) return new Response('Vous ne pouvez pas désactiver ou supprimer votre propre compte.', { status: 400, headers: corsHeaders })
  const action = body.action as 'suspend' | 'deactivate' | 'delete'
  const target = await admin.from('platform_admins').select('role').eq('user_id', body.userId).maybeSingle()
  if (target.error || !target.data) return new Response('Administrateur introuvable.', { status: 404, headers: corsHeaders })
  if (action === 'delete') {
    const deleted = await admin.auth.admin.deleteUser(body.userId)
    if (deleted.error) return new Response(deleted.error.message, { status: 400, headers: corsHeaders })
  } else {
    const updated = await admin.auth.admin.updateUserById(body.userId, { ban_duration: action === 'suspend' ? '24h' : '876000h' })
    if (updated.error) return new Response(updated.error.message, { status: 400, headers: corsHeaders })
    const status = action === 'suspend' ? 'suspended' : 'disabled'
    const saved = await admin.from('platform_admins').update({ status }).eq('user_id', body.userId)
    if (saved.error) return new Response(saved.error.message, { status: 400, headers: corsHeaders })
  }
  await admin.from('platform_audit_logs').insert({ actor_id: actorData.user.id, action: `${action}_platform_admin`, resource_type: 'platform_admin', resource_id: body.userId, result: 'success', context: { target_role: target.data.role } })
  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
