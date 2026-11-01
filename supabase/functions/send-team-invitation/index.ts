import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const resendApiKey = Deno.env.get('RESEND_API_KEY')
const emailFrom = Deno.env.get('EMAIL_FROM')
const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Méthode non autorisée.', { status: 405, headers: corsHeaders })
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) return new Response(JSON.stringify({ error: 'Configuration email incomplète.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response('Non autorisé.', { status: 401, headers: corsHeaders })
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authorization } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return new Response('Session invalide.', { status: 401, headers: corsHeaders })
  const body = await request.json() as { invitationId?: string }
  if (!body.invitationId) return new Response('Invitation invalide.', { status: 400, headers: corsHeaders })
  const { data: invitation, error: invitationError } = await admin.from('business_invitations').select('id, business_id, email, role, token, expires_at, validated_at, accepted_at, businesses(name)').eq('id', body.invitationId).single()
  if (invitationError || !invitation) return new Response('Invitation introuvable.', { status: 404, headers: corsHeaders })
  const { data: role, error: roleError } = await userClient.rpc('get_business_role', { p_business_id: invitation.business_id })
  if (roleError || !['owner', 'admin'].includes(role)) return new Response('Accès refusé.', { status: 403, headers: corsHeaders })
  const { data: subscription, error: subscriptionError } = await admin.from('business_subscriptions')
    .select('plan, status, expires_at')
    .eq('business_id', invitation.business_id)
    .maybeSingle()
  if (subscriptionError) return new Response('Impossible de vérifier l’abonnement de l’entreprise.', { status: 500, headers: corsHeaders })
  const expiresAt = subscription?.expires_at ? Date.parse(subscription.expires_at) : null
  if (
    !subscription ||
    !['pro', 'business'].includes(subscription.plan) ||
    !['active', 'trialing'].includes(subscription.status) ||
    (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now()))
  ) {
    return new Response('La gestion de l’équipe nécessite un abonnement Pro ou Business actif.', { status: 403, headers: corsHeaders })
  }
  if (invitation.accepted_at || new Date(invitation.expires_at) <= new Date()) return new Response('Invitation expirée ou déjà activée.', { status: 400, headers: corsHeaders })
  const business = Array.isArray(invitation.businesses) ? invitation.businesses[0] : invitation.businesses
  const link = `${appUrl.replace(/\/$/, '')}/?invitation=${encodeURIComponent(invitation.token)}`
  const html = `<div style="font-family:Arial;color:#192b45"><h1 style="color:#2475e8">Invitation FactureFacile</h1><p>${escapeHtml(business?.name ?? 'Une entreprise')} vous invite à rejoindre son espace.</p><p>Votre rôle : <strong>${escapeHtml(invitation.role)}</strong></p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;background:#2475e8;color:#fff;text-decoration:none;border-radius:6px">Activer mon accès</a></p><p>Ce lien expire le ${escapeHtml(invitation.expires_at)}.</p></div>`
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: emailFrom, to: [invitation.email], subject: `Invitation à rejoindre ${business?.name ?? 'FactureFacile'}`, html }) })
  if (!response.ok) return new Response('Le fournisseur email a refusé l’envoi.', { status: 502, headers: corsHeaders })
  const marked = await admin.from('business_invitations').update({ validated_at: invitation.validated_at ?? new Date().toISOString(), sent_at: new Date().toISOString() }).eq('id', invitation.id)
  if (marked.error) return new Response('Invitation envoyée mais son statut n’a pas pu être mis à jour.', { status: 500, headers: corsHeaders })
  return new Response(JSON.stringify({ sent: true, recipient: invitation.email }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
