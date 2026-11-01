import { supabase } from './supabase'
import { getMonthToDateComparisonPeriods } from './dashboardMetrics'
import { formatBusinessDateKey, getBusinessDateKey } from './businessPreferences'
import { validateBusinessLogoFile, validateProfilePhotoFile } from './logoValidation'

export type DashboardInvoice = {
  number: string
  customer: string
  date: string
  amount: string
  currency: string
  status: 'Payée' | 'En attente' | 'En retard' | 'Annulée'
  initials: string
  tone: string
}
export type InvoiceDetail = {
  id: string
  invoice_number: string
  client_id: string
  issue_date: string
  due_date: string | null
  subtotal: number
  discount: number
  tax: number
  total: number
  currency: string
  status: string
  invoice_type: InvoiceDocumentType
  clients: { name: string; email: string | null; phone: string | null } | { name: string; email: string | null; phone: string | null }[] | null
  invoice_items: { description: string; quantity: number; unit_price: number; total: number }[]
  payments: { amount: number; payment_date: string; method: string; reference: string | null }[]
}
export type InvoiceDocumentType = 'STANDARD' | 'PROFORMA' | 'DEPOSIT' | 'CREDIT_NOTE' | 'FINAL'

export const invoiceDocumentTypeLabels: Record<InvoiceDocumentType, string> = {
  STANDARD: 'Facture standard',
  PROFORMA: 'Facture proforma',
  DEPOSIT: "Facture d'acompte",
  CREDIT_NOTE: "Facture d'avoir",
  FINAL: 'Facture définitive',
}
export type ClientInvoiceHistoryItem = {
  invoice_number: string
  issue_date: string
  due_date: string | null
  total: number
  paid: number
  remaining: number
  status: string
}
export type ClientHistory = {
  client: ClientRecord
  totalInvoiced: number
  totalPaid: number
  totalRemaining: number
  invoices: ClientInvoiceHistoryItem[]
  payments: { invoice_number: string; payment_date: string; amount: number; method: string; reference: string | null }[]
}

export type ClientSegment = 'VIP' | 'À surveiller' | 'Standard'

export function getClientSegment(totalInvoiced: number, totalRemaining: number): ClientSegment {
  if (totalRemaining > 0) return 'À surveiller'
  if (totalInvoiced >= 1_000_000) return 'VIP'
  return 'Standard'
}

export type ClientOption = { id: string; name: string }
export type ProductOption = { id: string; name: string; price: number; unit?: string; product_type?: 'product' | 'service'; stock_quantity?: number }
export type ClientRecord = ClientOption & {
  email: string | null
  phone: string | null
  address: string | null
  client_type: 'individual' | 'company'
  notes: string | null
  status: 'active' | 'archived'
  tax_id?: string | null
  archived_at?: string | null
  created_at?: string | null
}
export type ProductRecord = ProductOption & {
  product_type: string
  description: string | null
  unit: string
  purchase_price: number
  stock_quantity: number
  low_stock_threshold: number
  reference: string | null
  category: string
  sub_category: string | null
  active: boolean
  image_url: string | null
}
export type PaymentInvoiceOption = { id: string; number: string; total: number; paid: number; remaining: number }
export type FinancialSummary = {
  revenue: number
  expenses: number
  profit: number
  invoiceCount: number
  outstanding: number
  clientCount: number
  paidCount: number
  overdueCount: number
  periodLabel: string
  previousPeriodLabel: string
  previousRevenue: number
  previousExpenses: number
  previousProfit: number
  previousInvoiceCount: number
}
export type DashboardAnalytics = {
  topClients: { name: string; amount: number }[]
  topProducts: { name: string; amount: number; quantity: number }[]
  monthlySales: { month: string; amount: number }[]
  statusBreakdown: { status: string; count: number; amount: number }[]
  overdue: { invoice: string; client: string; remaining: number; dueDate: string }[]
}
export type RecurringInvoiceOption = { id: string; client_id: string; product_id: string; frequency: string; next_issue_date: string; due_days: number; active: boolean }
export type RecurringInvoiceRow = {
  id: string
  clientId: string
  productId: string
  clientName: string
  productName: string
  productType: ProductRecord['product_type']
  stockQuantity: number
  amount: number
  frequency: string
  nextIssueDate: string
  dueDays: number
  active: boolean
  consecutiveFailures: number
  lastError: string | null
  retryAt: string | null
  failureSuspended: boolean
}
export type InvoiceLine = { product: ProductOption; quantity: number }
export type BusinessNotification = { id: string; type?: string; title: string; message: string; severity: 'warning' | 'critical' | 'info'; read_at: string | null; created_at: string; product_id?: string | null }
export type BusinessProfile = { id: string; name: string; phone: string | null; email: string | null; address: string | null; city: string | null; country: string; tax_id: string | null; logo_url: string | null; payment_instructions: string | null; invoice_legal_notice: string | null; default_due_days: number; default_tax_rate: number; currency: string; timezone: string; invoice_number_prefix: string; invoice_number_include_year: boolean; invoice_number_sequence_width: number }
export type AuditLog = { id: string; table_name: string; action: string; record_id: string | null; changed_fields: string[] | null; actor_label: string; created_at: string }
export type RecurringInvoiceRun = {
  id: string
  recurring_invoice_id: string | null
  invoice_id: string | null
  invoice_number: string | null
  issue_date: string
  status: 'issued' | 'failed' | 'skipped_stock' | 'skipped_subscription'
  message: string | null
  attempt_number: number
  created_at: string
}
export type MissedRecurringInvoice = { id: string; next_issue_date: string; consecutive_failures: number; last_error: string | null }
export type InvoiceCommunication = { id: string; event_type: 'invoice_email' | 'overdue_reminder'; status: 'accepted' | 'failed'; recipient: string | null; provider_message_id: string | null; created_at: string }
export type PaymentRecord = {
  id: string
  invoice_id: string
  invoice_number: string
  client_name: string
  invoice_total: number
  invoice_paid: number
  amount: number
  payment_date: string
  method: string
  reference: string | null
  transaction_type: 'receipt' | 'refund'
  status: 'pending' | 'reconciled' | 'cancelled'
  original_payment_id: string | null
  reversal_reason: string | null
  reconciled_at: string | null
  reconciliation_reference: string | null
  refunded_amount: number
}
export type TeamInvitation = { id: string; email: string; full_name: string | null; role: 'admin' | 'member' | 'viewer'; token: string; expires_at: string; validated_at: string | null; sent_at: string | null; accepted_at: string | null }
export type TeamMember = { id: string; user_id: string; email: string | null; full_name: string | null; role: 'admin' | 'member' | 'viewer'; created_at: string }
export type BusinessSubscription = { id: string; plan: 'free' | 'starter' | 'pro' | 'business'; status: string; monthly_invoice_limit: number; monthly_invoice_count: number; expires_at: string | null; is_owner: boolean }
export type BusinessRole = 'owner' | 'admin' | 'member' | 'viewer' | 'none'
export type SubscriptionPayment = { id: string; plan: 'starter' | 'pro'; amount: number; currency: string; status: 'pending' | 'completed' | 'failed' | 'cancelled'; provider: string; provider_url: string | null; created_at: string; completed_at: string | null }
export type PlatformAdminOverview = {
  business_count: number
  member_count: number
  invoice_count: number
  revenue: number
  subscription_revenue: number
  active_subscriptions: number
  pending_payments: number
  open_ticket_count?: number
  security_alert_count?: number
  revenue_month?: number
  revenue_previous_month?: number
  revenue_change_percent?: number | null
  revenue_by_plan?: { plan: string; amount: number; payments: number }[]
  failed_payments?: number
  refund_amount?: number
  unpaid_payments?: { count: number; amount: number }
  monthly_recurring_revenue?: number
  currency?: string
  urgent_ticket_count?: number
  unanswered_ticket_count?: number
  oldest_open_ticket_hours?: number | null
  average_first_response_hours?: number | null
  average_resolution_hours?: number | null
  sla_at_risk_ticket_count?: number
  tickets_by_priority?: { priority: string; count: number }[]
  monthly_revenue_goal?: number | null
  goal_progress_percent?: number | null
  growth_percent?: number | null
  retention_rate?: number | null
  churn_rate?: number | null
  growth_metrics_error?: string
  recent_businesses: { id: string; name: string; created_at: string; plan: string; subscription_status: string }[]
}
export type PlatformAdminRole = 'super_admin' | 'admin' | 'support' | 'finance' | 'analyst'
export type PlatformAdminPermission = 'overview' | 'users' | 'user_management' | 'businesses' | 'subscriptions' | 'subscription_payments' | 'support' | 'notifications' | 'analytics' | 'audit' | 'content' | 'integrations' | 'incidents' | 'finance' | 'reports'
export type PlatformSupportTicket = { id: string; business_id: string | null; business_name: string | null; user_id: string | null; user_email: string | null; subject: string; priority: string; status: string; assigned_to: string | null; created_at: string; updated_at: string }
export type PlatformSupportTicketDetail = PlatformSupportTicket & { messages: { id: string; author_email: string | null; body: string; internal: boolean; created_at: string }[] }
export type PlatformNotification = { id: string; type: string; title: string; message: string; severity: string; read_at: string | null; created_at: string; resource_type: string | null; resource_id: string | null; archived_at: string | null; recipient_user_id?: string | null; recipient_role?: string | null }
export type PlatformNotificationPreference = { notification_type: string; in_app_enabled: boolean; email_enabled: boolean; sms_enabled: boolean; webhook_enabled: boolean; critical_only: boolean }
export type PlatformAuditLog = { id: string; actor_id: string | null; actor_email: string | null; action: string; resource_type: string; resource_id: string | null; result: string; ip_address: string | null; context: Record<string, unknown>; created_at: string }
export type PlatformIncident = { id: string; title: string; description: string; service: string; severity: string; status: string; owner_id: string | null; owner_email: string | null; started_at: string; resolved_at: string | null; root_cause: string | null; resolution_summary: string | null; prevention_actions: string | null }
export type PlatformIntegration = { id: string; name: string; service_type: string; environment: string; status: string; last_checked_at: string | null }
export type PlatformHealthCheck = { service_key: string; service_name: string; status: 'operational' | 'attention' | 'incident'; detail: string; checked_at: string; latency_ms: number | null }
export type PlatformAdminProfile = { full_name: string; first_name: string; last_name: string; email: string; avatar_url: string | null; last_sign_in_at: string | null; sessions: { created_at: string; updated_at: string; user_agent: string | null; ip: string | null }[] }
export type PlatformAdminStatus = 'active' | 'suspended' | 'disabled'
export type PlatformAdminAccount = { user_id: string; email: string | null; full_name: string | null; phone: string | null; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null; status: PlatformAdminStatus; role: PlatformAdminRole }
export type PlatformContent = { id: string; content_type: string; slug: string; title: string; body: string; status: 'draft' | 'published' | 'archived'; updated_by: string | null; updated_at: string }
export type PlatformSetting = { key: string; value: string; updated_by: string | null; updated_at: string }
export type PublicSiteConfig = {
  heroEyebrow: string
  heroTitle: string
  heroTitleAccent: string
  heroSubtitle: string
  heroTrust: string
  audienceTags: string[]
  navLinks: { label: string; href: string }[]
  solutionsTitle: string
  solutionsSubtitle: string
  solutions: { title: string; body: string }[]
  steps: { number: string; title: string; body: string }[]
  finalCtaTitle: string
  finalCtaBody: string
  footerTagline: string
  contactEmail: string
  legalPrivacy: string
  legalTerms: string
}
export type PlatformSearchResult = { category: string; label: string; resource_id: string; status?: string | null; last_activity_at?: string | null }
export type PlatformAdminUser = { user_id: string; email: string | null; created_at: string; platform_role: PlatformAdminRole | null }
export type PlatformUserDetailed = { user_id: string; first_name: string; last_name: string | null; full_name: string | null; email: string | null; phone: string | null; avatar_url: string | null; business_id: string | null; business_name: string | null; business_plan: string; business_role: string; platform_role: PlatformAdminRole | null; account_status: string; created_at: string; last_sign_in_at: string | null; last_activity_at: string | null; connection_count: number }
export type PlatformUserDetail = { user_id: string; first_name: string; last_name: string | null; full_name: string | null; email: string | null; phone: string | null; avatar_url: string | null; created_at: string; last_sign_in_at: string | null; last_activity_at: string | null; connection_count: number; status: string; platform_role: PlatformAdminRole | null; businesses: { id: string; name: string; role: string; plan: string }[]; tickets: { id: string; subject: string; priority: string; status: string; created_at: string }[]; activity: { action: string; resource_type: string; result: string; created_at: string }[] }
export type PlatformAdminBusiness = { id: string; name: string; owner_id: string; owner_email: string | null; created_at: string; plan: string; subscription_status: string }
export type PlatformBusinessDetailed = { id: string; name: string; sector: string | null; owner_id: string; owner_email: string | null; user_count: number; plan: string; subscription_status: string; account_status: string; created_at: string; last_activity_at: string | null }
export type PlatformBusinessDetail = PlatformBusinessDetailed & { logo_url: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; country: string; users: { user_id: string; email: string | null; name: string | null; role: string }[]; subscription: { plan: string; status: string; created_at: string; expires_at: string | null } | null; activity: { invoices: number; clients: number; products: number; last_activity_at: string | null }; tickets: { id: string; subject: string; status: string; priority: string; created_at: string }[]; audit: { action: string; resource_type: string; result: string; created_at: string }[] }
export type PlatformAdminSubscription = { id: string; business_id: string; business_name: string; plan: string; status: string; monthly_invoice_limit: number; expires_at: string | null; created_at: string }
export type PlatformSubscriptionPlan = { id: string; code: string; name: string; description: string; price: number; currency: string; billing_period: string; features: string[]; limits: Record<string, number>; status: string }
export type PlatformSubscriptionDetail = PlatformAdminSubscription & { renewal_at: string | null; history: { id: string; from_plan: string | null; to_plan: string; from_status: string | null; to_status: string; reason: string | null; created_at: string }[]; payments: PlatformSubscriptionPayment[] }
export type PlatformSubscriptionPayment = { id: string; business_id: string; business_name: string; plan: string; amount: number; currency: string; status: string; provider: string; provider_token?: string | null; internal_reference?: string | null; confirmation_data?: Record<string, unknown>; provider_confirmed_at?: string | null; created_at: string; completed_at: string | null }
export type PlatformAdminPayment = PlatformSubscriptionPayment
export type PlatformAnalytics = { current: Record<string, number>; previous: Record<string, number>; feature_usage: { feature: string; usage: number }[]; previous_feature_usage: { feature: string; usage: number }[] }
export type PlatformAnalyticsFilters = { from?: string; to?: string; plan?: string; sector?: string; businessType?: string }
export type PlatformSecurityEvent = { id: string; action: string; resource_type: string; result: string; actor_email: string | null; created_at: string; context: Record<string, unknown> }
export type PlatformOperationalSummary = {
  health_checks: PlatformHealthCheck[]
  active_incident: { id: string; title: string; severity: string; status: string; started_at: string } | null
  latest_admin_logins: { actor_email: string | null; created_at: string; result: string }[]
  unusual_login_count: number
  failed_login_count: number
  suspended_account_count: number
  recent_admin_count: number
  active_session_count: number
  mfa_enabled_count: number
  mfa_total_count: number
  recent_critical_actions: { action: string; resource_type: string; actor_email: string | null; created_at: string; result: string }[]
  checked_at: string
}
export type PlatformActivity = { id: string; type: string; label: string; detail: string; created_at: string; resource_type: string | null; resource_id: string | null }

