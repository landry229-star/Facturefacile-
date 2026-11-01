export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'business'
export type SubscriptionFeature = 'stock' | 'recurringInvoices' | 'reports' | 'team' | 'audit' | 'exports' | 'advancedDashboard' | 'advancedInvoiceTypes'

const featurePlans: Record<SubscriptionFeature, SubscriptionPlan[]> = {
  stock: ['starter', 'pro', 'business'],
  recurringInvoices: ['starter', 'pro', 'business'],
  reports: ['starter', 'pro', 'business'],
  team: ['pro', 'business'],
  audit: ['pro', 'business'],
  exports: ['starter', 'pro', 'business'],
  advancedDashboard: ['pro', 'business'],
  advancedInvoiceTypes: ['starter', 'pro', 'business'],
}

export const subscriptionPlanLabels: Record<SubscriptionPlan, string> = {
  free: 'Gratuit',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
}

export const subscriptionLimits: Record<SubscriptionPlan, { invoices: number; clients: number; members: number }> = {
  free: { invoices: 20, clients: 50, members: 1 },
  starter: { invoices: 100, clients: 250, members: 1 },
  pro: { invoices: 500, clients: 1000, members: 5 },
  business: { invoices: 2000, clients: 10000, members: 25 },
}

export const subscriptionPlanFeatures: Record<SubscriptionPlan, string[]> = {
  free: ['20 factures / mois', '50 clients', '1 utilisateur', 'Factures standard'],
  starter: ['100 factures / mois', '250 clients', '1 utilisateur', 'Factures avancées', 'Factures récurrentes', 'Stock', 'Exports', 'Rapports'],
  pro: ['500 factures / mois', '1 000 clients', '5 utilisateurs', 'Toutes les factures avancées', 'Tableau de bord avancé', 'Équipe', 'Audit', 'Exports', 'Rapports'],
  business: ['2 000 factures / mois', '10 000 clients', '25 utilisateurs', 'Toutes les fonctionnalités Pro', 'Support prioritaire'],
}

export function hasSubscriptionFeature(plan: SubscriptionPlan, feature: SubscriptionFeature) {
  return featurePlans[feature].includes(plan)
}

const getDemoOwnerEmails = () => {
  const rawValue: string = (import.meta.env.VITE_OWNER_DEMO_EMAILS ?? import.meta.env.VITE_OWNER_DEMO_EMAIL ?? '').trim()
  return rawValue
    ? rawValue.split(',').map((email: string) => email.trim().toLowerCase()).filter((email): email is string => Boolean(email))
    : []
}

export function isDemoOwnerOverride(email?: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return false
  return getDemoOwnerEmails().includes(normalizedEmail)
}

export function hasFeatureForUser(plan: SubscriptionPlan, feature: SubscriptionFeature, email?: string | null | undefined) {
  return isDemoOwnerOverride(email) || hasSubscriptionFeature(plan, feature)
}

export function resolveEffectiveSubscriptionState(
  subscription: { plan?: string | null; status?: string | null; expires_at?: string | null } | null,
  now = new Date(),
) {
  const rawPlan = (subscription?.plan ?? 'free') as string | null
  const normalizedPlan = rawPlan && ['free', 'starter', 'pro', 'business'].includes(rawPlan) ? (rawPlan as SubscriptionPlan) : 'free'
  const status = String(subscription?.status ?? 'active')
  const expiresAt = subscription?.expires_at ?? null
  const expiryTime = expiresAt ? Date.parse(expiresAt) : null
  const expired = expiryTime !== null && (!Number.isFinite(expiryTime) || expiryTime <= now.getTime())
  const isActive = ['active', 'trialing'].includes(status) && !expired
  const effectivePlan = isActive ? normalizedPlan : 'free'

  return {
    plan: effectivePlan,
    status: expired ? 'expired' : isActive ? status : 'inactive',
    isActive,
    isPaid: normalizedPlan !== 'free' && isActive,
    expiresAt,
  }
}