const tones = ['blue', 'peach', 'purple', 'green']

const formatAmount = (amount: number) =>
  `${new Intl.NumberFormat('fr-FR', { useGrouping: true, maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0).replace(/[\u202f\u00a0/]/g, ' ')} FCFA`

const formatInvoiceAmount = (amount: number, currency: string) =>
  `${new Intl.NumberFormat('fr-FR', { useGrouping: true, maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0).replace(/[\u202f\u00a0/]/g, ' ')} ${currency === 'EUR' || currency === 'USD' ? currency : 'FCFA'}`

const displayStatus = (status: string): DashboardInvoice['status'] => {
  if (status === 'PAID') return 'Payée'
  if (status === 'CANCELLED') return 'Annulée'
  if (status === 'OVERDUE') return 'En retard'
  return 'En attente'
}

const normalizeClientType = (value?: string | null): 'individual' | 'company' => value === 'company' ? 'company' : 'individual'
const normalizeClientStatus = (value?: string | null): 'active' | 'archived' => value === 'archived' ? 'archived' : 'active'
const normalizeClientRecord = <T extends Partial<ClientRecord>>(client: T) => ({
  ...client,
  client_type: normalizeClientType(client.client_type),
  status: normalizeClientStatus(client.status),
}) as T & Pick<ClientRecord, 'client_type' | 'status'>

export async function ensureBusiness(userId: string, name?: string) {
  const existing = await supabase.from('businesses').select('id, name').eq('owner_id', userId).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    const ownerMembership = await supabase.from('business_members').upsert({
      business_id: existing.data.id,
      user_id: userId,
      role: 'admin',
    }, { onConflict: 'business_id,user_id', ignoreDuplicates: false }).select('business_id').maybeSingle()
    if (ownerMembership.error) throw ownerMembership.error
    return existing.data
  }

  const membership = await supabase.from('business_members').select('business_id, businesses(id, name)').eq('user_id', userId).order('created_at').limit(1).maybeSingle()
  if (membership.error) throw membership.error
  const memberBusiness = Array.isArray(membership.data?.businesses) ? membership.data.businesses[0] : membership.data?.businesses
  if (memberBusiness) {
    return memberBusiness
  }

  const created = await supabase.from('businesses').insert({
    owner_id: userId,
    name: name?.trim() ? `Entreprise de ${name.trim()}` : 'Mon entreprise',
  }).select('id, name').single()
  if (created.error) throw created.error

  const ownerMembership = await supabase.from('business_members').upsert({
    business_id: created.data.id,
    user_id: userId,
    role: 'admin',
  }, { onConflict: 'business_id,user_id', ignoreDuplicates: false }).select('business_id').maybeSingle()
  if (ownerMembership.error) throw ownerMembership.error

  return created.data
}

export async function loadBusinessProfile(businessId: string) {
  const result = await supabase.from('businesses').select('id, name, phone, email, address, city, country, tax_id, logo_url, payment_instructions, invoice_legal_notice, default_due_days, default_tax_rate, currency, timezone, invoice_number_prefix, invoice_number_include_year, invoice_number_sequence_width').eq('id', businessId).single()
  if (result.error) throw result.error
  return result.data as BusinessProfile
}

export async function updateBusinessProfile(businessId: string, profile: Omit<BusinessProfile, 'id'>) {
  const result = await supabase.from('businesses').update(profile).eq('id', businessId)
  if (result.error) throw result.error
}

export async function uploadBusinessLogo(businessId: string, file: File) {
  const format = await validateBusinessLogoFile(file)
  const path = `${businessId}/logo.${format.extension}`
  const upload = await supabase.storage.from('business-logos').upload(path, file, { upsert: true, contentType: file.type })
  if (upload.error) throw upload.error
  const { data } = supabase.storage.from('business-logos').getPublicUrl(path)
  const update = await supabase.from('businesses').update({ logo_url: data.publicUrl }).eq('id', businessId)
  if (update.error) throw update.error
  return data.publicUrl
}

export async function uploadProductImage(businessId: string, productId: string, file: File) {
  if (!file.type.startsWith('image/')) throw new Error('L’image du produit doit être une image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('L’image du produit ne doit pas dépasser 5 Mo.')
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${businessId}/${productId}.${extension}`
  const upload = await supabase.storage.from('product-images').upload(path, file, { upsert: true, contentType: file.type })
  if (upload.error) throw upload.error
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  const update = await supabase.from('products').update({ image_url: data.publicUrl }).eq('id', productId).eq('business_id', businessId)
  if (update.error) throw update.error
  return data.publicUrl
}

export async function loadAuditLogs(
  businessId: string,
  filters: { query?: string; action?: string; tableName?: string; from?: string; to?: string } = {},
) {
  const result = await supabase.rpc('list_business_audit_logs', {
    p_business_id: businessId,
    p_query: filters.query?.trim() || null,
    p_action: filters.action || null,
    p_table_name: filters.tableName || null,
    p_from: filters.from || null,
    p_to: filters.to || null,
  })
  if (result.error?.code === 'PGRST202') {
    throw new Error('La migration 20261019003000_audit_immutability_actor_search.sql doit être appliquée pour activer ce journal filtrable.')
  }
  if (result.error) throw result.error
  return result.data as AuditLog[]
}

export async function deleteAuditLog(businessId: string, auditLogId: string) {
  const result = await supabase.rpc('delete_business_audit_log', {
    p_business_id: businessId,
    p_audit_log_id: auditLogId,
  })
  if (result.error) throw result.error
}

export async function loadTeamInvitations(businessId: string) {
  const result = await supabase.from('business_invitations').select('id, email, full_name, role, token, expires_at, validated_at, sent_at, accepted_at').eq('business_id', businessId).order('created_at', { ascending: false })
  if (result.error) throw result.error
  return result.data as TeamInvitation[]
}

export async function loadTeamMembers(businessId: string) {
  const result = await supabase.rpc('list_business_team', { p_business_id: businessId })
  if (result.error) throw result.error
  return result.data as TeamMember[]
}

export async function loadBusinessRole(businessId: string): Promise<BusinessRole> {
  const result = await supabase.rpc('get_business_role', { p_business_id: businessId })
  if (result.error) throw result.error
  const role = result.data
  if (role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer') return role
  return 'none'
}

export async function loadPlatformAdminOverview(period?: { from?: string; to?: string }): Promise<PlatformAdminOverview | null> {
  const access = await supabase.rpc('is_platform_admin')
  if (access.error) {
    if (/cors|failed to fetch|network|connexion/i.test(access.error.message)) {
      throw new Error('Supabase est momentanément inaccessible depuis ce navigateur. Vérifiez votre connexion, désactivez temporairement un bloqueur réseau, puis rechargez la page.')
    }
    throw access.error
  }
  if (!access.data) return null
  const result = await supabase.rpc('get_platform_admin_overview_secure', {
    p_from: period?.from ?? null,
    p_to: period?.to ?? null,
  })
  if (result.error) throw result.error
  const metrics = await supabase.rpc('get_platform_growth_metrics', { p_from: period?.from ?? null, p_to: period?.to ?? null })
  if (metrics.error) {
    console.warn('Les métriques de croissance ne sont pas disponibles.', metrics.error)
    return {
      ...(result.data as PlatformAdminOverview),
      monthly_revenue_goal: null,
      goal_progress_percent: null,
      growth_percent: null,
      retention_rate: null,
      churn_rate: null,
      growth_metrics_error: 'Les métriques de croissance sont indisponibles. Les indicateurs concernés ne sont pas affichés.',
    }
  }
  return { ...(result.data as PlatformAdminOverview), ...(metrics.data ?? {}) } as PlatformAdminOverview
}

export async function loadPlatformAdminRole(): Promise<PlatformAdminRole | null> {
  const result = await supabase.rpc('get_platform_admin_role')
  if (result.error) throw result.error
  const role = result.data
  return role === 'super_admin' || role === 'admin' || role === 'support' || role === 'finance' || role === 'analyst' ? role : null
}

export async function hasPlatformAdminPermission(permission: PlatformAdminPermission | 'support' | 'notifications' | 'audit' | 'analytics' | 'incidents' | 'integrations'): Promise<boolean> {
  const result = await supabase.rpc('has_platform_admin_permission', { p_permission: permission })
  if (result.error) throw result.error
  return Boolean(result.data)
}

const platformAdminPage = (limit: number, offset: number) => ({
  p_limit: Math.max(1, Math.min(100, Math.trunc(limit))),
  p_offset: Math.max(0, Math.trunc(offset)),
})

export async function loadPlatformAdminUsers(limit = 50, offset = 0): Promise<PlatformAdminUser[]> {
  const result = await supabase.rpc('list_platform_admin_users', platformAdminPage(limit, offset))
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformAdminUser[]
}

export async function loadPlatformUsersDetailed(filters: { query?: string; status?: string; businessId?: string; role?: string; plan?: string } = {}, limit = 50, offset = 0): Promise<PlatformUserDetailed[]> {
  const result = await supabase.rpc('list_platform_users_detailed', { p_limit: limit, p_offset: offset, p_query: filters.query ?? null, p_status: filters.status ?? null, p_business_id: filters.businessId ?? null, p_role: filters.role ?? null, p_plan: filters.plan ?? null })
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformUserDetailed[]
}

export async function loadPlatformUserDetail(userId: string): Promise<PlatformUserDetail> {
  const session = await supabase.auth.getSession()
  if (!session.data.session) throw new Error('Votre session a expiré. Reconnectez-vous pour consulter cette fiche.')
  const result = await supabase.rpc('get_platform_user_detail', { p_user_id: userId })
  if (result.error) throw result.error
  if (!result.data || typeof result.data !== 'object') throw new Error('La fiche utilisateur n’a pas retourné de données valides.')
  const data = result.data as Partial<PlatformUserDetail>
  return {
    ...data,
    businesses: Array.isArray(data.businesses) ? data.businesses : [],
    tickets: Array.isArray(data.tickets) ? data.tickets : [],
    activity: Array.isArray(data.activity) ? data.activity : [],
  } as PlatformUserDetail
}

export async function setPlatformUserStatus(userId: string, status: 'active' | 'disabled') {
  const result = await supabase.rpc('set_platform_user_status', { p_user_id: userId, p_status: status })
  if (result.error) throw result.error
}

export async function deletePlatformUser(userId: string) {
  const result = await supabase.rpc('delete_platform_user', { p_user_id: userId })
  if (result.error) throw result.error
}

export async function loadPlatformAdminBusinesses(limit = 50, offset = 0): Promise<PlatformAdminBusiness[]> {
  const result = await supabase.rpc('list_platform_admin_businesses', platformAdminPage(limit, offset))
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformAdminBusiness[]
}

export async function loadPlatformBusinessesDetailed(limit = 100, offset = 0): Promise<PlatformBusinessDetailed[]> {
  const result = await supabase.rpc('list_platform_businesses_detailed', platformAdminPage(limit, offset))
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformBusinessDetailed[]
}

export async function loadPlatformBusinessDetail(businessId: string): Promise<PlatformBusinessDetail> {
  const result = await supabase.rpc('get_platform_business_detail', { p_business_id: businessId })
  if (result.error) throw result.error
  return result.data as PlatformBusinessDetail
}

export async function setPlatformBusinessStatus(businessId: string, status: 'active' | 'inactive' | 'suspended' | 'pending' | 'archived') {
  const result = await supabase.rpc('set_platform_business_status', { p_business_id: businessId, p_status: status })
  if (result.error) throw result.error
}

export async function loadPlatformAdminSubscriptions(limit = 50, offset = 0): Promise<PlatformAdminSubscription[]> {
  const result = await supabase.rpc('list_platform_admin_subscriptions', platformAdminPage(limit, offset))
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformAdminSubscription[]
}

export async function loadPlatformSubscriptionPlans(): Promise<PlatformSubscriptionPlan[]> {
  const result = await supabase.rpc('list_platform_subscription_plans')
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformSubscriptionPlan[]
}

export async function loadPublicSubscriptionPlans(): Promise<PlatformSubscriptionPlan[]> {
  const result = await supabase.rpc('list_public_subscription_plans')
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformSubscriptionPlan[]
}

export async function loadPlatformSubscriptionDetail(subscriptionId: string): Promise<PlatformSubscriptionDetail> {
  const result = await supabase.rpc('get_platform_subscription_detail', { p_subscription_id: subscriptionId })
  if (result.error) throw result.error
  return result.data as PlatformSubscriptionDetail
}

export async function loadPlatformSubscriptionPayments(limit = 50, offset = 0): Promise<PlatformSubscriptionPayment[]> {
  const result = await supabase.rpc('list_platform_subscription_payments', platformAdminPage(limit, offset))
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformSubscriptionPayment[]
}

export const loadPlatformAdminSubscriptionPayments = loadPlatformSubscriptionPayments
export const loadPlatformAdminPayments = loadPlatformSubscriptionPayments

export async function loadPlatformSupportTickets(limit = 50, offset = 0): Promise<PlatformSupportTicket[]> {
  const result = await supabase.rpc('list_platform_support_tickets', platformAdminPage(limit, offset))
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformSupportTicket[]
}

export async function loadPlatformAnalytics(filters: { from?: string; to?: string; plan?: string; sector?: string; businessType?: string } = {}): Promise<PlatformAnalytics> {
  const to = filters.to ?? new Date().toISOString()
  const from = filters.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const result = await supabase.rpc('get_platform_analytics', { p_from: from, p_to: to, p_plan: filters.plan ?? null, p_sector: filters.sector ?? null, p_business_type: filters.businessType ?? null })
  if (result.error) throw result.error
  return result.data as PlatformAnalytics
}

export async function loadPlatformSupportTicketDetail(ticketId: string): Promise<PlatformSupportTicketDetail> {
  const result = await supabase.rpc('get_platform_support_ticket_detail', { p_ticket_id: ticketId })
  if (result.error) throw result.error
  return result.data as PlatformSupportTicketDetail
}

export async function updatePlatformTicketPriority(ticketId: string, priority: string) {
  const result = await supabase.rpc('update_platform_ticket_priority', { p_ticket_id: ticketId, p_priority: priority })
  if (result.error) throw result.error
}

export async function assignPlatformTicket(ticketId: string, agentId: string | null = null) {
  const result = await supabase.rpc('assign_platform_ticket', { p_ticket_id: ticketId, p_agent_id: agentId })
  if (result.error) throw result.error
}

  export async function loadPlatformNotifications(limit = 50, offset = 0, filters: { query?: string; type?: string; severity?: string; unreadOnly?: boolean; from?: string; to?: string } = {}): Promise<PlatformNotification[]> {
  const result = await supabase.rpc('list_platform_notifications', { ...platformAdminPage(limit, offset), p_query: filters.query || null, p_type: filters.type || null, p_severity: filters.severity || null, p_unread_only: filters.unreadOnly ?? false, p_from: filters.from || null, p_to: filters.to || null })
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformNotification[]
}

export async function loadPlatformAuditLogs(limit = 100, offset = 0): Promise<PlatformAuditLog[]> {
  const result = await supabase.rpc('list_platform_audit_logs', platformAdminPage(limit, offset))
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformAuditLog[]
}

export async function deletePlatformAuditLogs(logIds: string[]) {
  if (!logIds.length) throw new Error('Sélectionnez au moins un journal à supprimer.')
  const result = await supabase.rpc('delete_platform_audit_logs', { p_log_ids: logIds })
  if (result.error) throw result.error
}

export async function loadPlatformSecurityEvents(limit = 100): Promise<PlatformSecurityEvent[]> {
  const result = await supabase.rpc('list_platform_security_events', { p_limit: limit })
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformSecurityEvent[]
}

export async function loadPlatformIncidents(limit = 50, offset = 0): Promise<PlatformIncident[]> {
  const result = await supabase.rpc('list_platform_incidents', platformAdminPage(limit, offset))
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformIncident[]
}

export async function loadPlatformIntegrations(): Promise<PlatformIntegration[]> {
  const result = await supabase.rpc('list_platform_integrations')
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformIntegration[]
}

export async function loadPlatformHealth(): Promise<PlatformHealthCheck[]> {
  const result = await supabase.rpc('check_platform_health')
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformHealthCheck[]
}

export async function loadPlatformOperationalSummary(): Promise<PlatformOperationalSummary> {
  const result = await supabase.rpc('get_platform_operational_summary')
  if (result.error) throw result.error
  return result.data as PlatformOperationalSummary
}

export async function loadPlatformActivity(limit = 20): Promise<PlatformActivity[]> {
  const result = await supabase.rpc('list_platform_activity', { p_limit: limit })
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformActivity[]
}

export async function loadPlatformAdminAccounts(): Promise<PlatformAdminAccount[]> {
  const result = await supabase.rpc('list_platform_admin_accounts')
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformAdminAccount[]
}

export async function updatePlatformAdminRole(userId: string, role: PlatformAdminRole) {
  const result = await supabase.rpc('update_platform_admin_role', { p_user_id: userId, p_role: role })
  if (result.error) throw result.error
}

export type PlatformAdminCreationMode = 'invite' | 'auto_confirm'

export async function createPlatformAdminAccount(email: string, role: PlatformAdminRole, mode: PlatformAdminCreationMode, fullName: string, password?: string) {
  const result = await supabase.functions.invoke('create-platform-admin', {
    body: { email, role, mode, fullName, password },
  })
  if (result.error) throw result.error
  return result.data as { userId: string; mode: PlatformAdminCreationMode }
}

export async function managePlatformAdminAccount(userId: string, action: 'suspend' | 'deactivate' | 'delete') {
  const result = await supabase.functions.invoke('manage-platform-admin', { body: { userId, action } })
  if (result.error) throw result.error
}

export async function loadPlatformContent(): Promise<PlatformContent[]> {
  const result = await supabase.rpc('list_platform_content')
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformContent[]
}

export async function loadPublicContent(contentType?: string): Promise<PlatformContent[]> {
  const result = await supabase.rpc('list_public_content', { p_content_type: contentType ?? null })
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformContent[]
}

export async function loadPublicSiteConfig(): Promise<PublicSiteConfig | null> {
  const result = await supabase.rpc('get_public_site_config')
  if (result.error) throw result.error
  return (result.data ?? null) as PublicSiteConfig | null
}

export async function updatePublicSiteConfig(config: PublicSiteConfig) {
  const result = await supabase.rpc('update_public_site_config', { p_config: config })
  if (result.error) throw result.error
}

export async function upsertPlatformContent(content: Partial<PlatformContent> & Pick<PlatformContent, 'content_type' | 'slug' | 'title' | 'body' | 'status'>) {
  const result = await supabase.rpc('upsert_platform_content', {
    p_id: content.id ?? null,
    p_content_type: content.content_type,
    p_slug: content.slug,
    p_title: content.title,
    p_body: content.body,
    p_status: content.status,
  })
  if (result.error) throw result.error
}

export async function loadPlatformSettings(): Promise<PlatformSetting[]> {
  const result = await supabase.rpc('list_platform_settings')
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformSetting[]
}

export async function updatePlatformSetting(key: string, value: string) {
  const result = await supabase.rpc('update_platform_setting', { p_key: key, p_value: value })
  if (result.error) throw result.error
}

export async function searchPlatformGlobal(query: string): Promise<PlatformSearchResult[]> {
  const result = await supabase.rpc('search_platform_global', { p_query: query, p_limit: 20 })
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformSearchResult[]
}

export async function updatePlatformAdminProfile(fullName: string) {
  const result = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } })
  if (result.error) throw result.error
}

export async function updatePlatformAdminEmail(email: string) {
  const result = await supabase.auth.updateUser({ email: email.trim() })
  if (result.error) throw result.error
}

export async function updatePlatformAdminPreferences(preferences: { notifications: boolean; language: string; density: string }) {
  const result = await supabase.auth.updateUser({ data: { admin_preferences: preferences } })
  if (result.error) throw result.error
}

export async function uploadPlatformAdminAvatar(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('La photo doit être une image.')
  if (file.size > 2 * 1024 * 1024) throw new Error('La photo ne doit pas dépasser 2 Mo.')
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
  const userResult = await supabase.auth.getUser()
  const userId = userResult.data.user?.id
  if (!userId) throw new Error('Utilisateur non authentifié.')
  const path = `${userId}/avatar.${extension}`
  const upload = await supabase.storage.from('admin-avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (upload.error) throw upload.error
  const { data } = supabase.storage.from('admin-avatars').getPublicUrl(path)
  await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } })
  return data.publicUrl
}

export async function loadPlatformAdminProfile(): Promise<PlatformAdminProfile> {
  const result = await supabase.rpc('get_platform_admin_profile')
  if (result.error) throw result.error
  return result.data as PlatformAdminProfile
}

export async function updatePlatformAdminPassword(password: string) {
  await updateAccountPassword(password)
}

export async function updateAccountPassword(password: string) {
  if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.')
  const result = await supabase.auth.updateUser({ password })
  if (result.error) throw result.error
}

export async function updateAccountProfile(profile: { fullName: string; phone: string }) {
  const fullName = profile.fullName.trim()
  const phone = profile.phone.trim()
  if (!fullName || fullName.length > 120) throw new Error('Le nom complet est obligatoire et ne doit pas dépasser 120 caractères.')
  if (phone.length > 30) throw new Error('Le téléphone ne doit pas dépasser 30 caractères.')
  const result = await supabase.auth.updateUser({ data: { full_name: fullName, phone } })
  if (result.error) throw result.error
}

export async function uploadAccountProfilePhoto(file: File) {
  const format = await validateProfilePhotoFile(file)
  const userResult = await supabase.auth.getUser()
  if (userResult.error) throw userResult.error
  const userId = userResult.data.user?.id
  if (!userId) throw new Error('Utilisateur non authentifié.')
  const path = `${userId}/avatar.${format.extension}`
  const upload = await supabase.storage.from('user-profile-photos').upload(path, file, { upsert: true, contentType: file.type })
  if (upload.error) throw upload.error
  const { data } = supabase.storage.from('user-profile-photos').getPublicUrl(path)
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`
  const update = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } })
  if (update.error) throw update.error
  return avatarUrl
}

export async function updatePlatformTicketStatus(ticketId: string, status: string) {
  const result = await supabase.rpc('update_platform_ticket_status', { p_ticket_id: ticketId, p_status: status })
  if (result.error) throw result.error
}

export async function addPlatformTicketMessage(ticketId: string, body: string, internal = false) {
  const result = await supabase.rpc('add_platform_ticket_message', { p_ticket_id: ticketId, p_body: body, p_internal: internal })
  if (result.error) throw result.error
}

export async function submitPublicSupportRequest(request: { name: string; email: string; subject: string; body: string }) {
  const result = await supabase.rpc('submit_public_support_request', {
    p_name: request.name,
    p_email: request.email,
    p_subject: request.subject,
    p_body: request.body,
  })
  if (result.error) throw result.error
  return result.data as { ticket_id: string; access_code: string }
}

export type PublicSupportTicket = {
  id: string
  subject: string
  priority: string
  status: string
  created_at: string
  updated_at: string
  messages: { id: string; body: string; internal: boolean; author_role: string; created_at: string }[]
}

export async function loadMySupportTickets(): Promise<PublicSupportTicket[]> {
  const result = await supabase.rpc('list_my_support_tickets')
  if (result.error) throw result.error
  return (result.data ?? []) as PublicSupportTicket[]
}

export async function replyToMySupportTicket(ticketId: string, body: string) {
  const result = await supabase.rpc('reply_my_support_ticket', { p_ticket_id: ticketId, p_body: body })
  if (result.error) throw result.error
}

export async function exportBusinessData(businessId: string) {
  const userResult = await supabase.auth.getUser()
  if (userResult.error) throw userResult.error
  if (!userResult.data.user) throw new Error('Connectez-vous pour exporter vos données.')

  const readBusinessRows = async (table: string) => {
    const rows: Record<string, unknown>[] = []
    const pageSize = 1000
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabase.from(table).select('*').eq('business_id', businessId).order('id', { ascending: true }).range(offset, offset + pageSize - 1)
      if (result.error) throw result.error
      rows.push(...(result.data ?? []))
      if (!result.data || result.data.length < pageSize) return rows
    }
  }

  const [
    businessResult,
    clients,
    products,
    stockMovements,
    invoices,
    payments,
    expenses,
    recurringInvoices,
    recurringRuns,
    notifications,
    auditLogs,
    businessMembers,
    businessSubscriptions,
    subscriptionPayments,
    role,
    supportTickets,
  ] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', businessId).single(),
    readBusinessRows('clients'),
    readBusinessRows('products'),
    readBusinessRows('stock_movements'),
    readBusinessRows('invoices'),
    readBusinessRows('payments'),
    readBusinessRows('expenses'),
    readBusinessRows('recurring_invoices'),
    readBusinessRows('recurring_invoice_runs'),
    readBusinessRows('business_notifications'),
    readBusinessRows('audit_logs'),
    readBusinessRows('business_members'),
    readBusinessRows('business_subscriptions'),
    readBusinessRows('subscription_payments'),
    loadBusinessRole(businessId),
    loadMySupportTickets(),
  ])
  if (businessResult.error) throw businessResult.error

  const invoiceIds = invoices.map((invoice) => invoice.id)
  const paymentIds = payments.map((payment) => payment.id)
  const readInvoiceRows = async (table: string) => {
    const rows: Record<string, unknown>[] = []
    const idBatchSize = 500
    const pageSize = 1000
    for (let start = 0; start < invoiceIds.length; start += idBatchSize) {
      const batch = invoiceIds.slice(start, start + idBatchSize)
      for (let offset = 0; ; offset += pageSize) {
        const result = await supabase.from(table).select('*').in('invoice_id', batch).order('id', { ascending: true }).range(offset, offset + pageSize - 1)
        if (result.error) throw result.error
        rows.push(...(result.data ?? []))
        if (!result.data || result.data.length < pageSize) break
      }
    }
    return rows
  }
  const readPaymentRows = async (table: string) => {
    const rows: Record<string, unknown>[] = []
    const idBatchSize = 500
    const pageSize = 1000
    for (let start = 0; start < paymentIds.length; start += idBatchSize) {
      const batch = paymentIds.slice(start, start + idBatchSize)
      for (let offset = 0; ; offset += pageSize) {
        const result = await supabase.from(table).select('*').in('payment_id', batch).order('id', { ascending: true }).range(offset, offset + pageSize - 1)
        if (result.error) throw result.error
        rows.push(...(result.data ?? []))
        if (!result.data || result.data.length < pageSize) break
      }
    }
    return rows
  }
  const readBusinessInvitations = async () => {
    if (role !== 'owner') return []
    const rows: Record<string, unknown>[] = []
    const pageSize = 1000
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabase.from('business_invitations')
        .select('id, business_id, email, role, expires_at, accepted_at, created_at')
        .eq('business_id', businessId)
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1)
      if (result.error) throw result.error
      rows.push(...(result.data ?? []))
      if (!result.data || result.data.length < pageSize) return rows
    }
  }
  const [invoiceItems, invoiceReminders, invoiceCommunications, paymentEvents, invitations] = await Promise.all([
    readInvoiceRows('invoice_items'),
    readInvoiceRows('invoice_reminders'),
    readInvoiceRows('invoice_communications'),
    readPaymentRows('payment_events'),
    readBusinessInvitations(),
  ])

  return {
    exported_at: new Date().toISOString(),
    format: 'FactureFacile account and business data export',
    note: 'Only records visible to the signed-in user in this business and that user’s own support requests are included. Storage file contents and authentication sessions or secrets are not embedded.',
    account: {
      id: userResult.data.user.id,
      email: userResult.data.user.email,
      phone: userResult.data.user.phone,
      created_at: userResult.data.user.created_at,
      last_sign_in_at: userResult.data.user.last_sign_in_at,
      user_metadata: userResult.data.user.user_metadata,
    },
    business: businessResult.data,
    business_role: role,
    data: {
      clients,
      products,
      stock_movements: stockMovements,
      invoices,
      invoice_items: invoiceItems,
      payments,
      expenses,
      recurring_invoices: recurringInvoices,
      recurring_invoice_runs: recurringRuns,
      invoice_reminders: invoiceReminders,
      invoice_communications: invoiceCommunications,
      business_notifications: notifications,
      audit_logs: auditLogs,
      business_members: businessMembers,
      business_invitations: invitations,
      business_subscriptions: businessSubscriptions,
      subscription_payments: subscriptionPayments,
      payment_events: paymentEvents,
      support_tickets: supportTickets,
    },
  }
}

export async function loadPublicSupportTicket(ticketId: string, accessCode: string): Promise<PublicSupportTicket> {
  const result = await supabase.rpc('get_public_support_ticket', { p_ticket_id: ticketId, p_access_code: accessCode })
  if (result.error) throw result.error
  return result.data as PublicSupportTicket
}

export async function replyToPublicSupportTicket(ticketId: string, accessCode: string, body: string) {
  const result = await supabase.rpc('reply_public_support_ticket', { p_ticket_id: ticketId, p_access_code: accessCode, p_body: body })
  if (result.error) throw result.error
}

export async function markPlatformNotificationRead(notificationId: string) {
  const result = await supabase.rpc('mark_platform_notification_read', { p_notification_id: notificationId })
  if (result.error) throw result.error
}

export async function markPlatformNotificationUnread(notificationId: string) {
  const result = await supabase.rpc('mark_platform_notification_unread', { p_notification_id: notificationId })
  if (result.error) throw result.error
}

export async function markAllPlatformNotificationsRead() {
  const result = await supabase.rpc('mark_all_platform_notifications_read')
  if (result.error) throw result.error
  return Number(result.data ?? 0)
}

export async function archivePlatformNotification(notificationId: string) {
  const result = await supabase.rpc('archive_platform_notification', { p_notification_id: notificationId })
  if (result.error) throw result.error
}

export async function loadPlatformNotificationPreferences(): Promise<PlatformNotificationPreference[]> {
  const result = await supabase.rpc('list_platform_notification_preferences')
  if (result.error) throw result.error
  return (result.data ?? []) as PlatformNotificationPreference[]
}

export async function setPlatformNotificationPreference(preference: PlatformNotificationPreference) {
  const result = await supabase.rpc('set_platform_notification_preference', {
    p_type: preference.notification_type,
    p_in_app: preference.in_app_enabled,
    p_email: preference.email_enabled,
    p_sms: preference.sms_enabled,
    p_webhook: preference.webhook_enabled,
    p_critical_only: preference.critical_only,
  })
  if (result.error) throw result.error
}

export async function createPlatformIncident(title: string, description: string, service: string, severity = 'medium') {
  const result = await supabase.rpc('create_platform_incident', { p_title: title, p_description: description, p_service: service, p_severity: severity })
  if (result.error) throw result.error
  return result.data as string
}

export async function updatePlatformIncidentStatus(incidentId: string, status: string) {
  const result = await supabase.rpc('update_platform_incident_status', { p_incident_id: incidentId, p_status: status })
  if (result.error) throw result.error
}

export async function updatePlatformIncidentReport(incidentId: string, rootCause: string, resolutionSummary: string, preventionActions: string) {
  const result = await supabase.rpc('update_platform_incident_report', { p_incident_id: incidentId, p_root_cause: rootCause, p_resolution_summary: resolutionSummary, p_prevention_actions: preventionActions })
  if (result.error) throw result.error
}

export async function acceptBusinessInvitation(token: string) {
  const result = await supabase.rpc('accept_business_invitation', { p_token: token.trim() })
  if (result.error) throw result.error
}

export async function cancelTeamInvitation(invitationId: string) {
  const result = await supabase.rpc('cancel_business_invitation', { p_invitation_id: invitationId })
  if (result.error) throw result.error
}

export async function removeTeamMember(memberId: string) {
  const result = await supabase.rpc('remove_business_member', { p_member_id: memberId })
  if (result.error) throw result.error
}

export async function updateTeamMemberRole(memberId: string, role: TeamMember['role']) {
  const result = await supabase.rpc('update_business_member_role', { p_member_id: memberId, p_role: role })
  if (result.error) throw result.error
}

export async function validateTeamInvitation(invitationId: string) {
  const result = await supabase.rpc('validate_business_invitation', { p_invitation_id: invitationId })
  if (result.error) throw result.error
}

export async function sendTeamInvitation(invitationId: string) {
  const result = await supabase.functions.invoke('send-team-invitation', { body: { invitationId } })
  if (result.error) {
    const context = 'context' in result.error ? result.error.context : null
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: string } | null
      if (payload?.error) throw new Error(payload.error)
      const text = await context.clone().text()
      if (text) throw new Error(text)
    }
    throw result.error
  }
  if (!result.data?.sent) throw new Error('L’invitation n’a pas pu être envoyée.')
}

export async function loadBusinessSubscription(businessId: string) {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
  const [subscription, invoices, owner] = await Promise.all([
    supabase.from('business_subscriptions').select('id, plan, status, monthly_invoice_limit, expires_at').eq('business_id', businessId).maybeSingle(),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('business_id', businessId).gte('issue_date', monthStart).lt('issue_date', nextMonth).neq('status', 'CANCELLED'),
    supabase.rpc('is_business_owner', { p_business_id: businessId }),
  ])
  if (subscription.error) throw subscription.error
  if (invoices.error) throw invoices.error
  if (owner.error) throw owner.error
  return subscription.data ? { ...subscription.data, monthly_invoice_count: invoices.count ?? 0, is_owner: Boolean(owner.data) } as BusinessSubscription : null
}

export async function updateBusinessSubscription(
  businessId: string,
  plan: BusinessSubscription['plan'],
  status: string,
  expiresAt: string | null,
) {
  const result = await supabase.rpc('update_business_subscription', {
    p_business_id: businessId,
    p_plan: plan,
    p_status: status,
    p_expires_at: expiresAt,
  })
  if (result.error) throw result.error
}

export type SubscriptionCheckout = {
  paymentId: string
  amount: number
  publicKey: string
  sandbox: boolean
  email?: string
  name?: string
}

export async function createSubscriptionCheckout(businessId: string, plan: 'starter' | 'pro'): Promise<SubscriptionCheckout> {
  const result = await supabase.functions.invoke('create-subscription-checkout', {
    body: { businessId, plan },
  })
  if (result.error) {
    const context = result.error.context
    if (context instanceof Response) {
      const message = await context.text()
      throw new Error(message || result.error.message)
    }
    throw result.error
  }
  if (
    !result.data?.paymentId ||
    !Number.isFinite(Number(result.data.amount)) ||
    !result.data.publicKey ||
    typeof result.data.sandbox !== 'boolean'
  ) {
    throw new Error('La configuration de paiement KKiaPay est incomplète.')
  }
  return {
    paymentId: String(result.data.paymentId),
    amount: Number(result.data.amount),
    publicKey: String(result.data.publicKey),
    sandbox: result.data.sandbox,
    email: typeof result.data.email === 'string' ? result.data.email : undefined,
    name: typeof result.data.name === 'string' ? result.data.name : undefined,
  }
}

export async function verifySubscriptionPayment(paymentId: string, transactionId: string) {
  const result = await supabase.functions.invoke('verify-kkiapay-subscription-payment', {
    body: { paymentId, transactionId },
  })
  if (result.error) {
    const context = result.error.context
    if (context instanceof Response) {
      const message = await context.text()
      try {
        const payload = JSON.parse(message) as { error?: string }
        throw new Error(payload.error || result.error.message)
      } catch (error) {
        if (error instanceof SyntaxError) throw new Error(message || result.error.message)
        throw error
      }
    }
    throw result.error
  }
  if (result.data?.status !== 'completed') throw new Error('KKiaPay n’a pas confirmé le paiement.')
}

export async function loadSubscriptionPayments(businessId: string): Promise<SubscriptionPayment[]> {
  const result = await supabase.from('subscription_payments')
    .select('id, plan, amount, currency, status, provider, provider_url, created_at, completed_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (result.error) throw result.error
  return result.data.map((payment) => ({ ...payment, amount: Number(payment.amount) })) as SubscriptionPayment[]
}

export async function createTeamInvitation(businessId: string, email: string, role: TeamInvitation['role']) {
  const result = await supabase.from('business_invitations').insert({ business_id: businessId, email: email.trim().toLowerCase(), role })
  if (result.error) throw result.error
}

export async function createTeamAccount(businessId: string, firstName: string, lastName: string, email: string, password: string, role: TeamInvitation['role']) {
  const result = await supabase.functions.invoke('create-team-account', { body: { businessId, firstName, lastName, email, password, role } })
  if (result.error) {
    const context = 'context' in result.error ? result.error.context : null
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: string } | null
      if (payload?.error) throw new Error(payload.error)
      const text = await context.clone().text()
      if (text) throw new Error(text)
    }
    throw new Error(result.error.message || 'La fonction de création du compte a échoué.')
  }
  if (!result.data?.invitationId) throw new Error('Le compte équipe n’a pas été créé.')
  return result.data as { invitationId: string; token: string; email: string; fullName: string }
}

export async function loadInvoices(businessId: string, timeZone = 'Africa/Porto-Novo'): Promise<DashboardInvoice[]> {
  const result = await supabase
    .from('invoices')
    .select('invoice_number, issue_date, due_date, total, currency, status, clients(name)')
    .eq('business_id', businessId)
    .order('issue_date', { ascending: false })
  if (result.error) throw result.error

  return result.data.map((invoice, index) => {
    const customer = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
    const customerName = customer?.name ?? 'Client supprimé'
    return {
      number: invoice.invoice_number,
      customer: customerName,
      date: formatBusinessDateKey(invoice.issue_date, timeZone),
      amount: formatInvoiceAmount(Number(invoice.total), invoice.currency ?? 'XOF'),
      currency: invoice.currency === 'EUR' || invoice.currency === 'USD' ? invoice.currency : 'FCFA',
      status: displayStatus(invoice.status === 'PAID' || invoice.status === 'CANCELLED' ? invoice.status : invoice.due_date && invoice.due_date < getBusinessDateKey(new Date(), timeZone) ? 'OVERDUE' : invoice.status),
      initials: customerName.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
      tone: tones[index % tones.length],
    }

  })
}

export async function loadFinancialSummary(businessId: string): Promise<FinancialSummary> {
  const { current, previous } = getMonthToDateComparisonPeriods()
  const [invoices, clients, expenses] = await Promise.all([
    supabase.from('invoices').select('total, status, due_date, issue_date, payments(effective_amount, payment_date)').eq('business_id', businessId),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
    supabase.from('expenses').select('amount, expense_date').eq('business_id', businessId),
  ])
  if (invoices.error) throw invoices.error
  if (clients.error) throw clients.error
  if (expenses.error) throw expenses.error
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const currentInvoices = invoices.data.filter((invoice) => invoice.issue_date >= current.from && invoice.issue_date < current.to && !['DRAFT', 'CANCELLED'].includes(invoice.status))
  const previousInvoices = invoices.data.filter((invoice) => invoice.issue_date >= previous.from && invoice.issue_date < previous.to && !['DRAFT', 'CANCELLED'].includes(invoice.status))
  const sumPayments = (from: string, to: string) => invoices.data.reduce((total, invoice) =>
    total + (invoice.payments ?? []).reduce((paid, payment) =>
      paid + (payment.payment_date >= from && payment.payment_date < to ? Number(payment.effective_amount) : 0), 0), 0)
  const sumExpenses = (from: string, to: string) => expenses.data.reduce((total, expense) =>
    total + (expense.expense_date >= from && expense.expense_date < to ? Number(expense.amount) : 0), 0)
  const revenue = sumPayments(current.from, current.to)
  const previousRevenue = sumPayments(previous.from, previous.to)
  const periodExpenses = sumExpenses(current.from, current.to)
  const previousExpenses = sumExpenses(previous.from, previous.to)
  const openInvoices = invoices.data.filter((invoice) => !['DRAFT', 'CANCELLED', 'PAID'].includes(invoice.status))
  const outstanding = openInvoices.reduce((total, invoice) => {
    const paid = (invoice.payments ?? []).reduce((sum, payment) => sum + Number(payment.effective_amount), 0)
    return total + Math.max(0, Number(invoice.total) - paid)
  }, 0)
  const overdueCount = openInvoices.filter((invoice) => invoice.due_date && invoice.due_date < todayKey).length
  return {
    revenue,
    expenses: periodExpenses,
    profit: revenue - periodExpenses,
    invoiceCount: currentInvoices.length,
    outstanding,
    clientCount: clients.count ?? 0,
    paidCount: currentInvoices.filter((invoice) => invoice.status === 'PAID').length,
    overdueCount,
    periodLabel: current.label,
    previousPeriodLabel: previous.label,
    previousRevenue,
    previousExpenses,
    previousProfit: previousRevenue - previousExpenses,
    previousInvoiceCount: previousInvoices.length,
  }
}

export async function loadBusinessNotifications(businessId: string): Promise<BusinessNotification[]> {
  const persisted = await supabase.from('business_notifications')
    .select('id, type, title, message, severity, read_at, created_at, product_id')
    .eq('business_id', businessId).eq('active', true).is('archived_at', null).order('created_at', { ascending: false }).limit(50)
  if (!persisted.error) return persisted.data as BusinessNotification[]
  if (!/business_notifications|relation .* does not exist/i.test(persisted.error.message)) throw persisted.error
  const [invoices, products] = await Promise.all([
    supabase.from('invoices').select('id, invoice_number, due_date, total, status, clients(name)').eq('business_id', businessId),
    supabase.from('products').select('id, name, stock_quantity, low_stock_threshold').eq('business_id', businessId).eq('product_type', 'product'),
  ])
  if (invoices.error) throw invoices.error
  if (products.error) throw products.error
  const today = new Date().toISOString().slice(0, 10)
  const notifications: BusinessNotification[] = []
  invoices.data
    .filter((invoice) => invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && invoice.due_date && invoice.due_date < today)
    .slice(0, 10)
    .forEach((invoice) => {
      const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
      notifications.push({
        id: `overdue-${invoice.id}`,
        title: 'Facture en retard',
        severity: 'warning',
        message: `${invoice.invoice_number} est en retard (${client?.name ?? 'client'}).`,
        read_at: null,
        created_at: new Date().toISOString(),
      })
    })
  products.data
    .filter((product) => Number(product.stock_quantity) <= Number(product.low_stock_threshold))
    .slice(0, 10)
    .forEach((product) => {
      notifications.push({
        id: `stock-${product.id}`,
        title: Number(product.stock_quantity) <= 0 ? 'Rupture de stock' : 'Stock faible',
        severity: Number(product.stock_quantity) <= 0 ? 'critical' : 'warning',
        message: Number(product.stock_quantity) <= 0
          ? `Rupture de stock : ${product.name}.`
          : `Stock faible : ${product.name} (${Number(product.stock_quantity)} restant(s)).`,
        read_at: null,
        created_at: new Date().toISOString(),
      })
    })
  return notifications
}

export async function markBusinessNotificationRead(businessId: string, notificationId: string) {
  const result = await supabase.rpc('mark_business_notification_read', {
    p_business_id: businessId,
    p_notification_id: notificationId,
  })
  if (result.error) throw result.error
}

export async function loadFinancialReport(businessId: string) {
  const summary = await loadFinancialSummary(businessId)
  const result = await supabase.from('payments').select('payment_date, effective_amount').eq('business_id', businessId).eq('status', 'reconciled').order('payment_date', { ascending: true })
  if (result.error) throw result.error
  const monthly = new Map<string, number>()
  result.data.forEach((payment) => {
    monthly.set(payment.payment_date.slice(0, 7), (monthly.get(payment.payment_date.slice(0, 7)) ?? 0) + Number(payment.effective_amount))
  })
  const now = new Date()
  const lastSixMonths = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1))
  return {
    summary,
    monthly: lastSixMonths.map((date) => {
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return { month, amount: monthly.get(month) ?? 0 }
    }),
  }
}

export async function loadDashboardAnalytics(businessId: string): Promise<DashboardAnalytics> {
  const result = await supabase.from('invoices')
    .select('invoice_number, issue_date, due_date, total, status, clients(name), payments(effective_amount), invoice_items(quantity, total, products(name))')
    .eq('business_id', businessId)
    .order('issue_date', { ascending: false })
  if (result.error) throw result.error
  const clientTotals = new Map<string, number>()
  const productTotals = new Map<string, { amount: number; quantity: number }>()
  const monthly = new Map<string, number>()
  const statuses = new Map<string, { count: number; amount: number }>()
  const overdue: DashboardAnalytics['overdue'] = []
  const today = new Date().toISOString().slice(0, 10)
  result.data.forEach((invoice) => {
    const total = Number(invoice.total)
    const paid = (invoice.payments ?? []).reduce((sum, payment) => sum + Number(payment.effective_amount), 0)
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
    const clientName = client?.name ?? 'Client supprimé'
    if (!['DRAFT', 'CANCELLED'].includes(invoice.status)) {
      clientTotals.set(clientName, (clientTotals.get(clientName) ?? 0) + total)
      monthly.set(invoice.issue_date.slice(0, 7), (monthly.get(invoice.issue_date.slice(0, 7)) ?? 0) + (invoice.status === 'PAID' ? total : paid))
    }
    if (invoice.status !== 'CANCELLED') {
      const current = statuses.get(invoice.status) ?? { count: 0, amount: 0 }
      current.count += 1; current.amount += total; statuses.set(invoice.status, current)
    }
    if (!['PAID', 'CANCELLED', 'DRAFT'].includes(invoice.status) && invoice.due_date && invoice.due_date < today && total > paid) {
      overdue.push({ invoice: invoice.invoice_number, client: clientName, remaining: Math.max(0, total - paid), dueDate: invoice.due_date })
    }
    ;(invoice.invoice_items ?? []).forEach((item) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products
      const name = product?.name ?? 'Article supprimé'
      const current = productTotals.get(name) ?? { amount: 0, quantity: 0 }
      current.amount += Number(item.total); current.quantity += Number(item.quantity); productTotals.set(name, current)
    })
  })
  return {
    topClients: Array.from(clientTotals, ([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5),
    topProducts: Array.from(productTotals, ([name, values]) => ({ name, ...values })).sort((a, b) => b.amount - a.amount).slice(0, 5),
    monthlySales: Array.from(monthly, ([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)).slice(-6),
    statusBreakdown: Array.from(statuses, ([status, values]) => ({ status, ...values })),
    overdue: overdue.sort((a, b) => b.remaining - a.remaining).slice(0, 8),
  }
}

export async function loadInvoicePdfData(businessId: string, invoiceNumber: string) {
  const result = await supabase.from('invoices')
    .select('invoice_number, invoice_type, issue_date, due_date, subtotal, discount, tax, total, currency, status, businesses(name, email, phone, address, city, country, logo_url), clients(name, email, phone, address), invoice_items(description, quantity, unit_price, total)')
    .eq('business_id', businessId).eq('invoice_number', invoiceNumber).single()
  if (result.error) throw result.error
  return result.data
}

export async function loadInvoiceDetail(businessId: string, invoiceNumber: string): Promise<InvoiceDetail> {
  const result = await supabase.from('invoices')
    .select('id, invoice_number, invoice_type, client_id, issue_date, due_date, subtotal, discount, tax, total, currency, status, clients(name, email, phone), invoice_items(description, quantity, unit_price, total), payments(effective_amount, payment_date, method, reference)')
    .eq('business_id', businessId).eq('invoice_number', invoiceNumber).single()
  if (result.error) throw result.error
  return {
    ...result.data,
    subtotal: Number(result.data.subtotal),
    discount: Number(result.data.discount),
    tax: Number(result.data.tax),
    total: Number(result.data.total),
    currency: result.data.currency === 'EUR' || result.data.currency === 'USD' ? result.data.currency : 'FCFA',
    invoice_items: (result.data.invoice_items ?? []).map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: Number(item.unit_price), total: Number(item.total) })),
    payments: (result.data.payments ?? []).map((payment) => ({ ...payment, amount: Number(payment.effective_amount) })),
  } as InvoiceDetail
}

export async function loadInvoiceAuditLogs(businessId: string, invoiceId: string) {
  const result = await supabase.from('audit_logs').select('id, table_name, action, record_id, changed_fields, created_at')
    .eq('business_id', businessId).eq('table_name', 'invoices').eq('record_id', invoiceId).order('created_at', { ascending: false }).limit(50)
  if (result.error) throw result.error
  return result.data as AuditLog[]
}

export async function loadInvoiceCommunications(invoiceId: string) {
  const result = await supabase.from('invoice_communications')
    .select('id, event_type, status, recipient, provider_message_id, created_at')
    .eq('invoice_id', invoiceId).order('created_at', { ascending: false }).limit(50)
  if (result.error) throw result.error
  return result.data as InvoiceCommunication[]
}

export async function updateInvoiceDetails(businessId: string, invoiceNumber: string, clientId: string, issueDate: string, dueDate: string, discount: number, taxRate: number) {
  const result = await supabase.rpc('update_invoice_details', {
    p_business_id: businessId,
    p_invoice_number: invoiceNumber,
    p_client_id: clientId,
    p_issue_date: issueDate,
    p_due_date: dueDate || null,
    p_discount: discount,
    p_tax_rate: taxRate,
  })
  if (result.error) throw result.error
}

export async function sendInvoiceEmail(businessId: string, invoiceNumber: string) {
  const result = await supabase.functions.invoke('send-invoice-email', {
    body: { businessId, invoiceNumber },
  })
  let sendError: Error | null = null
  if (result.error) {
    const context = 'context' in result.error ? result.error.context : null
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: string } | null
      if (payload?.error) sendError = new Error(payload.error)
      const text = await context.clone().text()
      if (!sendError && text) sendError = new Error(text)
    }
    sendError ??= result.error
  }
  if (!sendError && !result.data?.sent) sendError = new Error('La facture n’a pas pu être envoyée.')
  if (sendError) {
    const logged = await supabase.rpc('log_invoice_email_attempt', {
      p_business_id: businessId,
      p_invoice_number: invoiceNumber,
      p_status: 'failed',
      p_provider_message_id: null,
    })
    if (logged.error) throw new Error(`${sendError.message} L’échec n’a pas pu être ajouté à l’historique : ${logged.error.message}`)
    throw sendError
  }

  const sent = result.data as { sent: true; recipient: string; messageId?: string | null }
  const logged = await supabase.rpc('log_invoice_email_attempt', {
    p_business_id: businessId,
    p_invoice_number: invoiceNumber,
    p_status: 'accepted',
    p_provider_message_id: sent.messageId ?? null,
  })
  return { ...sent, historyError: logged.error?.message ?? null }
}

export type ExpensePaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'card' | 'check' | 'other'

export type ExpenseRecord = {
  id: string
  label: string
  amount: number
  expense_date: string
  category: string
  notes: string | null
  supplier_name: string | null
  payment_method: ExpensePaymentMethod
  receipt_path: string | null
}

export async function loadExpenseRecords(businessId: string): Promise<ExpenseRecord[]> {
  const result = await supabase.from('expenses').select('id, label, amount, expense_date, category, notes, supplier_name, payment_method, receipt_path').eq('business_id', businessId).order('expense_date', { ascending: false }).order('created_at', { ascending: false })
  if (result.error) throw result.error
  return result.data.map((expense) => ({ ...expense, amount: Number(expense.amount) })) as ExpenseRecord[]
}

export async function loadExpenses(businessId: string) {
  return (await loadExpenseRecords(businessId)).map((expense) => [expense.label, expense.category, new Date(expense.expense_date).toLocaleDateString('fr-FR'), formatAmount(expense.amount)])
}

export async function createExpense(businessId: string, label: string, amount: number, category: string, expenseDate: string, notes: string, supplierName: string, paymentMethod: ExpensePaymentMethod) {
  if (!label.trim()) throw new Error('La désignation de la dépense est obligatoire.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Le montant doit être supérieur à zéro.')
  if (!expenseDate || Number.isNaN(new Date(`${expenseDate}T00:00:00`).getTime())) throw new Error('La date de dépense est invalide.')
  const result = await supabase.from('expenses').insert({
    business_id: businessId,
    label: label.trim(),
    amount,
    category: category || 'other',
    expense_date: expenseDate,
    notes: notes.trim() || null,
    supplier_name: supplierName.trim() || null,
    payment_method: paymentMethod,
  }).select('id').single()
  if (result.error) throw result.error
  return result.data.id as string
}

export async function updateExpense(businessId: string, expenseId: string, label: string, amount: number, category: string, expenseDate: string, notes: string, supplierName: string, paymentMethod: ExpensePaymentMethod) {
  if (!label.trim()) throw new Error('La désignation de la dépense est obligatoire.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Le montant doit être supérieur à zéro.')
  const result = await supabase.from('expenses').update({
    label: label.trim(),
    amount,
    category: category || 'other',
    expense_date: expenseDate,
    notes: notes.trim() || null,
    supplier_name: supplierName.trim() || null,
    payment_method: paymentMethod,
  }).eq('id', expenseId).eq('business_id', businessId)
  if (result.error) throw result.error
}

export async function uploadExpenseReceipt(businessId: string, expenseId: string, file: File) {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) throw new Error('Le justificatif doit être un PDF, JPEG, PNG ou WEBP.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Le justificatif ne doit pas dépasser 10 Mo.')
  const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${businessId}/${expenseId}/receipt-${crypto.randomUUID()}.${extension}`
  const upload = await supabase.storage.from('expense-receipts').upload(path, file, { contentType: file.type })
  if (upload.error) throw upload.error
  const update = await supabase.rpc('set_expense_receipt_path', {
    p_business_id: businessId,
    p_expense_id: expenseId,
    p_receipt_path: path,
  })
  if (update.error) {
    const cleanup = await supabase.storage.from('expense-receipts').remove([path])
    if (cleanup.error) throw new Error(`Le justificatif a été téléversé, mais son association à la dépense a échoué et le nettoyage du fichier a aussi échoué : ${update.error.message}; ${cleanup.error.message}`)
    throw update.error
  }
  const previousPath = update.data as string | null
  if (previousPath && previousPath !== path) {
    const cleanup = await supabase.storage.from('expense-receipts').remove([previousPath])
    if (cleanup.error) return `Le nouveau justificatif est bien joint, mais l’ancien fichier n’a pas pu être supprimé du stockage : ${cleanup.error.message}`
  }
  return null
}

export async function createExpenseReceiptUrl(path: string) {
  const result = await supabase.storage.from('expense-receipts').createSignedUrl(path, 60)
  if (result.error) throw result.error
  return result.data.signedUrl
}

export async function deleteExpense(businessId: string, expenseId: string) {
  const selected = await supabase.from('expenses').select('receipt_path').eq('id', expenseId).eq('business_id', businessId).maybeSingle()
  if (selected.error) throw selected.error
  const result = await supabase.from('expenses').delete().eq('id', expenseId).eq('business_id', businessId)
  if (result.error) throw result.error
  if (selected.data?.receipt_path) {
    const cleanup = await supabase.storage.from('expense-receipts').remove([selected.data.receipt_path])
    if (cleanup.error) return `La dépense a été supprimée, mais le justificatif n’a pas pu être nettoyé du stockage : ${cleanup.error.message}`
  }
  return null
}

export async function loadInvoiceOptions(businessId: string) {
  const [clients, products] = await Promise.all([
    supabase.from('clients').select('id, name').eq('business_id', businessId).order('name'),
    supabase.from('products').select('id, name, price, product_type, stock_quantity, unit').eq('business_id', businessId).order('name'),
  ])
  if (clients.error) throw clients.error
  if (products.error) throw products.error
  return {
    clients: clients.data as ClientOption[],
    products: products.data.map((product) => ({ ...product, price: Number(product.price), stock_quantity: Number(product.stock_quantity) })) as ProductOption[],
  }
}

export async function loadClients(businessId: string) {
  const result = await supabase.from('clients').select('id, name, email, phone, address, client_type, notes, status, tax_id, archived_at').eq('business_id', businessId).order('name')
  if (result.error) throw result.error
  return result.data.map((client) => normalizeClientRecord(client as Partial<ClientRecord>)) as (ClientOption & { email: string | null; phone: string | null; address: string | null; client_type: 'individual' | 'company'; notes: string | null; status: 'active' | 'archived'; tax_id: string | null; archived_at: string | null })[]
}

export async function loadClientSummaries(businessId: string) {
  const [clients, invoices] = await Promise.all([
    loadClients(businessId),
    supabase.from('invoices').select('client_id, total, status, payments(effective_amount)').eq('business_id', businessId),
  ])
  if (invoices.error) throw invoices.error
  const summary = new Map<string, { count: number; total: number; remaining: number }>()
  invoices.data.forEach((invoice) => {
    const paid = (invoice.payments ?? []).reduce((sum, payment) => sum + Number(payment.effective_amount), 0)
    const current = summary.get(invoice.client_id) ?? { count: 0, total: 0, remaining: 0 }
    current.count += 1
    if (!['CANCELLED', 'DRAFT'].includes(invoice.status)) {
      current.total += Number(invoice.total)
      current.remaining += Math.max(0, Number(invoice.total) - paid)
    }
    summary.set(invoice.client_id, current)
  })
  return { clients, summary }
}

export async function loadClientHistory(businessId: string, clientId: string): Promise<ClientHistory> {
  const [clientResult, invoicesResult] = await Promise.all([
    supabase.from('clients').select('id, name, email, phone, address, client_type, notes, status, tax_id, archived_at').eq('business_id', businessId).eq('id', clientId).single(),
    supabase.from('invoices').select('invoice_number, issue_date, due_date, total, status, payments(effective_amount, payment_date, method, reference)').eq('business_id', businessId).eq('client_id', clientId).order('issue_date', { ascending: false }),
  ])
  if (clientResult.error) throw clientResult.error
  if (invoicesResult.error) throw invoicesResult.error
  const invoices = invoicesResult.data.map((invoice) => {
    const paid = (invoice.payments ?? []).reduce((sum, payment) => sum + Number(payment.effective_amount), 0)
    return { invoice_number: invoice.invoice_number, issue_date: invoice.issue_date, due_date: invoice.due_date, total: Number(invoice.total), paid, remaining: Math.max(0, Number(invoice.total) - paid), status: invoice.status }
  })
  const billable = invoices.filter((invoice) => !['CANCELLED', 'DRAFT'].includes(invoice.status))
  const payments = invoices.flatMap((invoice) => (invoicesResult.data.find((item) => item.invoice_number === invoice.invoice_number)?.payments ?? []).map((payment) => ({
    invoice_number: invoice.invoice_number,
    payment_date: payment.payment_date,
    amount: Number(payment.effective_amount),
    method: payment.method,
    reference: payment.reference,
  }))).sort((a, b) => b.payment_date.localeCompare(a.payment_date))
  return {
    client: normalizeClientRecord(clientResult.data as Partial<ClientRecord>) as ClientRecord,
    totalInvoiced: billable.reduce((sum, invoice) => sum + invoice.total, 0),
    totalPaid: billable.reduce((sum, invoice) => sum + invoice.paid, 0),
    totalRemaining: billable.reduce((sum, invoice) => sum + invoice.remaining, 0),
    invoices,
    payments,
  }
}

export async function loadProducts(businessId: string) {
    const selectFields = 'id, name, price, product_type, description, unit, purchase_price, stock_quantity, low_stock_threshold, reference, category, sub_category, active'
    const initialResult = await supabase.from('products').select(`${selectFields}, image_url`).eq('business_id', businessId).order('name')
    let data = initialResult.data as Array<Record<string, unknown>> | null
    let error = initialResult.error
    if (error && /image_url|column .* does not exist/i.test(error.message)) {
      const fallbackResult = await supabase.from('products').select(selectFields).eq('business_id', businessId).order('name')
      data = fallbackResult.data as Array<Record<string, unknown>> | null
      error = fallbackResult.error
    }
    if (error) throw error
    return (data ?? []).map((product) => ({ ...product, price: Number(product.price), purchase_price: Number(product.purchase_price), stock_quantity: Number(product.stock_quantity), low_stock_threshold: Number(product.low_stock_threshold), active: Boolean(product.active), category: product.category ?? 'other', sub_category: product.sub_category ?? null, reference: product.reference ?? null, image_url: product.image_url ?? null })) as ProductRecord[]
  }

export type ProductUsageHistoryItem = {
  invoice_number: string
  issue_date: string
  client_name: string
  quantity: number
  total: number
  status: string
}

export async function loadProductHistory(businessId: string, productId: string): Promise<{ product: ProductRecord | null; totalSold: number; totalRevenue: number; usage: ProductUsageHistoryItem[] }> {
  const [productResult, invoiceResult] = await Promise.all([
    loadProducts(businessId),
    supabase.from('invoices').select('invoice_number, issue_date, status, clients(name), invoice_items(quantity, total, product_id)').eq('business_id', businessId).order('issue_date', { ascending: false }),
  ])
  if (invoiceResult.error) throw invoiceResult.error

  const product = productResult.find((item) => item.id === productId) ?? null
  const usage = (invoiceResult.data ?? []).flatMap((invoice: any) => {
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
    return (invoice.invoice_items ?? [])
      .filter((item: any) => item.product_id === productId)
      .map((item: any) => ({
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        client_name: client?.name ?? 'Client supprimé',
        quantity: Number(item.quantity ?? 0),
        total: Number(item.total ?? 0),
        status: invoice.status,
      }))
  })

  return {
    product,
    totalSold: usage.reduce((sum, item) => sum + item.quantity, 0),
    totalRevenue: usage.reduce((sum, item) => sum + item.total, 0),
    usage: usage.sort((a, b) => b.issue_date.localeCompare(a.issue_date)),
  }
}

export async function createClient(businessId: string, name: string, email: string, phone: string, address = '', clientType: 'individual' | 'company' = 'individual', notes = '', status: 'active' | 'archived' = 'active') {
  const basePayload = { business_id: businessId, name, email: email || null, phone: phone || null, address: address || null, notes: notes || null, status }
  const payload = { ...basePayload, client_type: clientType }
  const result = await supabase.from('clients').insert(payload).select('id').single()
  if (result.error && /client_type.*column|column .*client_type/i.test(result.error.message)) {
    const fallback = await supabase.from('clients').insert(basePayload).select('id').single()
    if (fallback.error) throw fallback.error
    return fallback.data
  }
  if (result.error) throw result.error
  return result.data
}

export async function updateClient(businessId: string, clientId: string, name: string, email: string, phone: string, address = '', clientType: 'individual' | 'company' = 'individual', notes = '', status: 'active' | 'archived' = 'active') {
  const basePayload = { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, address: address || null, notes: notes || null, status }
  const payload = { ...basePayload, client_type: clientType }
  const result = await supabase.from('clients').update(payload).eq('id', clientId).eq('business_id', businessId)
  if (result.error && /client_type.*column|column .*client_type/i.test(result.error.message)) {
    const fallback = await supabase.from('clients').update(basePayload).eq('id', clientId).eq('business_id', businessId)
    if (fallback.error) throw fallback.error
    return
  }
  if (result.error) throw result.error
}

export async function archiveClient(businessId: string, clientId: string, archived: boolean) {
  const result = await supabase.from('clients').update({ status: archived ? 'archived' : 'active', archived_at: archived ? new Date().toISOString() : null }).eq('id', clientId).eq('business_id', businessId)
  if (result.error) throw result.error
}

export async function deleteClient(businessId: string, clientId: string) {
  const result = await supabase.from('clients').delete().eq('id', clientId).eq('business_id', businessId)
    if (result.error) throw result.error
  }

export async function createProduct(businessId: string, name: string, description: string, unit: string, purchasePrice: number, salePrice: number, productType: 'product' | 'service', stockQuantity: number, lowStockThreshold: number, reference = '', category = 'other', subCategory = '', active = true, imageUrl = '') {
  if (!name.trim()) throw new Error('Le nom du produit est obligatoire.')
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0 || !Number.isFinite(salePrice) || salePrice < 0) throw new Error('Les prix doivent être des montants positifs ou nuls.')
  if (productType === 'product' && (!Number.isFinite(stockQuantity) || stockQuantity < 0 || !Number.isFinite(lowStockThreshold) || lowStockThreshold < 0)) throw new Error('Le stock et le seuil d’alerte ne peuvent pas être négatifs.')
  const result = await supabase.from('products').insert({ business_id: businessId, name, description, unit, purchase_price: purchasePrice, price: salePrice, product_type: productType, stock_quantity: 0, low_stock_threshold: productType === 'product' ? lowStockThreshold : 0, reference: reference || null, category: category || 'other', sub_category: subCategory || null, active, image_url: imageUrl || null }).select('id').single()
  if (result.error) throw result.error
  if (productType === 'product' && stockQuantity > 0) {
    const movement = await supabase.rpc('apply_stock_movement', {
      p_business_id: businessId,
      p_product_id: result.data.id,
      p_quantity: stockQuantity,
      p_movement_type: 'adjustment',
      p_note: 'Stock initial',
    })
    if (movement.error) throw movement.error
  }
  return result.data.id
}

export async function updateProduct(businessId: string, productId: string, name: string, description: string, unit: string, purchasePrice: number, salePrice: number, productType: 'product' | 'service', stockQuantity: number, lowStockThreshold: number, reference = '', category = 'other', subCategory = '', active = true) {
  if (!name.trim()) throw new Error('Le nom du produit est obligatoire.')
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0 || !Number.isFinite(salePrice) || salePrice < 0) throw new Error('Les prix doivent être des montants positifs ou nuls.')
  if (productType === 'product' && (!Number.isFinite(stockQuantity) || stockQuantity < 0 || !Number.isFinite(lowStockThreshold) || lowStockThreshold < 0)) throw new Error('Le stock et le seuil d’alerte ne peuvent pas être négatifs.')
  const existing = await supabase.from('products').select('product_type, stock_quantity').eq('id', productId).eq('business_id', businessId).single()
  if (existing.error) throw existing.error
  const currentStock = Number(existing.data.stock_quantity)
  const targetStock = productType === 'product' ? stockQuantity : 0
  if (existing.data.product_type === 'product' && targetStock !== currentStock) {
    const movement = await supabase.rpc('apply_stock_movement', {
      p_business_id: businessId,
      p_product_id: productId,
      p_quantity: targetStock,
      p_movement_type: 'adjustment',
      p_note: 'Ajustement depuis la fiche produit',
    })
    if (movement.error) throw movement.error
  }
  const result = await supabase.from('products').update({ name: name.trim(), description: description || null, unit, purchase_price: purchasePrice, price: salePrice, product_type: productType, low_stock_threshold: productType === 'product' ? lowStockThreshold : 0, reference: reference || null, category: category || 'other', sub_category: subCategory || null, active }).eq('id', productId).eq('business_id', businessId)
  if (result.error) throw result.error
  if (existing.data.product_type === 'service' && productType === 'product' && targetStock > 0) {
    const movement = await supabase.rpc('apply_stock_movement', {
      p_business_id: businessId,
      p_product_id: productId,
      p_quantity: targetStock,
      p_movement_type: 'adjustment',
      p_note: 'Stock initial lors du passage en produit',
    })
    if (movement.error) throw movement.error
  }
}

export async function deleteProduct(businessId: string, productId: string) {
  const result = await supabase.from('products').delete().eq('id', productId).eq('business_id', businessId)
  if (result.error) throw result.error
}

export async function cancelInvoice(businessId: string, invoiceNumber: string) {
  const result = await supabase.rpc('cancel_invoice_with_stock_restore', {
    p_business_id: businessId,
    p_invoice_number: invoiceNumber,
  })
  if (result.error) throw result.error
}

export async function updateStock(businessId: string, productId: string, quantity: number, movementType: 'in' | 'out' | 'adjustment', note: string, supplierName = '') {
  if (!Number.isFinite(quantity) || quantity < 0 || (movementType !== 'adjustment' && quantity === 0)) {
    throw new Error(movementType === 'adjustment' ? 'La quantité réelle ne peut pas être négative.' : 'La quantité doit être supérieure à zéro.')
  }
  const result = await supabase.rpc('apply_stock_movement', {
    p_business_id: businessId,
    p_product_id: productId,
    p_quantity: quantity,
    p_movement_type: movementType,
    p_note: note || null,
    p_supplier_name: movementType === 'in' ? supplierName.trim() || null : null,
  })
  if (result.error) throw result.error
  const movement = Array.isArray(result.data) ? result.data[0] : undefined
  if (!movement) throw new Error('Le mouvement a été enregistré, mais le stock final n’a pas été retourné.')
  const previousStock = Number(movement.previous_stock)
  const newStock = Number(movement.new_stock)
  if (!Number.isFinite(previousStock) || !Number.isFinite(newStock)) throw new Error('Le mouvement a été enregistré, mais le résultat du stock est invalide.')
  return { previousStock, newStock }
}

export async function deleteStockMovement(businessId: string, movementId: string) {
  const result = await supabase.rpc('delete_stock_movement', {
    p_business_id: businessId,
    p_movement_id: movementId,
  })
  if (result.error) throw result.error
}

export async function loadStockMovements(businessId: string) {
  const detailed = await supabase.from('stock_movements')
    .select('id, quantity, movement_type, supplier_name, note, previous_stock, new_stock, created_at, products(name, reference)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  let data = detailed.data as Array<Record<string, any>> | null
  let error = detailed.error
  if (error && /previous_stock|new_stock|supplier_name|column .* does not exist/i.test(error.message)) {
    const fallback = await supabase.from('stock_movements')
      .select('id, quantity, movement_type, note, created_at, products(name, reference)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    data = fallback.data as Array<Record<string, any>> | null
    error = fallback.error
  }
  if (error) throw error
  return (data ?? []).map((movement) => {
    const product = Array.isArray(movement.products) ? movement.products[0] : movement.products
    const type = movement.movement_type === 'in' ? 'Entrée' : movement.movement_type === 'out' ? 'Sortie' : 'Ajustement'
    const formatStock = (value: number | null) => value === null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('fr-FR')
    return [
      movement.id,
      product?.name ?? 'Produit supprimé',
      product?.reference ?? 'Sans référence',
      type,
      `${Number(movement.quantity) > 0 ? '+' : ''}${Number(movement.quantity).toLocaleString('fr-FR')}`,
      formatStock(movement.previous_stock),
      formatStock(movement.new_stock),
      movement.supplier_name ?? '—',
      movement.note ?? '—',
      new Date(movement.created_at).toLocaleString('fr-FR'),
    ]
  })
}

export async function loadRecurringInvoiceRuns(businessId: string) {
  const [runsResult, missedResult] = await Promise.all([
    supabase.from('recurring_invoice_runs')
      .select('id, recurring_invoice_id, invoice_id, issue_date, status, message, attempt_number, created_at, invoices(invoice_number)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('recurring_invoices')
      .select('id, next_issue_date, consecutive_failures, last_error')
      .eq('business_id', businessId)
      .eq('active', true)
      .lt('next_issue_date', new Date().toISOString().slice(0, 10))
      .order('next_issue_date', { ascending: true }),
  ])
  if (runsResult.error) throw runsResult.error
  if (missedResult.error) throw missedResult.error
  const runs = runsResult.data.map((run) => {
    const invoice = Array.isArray(run.invoices) ? run.invoices[0] : run.invoices
    return {
      id: run.id,
      recurring_invoice_id: run.recurring_invoice_id,
      invoice_id: run.invoice_id,
      invoice_number: invoice?.invoice_number ?? null,
      issue_date: run.issue_date,
      status: run.status as RecurringInvoiceRun['status'],
      message: run.message,
      attempt_number: Number(run.attempt_number ?? 1),
      created_at: run.created_at,
    } satisfies RecurringInvoiceRun
  })
  return { runs, missed: missedResult.data as MissedRecurringInvoice[] }
}

export async function loadPayments(businessId: string): Promise<PaymentRecord[]> {
  const [paymentsResult, invoicesResult] = await Promise.all([
    supabase.from('payments')
      .select('id, invoice_id, amount, payment_date, method, reference, transaction_type, status, original_payment_id, reversal_reason, reconciled_at, reconciliation_reference, invoices(invoice_number, total, clients(name))')
      .eq('business_id', businessId)
      .order('payment_date', { ascending: false }),
    supabase.from('invoices').select('id, payments(effective_amount)').eq('business_id', businessId),
  ])
  if (paymentsResult.error) throw paymentsResult.error
  if (invoicesResult.error) throw invoicesResult.error

  const invoicePaid = new Map(invoicesResult.data.map((invoice) => [
    invoice.id,
    (invoice.payments ?? []).reduce((total, payment) => total + Number(payment.effective_amount), 0),
  ]))
  const refundedAmounts = new Map<string, number>()
  paymentsResult.data.forEach((payment) => {
    if (payment.transaction_type === 'refund' && payment.original_payment_id && payment.status !== 'cancelled') {
      refundedAmounts.set(payment.original_payment_id, (refundedAmounts.get(payment.original_payment_id) ?? 0) + Number(payment.amount))
    }
  })

  return paymentsResult.data.map((payment) => {
    const invoice = Array.isArray(payment.invoices) ? payment.invoices[0] : payment.invoices
    const client = invoice?.clients as { name?: string } | { name?: string }[] | null | undefined
    const clientName = Array.isArray(client) ? client[0]?.name : client?.name
    return {
      id: payment.id,
      invoice_id: payment.invoice_id,
      invoice_number: invoice?.invoice_number ?? '—',
      client_name: clientName ?? '—',
      invoice_total: Number(invoice?.total ?? 0),
      invoice_paid: invoicePaid.get(payment.invoice_id) ?? 0,
      amount: Number(payment.amount),
      payment_date: payment.payment_date,
      method: payment.method,
      reference: payment.reference,
      transaction_type: payment.transaction_type as PaymentRecord['transaction_type'],
      status: payment.status as PaymentRecord['status'],
      original_payment_id: payment.original_payment_id,
      reversal_reason: payment.reversal_reason,
      reconciled_at: payment.reconciled_at,
      reconciliation_reference: payment.reconciliation_reference,
      refunded_amount: refundedAmounts.get(payment.id) ?? 0,
    }
  })
}

  export async function loadPaymentInvoices(businessId: string) {
      const result = await supabase.from('invoices').select('id, invoice_number, total, payments(effective_amount)').eq('business_id', businessId).in('status', ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE']).order('issue_date', { ascending: false })
      if (result.error) throw result.error
      return result.data.map((invoice) => {
        const payments = Array.isArray(invoice.payments) ? invoice.payments : []
        const paid = payments.reduce((sum, payment) => sum + Number(payment.effective_amount), 0)
        return { id: invoice.id, number: invoice.invoice_number, total: Number(invoice.total), paid, remaining: Math.max(Number(invoice.total) - paid, 0) }
      })
    }

    export async function createPayment(businessId: string, invoiceId: string, amount: number, method: string, reference: string, paymentDate: string) {
      const result = await supabase.rpc('record_invoice_payment', {
        p_business_id: businessId,
        p_invoice_id: invoiceId,
        p_amount: amount,
        p_payment_date: paymentDate,
        p_method: method,
        p_reference: reference || null,
      })
      if (result.error) throw result.error
      return result.data?.[0] as { payment_id: string; paid_amount: number; remaining_amount: number; invoice_status: string }
    }

export async function reconcilePayment(businessId: string, paymentId: string, reconciliationReference: string) {
  const result = await supabase.rpc('reconcile_invoice_payment', {
    p_business_id: businessId,
    p_payment_id: paymentId,
    p_reconciliation_reference: reconciliationReference || null,
  })
  if (result.error) throw result.error
}

export async function correctPayment(businessId: string, paymentId: string, amount: number, paymentDate: string, method: string, reference: string, reason: string) {
  const result = await supabase.rpc('correct_invoice_payment', {
    p_business_id: businessId,
    p_payment_id: paymentId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_method: method,
    p_reference: reference || null,
    p_reason: reason,
  })
  if (result.error) throw result.error
}

export async function cancelPayment(businessId: string, paymentId: string, reason: string) {
  const result = await supabase.rpc('cancel_invoice_payment', {
    p_business_id: businessId,
    p_payment_id: paymentId,
    p_reason: reason,
  })
  if (result.error) throw result.error
}

export async function refundPayment(businessId: string, paymentId: string, amount: number, paymentDate: string, reference: string, reason: string) {
  const result = await supabase.rpc('refund_invoice_payment', {
    p_business_id: businessId,
    p_payment_id: paymentId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_reference: reference || null,
    p_reason: reason,
  })
  if (result.error) throw result.error
}
export async function createInvoice(
  businessId: string,
  clientId: string,
  lines: InvoiceLine[],
  issueDate: string,
  dueDate: string,
  discount: number,
  taxRate: number,
  invoiceType: InvoiceDocumentType = 'STANDARD',
) {
  const result = await supabase.rpc('create_invoice_with_lines', {
    p_business_id: businessId,
    p_client_id: clientId,
    p_issue_date: issueDate,
    p_due_date: dueDate || null,
    p_discount: discount,
    p_tax_rate: taxRate,
    p_invoice_type: invoiceType,
    p_lines: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
  })
  if (result.error) throw result.error
  return result.data as string
}

export async function loadRecurringInvoices(businessId: string) {
  const result = await supabase.from('recurring_invoices').select('id, client_id, product_id, frequency, next_issue_date, due_days, active, consecutive_failures, last_error, retry_at, failure_suspended, clients(name), products(name, price, product_type, stock_quantity)').eq('business_id', businessId).order('next_issue_date')
  if (result.error) throw result.error
  return result.data.map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients
    const product = Array.isArray(row.products) ? row.products[0] : row.products
    return {
      id: row.id,
      clientId: row.client_id,
      productId: row.product_id,
      clientName: client?.name ?? '—',
      productName: product?.name ?? '—',
      productType: product?.product_type ?? 'service',
      stockQuantity: Number(product?.stock_quantity ?? 0),
      amount: Number(product?.price ?? 0),
      frequency: row.frequency,
      nextIssueDate: row.next_issue_date,
      dueDays: row.due_days,
      active: row.active,
      consecutiveFailures: row.consecutive_failures,
      lastError: row.last_error,
      retryAt: row.retry_at,
      failureSuspended: row.failure_suspended,
    } satisfies RecurringInvoiceRow
  })
}

export async function toggleRecurringInvoice(businessId: string, recurringId: string, active: boolean) {
  const result = await supabase.from('recurring_invoices').update({ active }).eq('id', recurringId).eq('business_id', businessId)
  if (result.error) throw result.error
}

export async function updateRecurringInvoice(businessId: string, recurringId: string, clientId: string, productId: string, frequency: string, nextIssueDate: string, dueDays: number) {
  const result = await supabase.from('recurring_invoices').update({ client_id: clientId, product_id: productId, frequency, next_issue_date: nextIssueDate, due_days: dueDays }).eq('id', recurringId).eq('business_id', businessId)
  if (result.error) throw result.error
}

export async function deleteRecurringInvoice(businessId: string, recurringId: string) {
  const result = await supabase.from('recurring_invoices').delete().eq('id', recurringId).eq('business_id', businessId)
  if (result.error) throw result.error
}

export async function retryRecurringInvoice(businessId: string, recurringId: string) {
  const result = await supabase.rpc('retry_recurring_invoice', {
    p_business_id: businessId,
    p_recurring_invoice_id: recurringId,
  })
  if (result.error) throw result.error
  return result.data as boolean
}

export async function loadRecurringOptions(businessId: string) {
  const [clients, products] = await Promise.all([
    supabase.from('clients').select('id, name').eq('business_id', businessId).order('name'),
    supabase.from('products').select('id, name, price').eq('business_id', businessId).order('name'),
  ])
  if (clients.error) throw clients.error
  if (products.error) throw products.error
  return { clients: clients.data as ClientOption[], products: products.data.map((product) => ({ ...product, price: Number(product.price) })) as ProductOption[] }
}

export async function createRecurringInvoice(businessId: string, clientId: string, productId: string, frequency: string, nextIssueDate: string, dueDays: number) {
  const result = await supabase.rpc('create_recurring_invoice', {
    p_business_id: businessId,
    p_client_id: clientId,
    p_product_id: productId,
    p_frequency: frequency,
    p_next_issue_date: nextIssueDate,
    p_due_days: dueDays,
  })
  if (result.error) throw result.error
}
