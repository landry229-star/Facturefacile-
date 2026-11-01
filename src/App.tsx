import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Upload,
  Eye,
  FileText,
  Lightbulb,
  LayoutDashboard,
  ArrowRight,
  Calendar,
  Menu,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  UserRound,
  UserCog,
  Users,
  WalletCards,
  Mail,
  Plug,
  LogOut,
  Server,
  Send,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  LockKeyhole,
  Repeat2,
  CheckCircle2,
  PauseCircle,
  CalendarDays,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigError } from './lib/supabase'
import * as XLSX from 'xlsx'

function userFacingError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  return !message || /sql|postgres|postgrest|supabase|rpc|relation|constraint|column|database/i.test(message) ? fallback : message
}

function diagnosticErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    const fields: string[] = []
    for (const key of ['message', 'code', 'details', 'hint']) {
      const value = Reflect.get(error, key)
      if (typeof value === 'string' && value) fields.push(`${key}: ${value}`)
    }
    if (fields.length) return fields.join(' · ')
  }
  return 'Erreur non détaillée; consultez la console du navigateur.'
}

function invoiceFieldLabel(field: string) {
  const labels: Record<string, string> = {
    client_id: 'Client',
    issue_date: 'Date de facture',
    due_date: 'Échéance',
    discount: 'Remise',
    tax: 'Taxe',
    total: 'Total',
    status: 'Statut',
    invoice_type: 'Type de document',
  }
  return labels[field] ?? field.replaceAll('_', ' ')
}

function paymentMethodLabel(method: string) {
  return ({ cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement bancaire', card: 'Carte', check: 'Chèque' } as Record<string, string>)[method] ?? method
}

function paymentStatusLabel(status: PaymentRecord['status']) {
  return status === 'reconciled' ? 'Rapproché' : status === 'cancelled' ? 'Annulé' : 'À rapprocher'
}

function expensePaymentMethodLabel(method: string) {
  return ({ cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement bancaire', card: 'Carte', check: 'Chèque', other: 'Autre' } as Record<string, string>)[method] ?? method
}

const validExpensePaymentMethods = new Set(['cash', 'mobile_money', 'bank_transfer', 'card', 'check', 'other'])
function isExpensePaymentMethod(method: string): method is ExpenseRecord['payment_method'] {
  return validExpensePaymentMethods.has(method)
}

function expenseTableRow(expense: ExpenseRecord, currency: string) {
  return [
    expense.label,
    getExpenseCategoryLabel(expense.category),
    new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString('fr-FR'),
    `${expense.amount.toLocaleString('fr-FR')} ${currency}`,
    expense.supplier_name ?? '—',
    expensePaymentMethodLabel(expense.payment_method),
    expense.receipt_path ? 'Disponible' : '—',
  ]
}

import { runAiAction } from './lib/ai'
import type { AiDataSummary, AiExpenseAnalysis, AiForecast, AiUsage } from './lib/ai'
import { normalizeAiInvoiceDraft } from './lib/aiRules'
import type { AiInvoiceDraft } from './lib/aiRules'
const appIcon = '/image_8af825cc.jpg'
import { loadMySupportTickets, loadPublicSupportTicket, replyToPublicSupportTicket, submitPublicSupportRequest } from './lib/data'
import { getClientSegment } from './lib/data'
import { exportBusinessData } from './lib/data'
import { replyToMySupportTicket } from './lib/data'
import { updateAccountProfile } from './lib/data'
import { uploadAccountProfilePhoto } from './lib/data'
import { acceptBusinessInvitation, addPlatformTicketMessage, loadPlatformAnalytics, assignPlatformTicket, cancelInvoice, cancelTeamInvitation, createExpense, createExpenseReceiptUrl, createInvoice, createClient, createPayment, createProduct, createRecurringInvoice, createSubscriptionCheckout, createPlatformAdminAccount, managePlatformAdminAccount, deleteClient, deleteExpense, deletePlatformUser, deletePlatformAuditLogs, deleteAuditLog, deleteProduct, deleteStockMovement, deleteRecurringInvoice, ensureBusiness, createPlatformIncident, createTeamAccount, loadAuditLogs, loadInvoiceAuditLogs, loadInvoiceCommunications, loadBusinessNotifications, markBusinessNotificationRead, loadBusinessProfile, loadBusinessRole, loadBusinessSubscription, loadSubscriptionPayments, verifySubscriptionPayment, loadClients, loadClientHistory, loadClientSummaries, loadDashboardAnalytics, loadExpenseRecords, loadFinancialReport, loadFinancialSummary, loadInvoiceDetail, loadInvoiceOptions, loadInvoices, loadInvoicePdfData, loadPaymentInvoices, loadPayments, reconcilePayment, correctPayment, cancelPayment, refundPayment, loadPlatformAdminAccounts, loadPlatformAdminOverview, loadPlatformAdminRole, loadPlatformUsersDetailed, loadPlatformUserDetail, loadPlatformBusinessesDetailed, loadPlatformBusinessDetail, loadPlatformAdminSubscriptions, loadPlatformSubscriptionDetail, loadPlatformSubscriptionPlans, loadPublicSubscriptionPlans, loadPlatformSubscriptionPayments, loadPlatformSupportTickets, loadPlatformSupportTicketDetail, loadPlatformNotifications, loadPlatformNotificationPreferences, loadPublicContent, loadPublicSiteConfig, updatePublicSiteConfig, markAllPlatformNotificationsRead, archivePlatformNotification, loadPlatformAuditLogs, loadPlatformSecurityEvents, loadPlatformIncidents, loadPlatformIntegrations, loadPlatformHealth, loadPlatformOperationalSummary, loadPlatformActivity, loadPlatformContent, loadPlatformSettings, loadProducts, loadProductHistory, loadRecurringInvoiceRuns, loadRecurringInvoices, loadRecurringOptions, loadStockMovements, loadTeamInvitations, loadTeamMembers, markPlatformNotificationRead, markPlatformNotificationUnread, removeTeamMember, updateTeamMemberRole, validateTeamInvitation, searchPlatformGlobal, sendInvoiceEmail, setPlatformBusinessStatus, setPlatformUserStatus, toggleRecurringInvoice, updateRecurringInvoice, updateBusinessProfile, updateBusinessSubscription, updateClient, archiveClient, updateExpense, uploadExpenseReceipt, updateInvoiceDetails, updatePlatformAdminPassword, updateAccountPassword, updatePlatformAdminProfile, updatePlatformAdminEmail, updatePlatformAdminPreferences, updatePlatformAdminRole, updatePlatformIncidentStatus, updatePlatformIncidentReport, updatePlatformTicketPriority, updatePlatformTicketStatus, updatePlatformSetting, setPlatformNotificationPreference, upsertPlatformContent, updateProduct, updateStock, uploadBusinessLogo, uploadPlatformAdminAvatar, uploadProductImage, loadPlatformAdminProfile } from './lib/data'
import { retryRecurringInvoice } from './lib/data'
import type { AuditLog, MissedRecurringInvoice, RecurringInvoiceRun } from './lib/data'
import type { BusinessProfile } from './lib/data'
import type { PlatformAnalyticsFilters } from './lib/data'
import type { BusinessNotification } from './lib/data'
import type { FinancialSummary } from './lib/data'
import type { PaymentInvoiceOption } from './lib/data'
import type { SubscriptionCheckout } from './lib/data'
import { loadKkiapaySdk } from './lib/kkiapay'
import type { KkiapayWidgetResult } from './lib/kkiapay'
import { invoiceDocumentTypeLabels } from './lib/data'
import type { BusinessRole, ClientHistory, ClientOption, ClientRecord, DashboardAnalytics, ExpenseRecord, InvoiceDetail, InvoiceDocumentType, InvoiceLine, PaymentRecord, PlatformAdminAccount, ProductOption, ProductRecord, PublicSiteConfig, RecurringInvoiceRow } from './lib/data'
import { formatPeriodComparison } from './lib/dashboardMetrics'
import { addDateDays, businessTimeZones, formatBusinessDateKey, formatInvoiceNumberExample, getBusinessDateKey } from './lib/businessPreferences'
import { findClientDuplicates, parseClientImportRows } from './lib/clientTools'
import type { ImportedClient } from './lib/clientTools'
import { parseProductImportRows } from './lib/productTools'
import type { ProductImportRow } from './lib/productTools'
import { calculateStockDifference, calculateStockSummary, isValidStockMovementQuantity } from './lib/stockTools'
import { hasFeatureForUser, isDemoOwnerOverride, resolveEffectiveSubscriptionState, subscriptionPlanLabels } from './lib/subscription'
import './App.css'

type InvoiceStatus = 'Payée' | 'En attente' | 'En retard' | 'Annulée'

type Invoice = {
  number: string
  customer: string
  date: string
  amount: string
  status: InvoiceStatus
  initials: string
  tone: string
}

const formatMoney = (amount: number, currency = 'FCFA') =>
  `${new Intl.NumberFormat('fr-FR', { useGrouping: true, maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0).replace(/[\u202f\u00a0/]/g, ' ')} ${currency}`

const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  const csv = [headers, ...rows].map((row) => row.map((value) => escape(value)).join(';')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const productExportHeaders = ['Nom', 'Type', 'Référence', 'Catégorie', 'Sous-catégorie', 'Unité', 'Prix achat', 'Prix vente', 'Stock', 'Seuil alerte', 'Marge', 'Marge %', 'Statut', 'Image']
const productExportRows = (products: ProductRecord[]) => products.map((product) => {
  const margin = product.price - product.purchase_price
  return [product.name, product.product_type === 'product' ? 'Produit' : 'Service', product.reference ?? '', product.category, product.sub_category ?? '', product.unit, String(product.purchase_price), String(product.price), String(product.stock_quantity), String(product.low_stock_threshold), String(margin), product.purchase_price > 0 ? `${((margin / product.purchase_price) * 100).toFixed(2)}%` : '—', product.active ? 'Actif' : 'Inactif', product.image_url ?? '']
})

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const navItems = [
  { label: 'Tableau de bord', icon: LayoutDashboard },
  { label: 'Clients', icon: Users },
  { label: 'Produits & Services', icon: Package },
  { label: 'Stock', icon: Package },
  { label: 'Factures', icon: FileText },
  { label: 'Paiements', icon: WalletCards },
  { label: 'Dépenses', icon: TrendingUp },
  { label: 'Factures récurrentes', icon: FileText },
  { label: 'Historique automatisation', icon: Clock3 },
  { label: 'Journal d’audit', icon: Clock3 },
  { label: 'Équipe', icon: Users },
  { label: 'Abonnement', icon: WalletCards },
  { label: 'Assistant IA', icon: Sparkles },
]

const productCategoryLabels: Record<string, string> = {
  other: 'Autre',
  digital: 'Digital',
  service: 'Service',
  inventory: 'Stock',
  material: 'Matériel',
}

const expenseCategoryLabels: Record<string, string> = {
  office: 'Bureau',
  rent: 'Loyer',
  supplies: 'Fournitures',
  transport: 'Transport',
  salary: 'Salaires',
  tax: 'Taxes',
  marketing: 'Marketing',
  other: 'Autre',
}

const getExpenseCategoryLabel = (category: string) => expenseCategoryLabels[category] ?? category

const invoicePdfCopies: Record<string, { title: string; totalLabel: string; closing: string; payment: string }> = {
  STANDARD: { title: 'FACTURE', totalLabel: 'TOTAL À PAYER', closing: 'Facture commerciale établie au Bénin.', payment: 'Conditions de règlement : paiement à la date d’échéance indiquée ci-dessus.' },
  PROFORMA: { title: 'FACTURE PROFORMA', totalLabel: 'TOTAL ESTIMATIF', closing: 'Document proforma non définitif et non exigible comme facture finale.', payment: 'Cette proforma constitue une estimation soumise à validation du client.' },
  DEPOSIT: { title: "FACTURE D'ACOMPTE", totalLabel: "MONTANT DE L'ACOMPTE", closing: 'Acompte à valoir sur la facture définitive.', payment: 'Le solde sera régularisé lors de l’émission de la facture définitive.' },
  CREDIT_NOTE: { title: "FACTURE D'AVOIR", totalLabel: 'TOTAL À CRÉDITER', closing: 'Avoir venant corriger ou annuler une facturation antérieure.', payment: 'Le montant sera déduit d’une prochaine échéance ou remboursé selon accord.' },
  FINAL: { title: 'FACTURE DÉFINITIVE', totalLabel: 'TOTAL À PAYER', closing: 'Facture définitive établie au Bénin.', payment: 'Conditions de règlement : paiement à la date d’échéance indiquée ci-dessus.' },
}

const defaultPublicSiteConfig: PublicSiteConfig = {
  heroEyebrow: 'LA GESTION PROFESSIONNELLE POUR VOTRE ENTREPRISE',
  heroTitle: 'Votre entreprise mérite',
  heroTitleAccent: 'une gestion simple.',
  heroSubtitle: 'FactureFacile accompagne les entreprises béninoises pour gérer leurs ventes, factures, clients, paiements et stocks depuis un seul espace professionnel.',
  heroTrust: 'Données sécurisées · Paiement par carte Visa et Mobile Money',
  audienceTags: ['Commerces', 'PME', 'Entreprises de services'],
  navLinks: [{ label: 'Solutions', href: '#solutions' }, { label: 'Fonctionnalités', href: '#fonctionnalites' }, { label: 'Tarifs', href: '#tarifs' }, { label: 'FAQ', href: '/faq' }],
  solutionsTitle: 'Une plateforme qui grandit avec votre entreprise.',
  solutionsSubtitle: 'Indépendant, commerçant, artisan ou PME : retrouvez les outils adaptés à votre quotidien.',
  solutions: [{ title: 'Indépendants & freelances', body: 'Facturez rapidement et gardez l’historique de vos clients.' }, { title: 'Commerçants', body: 'Gérez vos produits, ventes, stocks et paiements.' }, { title: 'Artisans', body: 'Présentez vos prestations avec des factures professionnelles.' }],
  steps: [{ number: '01', title: 'Créez votre espace', body: 'Renseignez votre entreprise et retrouvez vos outils au même endroit.' }, { number: '02', title: 'Ajoutez vos clients et produits', body: 'Constituez votre catalogue et préparez vos ventes en quelques minutes.' }, { number: '03', title: 'Créez votre facture', body: 'Sélectionnez vos articles ou services et laissez les calculs se faire automatiquement.' }, { number: '04', title: 'Facturez et suivez', body: 'Envoyez vos factures, enregistrez les paiements et gardez le contrôle.' }],
  finalCtaTitle: 'Passez à une gestion plus simple et plus professionnelle.',
  finalCtaBody: 'Que vous soyez indépendant, commerçant, PME ou entreprise, FactureFacile vous aide à centraliser votre facturation, vos clients et vos paiements.',
  footerTagline: 'Une gestion plus simple pour votre entreprise.',
  contactEmail: 'contact@facturefacile.bj',
  legalPrivacy: 'FactureFacile collecte uniquement les informations nécessaires à la création de votre compte et au fonctionnement de votre espace professionnel.',
  legalTerms: 'FactureFacile est un outil de gestion destiné aux commerces, PME et entreprises de services.',
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [mfaGate, setMfaGate] = useState<'checking' | 'verified' | 'required' | 'error'>('checking')
  const [mfaGateError, setMfaGateError] = useState('')
  const [mfaCheckKey, setMfaCheckKey] = useState(0)
  const [authChecked, setAuthChecked] = useState(() => Boolean(supabaseConfigError))
  const [activePage, setActivePage] = useState(() => new URLSearchParams(window.location.search).has('invitation') ? 'Équipe' : 'Tableau de bord')
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<BusinessNotification[]>([])
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceRefreshKey, setInvoiceRefreshKey] = useState(0)
  const [search, setSearch] = useState('')
  const [dashboardInvoices, setDashboardInvoices] = useState<Invoice[]>([])
  const [dashboardRecurrences, setDashboardRecurrences] = useState<RecurringInvoiceRow[]>([])
  const [dashboardRecurrencesLoaded, setDashboardRecurrencesLoaded] = useState(false)
  const [dashboardRecurrencesError, setDashboardRecurrencesError] = useState('')
  const [dataMessage, setDataMessage] = useState('')
  const [summary, setSummary] = useState<FinancialSummary>({ revenue: 0, expenses: 0, profit: 0, invoiceCount: 0, outstanding: 0, clientCount: 0, paidCount: 0, overdueCount: 0, periodLabel: '', previousPeriodLabel: '', previousRevenue: 0, previousExpenses: 0, previousProfit: 0, previousInvoiceCount: 0 })
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; amount: number }[]>([])
  const [dashboardAnalytics, setDashboardAnalytics] = useState<DashboardAnalytics>({ topClients: [], topProducts: [], monthlySales: [], statusBreakdown: [], overdue: [] })
  const [businessId, setBusinessId] = useState('')
  const [businessRole, setBusinessRole] = useState<BusinessRole | null>(null)
  const [platformAdminOverview, setPlatformAdminOverview] = useState<Awaited<ReturnType<typeof loadPlatformAdminOverview>> | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [invoiceClientSearch, setInvoiceClientSearch] = useState('')
  const [invoiceProductSearch, setInvoiceProductSearch] = useState('')
  const [invoiceQuantity, setInvoiceQuantity] = useState('1')
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([])
  const [invoiceDiscount, setInvoiceDiscount] = useState('0')
  const [invoiceTaxRate, setInvoiceTaxRate] = useState('0')
  const [invoiceDate, setInvoiceDate] = useState(() => getBusinessDateKey(new Date(), 'Africa/Porto-Novo'))
  const [invoiceDueDate, setInvoiceDueDate] = useState(() => addDateDays(getBusinessDateKey(new Date(), 'Africa/Porto-Novo'), 30))
  const [invoiceType, setInvoiceType] = useState<InvoiceDocumentType>('STANDARD')
  const [invoiceBusy, setInvoiceBusy] = useState(false)
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null)
  const [subscriptionPlan, setSubscriptionPlan] = useState<'free' | 'starter' | 'pro' | 'business'>('free')
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null)
  const [subscriptionExpired, setSubscriptionExpired] = useState(false)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const handleSubscriptionChange = useCallback((subscription: Awaited<ReturnType<typeof loadBusinessSubscription>>) => {
    const nextState = resolveEffectiveSubscriptionState(subscription)
    setSubscriptionPlan(nextState.plan)
    setSubscriptionExpiresAt(subscription?.expires_at ?? null)
    setSubscriptionExpired(nextState.status === 'expired')
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const expiresAt = subscriptionExpiresAt ? Date.parse(subscriptionExpiresAt) : null
    if (expiresAt === null || !Number.isFinite(expiresAt)) return

    let timeout: number | undefined
    const updateEntitlementAtExpiry = () => {
      if (timeout !== undefined) window.clearTimeout(timeout)
      const remaining = expiresAt - Date.now()
      if (remaining <= 0) {
        setSubscriptionPlan('free')
        setSubscriptionExpired(true)
        return
      }
      timeout = window.setTimeout(updateEntitlementAtExpiry, Math.min(remaining, 2_147_000_000))
    }
    const checkOnReturn = () => {
      if (document.visibilityState === 'visible') updateEntitlementAtExpiry()
    }
    updateEntitlementAtExpiry()
    window.addEventListener('focus', checkOnReturn)
    document.addEventListener('visibilitychange', checkOnReturn)

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout)
      window.removeEventListener('focus', checkOnReturn)
      document.removeEventListener('visibilitychange', checkOnReturn)
    }
  }, [subscriptionExpiresAt])

  useEffect(() => {
    if (supabaseConfigError) {
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setMfaGate(data.session ? 'checking' : 'verified')
      setSession(data.session)
      setAuthChecked(true)
    }).catch((error: unknown) => {
      setDataMessage(error instanceof Error ? error.message : 'Connexion à Supabase impossible. Vérifiez votre connexion réseau.')
      setAuthChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setMfaGate(nextSession ? 'checking' : 'verified')
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setMfaGate('verified')
      setMfaGateError('')
      return
    }
    let cancelled = false
    setMfaGate('checking')
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(async ({ data, error }) => {
      if (cancelled) return
      if (error) {
        setMfaGateError(error.message)
        setMfaGate('error')
      } else if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
        const enforcement = await supabase.rpc('mfa_requirement_satisfied')
        if (cancelled) return
        if (enforcement.error) {
          setMfaGateError('Le contrôle MFA côté base n’est pas prêt. Demandez à l’administrateur d’appliquer la migration 20261019008000_mfa_enforcement.sql.')
          setMfaGate('error')
          return
        }
        setMfaGateError('')
        setMfaGate('required')
      } else {
        setMfaGateError('')
        setMfaGate('verified')
      }
    }).catch((error: unknown) => {
      if (cancelled) return
      setMfaGateError(userFacingError(error, 'Impossible de vérifier l’authentification multifacteur.'))
      setMfaGate('error')
    })
    return () => { cancelled = true }
  }, [session?.user.id, session?.access_token, mfaCheckKey])

  useEffect(() => {
    setBusinessId('')
    setBusinessRole(null)
    setPlatformAdminOverview(null)
    setSubscriptionPlan('free')
    setSubscriptionExpiresAt(null)
    setSubscriptionExpired(false)
    setDashboardRecurrences([])
    setDashboardRecurrencesLoaded(false)
    setDashboardRecurrencesError('')
    if (!session?.user || mfaGate !== 'verified') return
    let cancelled = false
    let loadStage = 'vérification des accès'
    const loadData = async () => {
      try {
        loadStage = 'chargement des droits administrateur'
        const adminOverview = await loadPlatformAdminOverview()
        if (!cancelled) {
          setPlatformAdminOverview(adminOverview)
          if (adminOverview && !new URLSearchParams(window.location.search).has('invitation')) {
            setActivePage('Administration')
          }
        }
        const invitationToken = new URLSearchParams(window.location.search).get('invitation')
        if (invitationToken) {
          loadStage = 'validation de l’invitation'
          await acceptBusinessInvitation(invitationToken)
          window.history.replaceState({}, '', window.location.pathname)
        }
        loadStage = 'chargement de l’entreprise'
        const business = await ensureBusiness(session.user.id, session.user.user_metadata?.full_name)
        if (!business || cancelled) {
          if (!cancelled && adminOverview) setBusinessRole('none')
          return
        }
        setBusinessId(business.id)
        loadStage = 'chargement du rôle de l’utilisateur'
        const role = await loadBusinessRole(business.id)
        if (!cancelled) setBusinessRole(role)
        loadStage = 'chargement du profil de l’entreprise'
        const profile = await loadBusinessProfile(business.id)
        loadStage = 'vérification de l’abonnement'
        const subscription = await loadBusinessSubscription(business.id)
        const effectiveSubscription = resolveEffectiveSubscriptionState(subscription)
        if (!cancelled) {
          setBusinessProfile(profile)
          setSubscriptionPlan(effectiveSubscription.plan)
          setSubscriptionExpiresAt(subscription?.expires_at ?? null)
          setSubscriptionExpired(effectiveSubscription.status === 'expired')
          setInvoiceTaxRate(String(profile.default_tax_rate))
          const businessToday = getBusinessDateKey(new Date(), profile.timezone)
          setInvoiceDate(businessToday)
          setInvoiceDueDate(addDateDays(businessToday, profile.default_due_days))
        }
        loadStage = 'chargement des clients et produits'
        const options = await loadInvoiceOptions(business.id)
        if (!cancelled) {
          setClients(options.clients)
          setProducts(options.products)
        }
        loadStage = 'chargement des factures'
        const loadedInvoices = await loadInvoices(business.id, profile.timezone)
        loadStage = 'calcul du résumé financier'
        const financialSummary = await loadFinancialSummary(business.id)
        loadStage = 'chargement du rapport financier'
        const financialReport = await loadFinancialReport(business.id)
        loadStage = 'calcul des indicateurs du tableau de bord'
        const analytics = await loadDashboardAnalytics(business.id)
        if (!cancelled) setDashboardInvoices(loadedInvoices)
        if (!cancelled) setSummary(financialSummary)
        if (!cancelled) setMonthlyRevenue(financialReport.monthly.slice(-6))
        if (!cancelled) setDashboardAnalytics(analytics)
        loadStage = 'chargement des notifications'
        const loadedNotifications = await loadBusinessNotifications(business.id)
        if (!cancelled) setNotifications(loadedNotifications)
        const recurrenceFeatureAvailable = role !== 'none' && (
          (isDemoOwnerOverride(session.user.email) && effectiveSubscription.status !== 'expired')
          || hasFeatureForUser(effectiveSubscription.plan, 'recurringInvoices', session.user.email)
        )
        if (recurrenceFeatureAvailable) {
          loadStage = 'chargement des échéances récurrentes'
          try {
            const recurrences = await loadRecurringInvoices(business.id)
            if (!cancelled) setDashboardRecurrences(recurrences)
          } catch (error) {
            console.error('Échec du chargement des échéances récurrentes du tableau de bord.', error)
            if (!cancelled) setDashboardRecurrencesError(diagnosticErrorMessage(error))
          } finally {
            if (!cancelled) setDashboardRecurrencesLoaded(true)
          }
        }
      } catch (error) {
        const details = diagnosticErrorMessage(error)
        console.error(`Échec du chargement initial à l’étape « ${loadStage} ».`, error)
        if (!cancelled) setDataMessage(`Échec du chargement à l’étape « ${loadStage} » : ${details}`)
      }
    }
    void loadData()
    return () => { cancelled = true }
  }, [session, mfaGate])

  const filteredInvoices = useMemo(
    () =>
      dashboardInvoices.filter((invoice) =>
        `${invoice.number} ${invoice.customer}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [dashboardInvoices, search],
  )

  const navigate = (label: string) => {
    if (!accessiblePages.has(label)) return
    setActivePage(label)
    setSidebarOpen(false)
  }

  const canEdit = businessRole === 'owner' || businessRole === 'admin' || businessRole === 'member'
  const demoOwnerAccess = businessRole === 'owner'
    && isDemoOwnerOverride(session?.user?.email)
    && !subscriptionExpired
  const accessiblePages = useMemo(() => {
    const pages = new Set<string>(businessRole && businessRole !== 'none'
      ? ['Tableau de bord', 'Clients', 'Produits & Services', 'Factures', 'Paiements', 'Dépenses', 'Besoin d’aide', 'Mon compte']
      : [])
    if (businessRole && businessRole !== 'none') pages.add('Assistant IA')
    if (businessRole && businessRole !== 'none' && (demoOwnerAccess || hasFeatureForUser(subscriptionPlan, 'stock', session?.user?.email))) pages.add('Stock')
    if (businessRole && businessRole !== 'none' && (demoOwnerAccess || hasFeatureForUser(subscriptionPlan, 'reports', session?.user?.email))) pages.add('Rapports')
    if (businessRole && businessRole !== 'none' && (demoOwnerAccess || hasFeatureForUser(subscriptionPlan, 'recurringInvoices', session?.user?.email))) {
      pages.add('Factures récurrentes')
      pages.add('Historique automatisation')
    }
    if (businessRole === 'owner' || businessRole === 'admin') {
      if (demoOwnerAccess || hasFeatureForUser(subscriptionPlan, 'team', session?.user?.email)) pages.add('Équipe')
      if (demoOwnerAccess || hasFeatureForUser(subscriptionPlan, 'audit', session?.user?.email)) pages.add('Journal d’audit')
    }
    if (businessRole === 'owner') {
      pages.add('Mon entreprise')
      pages.add('Paramètres')
      pages.add('Abonnement')
    }
    if (platformAdminOverview) pages.add('Administration')
    return pages
  }, [businessRole, demoOwnerAccess, platformAdminOverview, session?.user?.email, subscriptionPlan])

  useEffect(() => {
    if (businessRole && !accessiblePages.has(activePage)) setActivePage('Tableau de bord')
  }, [accessiblePages, activePage, businessRole])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activePage])

  const displayCurrency = businessProfile?.currency === 'EUR' ? 'EUR' : businessProfile?.currency === 'USD' ? 'USD' : 'FCFA'

  const printInvoice = async (invoiceNumber: string) => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!printWindow) {
      setDataMessage('La fenêtre d’impression a été bloquée. Autorisez les fenêtres pop-up pour ce site puis réessayez.')
      return
    }

    try {
      const invoice = await loadInvoicePdfData(businessId, invoiceNumber)
      const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
      const business = Array.isArray(invoice.businesses) ? invoice.businesses[0] : invoice.businesses
      const profile = businessProfile ?? await loadBusinessProfile(businessId)
      const items = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : []
      const currency = invoice.currency === 'EUR' || invoice.currency === 'USD' ? invoice.currency : 'FCFA'
      const pdfCopy = invoicePdfCopies[invoice.invoice_type] ?? invoicePdfCopies.STANDARD
      const formatCurrency = (amount: number) => `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\u202f/g, ' ')} ${currency}`
      const formatDate = (value: string | null) => value ? formatBusinessDateKey(value, profile.timezone) : '—'
      const rows = items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${formatCurrency(Number(item.unit_price))}</td><td>${formatCurrency(Number(item.total))}</td></tr>`).join('')
      const logo = profile.logo_url ? `<img class="invoice-logo" src="${escapeHtml(profile.logo_url)}" alt="Logo" />` : ''
      const businessName = business?.name ?? profile.name
      const legalNotice = profile.invoice_legal_notice?.trim()
      const paymentInstructions = profile.payment_instructions?.trim()
      printWindow.document.write(`<html><head><title>${escapeHtml(invoice.invoice_number)}</title><style>body{font-family:Arial;color:#192b45;padding:40px;max-width:900px;margin:auto}header{display:flex;justify-content:space-between;border-bottom:2px solid #2475e8;padding-bottom:20px}.invoice-logo{width:72px;height:72px;object-fit:contain;display:block;margin-bottom:8px}h1{color:#2475e8;margin:0 0 8px}.meta{color:#586b82;font-size:12px;line-height:1.6}.box{border:1px solid #dbe4ee;border-radius:5px;padding:14px;margin-top:24px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}th{background:#f1f6fc;text-transform:uppercase;font-size:10px}.summary{text-align:right;margin:25px 0 0 auto;width:320px}.summary p{display:flex;justify-content:space-between;margin:8px 0}.total{font-size:20px;font-weight:bold;border-top:2px solid #2475e8;padding-top:12px}.legal{margin-top:35px;padding-top:12px;border-top:1px solid #dbe4ee;color:#66778c;font-size:10px;text-align:center;white-space:pre-wrap}.legal p{margin:5px 0}@media print{body{padding:0}}</style></head><body><header><div>${logo}<h1>${escapeHtml(pdfCopy.title)}</h1><strong>${escapeHtml(businessName ?? 'Entreprise')}</strong><p class="meta">${escapeHtml(business?.address ?? profile.address ?? '')}<br>${escapeHtml(business?.city ?? profile.city ?? '')} ${escapeHtml(business?.country ?? profile.country ?? 'Bénin')}<br>${escapeHtml(business?.email ?? profile.email ?? '')} · ${escapeHtml(business?.phone ?? profile.phone ?? '')}<br>${profile.tax_id ? `IFU : ${escapeHtml(profile.tax_id)}` : ''}</p></div><div><h2>${escapeHtml(invoice.invoice_number)}</h2><p class="meta">Date d’émission : ${formatDate(invoice.issue_date)}<br>Date d’échéance : ${formatDate(invoice.due_date)}<br>Devise : ${currency}</p></div></header><div class="box"><strong>FACTURÉ À</strong><p class="meta">${escapeHtml(client?.name ?? '')}<br>${escapeHtml(client?.email ?? '')}<br>${escapeHtml(client?.phone ?? '')}</p></div><table><thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><p><span>Sous-total</span><strong>${formatCurrency(Number(invoice.subtotal))}</strong></p><p><span>Réduction</span><strong>- ${formatCurrency(Number(invoice.discount))}</strong></p><p><span>TVA / taxe</span><strong>${formatCurrency(Number(invoice.tax))}</strong></p><p class="total"><span>${escapeHtml(pdfCopy.totalLabel)}</span><strong>${formatCurrency(Number(invoice.total))}</strong></p></div><div class="legal"><p>${escapeHtml(pdfCopy.closing)} ${escapeHtml(pdfCopy.payment)}</p>${paymentInstructions ? `<p>Modalités de règlement : ${escapeHtml(paymentInstructions)}</p>` : ''}${legalNotice ? `<p>${escapeHtml(legalNotice)}</p>` : ''}<p>Document établi au Bénin - conserver cette facture pour votre comptabilité.</p></div><script>window.onload=()=>window.print()</script></body></html>`)
      printWindow.document.close()
    } catch (error) {
      printWindow.close()
      setDataMessage(error instanceof Error ? error.message : 'Le PDF n’a pas pu être généré.')
    }
  }

    const downloadInvoicePdf = async (invoiceNumber: string) => {
      try {
        const { jsPDF } = await import('jspdf')
        const invoice = await loadInvoicePdfData(businessId, invoiceNumber)
        const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
        const business = Array.isArray(invoice.businesses) ? invoice.businesses[0] : invoice.businesses
        const profile = businessProfile ?? await loadBusinessProfile(businessId)
        const items = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : []
        const currency = invoice.currency === 'EUR' || invoice.currency === 'USD' ? invoice.currency : 'FCFA'
        const pdfCopy = invoicePdfCopies[invoice.invoice_type] ?? invoicePdfCopies.STANDARD
        const amount = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\u202f/g, ' ')} ${currency}`
        const formatDate = (value: string | null) => value ? formatBusinessDateKey(value, profile.timezone) : '—'
        const pdf = new jsPDF()
        let y = 22
        pdf.setTextColor(25, 43, 69)
        pdf.setFontSize(20)
        if (profile.logo_url) {
          const logoResponse = await fetch(profile.logo_url)
          if (!logoResponse.ok) throw new Error('Le logo de l’entreprise est inaccessible. Vérifiez son téléversement avant de générer le PDF.')
          const logoBlob = await logoResponse.blob()
          const bitmap = await createImageBitmap(logoBlob)
          try {
            const canvas = document.createElement('canvas')
            canvas.width = bitmap.width
            canvas.height = bitmap.height
            const context = canvas.getContext('2d')
            if (!context) throw new Error('Impossible de préparer le logo pour le PDF.')
            context.drawImage(bitmap, 0, 0)
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 20, 10, 18, 18)
          } finally {
            bitmap.close()
          }
        }
        pdf.text(pdfCopy.title, profile.logo_url ? 42 : 20, y)
        pdf.setFontSize(11)
        pdf.text(business?.name ?? profile.name ?? 'Entreprise', 20, y + 8)
        pdf.setFontSize(10)
        pdf.text(`${business?.address ?? profile.address ?? ''} · ${business?.city ?? profile.city ?? ''}`, 20, y + 15)
        pdf.text(`${business?.email ?? profile.email ?? ''} ${business?.phone ?? profile.phone ? `· ${business?.phone ?? profile.phone}` : ''}`, 20, y + 22)
        if (profile.tax_id) pdf.text(`IFU : ${profile.tax_id}`, 20, y + 29)
        pdf.setFontSize(16)
        pdf.text(invoice.invoice_number, 145, y)
        pdf.setFontSize(10)
        pdf.text(`Date d’émission : ${formatDate(invoice.issue_date)}`, 145, y + 8)
        pdf.text(`Date d’échéance : ${formatDate(invoice.due_date)}`, 145, y + 15)
        pdf.text(`Devise : ${currency}`, 145, y + 22)
        y += 42
        pdf.setDrawColor(36, 117, 232)
        pdf.line(20, y, 190, y)
        y += 12
        pdf.setFontSize(11)
        pdf.text('Facturé à', 20, y)
        pdf.setFontSize(10)
        pdf.text(client?.name ?? '', 20, y + 8)
        pdf.text(client?.address ?? '', 20, y + 15)
        pdf.text(`${client?.email ?? ''} ${client?.phone ? `· ${client.phone}` : ''}`, 20, y + 22)
        y += 37
        pdf.setFillColor(241, 246, 252)
        pdf.rect(20, y - 6, 170, 9, 'F')
        pdf.setFontSize(9)
        pdf.text('Désignation', 23, y)
        pdf.text('Qté', 105, y)
        pdf.text('Prix unitaire', 125, y)
        pdf.text('Total', 165, y)
        y += 10
        items.forEach((item) => {
          pdf.text(String(item.description).slice(0, 42), 23, y)
          pdf.text(String(item.quantity), 105, y)
          pdf.text(amount(Number(item.unit_price)), 125, y)
          pdf.text(amount(Number(item.total)), 165, y)
          y += 8
        })
        y += 8
        pdf.line(120, y, 190, y)
        y += 9
        pdf.text(`Sous-total : ${amount(Number(invoice.subtotal))}`, 120, y)
        y += 7
        pdf.text(`Réduction : ${amount(Number(invoice.discount))}`, 120, y)
        y += 7
        pdf.text(`Taxe : ${amount(Number(invoice.tax))}`, 120, y)
        y += 10
        pdf.setFontSize(13)
        pdf.text(`${pdfCopy.totalLabel} : ${amount(Number(invoice.total))}`, 120, y)
        y += 14
        pdf.setFontSize(9)
        pdf.setTextColor(85, 102, 125)
        pdf.text(`${pdfCopy.closing} Montant : ${amount(Number(invoice.total))}`, 20, y)
        y += 9
        const legalLines = pdf.splitTextToSize(`${profile.invoice_legal_notice?.trim() ? `${profile.invoice_legal_notice.trim()}\n` : ''}Document établi au Bénin - conserver cette facture pour votre comptabilité.`, 170)
        const paymentLines = pdf.splitTextToSize(profile.payment_instructions?.trim() || pdfCopy.payment, 170)
        if (y + paymentLines.length * 4.5 + legalLines.length * 4.5 > 255) {
          pdf.addPage()
          y = 24
        }
        pdf.text(paymentLines, 20, y)
        y += paymentLines.length * 4.5 + 3
        pdf.text(legalLines, 20, y)
        pdf.setDrawColor(210, 220, 232)
        pdf.line(20, 275, 190, 275)
        pdf.text(`${business?.name ?? 'Entreprise'} · ${invoice.invoice_number} · Page 1/1`, 20, 282)
        pdf.save(`${invoice.invoice_number}.pdf`)
      } catch (error) {
        setDataMessage(error instanceof Error ? error.message : 'Le PDF n’a pas pu être téléchargé.')
      }
    }

  const emailInvoice = async (invoiceNumber: string): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await sendInvoiceEmail(businessId, invoiceNumber)
      const message = result.historyError
        ? `Le service e-mail a accepté l’envoi à ${result.recipient}, mais l’historique n’a pas pu être enregistré : ${result.historyError}`
        : `Le service e-mail a accepté l’envoi à ${result.recipient}.`
      setDataMessage(message)
      return { success: true, message }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'La facture n’a pas pu être envoyée.'
      setDataMessage(message)
      return { success: false, message }
    }
  }

  const submitInvoice = async () => {
    const discount = Number(invoiceDiscount)
    const taxRate = Number(invoiceTaxRate)
    if (!businessId || !selectedClient || !invoiceLines.length) {
      setDataMessage('Sélectionnez un client et ajoutez au moins une ligne de facture.')
      return
    }
    if (!invoiceDate || !invoiceDueDate || invoiceDueDate < invoiceDate) {
      setDataMessage('Vérifiez les dates de facture et d’échéance.')
      return
    }
    if (!Number.isFinite(discount) || discount < 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      setDataMessage('Vérifiez la réduction et le taux de taxe.')
      return
    }
    setInvoiceBusy(true)
    try {
      await createInvoice(businessId, selectedClient, invoiceLines, invoiceDate, invoiceDueDate, discount, taxRate, invoiceType)
      setShowInvoiceModal(false)
      setSelectedClient('')
      setSelectedProduct('')
      setInvoiceLines([])
      setInvoiceQuantity('1')
      setInvoiceDiscount('0')
      setInvoiceTaxRate('0')
      setInvoiceType('STANDARD')
      setDataMessage('')
      const refreshed = await loadInvoices(businessId, businessProfile?.timezone)
      setDashboardInvoices(refreshed)
      setInvoiceRefreshKey((current) => current + 1)
      const refreshedOptions = await loadInvoiceOptions(businessId)
      setProducts(refreshedOptions.products)
      setNotifications(await loadBusinessNotifications(businessId))
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : 'La facture n’a pas pu être créée.')
    } finally {
      setInvoiceBusy(false)
    }
  }

  const invoiceCurrency = businessProfile?.currency === 'EUR' ? 'EUR' : businessProfile?.currency === 'USD' ? 'USD' : 'FCFA'
  const formatInvoiceAmount = (amount: number) => `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${invoiceCurrency}`
  const prepareInvoiceDefaults = () => {
    const timezone = businessProfile?.timezone ?? 'Africa/Porto-Novo'
    const issueDate = getBusinessDateKey(new Date(), timezone)
    setInvoiceDate(issueDate)
    setInvoiceDueDate(addDateDays(issueDate, businessProfile?.default_due_days ?? 30))
    setInvoiceTaxRate(String(businessProfile?.default_tax_rate ?? 0))
    setInvoiceDiscount('0')
  }
  const openInvoiceModal = () => {
    prepareInvoiceDefaults()
    setShowInvoiceModal(true)
  }
  const invoiceSubtotal = invoiceLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0)
  const invoiceDiscountAmount = Math.min(Math.max(Number(invoiceDiscount) || 0, 0), invoiceSubtotal)
  const invoiceTaxable = Math.max(invoiceSubtotal - invoiceDiscountAmount, 0)
  const invoiceTaxAmount = invoiceTaxable * (Math.max(Number(invoiceTaxRate) || 0, 0) / 100)
  const invoiceTotal = invoiceTaxable + invoiceTaxAmount
  const normalizeSearch = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()
  const filteredInvoiceClients = clients.filter((client) => normalizeSearch(client.name).includes(normalizeSearch(invoiceClientSearch)))
  const filteredInvoiceProducts = products.filter((product) => normalizeSearch(product.name).includes(normalizeSearch(invoiceProductSearch)))
  const addInvoiceLine = () => {
    const product = products.find((item) => item.id === selectedProduct)
    const quantity = Number(invoiceQuantity)
    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
      setDataMessage('Sélectionnez un produit et indiquez une quantité valide.')
      return
    }
    setInvoiceLines((current) => [...current, { product, quantity }])
    setSelectedProduct('')
    setInvoiceQuantity('1')
    setDataMessage('')
  }

  if (!authChecked) return <div className="auth-loading">Chargement de votre espace sécurisé...</div>
  if (supabaseConfigError) return <ConfigurationError />
  if (window.location.pathname === '/reset-password') return <PasswordResetScreen />
  if (!session) return <AuthScreen />
  if (mfaGate === 'checking') return <div className="auth-loading">Vérification de la sécurité du compte...</div>
  if (mfaGate === 'required') return <MfaChallengeScreen onVerified={(verifiedSession) => { setSession(verifiedSession); setMfaGate('verified') }} />
  if (mfaGate === 'error') return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SÉCURITÉ DU COMPTE</p><h1>Vérification impossible</h1><p className="auth-message">{mfaGateError || 'La vérification MFA a échoué. Réessayez ou reconnectez-vous.'}</p><button className="primary-button full-width" onClick={() => { setMfaGate('checking'); setMfaCheckKey((current) => current + 1) }}>Réessayer</button><button className="outline-button full-width" onClick={() => void supabase.auth.signOut()}>Se déconnecter</button></section></main>
  if (businessRole === null) return <div className="auth-loading">Chargement de votre espace professionnel...</div>
  if (businessRole === 'none' && !platformAdminOverview) return <div className="auth-loading"><h1>Accès refusé</h1><p>Votre compte n’est associé à aucune entreprise.</p><button className="outline-button" onClick={() => void supabase.auth.signOut()}>Se déconnecter</button></div>
  if (platformAdminOverview) return <PlatformAdminShell overview={platformAdminOverview} session={session} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <img className="brand-mark" src={appIcon} alt="FactureFacile" />
          <div>
            <strong>Facture<span>Facile</span></strong>
            <small>BÉNIN</small>
          </div>
          <button className="icon-button close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu">
            <X size={20} />
          </button>
        </div>

        <div className="business-switcher">
          <div className="business-avatar">A</div>
          <div className="business-copy">
            <strong>{platformAdminOverview ? 'Console plateforme' : businessProfile?.name ?? 'Entreprise active'}</strong>
            <span>{platformAdminOverview ? 'Administration globale' : 'Entreprise active'}</span>
          </div>
          <ChevronDown size={16} />
        </div>

        <nav className="main-nav" aria-label="Navigation principale">
          <p className="nav-heading">MENU PRINCIPAL</p>
          {navItems.filter(({ label }) => accessiblePages.has(label)).map(({ label, icon: Icon }) => (
            <button
              className={`nav-item ${activePage === label ? 'active' : ''}`}
              key={label}
              onClick={() => navigate(label)}
            >
              <Icon size={19} strokeWidth={activePage === label ? 2.4 : 2} />
              <span>{label}</span>
            </button>
          ))}
          <p className="nav-heading nav-heading-spaced">AUTRE</p>
          {accessiblePages.has('Rapports') && <button className={`nav-item ${activePage === 'Rapports' ? 'active' : ''}`} onClick={() => navigate('Rapports')}>
            <TrendingUp size={19} />
            <span>Rapports</span>
          </button>}
          {accessiblePages.has('Mon entreprise') && <button className={`nav-item ${activePage === 'Mon entreprise' ? 'active' : ''}`} onClick={() => navigate('Mon entreprise')}>
            <ShoppingBag size={19} />
            <span>Mon entreprise</span>
          </button>}
          {accessiblePages.has('Paramètres') && <button className={`nav-item ${activePage === 'Paramètres' ? 'active' : ''}`} onClick={() => navigate('Paramètres')}>
            <Settings size={19} />
            <span>Paramètres</span>
          </button>}
          {accessiblePages.has('Mon compte') && <button className={`nav-item ${activePage === 'Mon compte' ? 'active' : ''}`} onClick={() => navigate('Mon compte')}>
            <UserRound size={19} />
            <span>Mon compte</span>
          </button>}
          {accessiblePages.has('Administration') && <button className={`nav-item ${activePage === 'Administration' ? 'active' : ''}`} onClick={() => navigate('Administration')}>
            <ShieldCheck size={19} />
            <span>Administration</span>
          </button>}
          <button className="nav-item logout-nav-item" onClick={() => void supabase.auth.signOut()}>
            <LogOut size={19} />
            <span>Se déconnecter</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button className="help-card" onClick={() => navigate('Besoin d’aide')}>
            <div className="help-icon"><CircleHelp size={18} /></div>
            <div>
              <strong>Besoin d'aide ?</strong>
              <span>Consultez notre guide</span>
            </div>
            <ChevronRight size={16} />
          </button>
          <div className="profile-row">
            <div className="profile-avatar">{typeof session.user.user_metadata?.avatar_url === 'string' ? <img src={session.user.user_metadata.avatar_url} alt="" /> : (session.user.user_metadata?.full_name ?? session.user.email ?? 'U').trim().slice(0, 2).toUpperCase()}</div>
            <div className="profile-copy">
              <strong>{session.user.user_metadata?.full_name ?? session.user.email ?? 'Utilisateur'}</strong>
              <span>{platformAdminOverview ? 'Administrateur plateforme' : businessRole === 'owner' ? 'Propriétaire' : businessRole === 'admin' ? 'Administrateur' : businessRole === 'member' ? 'Membre' : 'Lecteur'}</span>
            </div>
          </div>
        </div>
      </aside>

      {isSidebarOpen && <button className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu" />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu">
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
          <button className="breadcrumb-home" onClick={() => navigate('Tableau de bord')}>Accueil</button>
            <ChevronRight size={14} />
            <strong>{activePage}</strong>
          </div>
          <div className="topbar-actions">
            <button className="icon-button notification-button" onClick={() => setShowNotifications(!showNotifications)} aria-label="Notifications">
              <Bell size={20} />
              {notifications.some((notification) => !notification.read_at) && <i />}
            </button>
            {showNotifications && (
              <div className="notification-popover">
                <strong>Notifications</strong>
                {notifications.length ? notifications.map((notification) => <button className={`notification-item ${notification.severity}`} key={notification.id} onClick={() => { if (!notification.read_at && businessId) void markBusinessNotificationRead(businessId, notification.id).then(() => setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item))); navigate(notification.type === 'recurring_invoice' ? 'Historique automatisation' : notification.id.startsWith('stock-') || notification.product_id ? 'Stock' : 'Factures'); setShowNotifications(false) }}>{notification.title}: {notification.message}<small>{notification.read_at ? 'Lue' : 'Nouvelle alerte'} · Ouvrir le module</small></button>) : <p>Aucune alerte pour le moment.</p>}
              </div>
            )}
            <div className="topbar-divider" />
            <div className="topbar-user">
              <div className="topbar-user-button">
                <div className="profile-avatar small">{typeof session.user.user_metadata?.avatar_url === 'string' ? <img src={session.user.user_metadata.avatar_url} alt="" /> : (session.user.user_metadata?.full_name ?? session.user.email ?? 'U').slice(0, 2).toUpperCase()}</div>
                <span>{session.user.user_metadata?.full_name ?? session.user.email ?? 'Utilisateur'}</span>
                <ChevronDown size={15} />
              </div>
            </div>
          </div>
        </header>

        {!isOnline && <div className="offline-banner" role="status">Hors connexion : les données Supabase seront disponibles après reconnexion.</div>}
        <div className="page-content">
          {activePage === 'Tableau de bord' ? (
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">{new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()}</p>
                  <h1>Bonjour {(session.user.user_metadata?.full_name ?? 'à vous').split(' ')[0]}, <span>ravi de vous revoir.</span></h1>
                  <p className="heading-subtitle">Voici ce qui se passe dans votre entreprise aujourd'hui.</p>
                  <p className="dashboard-period-note">Indicateurs du {summary.periodLabel || 'mois en cours'} ; évolution comparée à la même durée du mois précédent ({summary.previousPeriodLabel || 'période précédente'}). Les encours correspondent au solde actuel, tous mois confondus.</p>
                  {dataMessage && <p className="data-warning">{dataMessage}</p>}
                </div>
                {canEdit && <button className="primary-button" onClick={openInvoiceModal}>
                  <Plus size={18} />
                  Nouvelle facture
                </button>}
              </section>

              <section className="stats-grid" aria-label="Indicateurs clés">
                <StatCard title="Encaissements reçus" value={summary.revenue.toLocaleString('fr-FR')} suffix={displayCurrency} detail="Paiements reçus pendant la période" change={formatPeriodComparison(summary.revenue, summary.previousRevenue).label} trend={formatPeriodComparison(summary.revenue, summary.previousRevenue).trend} icon={<WalletCards size={20} />} tone="blue" period={false} onClick={() => navigate('Paiements')} destination="Paiements" />
                <StatCard title="Factures émises" value={String(summary.invoiceCount)} detail={`${summary.paidCount} soldée(s) · hors brouillons et annulées`} change={formatPeriodComparison(summary.invoiceCount, summary.previousInvoiceCount).label} trend={formatPeriodComparison(summary.invoiceCount, summary.previousInvoiceCount).trend} icon={<FileText size={20} />} tone="purple" period={false} onClick={() => navigate('Factures')} destination="Factures" />
                <StatCard title="Solde à recouvrer" value={summary.outstanding.toLocaleString('fr-FR')} suffix={displayCurrency} detail="Toutes les factures non soldées · solde actuel" change={`${summary.overdueCount} en retard`} trend={summary.overdueCount ? 'down' : 'up'} icon={<WalletCards size={20} />} tone="orange" period={false} onClick={() => navigate('Factures')} destination="Factures" />
                <StatCard title="Solde net estimé" value={summary.profit.toLocaleString('fr-FR')} suffix={displayCurrency} detail="Encaissements moins dépenses saisies" change={formatPeriodComparison(summary.profit, summary.previousProfit).label} trend={formatPeriodComparison(summary.profit, summary.previousProfit).trend} icon={<TrendingUp size={20} />} tone="green" period={false} onClick={() => navigate('Dépenses')} destination="Dépenses" />
              </section>

              {accessiblePages.has('Factures récurrentes') && <section className="panel dashboard-recurring-panel" aria-label="Suivi des factures récurrentes">
                <div className="panel-heading">
                  <div>
                    <h2>Factures récurrentes</h2>
                    <p>Échéances à venir, retards et stock associé</p>
                  </div>
                  <button type="button" className="outline-button" onClick={() => navigate('Factures récurrentes')}>Voir le module</button>
                </div>
                {dashboardRecurrencesError && <p className="data-warning" role="alert">Impossible de charger les échéances récurrentes : {dashboardRecurrencesError}</p>}
                {!dashboardRecurrencesLoaded && !dashboardRecurrencesError
                  ? <p className="muted-cell">Chargement des échéances…</p>
                  : dashboardRecurrencesLoaded && !dashboardRecurrencesError && !dashboardRecurrences.some((item) => item.active)
                    ? <p className="muted-cell">Aucune facture récurrente active.</p>
                    : <div className="dashboard-recurring-list">
                      {dashboardRecurrences.filter((item) => item.active).sort((left, right) => left.nextIssueDate.localeCompare(right.nextIssueDate)).slice(0, 3).map((recurrence) => {
                        const overdue = recurrence.nextIssueDate <= getBusinessDateKey(new Date(), businessProfile?.timezone ?? 'Africa/Porto-Novo')
                        const stockInsufficient = recurrence.productType === 'product' && recurrence.stockQuantity < 1
                        return <article className="dashboard-recurring-row" key={recurrence.id}>
                          <div className="dashboard-recurring-copy">
                            <strong>{recurrence.clientName} · {recurrence.productName}</strong>
                            <span>{formatMoney(recurrence.amount, displayCurrency)} · {new Date(`${recurrence.nextIssueDate}T00:00:00`).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="dashboard-recurring-status">
                            <span className={overdue ? 'overdue' : 'upcoming'}>{overdue ? 'Échéance en attente' : 'À venir'}</span>
                            <small>{recurrence.productType !== 'product' ? 'Service sans suivi de stock' : stockInsufficient ? 'Stock insuffisant · 0 disponible' : `Stock : ${recurrence.stockQuantity} disponible(s)`}</small>
                          </div>
                          {stockInsufficient && accessiblePages.has('Stock') && <button type="button" className="outline-button" onClick={() => navigate('Stock')}>Voir le stock</button>}
                        </article>
                      })}
                    </div>}
              </section>}

              <section className="content-grid">
                <div className="panel revenue-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Évolution des encaissements</h2>
                      <p>Somme des paiements réellement reçus, par date de paiement</p>
                    </div>
                    <span className="dashboard-chart-period">6 derniers mois</span>
                  </div>
                  <div className="chart-summary">
                    <strong>{monthlyRevenue.reduce((total, month) => total + month.amount, 0).toLocaleString('fr-FR')} <small>{displayCurrency}</small></strong>
                    <span className="positive"><ArrowUpRight size={15} /> Total encaissé <em>sur 6 mois</em></span>
                  </div>
                  <RevenueChart monthly={monthlyRevenue} />
                </div>
                <div className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Actions rapides</h2>
                      <p>Gagnez du temps au quotidien</p>
                    </div>
                  </div>
                  <div className="quick-actions">
                    {canEdit && <QuickAction icon={<Plus size={19} />} label="Créer une facture" onClick={openInvoiceModal} />}
                    {canEdit && <QuickAction icon={<UserRound size={19} />} label="Ajouter un client" onClick={() => navigate('Clients')} />}
                    {canEdit && <QuickAction icon={<Package size={19} />} label="Ajouter un produit" onClick={() => navigate('Produits & Services')} />}
                    <QuickAction icon={<FileText size={19} />} label="Voir les rapports" onClick={() => navigate('Rapports')} />
                  </div>
                </div>
              </section>

              <section className="content-grid dashboard-analytics">
                <div className="panel">
                  <div className="panel-heading"><div><h2>Meilleurs clients</h2><p>Chiffre d’affaires facturé</p></div></div>
                  {dashboardAnalytics.topClients.length ? dashboardAnalytics.topClients.map((client, index) => <div className="analytics-row" key={`${client.name}-${index}`}><span>{client.name}</span><strong>{client.amount.toLocaleString('fr-FR')} FCFA</strong></div>) : <p className="muted-cell">Pas encore de données.</p>}
                </div>
                <div className="panel">
                  <div className="panel-heading"><div><h2>Meilleurs produits/services</h2><p>Ventes cumulées</p></div></div>
                  {dashboardAnalytics.topProducts.length ? dashboardAnalytics.topProducts.map((product, index) => <div className="analytics-row" key={`${product.name}-${index}`}><span>{product.name}<small>{product.quantity} vendu(s)</small></span><strong>{product.amount.toLocaleString('fr-FR')} FCFA</strong></div>) : <p className="muted-cell">Pas encore de données.</p>}
                </div>
                <div className="panel">
                  <div className="panel-heading"><div><h2>Répartition des ventes</h2><p>Par statut de facture</p></div></div>
                  {dashboardAnalytics.statusBreakdown.length ? dashboardAnalytics.statusBreakdown.map((item) => <div className="analytics-row" key={item.status}><span>{item.status}</span><strong>{item.count} · {item.amount.toLocaleString('fr-FR')} FCFA</strong></div>) : <p className="muted-cell">Pas encore de données.</p>}
                </div>
                <div className="panel">
                  <div className="panel-heading"><div><h2>Impayés à surveiller</h2><p>Factures échues non réglées</p></div></div>
                  {dashboardAnalytics.overdue.length ? dashboardAnalytics.overdue.map((item) => <div className="analytics-row" key={item.invoice}><span>{item.invoice}<small>{item.client} · échéance {new Date(item.dueDate).toLocaleDateString('fr-FR')}</small></span><strong>{item.remaining.toLocaleString('fr-FR')} FCFA</strong></div>) : <p className="muted-cell">Aucun impayé échu.</p>}
                </div>
              </section>

              <section className="panel invoices-panel">
                <div className="panel-heading invoices-heading">
                  <div>
                    <h2>Factures récentes</h2>
                    <p>Les dernières factures créées dans votre entreprise</p>
                  </div>
                  <div className="invoice-tools">
                    <label className="search-box">
                      <Search size={17} />
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher..." />
                    </label>
                    <button className="outline-button" onClick={() => navigate('Factures')}>Voir toutes <ChevronRight size={15} /></button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>N° DE FACTURE</th><th>CLIENT</th><th>DATE</th><th>MONTANT</th><th>STATUT</th><th /></tr></thead>
                    <tbody>
                      {filteredInvoices.map((invoice) => (
                        <tr key={invoice.number}>
                          <td className="invoice-number">{invoice.number}</td>
                          <td><div className="customer-cell"><span className={`customer-avatar ${invoice.tone}`}>{invoice.initials}</span>{invoice.customer}</div></td>
                          <td className="muted-cell">{invoice.date}</td>
                          <td className="amount-cell">{invoice.amount}</td>
                          <td><span className={`status status-${invoice.status.replace(' ', '-').toLowerCase()}`}><i />{invoice.status}</span></td>
                          <td><button type="button" className="row-menu" onClick={() => void printInvoice(invoice.number)} aria-label={`Imprimer ${invoice.number}`} title="Imprimer"><FileText size={17} /></button><button type="button" className="row-menu" onClick={() => void downloadInvoicePdf(invoice.number)} aria-label={`Télécharger ${invoice.number}`} title="Télécharger en PDF"><Download size={17} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            activePage === 'Administration' ? <PlatformAdminPage overview={platformAdminOverview} /> : activePage === 'Rapports' ? <ReportPage businessId={businessId} currency={businessProfile?.currency ?? 'FCFA'} /> : activePage === 'Assistant IA' ? <AiAssistantPage businessId={businessId} onUseInvoice={(draft) => {
              const usableLines = draft.lines.flatMap((line) => {
                const product = products.find((item) => item.id === line.productId)
                return product ? [{ product, quantity: line.quantity }] : []
              })
              setInvoiceLines(usableLines)
              setSelectedClient('')
              openInvoiceModal()
              setDataMessage(usableLines.length < draft.lines.length ? 'Certaines lignes n’existent pas dans votre catalogue et doivent être ajoutées manuellement.' : '')
            }} /> : activePage === 'Mon entreprise' ? <BusinessPage businessId={businessId} /> : activePage === 'Paramètres' ? <SettingsPage businessId={businessId} onProfileChanged={(profile) => setBusinessProfile(profile)} /> : activePage === 'Mon compte' ? <AccountSecurityPage email={session.user.email ?? ''} businessId={businessId} fullName={typeof session.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name : ''} phone={typeof session.user.user_metadata?.phone === 'string' ? session.user.user_metadata.phone : ''} avatarUrl={typeof session.user.user_metadata?.avatar_url === 'string' ? session.user.user_metadata.avatar_url : ''} onAvatarChanged={(url) => setSession((current) => current ? { ...current, user: { ...current.user, user_metadata: { ...current.user.user_metadata, avatar_url: url } } } : current)} /> : activePage === 'Journal d’audit' ? <AuditPage businessId={businessId} /> : activePage === 'Équipe' ? <TeamPage businessId={businessId} userId={session?.user?.id ?? ''} /> : activePage === 'Abonnement' ? <SubscriptionPage businessId={businessId} demoAccess={demoOwnerAccess} onSubscriptionChange={handleSubscriptionChange} /> : activePage === 'Besoin d’aide' ? <HelpPage businessId={businessId} email={session.user.email ?? ''} fullName={typeof session.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name : ''} accessiblePages={accessiblePages} onNavigate={navigate} />             : <ModulePage page={activePage} businessId={businessId} currency={displayCurrency} timezone={businessProfile?.timezone ?? 'Africa/Porto-Novo'} canEdit={canEdit} canEmail={canEdit} invoiceRefreshKey={invoiceRefreshKey} onBack={() => navigate('Tableau de bord')} onCreate={() => activePage === 'Factures' ? openInvoiceModal() : undefined} onPrint={printInvoice} onDownload={downloadInvoicePdf} onEmail={emailInvoice} />
          )}
        </div>
      </main>

      {showInvoiceModal && (
        <div className="modal-backdrop" onClick={() => setShowInvoiceModal(false)}>
          <form className="invoice-modal" onSubmit={(event) => { event.preventDefault(); void submitInvoice() }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">NOUVELLE VENTE</p><h2>Créer une facture</h2></div>
              <button type="button" className="icon-button" onClick={() => setShowInvoiceModal(false)} aria-label="Fermer"><X size={20} /></button>
            </div>
            <div className="invoice-form-grid">
              <label>Type de facture<select value={invoiceType} onChange={(event) => setInvoiceType(event.target.value as InvoiceDocumentType)}>{(Object.keys(invoiceDocumentTypeLabels) as InvoiceDocumentType[]).map((type) => <option value={type} key={type} disabled={type !== 'STANDARD' && !(demoOwnerAccess || hasFeatureForUser(subscriptionPlan, 'advancedInvoiceTypes', session?.user?.email))}>{invoiceDocumentTypeLabels[type]}{type !== 'STANDARD' && !(demoOwnerAccess || hasFeatureForUser(subscriptionPlan, 'advancedInvoiceTypes', session?.user?.email)) ? ' — Starter requis' : ''}</option>)}</select><small>{invoiceType === 'PROFORMA' ? 'Document prévisionnel, non comptabilisé comme facture définitive.' : invoiceType === 'DEPOSIT' ? 'Document pour enregistrer un acompte avant la livraison complète.' : invoiceType === 'CREDIT_NOTE' ? "Document d'avoir pour corriger ou annuler une facturation précédente." : invoiceType === 'FINAL' ? 'Document final après une facture proforma ou un acompte.' : 'Facture commerciale classique.'}</small></label>
              <label>Client<input className="invoice-search-input" value={invoiceClientSearch} onChange={(event) => setInvoiceClientSearch(event.target.value)} placeholder="Rechercher un client..." /><select required value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}><option value="">Sélectionner un client</option>{filteredInvoiceClients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
              <label>Date de facture<input required type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></label>
              <label>{invoiceType === 'CREDIT_NOTE' ? 'Date de correction' : invoiceType === 'DEPOSIT' ? "Date d'échéance de l'acompte" : "Date d'échéance"}<input required type="date" min={invoiceDate} value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} /></label>
            </div>
            <div className="invoice-line-builder">
              <div className="invoice-line-builder-heading"><div><h3>{invoiceType === 'CREDIT_NOTE' ? "Articles à créditer" : invoiceType === 'DEPOSIT' ? "Articles concernés par l'acompte" : 'Articles et services'}</h3><p>{invoiceType === 'PROFORMA' ? 'Préparez une estimation détaillée pour votre client.' : 'Ajoutez une ou plusieurs lignes à la facture.'}</p></div><span>{invoiceLines.length} ligne{invoiceLines.length > 1 ? 's' : ''}</span></div>
              <div className="invoice-line-fields"><label>Produit ou service<input className="invoice-search-input" value={invoiceProductSearch} onChange={(event) => setInvoiceProductSearch(event.target.value)} placeholder="Rechercher un produit ou service..." /><select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}><option value="">Choisir un produit</option>{filteredInvoiceProducts.map((product) => <option value={product.id} key={product.id}>{product.name} — {formatInvoiceAmount(product.price)}{product.product_type === 'product' ? ` (stock: ${product.stock_quantity ?? 0})` : ''}</option>)}</select></label><label>Quantité<input type="number" min="0.01" step="0.01" value={invoiceQuantity} onChange={(event) => setInvoiceQuantity(event.target.value)} /></label><button className="outline-button" type="button" onClick={addInvoiceLine}>Ajouter</button></div>
              {invoiceLines.length ? <div className="invoice-lines"><div className="invoice-line invoice-line-head"><span>Désignation</span><span>Qté</span><span>Prix unitaire</span><span>Total</span><span /></div>{invoiceLines.map((line, index) => <div className="invoice-line" key={`${line.product.id}-${index}`}><div><strong>{line.product.name}</strong><span>{line.product.product_type === 'product' ? 'Produit' : 'Service'}</span></div><span>{line.quantity}</span><span>{formatInvoiceAmount(line.product.price)}</span><strong>{formatInvoiceAmount(line.product.price * line.quantity)}</strong><button type="button" className="line-remove" onClick={() => setInvoiceLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} aria-label={`Supprimer ${line.product.name}`}><X size={15} /></button></div>)}</div> : <p className="invoice-lines-empty">Aucune ligne ajoutée. Sélectionnez un produit ou un service ci-dessus.</p>}
            </div>
            <div className="invoice-adjustments"><label>Réduction ({invoiceCurrency})<input type="number" min="0" max={invoiceSubtotal} step="0.01" value={invoiceDiscount} onChange={(event) => setInvoiceDiscount(event.target.value)} /></label><label>Taxe (%)<input type="number" min="0" max="100" step="0.01" value={invoiceTaxRate} onChange={(event) => setInvoiceTaxRate(event.target.value)} /></label></div>
            <div className="invoice-summary"><div><span>Sous-total</span><strong>{formatInvoiceAmount(invoiceSubtotal)}</strong></div><div><span>Réduction</span><strong>- {formatInvoiceAmount(invoiceDiscountAmount)}</strong></div><div><span>Taxe</span><strong>{formatInvoiceAmount(invoiceTaxAmount)}</strong></div><div className="invoice-summary-total"><span>Total estimé</span><strong>{formatInvoiceAmount(invoiceTotal)}</strong></div></div>
            {dataMessage && <div className="settings-message">{dataMessage}</div>}
            <button className="primary-button full-width" disabled={invoiceBusy}>{invoiceBusy ? 'Enregistrement...' : 'Créer la facture'}</button>
          </form>
        </div>
      )}
    </div>
  )
}

function ConfigurationError() {
  return <main className="auth-shell"><div className="auth-brand"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></div><section className="auth-card"><h1>Configuration nécessaire</h1><p className="auth-subtitle">L’application est bien démarrée, mais elle ne peut pas se connecter à Supabase.</p><div className="data-warning">{supabaseConfigError}</div><p className="auth-subtitle">Copiez .env.example vers .env, renseignez les deux valeurs Supabase, puis redémarrez Vite.</p></section></main>
}

function AiAssistantPage({ businessId, onUseInvoice }: { businessId: string; onUseInvoice: (draft: AiInvoiceDraft) => void }) {
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [answer, setAnswer] = useState('')
  const [forecast, setForecast] = useState<AiForecast | null>(null)
  const [analysis, setAnalysis] = useState<AiExpenseAnalysis | null>(null)
  const [invoice, setInvoice] = useState<AiInvoiceDraft | null>(null)
  const [usage, setUsage] = useState<AiUsage | null>(null)
  const [dataSummary, setDataSummary] = useState<AiDataSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const quotaReached = usage?.remaining === 0

  const run = async (action: 'assistant' | 'forecast' | 'expenses' | 'invoice') => {
    setBusy(true)
    setError('')
    setAnswer('')
    setForecast(null)
    setAnalysis(null)
    setInvoice(null)
    setDataSummary(null)
    try {
      const result = await runAiAction(action, businessId, { question, description })
      setAnswer(result.answer ?? '')
      setForecast(result.forecast ?? null)
      setAnalysis(result.analysis ?? null)
      setInvoice(result.invoice ? normalizeAiInvoiceDraft(result.invoice) : null)
      setUsage(result.usage)
      setDataSummary(result.dataSummary)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le service IA est indisponible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="module-page">
      <div className="module-heading">
        <div><p className="eyebrow">INTELLIGENCE ARTIFICIELLE</p><h1>Assistant financier</h1><p>Analysez votre activité et préparez vos décisions avec les données de votre entreprise.</p></div>
        <Sparkles size={28} />
      </div>
      <div className="panel ai-privacy-notice">
        <div><ShieldCheck size={18} /><strong>Confidentialité et utilisation</strong></div>
        <p>Les requêtes et les résultats restent affichés uniquement pendant cette session et ne sont pas enregistrés dans l’historique de l’application. Les données utiles à l’action choisie et votre texte sont transmis depuis Supabase à OpenAI pour produire la réponse. Les règles de conservation du fournisseur s’appliquent ; évitez d’inclure des informations sensibles non nécessaires.</p>
        <p>Limite : 20 requêtes par jour et par compte, toutes entreprises confondues. Seuls les compteurs d’utilisation (sans question, réponse ni données financières) sont nettoyés lors d’une requête suivante lorsqu’ils dépassent 90 jours.</p>
        {usage && <small>Utilisation aujourd’hui : {usage.used}/{usage.limit} requêtes · {usage.remaining} restante{usage.remaining === 1 ? '' : 's'} · réinitialisation le {new Date(usage.resetsAt).toLocaleString('fr-FR')}.</small>}
        {quotaReached && <small>Limite quotidienne atteinte : l’accès sera rétabli à la prochaine réinitialisation indiquée ci-dessus.</small>}
      </div>
      <div className="content-grid">
        <div className="panel">
          <div className="panel-heading"><div><h2>Poser une question</h2><p>Ventes, impayés, trésorerie ou dépenses.</p></div></div>
          <p className="ai-source-details">Données envoyées : jusqu’à 240 factures récentes (client, dates, statut, montants, paiements) et 240 dépenses (libellé, catégorie, date, montant, note). Les données sont limitées à cette entreprise.</p>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ex. Quels clients ont les plus gros montants impayés ?" rows={5} />
          <button className="primary-button" disabled={busy || quotaReached || !question.trim()} onClick={() => void run('assistant')}><Send size={17} />{busy ? 'Analyse...' : 'Demander une analyse'}</button>
          {answer && <div className="settings-message success">{answer}</div>}
          {answer && dataSummary && <small className="ai-result-source">Sources utilisées : {dataSummary.invoices} facture(s) et {dataSummary.expenses} dépense(s){dataSummary.truncated ? ' (historique limité aux enregistrements les plus récents)' : ''}.</small>}
        </div>
        <div className="panel">
          <div className="panel-heading"><div><h2>Prévisions</h2><p>Estimation indicative des 3 prochains mois, pas une garantie de résultat.</p></div></div>
          <p className="ai-source-details">Données envoyées : historique mensuel calculé à partir des factures et dépenses récentes (jusqu’à 240 de chaque), avec les encaissements rapprochés ventilés par date de paiement, plus au maximum 100 résumés de factures. Le chiffre facturé est classé par date d’émission ; les dépenses par date de dépense. Le flux net est calculé comme encaissements prévus moins dépenses prévues.</p>
          <button className="outline-button" disabled={busy || quotaReached} onClick={() => void run('forecast')}>Prévoir chiffre d’affaires</button>
          {forecast && <div className="analytics-list"><p>{forecast.summary}</p>{forecast.months.map((month) => <div className="analytics-row" key={month.month}><span>{month.month}<small>Encaissements prévus {month.cashIn.toLocaleString('fr-FR')} FCFA</small></span><strong>{month.netCashFlow.toLocaleString('fr-FR')} FCFA net</strong></div>)}<small>Confiance indicative : {forecast.confidence}. Hypothèses : {forecast.assumptions.join(' ') || 'continuité des tendances observées'}.</small><p className="ai-result-source">Limites : les retards, saisonnalités, événements exceptionnels et changements futurs peuvent ne pas être représentés. Le flux net est une estimation mensuelle, pas un solde de trésorerie ni un conseil comptable.</p>{dataSummary && <small className="ai-result-source">Sources utilisées : {dataSummary.invoices} facture(s), {dataSummary.expenses} dépense(s), {dataSummary.months} mois d’historique{dataSummary.truncated ? ' (données limitées aux enregistrements les plus récents)' : ''}.</small>}</div>}
        </div>
        <div className="panel">
          <div className="panel-heading"><div><h2>Analyse des dépenses</h2><p>Catégories principales et recommandations.</p></div></div>
          <p className="ai-source-details">Données envoyées : jusqu’à 240 dépenses récentes (libellé, catégorie, date, montant et note). Les recommandations ne remplacent pas un contrôle comptable.</p>
          <button className="outline-button" disabled={busy || quotaReached} onClick={() => void run('expenses')}>Analyser mes dépenses</button>
          {analysis && <div className="analytics-list"><p>{analysis.summary}</p>{analysis.recommendations.map((item, index) => <div className="analytics-row" key={`${item.title}-${index}`}><span>{item.title}<small>{item.detail}</small></span><strong>{item.priority}</strong></div>)}{dataSummary && <small className="ai-result-source">Sources utilisées : {dataSummary.expenses} dépense(s){dataSummary.truncated ? ' (historique limité aux enregistrements les plus récents)' : ''}.</small>}</div>}
        </div>
        <div className="panel">
          <div className="panel-heading"><div><h2>Générer une facture</h2><p>Décrivez la vente, puis vérifiez chaque ligne avant création.</p></div></div>
          <p className="ai-source-details">Données envoyées : votre description et jusqu’à 240 produits/services du catalogue (nom, prix, type). Aucun document n’est créé ou envoyé par l’IA.</p>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex. 2 logos à 75 000 FCFA et une maintenance mensuelle." rows={5} />
          <button className="primary-button" disabled={busy || quotaReached || !description.trim()} onClick={() => void run('invoice')}><Sparkles size={17} />Générer un brouillon</button>
          {invoice && <div className="analytics-list"><p><strong>{invoice.title}</strong></p>{invoice.lines.map((line, index) => <div className="analytics-row" key={`${line.description}-${index}`}><span>{line.description}<small>{line.quantity} × {line.unitPrice.toLocaleString('fr-FR')} FCFA</small></span><strong>{(line.quantity * line.unitPrice).toLocaleString('fr-FR')} FCFA</strong></div>)}<p className="ai-draft-warning">Brouillon non validé : vérifiez les quantités, prix, taxes, client et dates. Seules les lignes associées à un produit du catalogue seront reprises ; ajoutez manuellement les autres. La facture ne sera créée qu’après votre validation dans le formulaire.</p><button className="outline-button" disabled={!invoice.lines.some((line) => line.productId)} onClick={() => onUseInvoice(invoice)}>Vérifier dans le formulaire de facture</button>{dataSummary && <small className="ai-result-source">Sources utilisées : {dataSummary.products} produit(s)/service(s){dataSummary.truncated ? ' (catalogue limité)' : ''}.</small>}</div>}
        </div>
      </div>
      {error && <div className="settings-message">{error}</div>}
    </section>
  )
}

function HelpPage({ businessId, email, fullName, accessiblePages, onNavigate }: { businessId: string; email: string; fullName: string; accessiblePages: ReadonlySet<string>; onNavigate: (page: string) => void }) {
  const [query, setQuery] = useState('')
  const [contact, setContact] = useState({ name: fullName, email, subject: '', body: '' })
  const [tickets, setTickets] = useState<Awaited<ReturnType<typeof loadMySupportTickets>>>([])
  const [selectedTicket, setSelectedTicket] = useState<Awaited<ReturnType<typeof loadPublicSupportTicket>> | null>(null)
  const [ticketId, setTicketId] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [reply, setReply] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadMySupportTickets().then((items) => { if (!cancelled) setTickets(items) }).catch((loadError: unknown) => {
      if (!cancelled) setError(userFacingError(loadError, 'Impossible de charger vos demandes de support.'))
    })
    return () => { cancelled = true }
  }, [businessId])

  const guides = [
    { title: 'Démarrer dans FactureFacile', page: 'Tableau de bord', body: 'Complétez d’abord les informations de votre entreprise, ajoutez vos clients et votre catalogue, puis créez une facture. Vérifiez les coordonnées et les montants avant l’envoi.' },
    { title: 'Clients et produits/services', page: 'Clients', body: 'Créez et entretenez les fiches clients. Le catalogue conserve les prix, unités, services et niveaux de stock pour préparer vos ventes.' },
    { title: 'Factures', page: 'Factures', body: 'Créez, consultez, imprimez ou téléchargez un PDF. Les dates et les montants restent ceux enregistrés sur la facture ; les paramètres ne recalculent pas les documents déjà émis.' },
    { title: 'Paiements et dépenses', page: 'Paiements', body: 'Associez chaque encaissement à une facture et consultez les paiements et dépenses dans leurs modules. Vérifiez les références avant de corriger ou annuler une opération.' },
    { title: 'Factures récurrentes et automatisation', page: 'Factures récurrentes', body: 'Choisissez une fréquence et une date d’émission, puis consultez l’historique automatisé. Une échéance passée sans exécution doit être vérifiée avant toute reprise manuelle.' },
    { title: 'Rapports et indicateurs', page: 'Rapports', body: 'Choisissez une période, consultez les encaissements, factures et dépenses, puis exportez les résultats. Le chiffre facturé, l’encaissement et le bénéfice sont des indicateurs distincts.' },
    { title: 'Équipe et rôles', page: 'Équipe', body: 'Les invitations et rôles d’équipe déterminent les données et actions accessibles. Révisez régulièrement les accès et retirez les membres qui n’en ont plus besoin.' },
    { title: 'Abonnement et paiements', page: 'Abonnement', body: 'Consultez la formule active, les limites et l’historique de paiement. Vérifiez le statut d’une transaction auprès du fournisseur avant de relancer un paiement.' },
    { title: 'Assistant IA', page: 'Assistant IA', body: 'Les réponses et prévisions sont indicatives. Vérifiez les sources, les hypothèses, les taxes et les montants ; aucune facture ne doit être créée sans validation humaine.' },
    { title: 'Journal d’audit', page: 'Journal d’audit', body: 'Le journal retrace les changements enregistrés. Vérifiez l’acteur et les détails avant toute action de maintenance ou demande de suppression.' },
    { title: 'Paramètres et entreprise', page: 'Paramètres', body: 'Les paramètres définissent les valeurs par défaut des prochaines factures. Le profil de l’entreprise fournit coordonnées, modalités de paiement et mentions affichées sur les documents.' },
    { title: 'Compte et sécurité', page: 'Mon compte', body: 'Modifiez votre mot de passe, configurez une application TOTP, mettez à jour l’adresse e-mail ou exportez les données accessibles à votre rôle.' },
  ]
  const faqs = [
    ['Comment récupérer mon compte ?', 'Depuis Mon compte, demandez l’envoi d’un lien de récupération à votre adresse e-mail. Vérifiez aussi les courriers indésirables.'],
    ['Comment changer mon adresse e-mail ?', 'Saisissez la nouvelle adresse dans Mon compte. Elle ne devient effective qu’après confirmation via le lien envoyé par Supabase.'],
    ['Comment activer la double authentification ?', 'Dans Mon compte, configurez une application compatible TOTP, scannez le QR code puis confirmez avec le code à 6 chiffres. Le code sera demandé à la connexion.'],
    ['Comment suivre une demande au support ?', 'Après l’envoi du formulaire, conservez l’identifiant et le code de suivi affichés. Utilisez-les dans la section de suivi pour consulter la réponse et répondre.'],
    ['Puis-je supprimer mes données moi-même ?', 'Vous pouvez envoyer une demande de suppression depuis Mon compte. Le support examine la portée, les données partagées et les obligations de conservation avant toute suppression.'],
    ['Que contient l’export JSON ?', 'Il rassemble les données de compte et d’entreprise visibles avec votre rôle. Les fichiers justificatifs et secrets de connexion ne sont pas intégrés au fichier JSON.'],
  ]
  const supportStatusLabel = (status: string) => ({
    open: 'Ouverte',
    in_progress: 'En cours',
    waiting: 'En attente',
    resolved: 'Résolue',
    closed: 'Fermée',
  }[status] ?? status)
  const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR')
  const visibleGuides = guides.filter((guide) => `${guide.title} ${guide.body}`.toLocaleLowerCase('fr-FR').includes(normalizedQuery))
  const visibleFaqs = faqs.filter(([question, answer]) => `${question} ${answer}`.toLocaleLowerCase('fr-FR').includes(normalizedQuery))

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await submitPublicSupportRequest(contact)
      setTicketId(result.ticket_id)
      setAccessCode(result.access_code)
      setSelectedTicket(await loadPublicSupportTicket(result.ticket_id, result.access_code))
      setTickets(await loadMySupportTickets())
      setContact((current) => ({ ...current, subject: '', body: '' }))
      setMessage(`Votre demande est enregistrée. Conservez le code de suivi : ${result.access_code}`)
    } catch (submitError) {
      setError(userFacingError(submitError, 'La demande n’a pas pu être enregistrée. Réessayez ou écrivez à contact@facturefacile.bj.'))
    } finally {
      setBusy(false)
    }
  }

  const followTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      setSelectedTicket(await loadPublicSupportTicket(ticketId.trim(), accessCode.trim()))
    } catch (followError) {
      setError(userFacingError(followError, 'Impossible de retrouver cette demande. Vérifiez l’identifiant et le code de suivi.'))
    } finally {
      setBusy(false)
    }
  }

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTicket) return
    setBusy(true)
    setError('')
    try {
      if (tickets.some((ticket) => ticket.id === selectedTicket.id)) await replyToMySupportTicket(selectedTicket.id, reply)
      else await replyToPublicSupportTicket(selectedTicket.id, accessCode, reply)
      setReply('')
      const refreshedTickets = await loadMySupportTickets()
      setTickets(refreshedTickets)
      const refreshedOwnedTicket = refreshedTickets.find((ticket) => ticket.id === selectedTicket.id)
      setSelectedTicket(refreshedOwnedTicket ?? await loadPublicSupportTicket(selectedTicket.id, accessCode))
    } catch (replyError) {
      setError(userFacingError(replyError, 'La réponse n’a pas pu être envoyée.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="module-page">
      <div className="module-heading">
        <div>
          <p className="eyebrow">CENTRE D’AIDE</p>
          <h1>Besoin d’aide ?</h1>
          <p>Consultez les réponses, les guides des modules et l’état de vos demandes au support.</p>
        </div>
      </div>
      <label className="help-search"><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans la FAQ et les guides..." /></label>
      <div className="help-page-grid">
        <section className="panel help-page-card help-wide-card">
          <div className="panel-heading"><div><h2>Guides par module</h2><p>Ouvrez un module directement depuis son guide.</p></div></div>
          <div className="help-guide-list">{visibleGuides.map((guide) => <article key={guide.title}><div><h3>{guide.title}</h3><p>{guide.body}</p></div><button className="outline-button" disabled={!accessiblePages.has(guide.page)} onClick={() => onNavigate(guide.page)}>{accessiblePages.has(guide.page) ? 'Ouvrir' : 'Accès non disponible'}</button></article>)}{visibleGuides.length === 0 && <p className="muted-cell">Aucun guide ne correspond à cette recherche.</p>}</div>
        </section>
        <section className="panel help-page-card">
          <div className="panel-heading"><div><h2>FAQ</h2><p>Réponses rapides aux questions courantes.</p></div></div>
          <div className="faq-list">{visibleFaqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}{visibleFaqs.length === 0 && <p className="muted-cell">Aucune question correspondante.</p>}</div>
        </section>
        <section className="panel help-page-card">
          <div className="panel-heading"><div><h2>Contacter le support</h2><p>Une demande sera associée à votre compte connecté.</p></div></div>
          <form className="help-support-form" onSubmit={(event) => void submitRequest(event)}>
            <label>Nom<input required maxLength={120} value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} /></label>
            <label>E-mail<input required type="email" maxLength={320} value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} /></label>
            <label>Objet<input required maxLength={160} value={contact.subject} onChange={(event) => setContact({ ...contact, subject: event.target.value })} /></label>
            <label>Votre demande<textarea required maxLength={5000} rows={5} value={contact.body} onChange={(event) => setContact({ ...contact, body: event.target.value })} /></label>
            <button className="primary-button" disabled={busy}>{busy ? 'Envoi...' : 'Envoyer la demande'}</button>
          </form>
          <p>Vous pouvez aussi écrire à <a href="mailto:contact@facturefacile.bj">contact@facturefacile.bj</a>.</p>
        </section>
        <section className="panel help-page-card">
          <div className="panel-heading"><div><h2>Suivi des demandes</h2><p>Demandes rattachées à votre compte et consultation par code.</p></div></div>
          {tickets.length ? <div className="help-ticket-list">{tickets.map((ticket) => <button className="help-ticket-item" key={ticket.id} onClick={() => { setTicketId(ticket.id); setSelectedTicket(ticket); setAccessCode('') }}><span><strong>{ticket.subject}</strong><small>{new Date(ticket.updated_at).toLocaleString('fr-FR')}</small></span><span className={`status status-${ticket.status}`}>{supportStatusLabel(ticket.status)}</span></button>)}</div> : <p className="muted-cell">Aucune demande enregistrée sur ce compte.</p>}
          <form className="help-support-form help-tracking-form" onSubmit={(event) => void followTicket(event)}>
            <label>Identifiant de la demande<input required value={ticketId} onChange={(event) => setTicketId(event.target.value)} /></label>
            <label>Code de suivi<input required autoComplete="off" value={accessCode} onChange={(event) => setAccessCode(event.target.value.toUpperCase())} /></label>
            <button className="outline-button" disabled={busy}>Consulter avec le code</button>
          </form>
          {selectedTicket && <div className="help-ticket-detail"><h3>{selectedTicket.subject}</h3><p>État : {supportStatusLabel(selectedTicket.status)}</p>{selectedTicket.messages.map((ticketMessage) => <article key={ticketMessage.id}><small>{ticketMessage.author_role} · {new Date(ticketMessage.created_at).toLocaleString('fr-FR')}</small><p>{ticketMessage.body}</p></article>)}{(accessCode || tickets.some((ticket) => ticket.id === selectedTicket.id)) && <form className="help-support-form" onSubmit={(event) => void sendReply(event)}><label>Répondre<textarea rows={3} maxLength={5000} required value={reply} onChange={(event) => setReply(event.target.value)} /></label><button className="outline-button" disabled={busy}>Envoyer la réponse</button></form>}</div>}
        </section>
      </div>
      {message && <div className="settings-message success" role="status">{message}</div>}
      {error && <div className="settings-message" role="alert">{error}</div>}
    </section>
  )
}

type PlatformAdminSection = 'Tableau de bord' | 'Utilisateurs' | 'Entreprises' | 'Abonnements' | 'Paiements' | 'Support' | 'Notifications' | 'Analytics' | 'Sécurité' | 'Journal d’audit' | 'Administrateurs' | 'Contenu' | 'Espace public' | 'Intégrations' | 'Health' | 'Incidents' | 'Paramètres' | 'Mon profil'

const platformRolePermissions: Record<string, Set<string>> = {
  super_admin: new Set(['overview', 'users', 'user_management', 'businesses', 'subscriptions', 'subscription_payments', 'support', 'notifications', 'analytics', 'audit', 'content', 'integrations', 'incidents', 'settings', 'admin_management', 'security']),
  admin: new Set(['overview', 'users', 'user_management', 'businesses', 'subscriptions', 'subscription_payments', 'support', 'notifications', 'analytics', 'audit', 'content', 'integrations', 'incidents']),
  support: new Set(['overview', 'users', 'businesses', 'support', 'notifications']),
  finance: new Set(['overview', 'subscriptions', 'subscription_payments', 'finance']),
  analyst: new Set(['overview', 'analytics', 'reports']),
}

const sectionPermissions: Partial<Record<PlatformAdminSection, string>> = {
  Utilisateurs: 'users',
  Entreprises: 'businesses',
  Abonnements: 'subscriptions',
  Paiements: 'subscription_payments',
  Support: 'support',
  Notifications: 'notifications',
  Analytics: 'analytics',
  Sécurité: 'security',
  'Journal d’audit': 'audit',
  Administrateurs: 'admin_management',
  Contenu: 'content',
  'Espace public': 'content',
  Intégrations: 'integrations',
  Health: 'integrations',
  Incidents: 'incidents',
  Paramètres: 'settings',
}

function PlatformPermissionMatrix() {
  const rows: [string, string[]][] = [
    ['Super Admin', ['Administrateurs', 'Permissions', 'Paramètres critiques', 'Sécurité', 'Abonnements', 'Entreprises', 'Utilisateurs', 'Audit']],
    ['Admin', ['Utilisateurs', 'Entreprises', 'Abonnements', 'Paiements', 'Support', 'Notifications', 'Analytics', 'Incidents']],
    ['Support', ['Utilisateurs', 'Entreprises support', 'Tickets', 'Notifications']],
    ['Finance Manager', ['Abonnements', 'Paiements', 'Revenus', 'Données financières']],
    ['Analyst', ['Statistiques', 'Analytics', 'Rapports']],
  ]
  return <div className="admin-permission-matrix"><div><h3>Matrice des permissions</h3><p>Les accès sont contrôlés côté Supabase par le rôle actif, pas uniquement par l’interface.</p>  </div><div className="table-wrap"><table><thead><tr><th>RÔLE</th><th>ACCÈS AUTORISÉS</th></tr></thead><tbody>{rows.map(([name, permissions]) => <tr key={name}><td><strong>{name}</strong></td><td>{permissions.join(' · ')}</td></tr>)}</tbody></table></div></div>
}

function PlatformAdminShell({ overview, session }: { overview: NonNullable<Awaited<ReturnType<typeof loadPlatformAdminOverview>>>; session: Session }) {
  const [currentOverview, setCurrentOverview] = useState(overview)
  const [overviewBusy, setOverviewBusy] = useState(false)
  const [overviewLastSync, setOverviewLastSync] = useState(() => new Date())
  const [section, setSection] = useState<PlatformAdminSection>('Tableau de bord')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [users, setUsers] = useState<Awaited<ReturnType<typeof loadPlatformUsersDetailed>>>([])
  const [businesses, setBusinesses] = useState<Awaited<ReturnType<typeof loadPlatformBusinessesDetailed>>>([])
  const [subscriptions, setSubscriptions] = useState<Awaited<ReturnType<typeof loadPlatformAdminSubscriptions>>>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<Awaited<ReturnType<typeof loadPlatformSubscriptionPlans>>>([])
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof loadPlatformSubscriptionPayments>>>([])
  const [tickets, setTickets] = useState<Awaited<ReturnType<typeof loadPlatformSupportTickets>>>([])
  const [notifications, setNotifications] = useState<Awaited<ReturnType<typeof loadPlatformNotifications>>>([])
  const [auditLogs, setAuditLogs] = useState<Awaited<ReturnType<typeof loadPlatformAuditLogs>>>([])
  const [securityEvents, setSecurityEvents] = useState<Awaited<ReturnType<typeof loadPlatformSecurityEvents>>>([])
  const [incidents, setIncidents] = useState<Awaited<ReturnType<typeof loadPlatformIncidents>>>([])
  const [integrations, setIntegrations] = useState<Awaited<ReturnType<typeof loadPlatformIntegrations>>>([])
  const [healthChecks, setHealthChecks] = useState<Awaited<ReturnType<typeof loadPlatformHealth>>>([])
  const [adminAccounts, setAdminAccounts] = useState<Awaited<ReturnType<typeof loadPlatformAdminAccounts>>>([])
  const [content, setContent] = useState<Awaited<ReturnType<typeof loadPlatformContent>>>([])
  const [publicSiteConfig, setPublicSiteConfig] = useState<PublicSiteConfig>(defaultPublicSiteConfig)
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof loadPlatformSettings>>>([])
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof loadPlatformAnalytics>> | null>(null)
  const [analyticsFilters, setAnalyticsFilters] = useState<PlatformAnalyticsFilters>({})
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [adminRefresh, setAdminRefresh] = useState(0)
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalResults, setGlobalResults] = useState<{ label: string; type: string; resourceId: string; section: PlatformAdminSection; status?: string | null; lastActivity?: string | null }[]>([])
  const [globalSearchBusy, setGlobalSearchBusy] = useState(false)
  const [globalSearchError, setGlobalSearchError] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('platform_recent_searches') ?? '[]') as string[] } catch { return [] }
  })
  const [notificationPreviewOpen, setNotificationPreviewOpen] = useState(false)
  const [operationalSummary, setOperationalSummary] = useState<Awaited<ReturnType<typeof loadPlatformOperationalSummary>> | null>(null)
  const [platformActivity, setPlatformActivity] = useState<Awaited<ReturnType<typeof loadPlatformActivity>>>([])
  const [overviewPeriod, setOverviewPeriod] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const periodRange = useMemo(() => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const ranges: Record<string, { from: Date; to: Date }> = {
      today: { from: startOfDay, to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) },
      '7d': { from: new Date(startOfDay.getTime() - 6 * 86400000), to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) },
      '30d': { from: new Date(startOfDay.getTime() - 29 * 86400000), to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) },
      month: { from: startOfMonth, to: endOfMonth },
      previous_month: { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: startOfMonth },
    }
    if (overviewPeriod === 'custom' && customFrom && customTo) {
      const customEnd = new Date(`${customTo}T00:00:00`)
      customEnd.setDate(customEnd.getDate() + 1)
      return { from: new Date(`${customFrom}T00:00:00`), to: customEnd }
    }
    const range = ranges[overviewPeriod] ?? ranges['30d']
    return range
  }, [overviewPeriod, customFrom, customTo])
  const refreshOverview = async () => {
    if (overviewBusy) return
    setOverviewBusy(true)
    try {
      const nextOverview = await loadPlatformAdminOverview({ from: periodRange.from.toISOString(), to: periodRange.to.toISOString() })
      if (nextOverview) {
        setCurrentOverview(nextOverview)
        setOverviewLastSync(new Date())
      }
      setAdminError('')
    } catch (error) {
      setAdminError(userFacingError(error, 'Impossible d’actualiser les statistiques du dashboard.'))
    } finally {
      setOverviewBusy(false)
    }
  }
  const items: { label: PlatformAdminSection; icon: typeof LayoutDashboard }[] = [
    { label: 'Tableau de bord', icon: LayoutDashboard },
    { label: 'Utilisateurs', icon: Users },
    { label: 'Entreprises', icon: ShoppingBag },
    { label: 'Abonnements', icon: WalletCards },
    { label: 'Paiements', icon: WalletCards },
    { label: 'Support', icon: CircleHelp },
    { label: 'Notifications', icon: Bell },
    { label: 'Analytics', icon: TrendingUp },
    { label: 'Sécurité', icon: ShieldCheck },
    { label: 'Journal d’audit', icon: Clock3 },
    { label: 'Administrateurs', icon: UserCog },
    { label: 'Espace public', icon: LayoutDashboard },
    { label: 'Intégrations', icon: Plug },
    { label: 'Health', icon: Server },
    { label: 'Incidents', icon: AlertTriangle },
    { label: 'Paramètres', icon: Settings },
    { label: 'Mon profil', icon: UserRound },
  ]
  const sectionDescription: Record<PlatformAdminSection, string> = {
    'Tableau de bord': 'Vue globale de la santé et de la croissance de la plateforme.',
    Utilisateurs: 'Recherchez et surveillez les comptes inscrits sur FactureFacile.',
    Entreprises: 'Supervisez les entreprises clientes et leur activité.',
    Abonnements: 'Suivez les formules, les activations et les expirations.',
    Paiements: 'Contrôlez uniquement les paiements liés aux abonnements plateforme.',
    Support: 'Centralisez les demandes et incidents remontés par les entreprises.',
    Notifications: 'Consultez les événements nécessitant une action de l’équipe.',
    Analytics: 'Analysez les tendances d’utilisation et les revenus.',
    Sécurité: 'Consultez les accès sensibles et les journaux d’audit.',
    'Journal d’audit': 'Consultez la traçabilité des actions sensibles de la plateforme.',
    Administrateurs: 'Gérez les accès et les rôles de l’équipe interne.',
    Contenu: 'Gérez les informations présentées sur le site public.',
    'Espace public': 'Modifiez chaque section de la page publique. Accès réservé au super administrateur.',
    Intégrations: 'Surveillez les connexions aux services externes.',
    Health: 'Vérifiez l’état opérationnel des composants de la plateforme.',
    Incidents: 'Suivez les incidents techniques et leur résolution.',
    Paramètres: 'Configurez les règles générales de la plateforme.',
    'Mon profil': 'Gérez votre identité, votre sécurité et vos préférences.',
  }
  useEffect(() => {
    let cancelled = false
    if (globalQuery.trim().length < 2) {
      setGlobalResults([])
      setGlobalSearchBusy(false)
      setGlobalSearchError('')
      return () => { cancelled = true }
    }
    setGlobalSearchBusy(true)
    setGlobalSearchError('')
    setGlobalResults([])
    const timer = window.setTimeout(() => void searchPlatformGlobal(globalQuery).then((results) => {
    if (!cancelled) setGlobalResults(results.map((result) => ({
      label: result.label,
      type: result.category,
      resourceId: result.resource_id,
      section: ({ Entreprise: 'Entreprises', Utilisateur: 'Utilisateurs', Abonnement: 'Abonnements', Transaction: 'Paiements', Ticket: 'Support', Incident: 'Incidents' }[result.category] ?? 'Tableau de bord') as PlatformAdminSection,
      status: result.status,
      lastActivity: result.last_activity_at,
    })))
    }).catch((error: unknown) => {
      if (!cancelled) {
        setGlobalResults([])
        setGlobalSearchError(userFacingError(error, 'La recherche globale a échoué. Réessayez.'))
      }
    }).finally(() => { if (!cancelled) setGlobalSearchBusy(false) }), 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [globalQuery])
  useEffect(() => {
    let cancelled = false
    void loadPlatformNotifications(10).then((recent) => {
      if (!cancelled && section !== 'Notifications') setNotifications(recent)
    }).catch((error: unknown) => {
      if (!cancelled) setAdminError(userFacingError(error, 'Impossible de charger les notifications.'))
    })
    return () => { cancelled = true }
  }, [adminRefresh, section])
  useEffect(() => {
    void refreshOverview()
    const interval = window.setInterval(() => { void refreshOverview() }, 60_000)
    return () => window.clearInterval(interval)
  }, [periodRange])
  useEffect(() => {
    if (!session.user.id || !navigator.onLine) return
    const channel = supabase.channel('platform-notifications-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_notifications' }, (payload) => {
        const notification = payload.new as Awaited<ReturnType<typeof loadPlatformNotifications>>[number]
        if (notification.recipient_user_id && notification.recipient_user_id !== session.user.id) return
        if (notification.recipient_role && notification.recipient_role !== role && role !== 'super_admin') return
        setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 100))
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void supabase.removeChannel(channel)
        }
      })
    return () => { void supabase.removeChannel(channel) }
  }, [role, session.user.id])
  useEffect(() => {
    const openResource = (event: Event) => {
      const detail = (event as CustomEvent<{ resourceType?: string; resourceId?: string }>).detail
      const target = detail.resourceType
      if (target === 'support_ticket') setSection('Support')
      if (target === 'platform_incident') setSection('Incidents')
      if (target === 'subscription_payment') setSection('Paiements')
      if (target === 'business_subscription') setSection('Abonnements')
      if (target === 'business') setSection('Entreprises')
      if (target === 'user') setSection('Utilisateurs')
      if (target === 'platform_audit') setSection('Journal d’audit')
      if (target === 'platform_integration') setSection('Intégrations')
      if (detail.resourceType) window.dispatchEvent(new CustomEvent('platform-resource-open', { detail }))
    }
    window.addEventListener('platform-resource', openResource)
    return () => window.removeEventListener('platform-resource', openResource)
  }, [])
  const unreadNotifications = notifications.filter((notification) => !notification.read_at)
  useEffect(() => {
    let cancelled = false
    const loadSection = async () => {
      setAdminError('')
      try {
        try {
          const loadedRole = await loadPlatformAdminRole()
          if (!cancelled) setRole(loadedRole)
        } catch {
          if (!cancelled) setRole(null)
        }
        if (section === 'Tableau de bord') {
          setDashboardLoading(true)
          setDashboardError('')
          try {
            const [summary, activity] = await Promise.all([loadPlatformOperationalSummary(), loadPlatformActivity()])
            setOperationalSummary(summary)
            setPlatformActivity(activity)
          } catch (error) {
            setDashboardError(userFacingError(error, 'Impossible de charger les données du dashboard.'))
          } finally {
            setDashboardLoading(false)
          }
          return
        }
        setAdminBusy(true)
        if (section === 'Utilisateurs') setUsers(await loadPlatformUsersDetailed())
        if (section === 'Entreprises') setBusinesses(await loadPlatformBusinessesDetailed())
        if (section === 'Abonnements') {
          const [loadedSubscriptions, loadedPlans] = await Promise.all([loadPlatformAdminSubscriptions(), loadPlatformSubscriptionPlans()])
          setSubscriptions(loadedSubscriptions)
          setSubscriptionPlans(loadedPlans)
        }
        if (section === 'Paiements') setPayments(await loadPlatformSubscriptionPayments())
        if (section === 'Support') setTickets(await loadPlatformSupportTickets())
        if (section === 'Notifications') setNotifications(await loadPlatformNotifications())
        if (section === 'Journal d’audit') setAuditLogs(await loadPlatformAuditLogs())
        if (section === 'Sécurité') {
          const [events, alerts] = await Promise.all([loadPlatformSecurityEvents(), loadPlatformNotifications(100)])
          setSecurityEvents(events)
          setNotifications(alerts)
        }
        if (section === 'Incidents') setIncidents(await loadPlatformIncidents())
        if (section === 'Intégrations') setIntegrations(await loadPlatformIntegrations())
        if (section === 'Health') setHealthChecks(await loadPlatformHealth())
        if (section === 'Administrateurs') setAdminAccounts(await loadPlatformAdminAccounts())
        if (section === 'Contenu') setContent(await loadPlatformContent())
        if (section === 'Espace public') setPublicSiteConfig((await loadPublicSiteConfig()) ?? defaultPublicSiteConfig)
        if (section === 'Paramètres') setSettings(await loadPlatformSettings())
        if (section === 'Analytics') setAnalytics(await loadPlatformAnalytics(analyticsFilters))
      } catch (error) {
        if (!cancelled) setAdminError(userFacingError(error, 'Impossible de charger les données administrateur.'))
      } finally {
        if (!cancelled) setAdminBusy(false)
      }
    }
    void loadSection()
    return () => { cancelled = true }
  }, [section, adminRefresh])
  return <div className="admin-shell">
    <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar-open' : ''}`}>
      <div className="admin-brand"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><div><strong>Facture<span>Facile</span></strong><small>ADMINISTRATION</small></div><button className="icon-button admin-close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu"><X size={20} /></button></div>
      <div className="admin-console-label"><ShieldCheck size={16} /><span>Console plateforme</span></div>
      <nav className="admin-nav" aria-label="Navigation administrateur">
        {([
          ['PRINCIPAL', ['Tableau de bord']],
          ['GESTION', ['Utilisateurs', 'Entreprises', 'Abonnements', 'Paiements']],
          ['RELATION CLIENT', ['Support', 'Notifications']],
          ['ANALYSE', ['Analytics']],
          ['SÉCURITÉ', ['Sécurité', 'Journal d’audit']],
          ['ADMINISTRATION', ['Administrateurs']],
          ['PLATEFORME', ['Espace public', 'Intégrations', 'Health', 'Incidents']],
          ['CONFIGURATION', ['Paramètres']],
          ['COMPTE', ['Mon profil']],
        ] as [string, PlatformAdminSection[]][]).map(([title, labels], groupIndex) => <div key={title}><p className={groupIndex ? 'admin-nav-spaced' : undefined}>{title}</p>{        items.filter(({ label }) => labels.includes(label)).filter(({ label }) => !sectionPermissions[label] || platformRolePermissions[role ?? '']?.has(sectionPermissions[label] ?? '')).map(({ label, icon: Icon }) => <button key={label} className={section === label ? 'active' : ''} onClick={() => { setSection(label); setSidebarOpen(false) }}><Icon size={18} /><span>{label}</span></button>)}</div>)}
      </nav>
      <div className="admin-sidebar-footer"><div className="admin-user"><div className="profile-avatar">{(session.user.user_metadata?.full_name ?? session.user.email ?? 'AD').slice(0, 2).toUpperCase()}</div><div><strong>{session.user.user_metadata?.full_name ?? session.user.email ?? 'Administrateur'}</strong><span>{({ super_admin: 'Super administrateur', admin: 'Administrateur', support: 'Support', finance: 'Finance Manager', analyst: 'Analyste' } as Record<string, string>)[role ?? ''] ?? 'Rôle en chargement'}</span></div></div><button className="admin-logout" onClick={() => void supabase.auth.signOut()}><LogOut size={17} /> Se déconnecter</button></div>
    </aside>
    {sidebarOpen && <button className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu" />}
    <main className="admin-main">
      <header className="admin-topbar">
        <button className="icon-button admin-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu"><Menu size={22} /></button>
        <div className="admin-breadcrumb"><span>Administration</span><ChevronRight size={14} /><strong>{section}</strong></div>
        <div className="admin-topbar-actions">
          <label className="admin-global-search"><Search size={14} /><input list="platform-recent-searches" value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} placeholder="Rechercher entreprise, utilisateur..." aria-label="Recherche globale" /></label>
          <datalist id="platform-recent-searches">{recentSearches.map((term) => <option key={term} value={term} />)}</datalist>
          <div className="admin-notification-wrap">
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotificationPreviewOpen((open) => !open)}><Bell size={19} />{unreadNotifications.length > 0 && <span className="admin-notification-badge">{unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}</span>}</button>
            {notificationPreviewOpen && <div className="admin-notification-popover">
              <div className="admin-notification-heading"><strong>Notifications</strong><button onClick={() => { setSection('Notifications'); setNotificationPreviewOpen(false) }}>Voir l’historique</button></div>
              {notifications.slice(0, 5).length ? notifications.slice(0, 5).map((notification) => <button className={notification.read_at ? 'admin-notification-item read' : 'admin-notification-item'} key={notification.id} onClick={() => { if (!notification.read_at) void markPlatformNotificationRead(notification.id).then(() => setAdminRefresh((value) => value + 1)); setSection('Notifications'); setNotificationPreviewOpen(false) }}><span><strong>{notification.title}</strong><small>{notification.message}</small></span><em>{new Date(notification.created_at).toLocaleDateString('fr-FR')}</em></button>) : <p className="admin-notification-empty">Aucune notification.</p>}
            </div>}
          </div>
          <div className="topbar-divider" />
          <span className="admin-email">{session.user.email}</span>
        </div>
        {globalQuery.trim().length >= 2 && !globalSearchBusy && <div className="admin-search-results">
          {globalSearchError ? <p className="admin-search-empty" role="alert">{globalSearchError}</p> : globalResults.length ? Object.entries(globalResults.reduce<Record<string, typeof globalResults>>((groups, result) => { (groups[result.type] ??= []).push(result); return groups }, {})).map(([category, results]) => <div className="admin-search-group" key={category}>
            <strong>{{ Entreprise: 'Entreprises', Utilisateur: 'Utilisateurs', Abonnement: 'Abonnements', Transaction: 'Transactions', Ticket: 'Tickets', Incident: 'Incidents' }[category] ?? category}</strong>
            {results.map((result) => <button key={`${result.type}-${result.resourceId}`} onClick={() => { setSection(result.section); window.dispatchEvent(new CustomEvent('platform-resource', { detail: { resourceType: ({ Entreprise: 'business', Utilisateur: 'user', Abonnement: 'business_subscription', Transaction: 'subscription_payment', Ticket: 'support_ticket', Incident: 'platform_incident' }[result.type]), resourceId: result.resourceId } })); setRecentSearches((items) => { const next = [globalQuery.trim(), ...items.filter((item) => item !== globalQuery.trim())].slice(0, 6); localStorage.setItem('platform_recent_searches', JSON.stringify(next)); return next }); setGlobalQuery('') }}><span>{result.label}</span><small>{result.status ? `${result.status} · ` : ''}{result.lastActivity ? new Date(result.lastActivity).toLocaleString('fr-FR') : `Ouvrir dans ${result.section}`}</small></button>)}
          </div>) : <p className="admin-search-empty">Aucun résultat ne correspond à votre recherche.</p>}
        </div>}
      </header>
      <div className="admin-page-content">
        <div className="admin-page-heading"><div><p className="eyebrow">CONSOLE PLATEFORME</p><h1>{section}</h1><p>{sectionDescription[section]}</p></div>{section === 'Tableau de bord' && <div className="admin-dashboard-actions"><span className="admin-live-badge"><i /> Données en direct</span><select className="admin-period-select" value={overviewPeriod} onChange={(event) => setOverviewPeriod(event.target.value)} aria-label="Période d’analyse"><option value="today">Aujourd’hui</option><option value="7d">7 derniers jours</option><option value="30d">30 derniers jours</option><option value="month">Ce mois</option><option value="previous_month">Mois précédent</option><option value="custom">Période personnalisée</option></select>{overviewPeriod === 'custom' && <span className="admin-custom-period"><input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} aria-label="Date de début" /><input type="date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} aria-label="Date de fin" /></span>}{overviewPeriod === 'custom' && customFrom && customTo && customFrom > customTo && <small className="admin-period-error">La date de début doit précéder la date de fin.</small>}<button className="outline-button" onClick={() => void refreshOverview()} disabled={overviewBusy || (overviewPeriod === 'custom' && (!customFrom || !customTo || customFrom > customTo))}><RefreshCw size={14} className={overviewBusy ? 'spin' : undefined} /> {overviewBusy ? 'Actualisation...' : 'Actualiser'}</button><small>Synchronisé à {overviewLastSync.toLocaleTimeString('fr-FR')}</small></div>}</div>
        {adminError && <div className="data-warning">{adminError}</div>}
        {section === 'Tableau de bord' ? <PlatformAdminPage overview={currentOverview} role={role} loading={dashboardLoading} error={dashboardError} operationalSummary={operationalSummary} activity={platformActivity} onRetry={() => setAdminRefresh((value) => value + 1)} onOpenSupport={() => setSection('Support')} onOpenHealth={() => setSection('Health')} onOpenSecurity={() => setSection('Sécurité')} onOpenSection={setSection} onRefresh={() => { setAdminRefresh((value) => value + 1); void refreshOverview() }} /> : ['Utilisateurs', 'Entreprises', 'Abonnements', 'Paiements'].includes(section) ? <PlatformAdminDataTable section={section} role={role} busy={adminBusy} users={users} businesses={businesses} subscriptions={subscriptions} subscriptionPlans={subscriptionPlans} payments={payments} /> : <PlatformAdminOperations section={section} analytics={analytics} analyticsFilters={analyticsFilters} onAnalyticsFiltersChange={(filters) => { setAnalyticsFilters(filters); setAdminRefresh((value) => value + 1) }} role={role} session={session} busy={adminBusy} tickets={tickets} notifications={notifications} securityEvents={securityEvents} auditLogs={auditLogs} incidents={incidents} integrations={integrations} healthChecks={healthChecks} adminAccounts={adminAccounts} content={content} settings={settings} publicSiteConfig={publicSiteConfig} onChanged={() => { setAdminRefresh((value) => value + 1); void refreshOverview() }} />}
      </div>
    </main>
  </div>
}

function NotificationsManagement({ notifications, runAction, onChanged }: { notifications: Awaited<ReturnType<typeof loadPlatformNotifications>>; runAction: (action: () => Promise<void>) => Promise<void>; onChanged: () => void }) {
  const [filters, setFilters] = useState({ query: '', type: '', severity: '', unreadOnly: false, from: '', to: '' })
  const [page, setPage] = useState(0)
  const [pageItems, setPageItems] = useState(notifications)
  const [notificationsError, setNotificationsError] = useState('')
  const [preferences, setPreferences] = useState<Awaited<ReturnType<typeof loadPlatformNotificationPreferences>>>([])
  const [showPreferences, setShowPreferences] = useState(false)
  useEffect(() => { void loadPlatformNotificationPreferences().then(setPreferences).catch(() => setPreferences([])) }, [])
  useEffect(() => {
    let cancelled = false
    setNotificationsError('')
    void loadPlatformNotifications(25, page * 25, filters).then((items) => {
      if (!cancelled) setPageItems(items)
    }).catch((error: unknown) => {
      if (!cancelled) setNotificationsError(error instanceof Error ? error.message : 'Impossible de charger les notifications.')
    })
    return () => { cancelled = true }
  }, [page, filters])
  useEffect(() => { setPageItems(notifications) }, [notifications])
  const typeLabels: Record<string, string> = {
    new_business: 'Nouvelle entreprise',
    new_user: 'Nouvel utilisateur',
    new_ticket: 'Nouveau ticket',
    urgent_ticket: 'Ticket urgent',
    failed_payment: 'Paiement échoué',
    expired_subscription: 'Abonnement expiré',
    technical_incident: 'Incident technique',
    security_issue: 'Problème de sécurité',
    integration_unavailable: 'Intégration indisponible',
  }
  const types = Object.keys(typeLabels)
  const updateFilters = (next: typeof filters) => { setPage(0); setFilters(next) }
  const updatePreference = (type: string, key: 'in_app_enabled' | 'email_enabled' | 'sms_enabled' | 'webhook_enabled' | 'critical_only', value: boolean) => {
    const current = preferences.find((item) => item.notification_type === type) ?? { notification_type: type, in_app_enabled: true, email_enabled: false, sms_enabled: false, webhook_enabled: false, critical_only: false }
    const next = { ...current, [key]: value }
    setPreferences((items) => [...items.filter((item) => item.notification_type !== type), next])
    void runAction(async () => { await setPlatformNotificationPreference(next); onChanged() })
  }
  return <section className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Centre de notifications</h2><p>Historique des entreprises, utilisateurs, tickets, paiements, abonnements, incidents, sécurité et intégrations.</p></div><span className="admin-role-context">{notifications.filter((item) => !item.read_at).length} non lue(s) / {notifications.length}</span></div><div className="notification-toolbar"><input placeholder="Rechercher..." value={filters.query} onChange={(event) => updateFilters({ ...filters, query: event.target.value })} /><select value={filters.type} onChange={(event) => updateFilters({ ...filters, type: event.target.value })}><option value="">Tous les types</option>{types.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select><select value={filters.severity} onChange={(event) => updateFilters({ ...filters, severity: event.target.value })}><option value="">Toutes les gravités</option><option value="info">Information</option><option value="warning">Avertissement</option><option value="critical">Critique</option></select><label><input type="checkbox" checked={filters.unreadOnly} onChange={(event) => updateFilters({ ...filters, unreadOnly: event.target.checked })} /> Non lues</label><label>Du<input type="date" value={filters.from} onChange={(event) => updateFilters({ ...filters, from: event.target.value })} /></label><label>Au<input type="date" value={filters.to} onChange={(event) => updateFilters({ ...filters, to: event.target.value })} /></label><button className="outline-button" onClick={() => void runAction(async () => { await markAllPlatformNotificationsRead(); onChanged() })}>Tout marquer comme lu</button><button className="outline-button" onClick={() => setShowPreferences((value) => !value)}>Préférences</button></div>{notificationsError && <p className="form-error">{notificationsError}</p>}{showPreferences && <div className="notification-preferences"><h3>Préférences de réception</h3><p>Les notifications dans l’interface sont actives immédiatement. L’e-mail, le SMS et le webhook nécessitent encore la configuration de leurs services d’envoi.</p>{types.map((type) => { const preference = preferences.find((item) => item.notification_type === type) ?? { notification_type: type, in_app_enabled: true, email_enabled: false, sms_enabled: false, webhook_enabled: false, critical_only: false }; return <div key={type}><strong>{typeLabels[type]}</strong><label><input type="checkbox" checked={preference.in_app_enabled} onChange={(event) => updatePreference(type, 'in_app_enabled', event.target.checked)} /> Interface</label><label><input type="checkbox" checked={preference.email_enabled} onChange={(event) => updatePreference(type, 'email_enabled', event.target.checked)} /> E-mail</label><label><input type="checkbox" checked={preference.sms_enabled} onChange={(event) => updatePreference(type, 'sms_enabled', event.target.checked)} /> SMS</label><label><input type="checkbox" checked={preference.webhook_enabled} onChange={(event) => updatePreference(type, 'webhook_enabled', event.target.checked)} /> Webhook</label><label><input type="checkbox" checked={preference.critical_only} onChange={(event) => updatePreference(type, 'critical_only', event.target.checked)} /> Critiques uniquement</label></div> })}</div>}<div className="table-wrap"><table><thead><tr><th>TYPE</th><th>TITRE</th><th>MESSAGE</th><th>GRAVITÉ</th><th>DATE</th><th>STATUT</th><th>ACTION</th></tr></thead><tbody>{pageItems.length ? pageItems.map((notification) => <tr key={notification.id}><td>{typeLabels[notification.type] ?? notification.type}</td><td><strong>{notification.title}</strong></td><td>  <button className="notification-resource-link" onClick={() => notification.resource_type && window.dispatchEvent(new CustomEvent('platform-resource', { detail: { resourceType: notification.resource_type, resourceId: notification.resource_id } }))}>{notification.message}</button></td><td>{notification.severity}</td><td className="muted-cell">{new Date(notification.created_at).toLocaleString('fr-FR')}</td><td><span className={notification.read_at ? 'notification-status read' : 'notification-status unread'}>{notification.read_at ? 'Lue' : 'Non lue'}</span></td><td><button className="outline-button" onClick={() => void runAction(() => notification.read_at ? markPlatformNotificationUnread(notification.id) : markPlatformNotificationRead(notification.id))}>{notification.read_at ? 'Marquer non lue' : 'Marquer lue'}</button><button className="outline-button" onClick={() => void runAction(() => archivePlatformNotification(notification.id))}>Archiver</button></td></tr>) : <tr><td colSpan={7} className="muted-cell">Aucune notification correspondant aux filtres.</td></tr>}</tbody></table></div><div className="notification-pagination"><button className="outline-button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Précédent</button><span>Page {page + 1}{pageItems.length === 25 ? ' ou plus' : ''}</span><button className="outline-button" disabled={pageItems.length < 25} onClick={() => setPage((value) => value + 1)}>Suivant</button></div></section>
}

function ContentManagement({ content, runAction }: { content: Awaited<ReturnType<typeof loadPlatformContent>>; runAction: (action: () => Promise<void>) => Promise<void> }) {
  const [editing, setEditing] = useState<Awaited<ReturnType<typeof loadPlatformContent>>[number]>({ id: '', content_type: 'faq', slug: '', title: '', body: '', status: 'draft', updated_by: null, updated_at: new Date().toISOString() })
  const types = { faq: 'FAQ', feature: 'Fonctionnalité', plan: 'Plan tarifaire', announcement: 'Annonce', article: 'Article', resource: 'Ressource' }
  const save = () => void runAction(async () => { await upsertPlatformContent(editing); setEditing({ ...editing, id: '' }) })
  return <section className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Contenu public</h2><p>Gérez les contenus sans modifier le code.</p></div><button className="outline-button" onClick={() => setEditing({ ...editing, id: '', slug: '', title: '', body: '', status: 'draft' })}>Nouveau</button></div><div className="admin-content-editor"><label>Type<select value={editing.content_type} onChange={(event) => setEditing({ ...editing, content_type: event.target.value })}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Slug<input value={editing.slug} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} /></label><label>Titre<input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label><label>État<select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as 'draft' | 'published' | 'archived' })}><option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Archivé</option></select></label><label>Contenu<textarea rows={5} value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} /></label><button className="primary-button" disabled={!editing.slug.trim() || !editing.title.trim()} onClick={save}>{editing.id ? 'Enregistrer' : 'Créer'}</button></div><div className="table-wrap"><table><thead><tr><th>TYPE</th><th>TITRE</th><th>ÉTAT</th><th>ACTION</th></tr></thead><tbody>{content.map((item) => <tr key={item.id}><td>{types[item.content_type as keyof typeof types] ?? item.content_type}</td><td>{item.title}</td><td>{item.status === 'draft' ? 'Brouillon' : item.status === 'published' ? 'Publié' : 'Archivé'}</td><td><button className="outline-button" onClick={() => setEditing(item)}>Modifier</button></td></tr>)}</tbody></table></div></section>
}

function PublicSiteManagement({ config, role, runAction }: { config: PublicSiteConfig; role: string | null; runAction: (action: () => Promise<void>) => Promise<void> }) {
  const [draft, setDraft] = useState(config)
  useEffect(() => setDraft(config), [config])
  const update = <K extends keyof PublicSiteConfig>(key: K, value: PublicSiteConfig[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const save = () => void runAction(async () => updatePublicSiteConfig(draft))
  const updateList = (key: 'audienceTags' | 'solutions' | 'steps', index: number, value: string, field?: 'title' | 'body' | 'number') => {
    if (key === 'audienceTags') {
      const tags = [...draft.audienceTags]
      tags[index] = value
      update('audienceTags', tags)
      return
    }
    const items = [...draft[key]]
    items[index] = { ...items[index], ...(field ? { [field]: value } : {}) }
    update(key, items as PublicSiteConfig[typeof key])
  }
  if (role !== 'super_admin') return <section className="panel admin-data-panel"><h2>Accès réservé</h2><p>Seul le super administrateur peut modifier l’espace public.</p></section>
  return <section className="panel admin-data-panel public-site-editor"><div className="panel-heading"><div><p className="eyebrow">ÉDITEUR VISUEL</p><h2>Espace public</h2><p>Cette interface reprend les sections visibles sur la page d’accueil. Les modifications sont publiées après enregistrement.</p></div><button className="primary-button" onClick={save}>Enregistrer la page publique</button></div><div className="editor-section"><h3>Navigation et bandeau principal</h3><div className="form-grid"><label>Accroche<input value={draft.heroEyebrow} onChange={(e) => update('heroEyebrow', e.target.value)} /></label><label>Titre<input value={draft.heroTitle} onChange={(e) => update('heroTitle', e.target.value)} /></label><label>Titre accentué<input value={draft.heroTitleAccent} onChange={(e) => update('heroTitleAccent', e.target.value)} /></label><label>Sous-titre<textarea value={draft.heroSubtitle} onChange={(e) => update('heroSubtitle', e.target.value)} /></label><label>Promesse de confiance<input value={draft.heroTrust} onChange={(e) => update('heroTrust', e.target.value)} /></label></div><h4>Publics affichés</h4><div className="form-grid">{draft.audienceTags.map((tag, index) => <label key={index}>Public {index + 1}<input value={tag} onChange={(e) => updateList('audienceTags', index, e.target.value)} /></label>)}</div></div><div className="editor-section"><h3>Solutions</h3><div className="form-grid"><label>Titre de section<input value={draft.solutionsTitle} onChange={(e) => update('solutionsTitle', e.target.value)} /></label><label>Introduction<textarea value={draft.solutionsSubtitle} onChange={(e) => update('solutionsSubtitle', e.target.value)} /></label></div><div className="editor-list">{draft.solutions.map((item, index) => <div className="editor-list-item" key={index}><strong>Solution {index + 1}</strong><input value={item.title} onChange={(e) => updateList('solutions', index, e.target.value, 'title')} /><textarea value={item.body} onChange={(e) => updateList('solutions', index, e.target.value, 'body')} /></div>)}</div></div><div className="editor-section"><h3>Étapes de fonctionnement</h3><div className="editor-list">{draft.steps.map((item, index) => <div className="editor-list-item" key={index}><strong>Étape {index + 1}</strong><input value={item.title} onChange={(e) => updateList('steps', index, e.target.value, 'title')} /><textarea value={item.body} onChange={(e) => updateList('steps', index, e.target.value, 'body')} /></div>)}</div></div><div className="editor-section"><h3>Appel à l’action et pied de page</h3><div className="form-grid"><label>Titre final<input value={draft.finalCtaTitle} onChange={(e) => update('finalCtaTitle', e.target.value)} /></label><label>Texte final<textarea value={draft.finalCtaBody} onChange={(e) => update('finalCtaBody', e.target.value)} /></label><label>Phrase du pied de page<input value={draft.footerTagline} onChange={(e) => update('footerTagline', e.target.value)} /></label><label>E-mail de contact<input type="email" value={draft.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} /></label><label>Confidentialité<textarea value={draft.legalPrivacy} onChange={(e) => update('legalPrivacy', e.target.value)} /></label><label>Conditions<textarea value={draft.legalTerms} onChange={(e) => update('legalTerms', e.target.value)} /></label></div></div><button className="primary-button" onClick={save}>Enregistrer les modifications</button></section>
}

function PlatformAdminOperations({ section, analytics, analyticsFilters, onAnalyticsFiltersChange, role, session, busy, tickets, notifications, securityEvents, auditLogs, incidents, integrations, healthChecks, adminAccounts, content, settings, publicSiteConfig, onChanged }: { section: PlatformAdminSection; analytics: Awaited<ReturnType<typeof loadPlatformAnalytics>> | null; analyticsFilters: PlatformAnalyticsFilters; onAnalyticsFiltersChange: (filters: PlatformAnalyticsFilters) => void; role: string | null; session: Session; busy: boolean; tickets: Awaited<ReturnType<typeof loadPlatformSupportTickets>>; notifications: Awaited<ReturnType<typeof loadPlatformNotifications>>; securityEvents: Awaited<ReturnType<typeof loadPlatformSecurityEvents>>; auditLogs: Awaited<ReturnType<typeof loadPlatformAuditLogs>>; incidents: Awaited<ReturnType<typeof loadPlatformIncidents>>; integrations: Awaited<ReturnType<typeof loadPlatformIntegrations>>; healthChecks: Awaited<ReturnType<typeof loadPlatformHealth>>; adminAccounts: Awaited<ReturnType<typeof loadPlatformAdminAccounts>>; content: Awaited<ReturnType<typeof loadPlatformContent>>; settings: Awaited<ReturnType<typeof loadPlatformSettings>>; publicSiteConfig: PublicSiteConfig; onChanged: () => void }) {
  const [actionError, setActionError] = useState('')
  const [newIncident, setNewIncident] = useState({ title: '', description: '', service: '', severity: 'medium' })
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [incidentReport, setIncidentReport] = useState({ rootCause: '', resolutionSummary: '', preventionActions: '' })
  const [auditFilters, setAuditFilters] = useState({ query: '', action: '', result: '', from: '', to: '', hideSuccess: false })
  const [auditTab, setAuditTab] = useState<'journal' | 'suppression'>('journal')
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([])
  const [auditDeleteConfirmation, setAuditDeleteConfirmation] = useState(false)
  const [adminAction, setAdminAction] = useState<{ userId: string; email: string; action: 'suspend' | 'deactivate' | 'delete' } | null>(null)
  const [adminProfile, setAdminProfile] = useState<PlatformAdminAccount | null>(null)
  const [selectedIntegration, setSelectedIntegration] = useState<Awaited<ReturnType<typeof loadPlatformIntegrations>>[number] | null>(null)
  const [newAdmin, setNewAdmin] = useState({ email: '', fullName: '', password: '', role: 'support' as 'super_admin' | 'admin' | 'support' | 'finance' | 'analyst', mode: 'invite' as 'invite' | 'auto_confirm' })
  const runAction = async (action: () => Promise<void>) => {
    setActionError('')
    try { await action(); onChanged() } catch (error) { setActionError(error instanceof Error ? error.message : 'L’opération n’a pas pu être effectuée.') }
  }
  if (section === 'Espace public') return <PublicSiteManagement config={publicSiteConfig} role={role} runAction={runAction} />

  function AdminProfile({ session, role, onChanged }: { session: Session; role: string | null; onChanged: () => void }) {
    const [firstName, setFirstName] = useState(String(session.user.user_metadata?.full_name ?? '').split(' ')[0] ?? '')
    const [lastName, setLastName] = useState(String(session.user.user_metadata?.full_name ?? '').split(' ').slice(1).join(' '))
    const [email, setEmail] = useState(session.user.email ?? '')
    const [avatarUrl, setAvatarUrl] = useState(String(session.user.user_metadata?.avatar_url ?? ''))
    const [password, setPassword] = useState('')
    const [notificationsEnabled, setNotificationsEnabled] = useState(Boolean((session.user.user_metadata?.admin_preferences as { notifications?: boolean } | undefined)?.notifications ?? true))
    const [language, setLanguage] = useState(String((session.user.user_metadata?.admin_preferences as { language?: string } | undefined)?.language ?? 'fr'))
    const [density, setDensity] = useState(String((session.user.user_metadata?.admin_preferences as { density?: string } | undefined)?.density ?? 'comfortable'))
    const [profileData, setProfileData] = useState<Awaited<ReturnType<typeof loadPlatformAdminProfile>> | null>(null)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    useEffect(() => { void loadPlatformAdminProfile().then(setProfileData).catch((value: unknown) => setError(value instanceof Error ? value.message : 'Impossible de charger la sécurité du compte.')) }, [])
    const save = async (action: () => Promise<void>) => {
      setError('')
      setMessage('')
      try { await action(); setMessage('Modifications enregistrées.'); onChanged() } catch (value) { setError(value instanceof Error ? value.message : 'Impossible d’enregistrer les modifications.') }
    }
    return <section className="admin-profile-page"><div className="admin-profile-grid"><section className="panel admin-ops-card"><div className="admin-ops-icon slate"><UserRound size={21} /></div><h2>Mon profil</h2><p>Gérez votre identité, votre photo et votre adresse e-mail.</p>{error && <div className="data-warning">{error}</div>}{message && <div className="settings-message">{message}</div>}<div className="admin-avatar-preview">{avatarUrl ? <img src={avatarUrl} alt="Photo de profil" /> : <UserRound size={28} />}<label className="outline-button">Choisir une photo<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void save(async () => setAvatarUrl(await uploadPlatformAdminAvatar(file))) }} /></label></div><div className="admin-profile-fields"><label>Prénom<input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Nom<input value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label className="admin-profile-wide">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label></div><button className="primary-button" onClick={() => void save(async () => { await updatePlatformAdminProfile(`${firstName} ${lastName}`); if (email !== (session.user.email ?? '')) await updatePlatformAdminEmail(email) })}>Enregistrer le profil</button></section><section className="panel admin-checklist"><h2>Sécurité du compte</h2><div><span>Rôle</span><strong>{role ?? 'Non détecté'}</strong></div><div><span>Dernière connexion</span><strong>{profileData?.last_sign_in_at ? new Date(profileData.last_sign_in_at).toLocaleString('fr-FR') : 'Session actuelle'}</strong></div><label className="admin-profile-field"><span>Nouveau mot de passe</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" /></label><button className="outline-button" disabled={!password} onClick={() => void save(async () => { await updatePlatformAdminPassword(password); setPassword('') })}>Changer le mot de passe</button><h3 className="admin-profile-subheading">Historique des sessions</h3>{profileData?.sessions.length ? profileData.sessions.map((item) => <div className="admin-session-row" key={`${item.created_at}-${item.updated_at}`}><span>{new Date(item.updated_at).toLocaleString('fr-FR')}<small>{item.user_agent ?? 'Navigateur non renseigné'}{item.ip ? ` · ${item.ip}` : ''}</small></span><strong>{item.updated_at === profileData.sessions[0]?.updated_at ? 'Session récente' : 'Session'}</strong></div>) : <p className="muted-cell">Aucune session détaillée disponible.</p>}<div className="admin-mfa-note"><ShieldCheck size={16} /><span>Authentification renforcée : activez la MFA dans les paramètres de sécurité Supabase pour ce compte.</span></div></section></div><section className="panel admin-preferences"><div className="panel-heading"><div><h2>Préférences</h2><p>Ces préférences sont enregistrées dans votre profil administrateur.</p></div></div><div className="admin-preference-grid"><label><span>Notifications administrateur</span><input type="checkbox" checked={notificationsEnabled} onChange={(event) => setNotificationsEnabled(event.target.checked)} /></label><label><span>Langue</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="fr">Français</option><option value="en">English</option></select></label><label><span>Densité d’affichage</span><select value={density} onChange={(event) => setDensity(event.target.value)}><option value="comfortable">Confortable</option><option value="compact">Compacte</option></select></label></div><button className="primary-button" onClick={() => void save(() => updatePlatformAdminPreferences({ notifications: notificationsEnabled, language, density }))}>Enregistrer les préférences</button></section></section>
  }
  if (busy) return <div className="auth-loading admin-inline-loading">Chargement du module administrateur...</div>
  if (section === 'Support') return <SupportManagement tickets={tickets} runAction={runAction} />
  if (section === 'Notifications') return <NotificationsManagement notifications={notifications} runAction={runAction} onChanged={onChanged} />
  if (section === 'Contenu') return <ContentManagement content={content} runAction={runAction} />
  if (section === 'Analytics') {
    const current = analytics?.current ?? {}
    const previous = analytics?.previous ?? {}
    const growth = (key: string) => Number(previous[key]) ? `${(((Number(current[key] ?? 0) - Number(previous[key])) / Number(previous[key])) * 100).toFixed(1)} %` : '—'
    const setFilter = (key: keyof PlatformAnalyticsFilters, value: string) => onAnalyticsFiltersChange({ ...analyticsFilters, [key]: value || undefined })
    const chartMetrics: [string, number][] = [['Inscriptions', Number(current.signups ?? 0)], ['Actifs', Number(current.active_businesses ?? 0)], ['Payants', Number(current.paid_conversions ?? 0)], ['Renouvellements', Number(current.renewals ?? 0)], ['Churn', Number(current.churn ?? 0)]]
    const chartMax = Math.max(...chartMetrics.map(([, value]) => value), 1)
    const previousFeatureUsage = analytics?.previous_feature_usage ?? []
    const featureValues = (analytics?.feature_usage ?? []).map((item) => ({ ...item, previous: previousFeatureUsage.find((previousItem) => previousItem.feature === item.feature)?.usage ?? 0 }))
    const featureMax = Math.max(...featureValues.flatMap((item) => [item.usage, item.previous]), 1)
    const featurePoint = (value: number, index: number) => `${24 + index * (252 / Math.max(featureValues.length - 1, 1))},${154 - (value / featureMax) * 124}`
    const featureCurrentPoints = featureValues.map((item, index) => featurePoint(item.usage, index)).join(' ')
    const featurePreviousPoints = featureValues.map((item, index) => featurePoint(item.previous, index)).join(' ')
    const decisions = [
      Number(current.conversion_rate ?? 0) < 10 ? 'Priorité commerciale : améliorer l’activation des comptes FREE vers une offre payante.' : 'La conversion FREE → payant est saine : consolider les campagnes qui fonctionnent.',
      Number(current.churn ?? 0) > Number(previous.churn ?? 0) ? 'Alerte rétention : le churn progresse, analyser les entreprises récemment résiliées.' : 'La rétention est maîtrisée sur la période sélectionnée.',
      featureValues.some((item) => item.usage > item.previous) ? 'Adoption en hausse : mettre en avant les fonctionnalités dont l’usage progresse.' : 'Adoption stable ou en baisse : prévoir une action de formation ou d’onboarding.',
    ]
    return <section className="admin-ops-grid analytics-page"><div className="panel admin-chart-card analytics-main-card"><div className="panel-heading"><div><h2>Analytics décisionnels</h2><p>Période sélectionnée comparée à la période précédente.</p></div><TrendingUp size={20} /></div><div className="analytics-filter-bar"><label>Du<input type="date" value={analyticsFilters.from?.slice(0, 10) ?? ''} onChange={(event) => setFilter('from', event.target.value)} /></label><label>Au<input type="date" value={analyticsFilters.to?.slice(0, 10) ?? ''} onChange={(event) => setFilter('to', event.target.value)} /></label><label>Plan<select value={analyticsFilters.plan ?? ''} onChange={(event) => setFilter('plan', event.target.value)}><option value="">Tous</option><option value="free">FREE</option><option value="basic">BASIC</option><option value="pro">PRO</option><option value="business">BUSINESS</option></select></label><label>Secteur<input value={analyticsFilters.sector ?? ''} onChange={(event) => setFilter('sector', event.target.value)} placeholder="Tous" /></label><label>Type<input value={analyticsFilters.businessType ?? ''} onChange={(event) => setFilter('businessType', event.target.value)} placeholder="Tous" /></label></div><div className="analytics-chart"><div className="analytics-chart-grid"><i /><i /><i /><i /></div><div className="analytics-bars">{chartMetrics.map(([label, value]) => <div className="analytics-bar-item" key={label}><strong>{value.toLocaleString('fr-FR')}</strong><div className="analytics-bar-track"><i style={{ height: `${Math.max(value > 0 ? 8 : 0, (value / chartMax) * 100)}%` }} /></div><span>{label}</span></div>)}</div></div><div className="analytics-kpi-grid">{[['signups','Inscriptions'],['active_users','Utilisateurs actifs'],['active_businesses','Entreprises actives'],['activation_rate','Activation %'],['conversion_rate','Conversion %'],['renewals','Renouvellements'],['churn','Churn'],['mrr','MRR'],['arr','ARR'],['revenue','Chiffre d’affaires']].map(([key,label]) => <div className="analytics-kpi" key={key}><span>{label}</span><strong>{Number(current[key] ?? 0).toLocaleString('fr-FR')}</strong><small>{growth(key)} vs période précédente</small></div>)}</div></div><div className="panel admin-checklist analytics-feature-card"><h2>Utilisation des fonctionnalités</h2><p className="analytics-card-subtitle">Courbe comparative : période actuelle contre période précédente.</p><div className="feature-line-chart"><svg viewBox="0 0 300 180" role="img" aria-label="Comparaison de l’utilisation des fonctionnalités"><polyline className="feature-line previous" points={featurePreviousPoints} /><polyline className="feature-line current" points={featureCurrentPoints} />{featureValues.map((item, index) => <g key={item.feature}><circle className="feature-dot previous" cx={24 + index * (252 / Math.max(featureValues.length - 1, 1))} cy={154 - (item.previous / featureMax) * 124} r="3" /><circle className="feature-dot current" cx={24 + index * (252 / Math.max(featureValues.length - 1, 1))} cy={154 - (item.usage / featureMax) * 124} r="3" /><text x={24 + index * (252 / Math.max(featureValues.length - 1, 1))} y="174" textAnchor="middle">{item.feature}</text></g>)}</svg><div className="feature-chart-legend"><span><i className="current" /> Période actuelle</span><span><i className="previous" /> Période précédente</span></div></div></div><div className="panel analytics-decisions"><div className="panel-heading"><div><h2>Décisions recommandées</h2><p>Lecture automatique des évolutions observées.</p></div><Lightbulb size={20} /></div>{decisions.map((decision) => <div className="analytics-decision" key={decision}><span>•</span><p>{decision}</p></div>)}</div></section>
  }
  if (section === 'Sécurité') {
    const alerts = notifications.filter((notification) => ['warning', 'critical'].includes(notification.severity))
    const failedEvents = securityEvents.filter((event) => event.result !== 'success')
    const sensitiveEvents = securityEvents.filter((event) => ['disable', 'delete', 'update_role', 'access_denied'].includes(event.action))
    const alertCount = alerts.filter((alert) => !alert.read_at).length
    return <section className="security-page"><div className="security-summary-grid"><div className="security-summary-card"><span>Événements suivis</span><strong>{securityEvents.length}</strong><small>journalisés</small></div><div className="security-summary-card warning"><span>Accès refusés</span><strong>{failedEvents.length}</strong><small>à examiner</small></div><div className="security-summary-card danger"><span>Alertes ouvertes</span><strong>{alertCount}</strong><small>non traitées</small></div><div className="security-summary-card"><span>Actions sensibles</span><strong>{sensitiveEvents.length}</strong><small>traçables</small></div></div><div className="security-grid"><div className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Événements de sécurité</h2><p>Connexions, accès refusés et opérations administratives importantes.</p></div><span className="admin-role-context">{securityEvents.length} événement(s)</span></div><div className="table-wrap"><table><thead><tr><th>ÉVÉNEMENT</th><th>ACTEUR</th><th>RÉSULTAT</th><th>DATE</th><th>CONTEXTE</th></tr></thead><tbody>{securityEvents.length ? securityEvents.map((event) => <tr key={event.id}><td><strong>{event.action}</strong><small className="security-resource">{event.resource_type}</small></td><td>{event.actor_email ?? 'Système'}</td><td><span className={`security-result ${event.result === 'success' ? 'success' : 'failed'}`}>{event.result === 'success' ? 'Réussi' : 'Refusé / échec'}</span></td><td className="muted-cell">{new Date(event.created_at).toLocaleString('fr-FR')}</td><td className="muted-cell">{Object.keys(event.context ?? {}).length ? JSON.stringify(event.context) : '—'}</td></tr>) : <tr><td colSpan={5} className="muted-cell">Aucun événement de sécurité.</td></tr>}</tbody></table></div></div><div className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Alertes à traiter</h2><p>Examinez chaque signal puis marquez-le comme traité.</p></div></div><div className="security-alert-list">{alerts.length ? alerts.map((alert) => <article className={`security-alert ${alert.read_at ? 'resolved' : ''}`} key={alert.id}><div><span className={`security-severity ${alert.severity}`}>{alert.severity === 'critical' ? 'Critique' : 'Avertissement'}</span><strong>{alert.title}</strong><p>{alert.message}</p><small>{new Date(alert.created_at).toLocaleString('fr-FR')}</small></div>{alert.read_at ? <span className="security-resolved">Traitée</span> : <button className="outline-button" onClick={() => void runAction(() => markPlatformNotificationRead(alert.id))}>Marquer traitée</button>}</article>) : <p className="muted-cell security-empty">Aucune alerte active.</p>}</div></div></div></section>
  }
  if (section === 'Journal d’audit') {
    const filteredAuditLogs = auditLogs.filter((log) => {
      const query = auditFilters.query.trim().toLowerCase()
      const searchable = `${log.actor_email ?? ''} ${log.action} ${log.resource_type} ${log.resource_id ?? ''} ${JSON.stringify(log.context ?? {})}`.toLowerCase()
      const date = log.created_at.slice(0, 10)
      return (!query || searchable.includes(query)) && (!auditFilters.action || log.action === auditFilters.action) && (!auditFilters.result || log.result === auditFilters.result) && (!auditFilters.from || date >= auditFilters.from) && (!auditFilters.to || date <= auditFilters.to) && (!auditFilters.hideSuccess || log.result !== 'success')
    })
    const auditActions = [...new Set(auditLogs.map((log) => log.action))].sort()
    const resetAuditFilters = () => setAuditFilters({ query: '', action: '', result: '', from: '', to: '', hideSuccess: false })
    const toggleAudit = (id: string) => setSelectedAuditIds(selectedAuditIds.includes(id) ? selectedAuditIds.filter((selectedId) => selectedId !== id) : [...selectedAuditIds, id])
    const selectFilteredAudits = () => setSelectedAuditIds([...new Set([...selectedAuditIds, ...filteredAuditLogs.map((log) => log.id)])])
    const deleteSelected = async () => { await deletePlatformAuditLogs(selectedAuditIds); setSelectedAuditIds([]); setAuditDeleteConfirmation(false); onChanged() }
    return <section className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Journal d’audit plateforme</h2><p>Qui a fait quoi, quand, sur quelle ressource et dans quel contexte. Journal en lecture seule.</p></div><span className="admin-role-context">{filteredAuditLogs.length} / {auditLogs.length} événement(s)</span></div><div className="audit-tabs"><button className={auditTab === 'journal' ? 'active' : ''} onClick={() => setAuditTab('journal')}>Consulter le journal</button><button className={auditTab === 'suppression' ? 'active danger-tab' : 'danger-tab'} onClick={() => setAuditTab('suppression')}>Supprimer des actions</button></div>{auditTab === 'suppression' && role !== 'super_admin' ? <div className="audit-delete-locked"><ShieldCheck size={22} /><strong>Accès réservé au super administrateur</strong><p>La suppression des traces d’audit est une opération irréversible et n’est pas disponible pour votre rôle.</p></div> : auditTab === 'suppression' ? <div className="audit-delete-panel"><h3>Sélectionner les actions à supprimer</h3><p>Utilisez la recherche et les filtres du journal, puis sélectionnez rapidement les événements à supprimer.</p><div className="audit-delete-summary"><strong>{selectedAuditIds.length}</strong> action(s) sélectionnée(s)<button className="outline-button" onClick={selectFilteredAudits} disabled={!filteredAuditLogs.length}>Tout sélectionner ({filteredAuditLogs.length})</button><button className="danger-button" disabled={!selectedAuditIds.length} onClick={() => setAuditDeleteConfirmation(true)}>Continuer vers la confirmation</button></div><div className="audit-selection-list">{filteredAuditLogs.map((log) => <label key={log.id}><input type="checkbox" checked={selectedAuditIds.includes(log.id)} onChange={() => toggleAudit(log.id)} /><span><strong>{log.action}</strong> · {log.resource_type}<small>{new Date(log.created_at).toLocaleString('fr-FR')} · {log.actor_email ?? 'Système'}</small></span></label>)}{!filteredAuditLogs.length && <p className="muted-cell">Aucun événement correspondant aux filtres.</p>}</div></div> : <><div className="audit-filter-bar"><input value={auditFilters.query} onChange={(event) => setAuditFilters({ ...auditFilters, query: event.target.value })} placeholder="Rechercher acteur, ressource, contexte..." aria-label="Rechercher dans le journal" /><select value={auditFilters.action} onChange={(event) => setAuditFilters({ ...auditFilters, action: event.target.value })}><option value="">Toutes les actions</option>{auditActions.map((action) => <option key={action} value={action}>{action}</option>)}</select><select value={auditFilters.result} onChange={(event) => setAuditFilters({ ...auditFilters, result: event.target.value })}><option value="">Tous les résultats</option><option value="success">Réussi</option><option value="failure">Échec</option></select><label>Du<input type="date" value={auditFilters.from} onChange={(event) => setAuditFilters({ ...auditFilters, from: event.target.value })} /></label><label>Au<input type="date" value={auditFilters.to} onChange={(event) => setAuditFilters({ ...auditFilters, to: event.target.value })} /></label><label className="audit-toggle"><input type="checkbox" checked={auditFilters.hideSuccess} onChange={(event) => setAuditFilters({ ...auditFilters, hideSuccess: event.target.checked })} /> Masquer les succès</label><button className="outline-button" onClick={resetAuditFilters}>Réinitialiser</button></div><p className="audit-retention-note">Nettoyage sûr : les filtres et le masquage réduisent l’affichage sans supprimer les preuves d’audit. Les journaux restent immuables et consultables.</p><div className="table-wrap"><table><thead><tr><th>RESPONSABLE</th><th>ACTION</th><th>RESSOURCE</th><th>RÉSULTAT</th><th>DATE / IP</th><th>CONTEXTE</th></tr></thead><tbody>{filteredAuditLogs.length ? filteredAuditLogs.map((log) => { const context = log.context ?? {}; const before = context.before; const after = context.after; const details = context.details; return <tr key={log.id}><td>{log.actor_email ?? 'Système'}</td><td><strong>{log.action}</strong></td><td>{log.resource_type}<small className="table-subtitle">{log.resource_id ?? 'Identifiant non renseigné'}</small></td><td><span className={`security-result ${log.result === 'success' ? 'success' : 'failed'}`}>{log.result === 'success' ? 'Réussi' : 'Échec'}</span></td><td className="muted-cell">{new Date(log.created_at).toLocaleString('fr-FR')}<small className="table-subtitle">{log.ip_address ?? 'IP non disponible'}</small></td><td className="audit-context-cell"><div>{before !== undefined && <span><b>Avant :</b> {JSON.stringify(before)}</span>}{after !== undefined && <span><b>Après :</b> {JSON.stringify(after)}</span>}{details !== undefined && JSON.stringify(details) !== '{}' && <span><b>Détails :</b> {JSON.stringify(details)}</span>}{before === undefined && after === undefined && (details === undefined || JSON.stringify(details) === '{}') && <span>Contexte technique non renseigné pour cet événement historique.</span>}</div></td></tr> }) : <tr><td colSpan={6} className="muted-cell">Aucun événement ne correspond aux filtres.</td></tr>}</tbody></table></div></>}{auditDeleteConfirmation && <div className="audit-confirmation-page"><div><h3>Confirmer la suppression</h3><p>Vous allez supprimer définitivement <strong>{selectedAuditIds.length}</strong> trace(s) d’audit. Cette opération est irréversible.</p><p>La suppression sera elle-même enregistrée dans le journal.</p><div className="confirmation-actions"><button className="outline-button" onClick={() => setAuditDeleteConfirmation(false)}>Annuler</button><button className="danger-button" onClick={() => void runAction(deleteSelected)}>Confirmer et supprimer</button></div></div></div>}</section>
  }
  if (section === 'Administrateurs') {
    const roleDescriptions = {
      super_admin: 'Accès maximal : sécurité, paramètres critiques, rôles, audit et toute la plateforme.',
      admin: 'Opérations générales, avec restrictions sur les rôles et paramètres critiques.',
      support: 'Utilisateurs, entreprises utiles au support, tickets et notifications.',
      finance: 'Abonnements, paiements, revenus et données financières.',
      analyst: 'Analytics, statistiques et rapports en lecture.',
    } as const
    return <section className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Administrateurs internes</h2><p>Créez un compte avec un rôle précis. Une invitation est recommandée pour que l’agent définisse lui-même son mot de passe.</p></div><span className="admin-role-context">{adminAccounts.length} compte(s)</span></div>{actionError && <div className="data-warning">{actionError}</div>}{role === 'super_admin' && <form className="admin-create-form" onSubmit={(event) => { event.preventDefault(); void runAction(async () => { await createPlatformAdminAccount(newAdmin.email.trim(), newAdmin.role, newAdmin.mode, newAdmin.fullName.trim(), newAdmin.password); setNewAdmin({ email: '', fullName: '', password: '', role: 'support', mode: 'invite' }); }) }}><div><label>Nom complet<input value={newAdmin.fullName} onChange={(event) => setNewAdmin({ ...newAdmin, fullName: event.target.value })} placeholder="Ex. Aïcha K." required /></label><label>E-mail professionnel<input type="email" value={newAdmin.email} onChange={(event) => setNewAdmin({ ...newAdmin, email: event.target.value })} placeholder="agent@facturefacile.bj" required /></label></div><div><label>Rôle<select value={newAdmin.role} onChange={(event) => setNewAdmin({ ...newAdmin, role: event.target.value as typeof newAdmin.role })}><option value="admin">Admin</option><option value="support">Support</option><option value="finance">Finance Manager</option><option value="analyst">Analyst</option><option value="super_admin">Super Admin</option></select></label><label>Activation du compte<select value={newAdmin.mode} onChange={(event) => setNewAdmin({ ...newAdmin, mode: event.target.value as typeof newAdmin.mode })}><option value="invite">Par invitation (recommandé)</option><option value="auto_confirm">Confirmation automatique</option></select></label>{newAdmin.mode === 'auto_confirm' && <label>Mot de passe temporaire<input type="password" minLength={8} value={newAdmin.password} onChange={(event) => setNewAdmin({ ...newAdmin, password: event.target.value })} placeholder="8 caractères minimum" required /></label>}</div><div className="admin-create-help"><strong>{newAdmin.mode === 'invite' ? 'Invitation sécurisée' : 'Confirmation automatique'}</strong><p>{newAdmin.mode === 'invite' ? 'Le nouvel administrateur reçoit un e-mail et choisit son mot de passe.' : 'Le compte est confirmé immédiatement avec le mot de passe temporaire défini ci-dessus.'}</p><small>{roleDescriptions[newAdmin.role]}</small></div><button className="primary-button" type="submit">Créer le compte</button>    </form>}<PlatformPermissionMatrix />{role !== 'super_admin' && <div className="admin-permission-note"><ShieldCheck size={18} /> Seul le super administrateur peut créer des comptes ou modifier les rôles.</div>}<div className="table-wrap"><table><thead><tr><th>ADMINISTRATEUR</th><th>RÔLE</th><th>STATUT</th><th>PROFIL</th><th>ACTIONS</th></tr></thead><tbody>{adminAccounts.length ? adminAccounts.map((account) => <tr key={account.user_id}><td><strong>{account.full_name ?? account.email ?? 'Email non renseigné'}</strong><small className="table-subtitle">{account.email}</small></td><td><span className="admin-plan-badge">{account.role}</span></td><td><span className={`admin-status-badge ${account.status}`}>{account.status === 'active' ? 'Actif' : account.status === 'suspended' ? 'Suspendu' : 'Désactivé'}</span></td><td><button className="outline-button" onClick={() => setAdminProfile(account)}>Voir les informations</button></td><td>{role === 'super_admin' ? <div className="admin-action-buttons"><select value={account.role} onChange={(event) => void runAction(() => updatePlatformAdminRole(account.user_id, event.target.value as 'super_admin' | 'admin' | 'support' | 'finance' | 'analyst'))}><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="support">Support</option><option value="finance">Finance Manager</option><option value="analyst">Analyst</option></select><button className="outline-button" onClick={() => setAdminAction({ userId: account.user_id, email: account.email ?? 'cet administrateur', action: 'suspend' })}>Suspendre</button><button className="outline-button" onClick={() => setAdminAction({ userId: account.user_id, email: account.email ?? 'cet administrateur', action: 'deactivate' })}>Désactiver</button><button className="danger-button" onClick={() => setAdminAction({ userId: account.user_id, email: account.email ?? 'cet administrateur', action: 'delete' })}>Supprimer</button></div> : 'Lecture seule'}</td></tr>) : <tr><td colSpan={5} className="muted-cell">Aucun administrateur enregistré.</td></tr>}</tbody></table></div>{adminProfile && <div className="audit-confirmation-page"><div><h3>Profil administrateur</h3><p><strong>{adminProfile.full_name ?? 'Nom non renseigné'}</strong></p><p>E-mail : {adminProfile.email ?? '—'}<br />Téléphone : {adminProfile.phone ?? '—'}<br />Rôle : {adminProfile.role}<br />Statut : {adminProfile.status}<br />Créé le : {new Date(adminProfile.created_at).toLocaleString('fr-FR')}<br />Dernière connexion : {adminProfile.last_sign_in_at ? new Date(adminProfile.last_sign_in_at).toLocaleString('fr-FR') : 'Jamais'}<br />E-mail confirmé : {adminProfile.email_confirmed_at ? 'Oui' : 'Non'}</p><div className="confirmation-actions"><button className="outline-button" onClick={() => setAdminProfile(null)}>Fermer</button></div></div></div>}{adminAction && <div className="audit-confirmation-page"><div><h3>{adminAction.action === 'delete' ? 'Confirmer la suppression' : adminAction.action === 'deactivate' ? 'Confirmer la désactivation' : 'Confirmer la suspension'}</h3><p>Vous allez {adminAction.action === 'delete' ? 'supprimer définitivement' : adminAction.action === 'deactivate' ? 'désactiver' : 'suspendre temporairement'} le compte <strong>{adminAction.email}</strong>.</p>{adminAction.action === 'delete' && <p>Cette action supprime également son accès d’authentification et ne peut pas être annulée.</p>}<div className="confirmation-actions"><button className="outline-button" onClick={() => setAdminAction(null)}>Annuler</button><button className={adminAction.action === 'delete' ? 'danger-button' : 'primary-button'} onClick={() => void runAction(async () => { await managePlatformAdminAccount(adminAction.userId, adminAction.action); setAdminAction(null) })}>Confirmer</button></div></div></div>}</section>
  }
  if (String(section) === 'Contenu') return <ContentManagement content={content} runAction={runAction} />
  if (section === 'Intégrations') {
    const statusLabels: Record<string, string> = { connected: 'Connecté', operational: 'Opérationnel', not_configured: 'Non configuré', attention: 'Attention', unavailable: 'Indisponible' }
    const typeLabels: Record<string, string> = { payment: 'Prestataire de paiement', email: 'Service e-mail', storage: 'Stockage', sms: 'SMS', api: 'API', notification: 'Notifications', whatsapp: 'WhatsApp' }
    const statusCounts = integrations.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.status]: (counts[item.status] ?? 0) + 1 }), {})
    return <section className="integration-page"><div className="integration-summary">{[['connected', 'Connectées'], ['operational', 'Opérationnelles'], ['attention', 'À surveiller'], ['unavailable', 'Indisponibles']].map(([status, label]) => <div className="integration-summary-card" key={status}><span className={`integration-dot ${status}`} /><strong>{statusCounts[status] ?? 0}</strong><small>{label}</small></div>)}</div><section className="panel module-table admin-data-panel"><div className="panel-heading"><div><p className="eyebrow">SERVICES EXTERNES</p><h2>Intégrations</h2><p>Surveillez les services utilisés par FactureFacile. Les clés secrètes et credentials ne sont jamais affichés.</p></div><div className="integration-header-actions"><button className="outline-button" onClick={onChanged}>Actualiser</button><span className="admin-role-context">{integrations.length} service(s)</span></div></div><div className="integration-notice"><ShieldCheck size={17} /><span>Les secrets restent dans Supabase Edge Functions et les variables sécurisées. Cette console affiche uniquement l’état opérationnel.</span></div><div className="table-wrap"><table><thead><tr><th>SERVICE</th><th>TYPE</th><th>ENVIRONNEMENT</th><th>STATUT</th><th>ÉTAT DE CONNEXION</th><th>DERNIÈRE VÉRIFICATION</th><th>ACTIONS</th></tr></thead><tbody>{integrations.length ? integrations.map((integration) => { const label = statusLabels[integration.status] ?? 'État inconnu'; const connected = integration.status === 'connected' || integration.status === 'operational'; return <tr key={integration.id}><td><div className="integration-service"><span className={`integration-service-icon ${integration.service_type}`}><Plug size={15} /></span><strong>{integration.name}</strong></div></td><td>{typeLabels[integration.service_type] ?? integration.service_type}</td><td><span className="integration-environment">{integration.environment === 'production' ? 'Production' : integration.environment}</span></td><td><span className={`integration-status ${integration.status}`}><i />{label}</span></td><td><span className={connected ? 'integration-connection connected' : 'integration-connection'}>{connected ? 'Connexion active' : integration.status === 'not_configured' ? 'À configurer' : 'Vérification nécessaire'}</span></td><td className="muted-cell">{integration.last_checked_at ? new Date(integration.last_checked_at).toLocaleString('fr-FR') : 'Jamais vérifiée'}</td><td><button className="outline-button integration-action-button" onClick={() => setSelectedIntegration(integration)}>Détails</button><button className="outline-button integration-action-button" onClick={onChanged}>Actualiser</button></td></tr> }) : <tr><td colSpan={7} className="muted-cell">Aucune intégration configurée.</td></tr>}</tbody></table></div></section>{selectedIntegration && <div className="modal-backdrop" onClick={() => setSelectedIntegration(null)}><div className="modal-card integration-detail-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedIntegration(null)} aria-label="Fermer"><X size={18} /></button><p className="eyebrow">DÉTAILS DE L’INTÉGRATION</p><h2>{selectedIntegration.name}</h2>    <div className="integration-detail-grid"><div><span>Type</span><strong>{typeLabels[selectedIntegration.service_type] ?? selectedIntegration.service_type}</strong></div><div><span>Environnement</span><strong>{selectedIntegration.environment === 'production' ? 'Production' : selectedIntegration.environment}</strong></div><div><span>Statut</span><strong>{statusLabels[selectedIntegration.status] ?? selectedIntegration.status}</strong></div><div><span>Dernière vérification</span><strong>{selectedIntegration.last_checked_at ? new Date(selectedIntegration.last_checked_at).toLocaleString('fr-FR') : 'Jamais'}</strong></div></div><div className="integration-detail-safe"><ShieldCheck size={17} /><span>Les credentials ne sont pas accessibles depuis cette interface. Configurez-les uniquement dans les secrets Supabase/Edge Functions.</span></div><button className="primary-button" onClick={() => setSelectedIntegration(null)}>Fermer</button></div></div>}</section>
  }
  if (section === 'Health') {
    const statusLabels = { operational: 'Opérationnel', attention: 'Attention', incident: 'Incident' } as const
    const statusCounts = healthChecks.reduce<Record<string, number>>((counts, check) => ({ ...counts, [check.status]: (counts[check.status] ?? 0) + 1 }), {})
    const lastChecked = healthChecks.length ? new Date(Math.max(...healthChecks.map((check) => new Date(check.checked_at).getTime()))).toLocaleString('fr-FR') : 'Jamais'
    return <section className="health-page"><div className="health-summary-grid"><div className="health-summary-card operational"><span>Opérationnels</span><strong>{statusCounts.operational ?? 0}</strong></div><div className="health-summary-card attention"><span>À surveiller</span><strong>{statusCounts.attention ?? 0}</strong></div><div className="health-summary-card incident"><span>Incidents</span><strong>{statusCounts.incident ?? 0}</strong></div><div className="health-summary-card"><span>Dernier check</span><strong>{lastChecked}</strong></div></div><section className="panel module-table admin-data-panel"><div className="panel-heading"><div><p className="eyebrow">SURVEILLANCE TECHNIQUE</p><h2>État des composants</h2><p>Chaque vérification contrôle un service essentiel et explique immédiatement l’état détecté.</p></div><button className="primary-button" onClick={onChanged}><Activity size={15} /> Vérifier maintenant</button></div><div className="health-list">{healthChecks.length ? healthChecks.map((check) => <article className={`health-row ${check.status}`} key={check.service_key}><div className="health-service-icon"><Server size={17} /></div><div className="health-service-copy"><strong>{check.service_name}</strong><span>{check.detail}</span></div><span className={`health-status ${check.status}`}><i />{statusLabels[check.status]}</span><div className="health-meta"><span>Vérifié le {new Date(check.checked_at).toLocaleString('fr-FR')}</span>{check.latency_ms !== null && <span>{check.latency_ms} ms</span>}</div></article>) : <div className="health-empty">Aucun résultat de vérification disponible.</div>}</div></section></section>
  }
  if (section === 'Incidents') {
    const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId) ?? null
    const statusLabels: Record<string, string> = { detected: 'Détection', investigating: 'Investigation', identified: 'Identification', fixing: 'Correction', verifying: 'Vérification', resolved: 'Résolution' }
    const severityLabels: Record<string, string> = { low: 'Faible', medium: 'Moyenne', high: 'Élevée', critical: 'Critique' }
    return <section className="panel module-table admin-data-panel">
      <div className="panel-heading"><div><p className="eyebrow">GESTION DES INCIDENTS</p><h2>Incidents techniques</h2><p>Détection → Investigation → Identification → Correction → Vérification → Résolution → Rapport.</p></div><span className="admin-role-context">{incidents.length} incident(s)</span></div>
      {actionError && <div className="data-warning">{actionError}</div>}
      <form className="admin-incident-form" onSubmit={(event) => { event.preventDefault(); void runAction(async () => { await createPlatformIncident(newIncident.title, newIncident.description, newIncident.service, newIncident.severity); setNewIncident({ title: '', description: '', service: '', severity: 'medium' }) }) }}>
        <input value={newIncident.title} onChange={(event) => setNewIncident({ ...newIncident, title: event.target.value })} placeholder="Titre de l’incident" required />
        <input value={newIncident.service} onChange={(event) => setNewIncident({ ...newIncident, service: event.target.value })} placeholder="Service concerné" required />
        <select value={newIncident.severity} onChange={(event) => setNewIncident({ ...newIncident, severity: event.target.value })}><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Élevée</option><option value="critical">Critique</option></select>
        <textarea value={newIncident.description} onChange={(event) => setNewIncident({ ...newIncident, description: event.target.value })} placeholder="Description et impact" required />
        <button className="primary-button" type="submit">Créer l’incident</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>TITRE</th><th>SERVICE</th><th>GRAVITÉ</th><th>STATUT</th><th>RESPONSABLE</th><th>DÉBUT</th><th>RAPPORT</th></tr></thead><tbody>{incidents.length ? incidents.map((incident) => <tr key={incident.id}><td><strong>{incident.title}</strong><small className="table-subtitle">{incident.description}</small></td><td>{incident.service}</td><td><span className={`incident-severity ${incident.severity}`}>{severityLabels[incident.severity] ?? incident.severity}</span></td><td><select value={incident.status} onChange={(event) => void runAction(() => updatePlatformIncidentStatus(incident.id, event.target.value))}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="muted-cell">{incident.owner_email ?? 'Responsable non renseigné'}</td><td className="muted-cell">{new Date(incident.started_at).toLocaleString('fr-FR')}</td><td><button className="outline-button" onClick={() => { setSelectedIncidentId(incident.id); setIncidentReport({ rootCause: incident.root_cause ?? '', resolutionSummary: incident.resolution_summary ?? '', preventionActions: incident.prevention_actions ?? '' }) }}>{incident.resolution_summary ? 'Voir le rapport' : 'Rédiger le rapport'}</button></td></tr>) : <tr><td colSpan={7} className="muted-cell">Aucun incident enregistré.</td></tr>}</tbody></table></div>
      {selectedIncident && <div className="incident-report-panel"><div className="panel-heading"><div><h3>Compte rendu : {selectedIncident.title}</h3><p>Cause racine, résolution appliquée et actions préventives pour éviter la répétition.</p></div><button className="outline-button" onClick={() => setSelectedIncidentId(null)}>Fermer</button></div><label>Cause racine<textarea value={incidentReport.rootCause} onChange={(event) => setIncidentReport({ ...incidentReport, rootCause: event.target.value })} placeholder="Pourquoi l’incident s’est-il produit ?" /></label><label>Résolution appliquée<textarea value={incidentReport.resolutionSummary} onChange={(event) => setIncidentReport({ ...incidentReport, resolutionSummary: event.target.value })} placeholder="Quelle correction a été déployée ?" /></label><label>Actions préventives<textarea value={incidentReport.preventionActions} onChange={(event) => setIncidentReport({ ...incidentReport, preventionActions: event.target.value })} placeholder="Comment éviter une nouvelle occurrence ?" /></label><button className="primary-button" onClick={() => void runAction(async () => { await updatePlatformIncidentReport(selectedIncident.id, incidentReport.rootCause, incidentReport.resolutionSummary, incidentReport.preventionActions); setSelectedIncidentId(null) })}>Enregistrer le compte rendu</button></div>}
    </section>
  }
  if (section === 'Mon profil') return <AdminProfile session={session} role={role} onChanged={onChanged} />
  const settingLabels: Record<string, string> = {
    platform_name: 'Nom de la plateforme', platform_logo_url: 'Logo (URL publique)', support_email: 'E-mail support', support_phone: 'Téléphone support', general_info: 'Informations générales',
    email_notifications: 'E-mails', system_notifications: 'Notifications système', alert_notifications: 'Alertes',
    session_duration_minutes: 'Durée des sessions (minutes)', security_rules: 'Règles de sécurité', login_settings: 'Paramètres de connexion',
    subscription_plans: 'Configuration des plans', subscription_rules: 'Règles générales', commercial_settings: 'Paramètres commerciaux',
    timezone: 'Fuseau horaire', maintenance_mode: 'Mode maintenance', pdf_provider: 'Génération PDF'
  }
  const settingGroups: { label: string; keys: string[] }[] = [
    { label: 'Paramètres généraux', keys: ['platform_name', 'platform_logo_url', 'support_email', 'support_phone', 'general_info'] },
    { label: 'Paramètres notifications', keys: ['email_notifications', 'system_notifications', 'alert_notifications'] },
    { label: 'Paramètres sécurité', keys: ['session_duration_minutes', 'security_rules', 'login_settings'] },
    { label: 'Paramètres abonnements', keys: ['subscription_plans', 'subscription_rules', 'commercial_settings'] },
    { label: 'Paramètres système', keys: ['timezone', 'maintenance_mode', 'pdf_provider'] }
  ]
  const settingByKey = new Map(settings.map((setting) => [setting.key, setting]))
  return <section className="platform-settings-page"><div className="panel-heading"><div><p className="eyebrow">CONFIGURATION GLOBALE</p><h1>Paramètres de la plateforme</h1><p>Organisez les règles publiques et opérationnelles de FactureFacile. Les secrets techniques restent dans l’environnement sécurisé de l’application.</p></div></div>{actionError && <div className="data-warning">{actionError}</div>}<div className="platform-settings-grid">{settingGroups.map((group) => <section className="panel platform-settings-card" key={group.label}><h2>{group.label}</h2>{group.keys.map((key) => { const setting = settingByKey.get(key); if (!setting) return null; return <label className="platform-setting-row" key={setting.key}><span>{settingLabels[setting.key]}</span><input className="admin-setting-input" defaultValue={setting.value} onBlur={(event) => { if (event.target.value !== setting.value) void runAction(() => updatePlatformSetting(setting.key, event.target.value)) }} /></label> })}</section>)}</div></section>
}

function UserManagementTable({ users, role }: { users: Awaited<ReturnType<typeof loadPlatformUsersDetailed>>; role: string | null }) {
  const [selected, setSelected] = useState<Awaited<ReturnType<typeof loadPlatformUserDetail>> | null>(null)
  const [error, setError] = useState('')
  const [detailLoading, setDetailLoading] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [businessRole, setBusinessRole] = useState('')
  const [business, setBusiness] = useState('')
  const [plan, setPlan] = useState('')
  const [activity, setActivity] = useState('')
  const [registeredAfter, setRegisteredAfter] = useState('')
  const [removedUserIds, setRemovedUserIds] = useState<Set<string>>(() => new Set())
  const [disabledUserIds, setDisabledUserIds] = useState<Set<string>>(() => new Set())
  const [pendingAction, setPendingAction] = useState<{ type: 'disable' | 'delete'; user: typeof users[number] } | null>(null)
  const canManage = role === 'super_admin' || role === 'admin' || role === 'support'
  const canDelete = role === 'super_admin' || role === 'admin'
  const managedUsers = users
    .filter((user) => !removedUserIds.has(user.user_id))
    .map((user) => disabledUserIds.has(user.user_id) && user.account_status !== 'disabled'
      ? { ...user, account_status: 'disabled' }
      : user)
  const displayedUsers = managedUsers.filter((user) => {
    const haystack = [user.full_name, user.first_name, user.last_name, user.email].filter(Boolean).join(' ').toLowerCase()
    const registered = new Date(user.created_at).getTime()
    const cutoff = registeredAfter ? new Date(registeredAfter).getTime() : 0
    const activeRecently = user.last_activity_at ? Date.now() - new Date(user.last_activity_at).getTime() < 30 * 86400000 : false
    return (!query.trim() || haystack.includes(query.trim().toLowerCase()))
      && (!status || user.account_status === status)
      && (!businessRole || user.business_role === businessRole)
      && (!business || user.business_name === business)
      && (!plan || user.business_plan === plan)
      && (!registeredAfter || registered >= cutoff)
      && (!activity || (activity === 'active' ? activeRecently : !activeRecently))
  })
  const confirmAction = async () => {
    if (!pendingAction) return
    const { type, user } = pendingAction
    setError('')
    try {
      if (type === 'delete') await deletePlatformUser(user.user_id)
      else await setPlatformUserStatus(user.user_id, 'disabled')
      if (type === 'delete') {
        setRemovedUserIds((current) => new Set(current).add(user.user_id))
      } else {
        setDisabledUserIds((current) => new Set(current).add(user.user_id))
      }
      setPendingAction(null)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'L’action n’a pas pu être effectuée.')
    }
  }
  const openDetail = async (userId: string) => {
    setError('')
    setDetailLoading(userId)
    try {
      setSelected(await loadPlatformUserDetail(userId))
    } catch (value) {
      setError(value instanceof Error ? `Impossible de charger la fiche : ${value.message}` : 'Impossible de charger la fiche.')
    } finally {
      setDetailLoading(null)
    }
  }
  return <><section className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Utilisateurs</h2><p>Comptes, entreprise associée, activité et actions protégées.</p></div><span className="admin-role-context">{displayedUsers.length} résultat(s)</span></div>{error && <div className="data-warning">{error}</div>}<div className="module-toolbar"><label className="search-box"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, prénom ou e-mail" aria-label="Rechercher un utilisateur" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer par statut"><option value="">Tous les statuts</option><option value="active">Actif</option><option value="disabled">Désactivé</option></select><select value={businessRole} onChange={(event) => setBusinessRole(event.target.value)} aria-label="Filtrer par rôle"><option value="">Tous les rôles</option><option value="owner">Propriétaire</option><option value="admin">Administrateur</option><option value="member">Membre</option><option value="viewer">Lecteur</option></select>  <select value={business} onChange={(event) => setBusiness(event.target.value)} aria-label="Filtrer par entreprise"><option value="">Toutes les entreprises</option>{[...new Set(users.map((user) => user.business_name).filter((name): name is string => Boolean(name)))].map((name) => <option key={name} value={name}>{name}</option>)}</select><select value={plan} onChange={(event) => setPlan(event.target.value)} aria-label="Filtrer par plan"><option value="">Tous les plans</option>{[...new Set(users.map((user) => user.business_plan))].map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={activity} onChange={(event) => setActivity(event.target.value)} aria-label="Filtrer par activité"><option value="">Toute activité</option><option value="active">Actif sous 30 jours</option><option value="inactive">Inactif ou jamais connecté</option></select><label className="admin-date-filter">Inscrit depuis<input type="date" value={registeredAfter} onChange={(event) => setRegisteredAfter(event.target.value)} /></label></div><div className="table-wrap"><table><thead><tr><th>NOM</th><th>PRÉNOM</th><th>E-MAIL</th><th>ENTREPRISE</th><th>RÔLE</th><th>STATUT</th><th>INSCRIPTION</th><th>DERNIÈRE ACTIVITÉ</th><th>ACTIONS</th></tr></thead><tbody>{displayedUsers.length ? displayedUsers.map((user) => <tr key={user.user_id}><td>{user.last_name ?? '—'}</td><td><strong>{user.first_name || '—'}</strong></td><td>{user.email ?? '—'}</td><td>{user.business_name ?? 'Aucune'}</td><td>{user.business_role}</td><td>{user.account_status === 'active' ? 'Actif' : 'Désactivé'}</td><td className="muted-cell">{new Date(user.created_at).toLocaleDateString('fr-FR')}</td><td className="muted-cell">{user.last_activity_at ? new Date(user.last_activity_at).toLocaleDateString('fr-FR') : 'Jamais'}</td><td className="user-actions"><button type="button" title="Consulter la fiche utilisateur" aria-label={`Consulter ${user.email ?? 'cet utilisateur'}`} className="outline-button" disabled={detailLoading === user.user_id} onClick={() => void openDetail(user.user_id)}><Eye size={14} /> {detailLoading === user.user_id ? 'Chargement…' : 'Consulter'}</button>{canManage && user.account_status === 'active' && <button type="button" className="outline-button warning-button" onClick={() => setPendingAction({ type: 'disable', user })}>Désactiver</button>}{canDelete && <button type="button" className="outline-button danger-button" onClick={() => setPendingAction({ type: 'delete', user })}>Supprimer</button>}</td></tr>) : <tr><td colSpan={9} className="muted-cell">Aucun utilisateur.</td></tr>}</tbody></table></div></section>{selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal-card user-detail-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setSelected(null)}><X size={18} /></button>{selected.avatar_url && <img className="user-detail-avatar" src={selected.avatar_url} alt="" />}  <div className="user-detail-identity"><div className="user-detail-avatar-placeholder">{(selected.first_name || selected.email || '?').slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">FICHE UTILISATEUR</p><h2>{selected.full_name ?? selected.email}</h2><p>{selected.email} · {selected.phone ?? 'Téléphone non renseigné'}</p></div></div><div className="admin-checklist user-detail-summary"><div><span>Prénom / nom</span><strong>{selected.first_name} {selected.last_name ?? ''}</strong></div><div><span>Statut</span><strong>{selected.status}</strong></div><div><span>Création</span><strong>{new Date(selected.created_at).toLocaleDateString('fr-FR')}</strong></div><div><span>Dernière connexion</span><strong>{selected.last_sign_in_at ? new Date(selected.last_sign_in_at).toLocaleString('fr-FR') : 'Jamais'}</strong></div><div><span>Dernière activité</span><strong>{selected.last_activity_at ? new Date(selected.last_activity_at).toLocaleString('fr-FR') : 'Aucune activité enregistrée'}</strong></div><div><span>Nombre de connexions</span><strong>{selected.connection_count || 'Non disponible'}</strong></div></div><h3>Entreprises associées</h3>{selected.businesses.map((item) => <div key={item.id} className="admin-list-item"><strong>{item.name}</strong><span>{item.role} · {item.plan}</span></div>)}<h3>Activité et audit</h3>{selected.activity.length ? selected.activity.map((item, index) => <div key={`${item.created_at}-${index}`} className="admin-list-item"><strong>{item.action}</strong><span>{item.resource_type} · {new Date(item.created_at).toLocaleString('fr-FR')}</span></div>) : <p className="muted-cell">Aucune action importante enregistrée.</p>}<h3>Tickets support récents</h3>{selected.tickets.length ? selected.tickets.map((ticket) => <div key={ticket.id} className="admin-list-item"><strong>{ticket.subject}</strong><span>{ticket.status} · {new Date(ticket.created_at).toLocaleDateString('fr-FR')}</span></div>) : <p className="muted-cell">Aucun ticket lié.</p>}  </div></div>  }{pendingAction && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card confirmation-modal"><p className="eyebrow">{pendingAction.type === 'delete' ? 'SUPPRESSION DÉFINITIVE' : 'DÉSACTIVATION DU COMPTE'}</p><h2>{pendingAction.type === 'delete' ? 'Supprimer cet utilisateur ?' : 'Désactiver cet utilisateur ?'}</h2><p>{pendingAction.type === 'delete' ? 'Cette action supprimera définitivement le compte, ses accès et les données liées selon les règles de conservation. Elle est irréversible.' : 'L’utilisateur ne pourra plus se connecter ni accéder à son entreprise tant que son compte restera désactivé.'}</p><div className="confirmation-actions"><button type="button" className="outline-button" onClick={() => setPendingAction(null)}>Annuler</button><button type="button" className={pendingAction.type === 'delete' ? 'danger-button' : 'warning-button'} onClick={() => void confirmAction()}>{pendingAction.type === 'delete' ? 'Confirmer la suppression' : 'Confirmer la désactivation'}</button></div></div></div>}</>
}

function BusinessManagementTable({ businesses, role }: { businesses: Awaited<ReturnType<typeof loadPlatformBusinessesDetailed>>; role: string | null }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [plan, setPlan] = useState('')
  const [selected, setSelected] = useState<Awaited<ReturnType<typeof loadPlatformBusinessDetail>> | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'subscription' | 'activity' | 'support' | 'audit'>('overview')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const canManage = role === 'super_admin' || role === 'admin' || role === 'support'
  const rows = businesses.filter((item) => (!query || [item.name, item.sector, item.owner_email].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase())) && (!status || item.account_status === status) && (!plan || item.plan === plan))
  const open = async (id: string) => { setLoading(id); setError(''); setActiveTab('overview'); try { setSelected(await loadPlatformBusinessDetail(id)) } catch (value) { setError(value instanceof Error ? value.message : 'Impossible de charger la fiche entreprise.') } finally { setLoading(null) } }
  const updateStatus = async (business: typeof businesses[number], next: 'active' | 'inactive' | 'suspended') => { try { await setPlatformBusinessStatus(business.id, next); business.account_status = next } catch (value) { setError(value instanceof Error ? value.message : 'Impossible de modifier le statut.') } }
  const statusLabel = (value: string) => ({ active: 'Active', inactive: 'Inactive', suspended: 'Suspendue', pending: 'En attente', archived: 'Archivée' }[value] ?? value)
  return <section className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Entreprises clientes</h2><p>Organisations, utilisateurs, abonnements et activité de la plateforme.</p></div><span className="admin-role-context">{rows.length} résultat(s)</span></div>{error && <div className="data-warning">{error}</div>}<div className="module-toolbar"><label className="search-box"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, secteur ou administrateur" aria-label="Rechercher une entreprise" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer par statut"><option value="">Tous les statuts</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspendue</option><option value="pending">En attente</option><option value="archived">Archivée</option></select><select value={plan} onChange={(event) => setPlan(event.target.value)} aria-label="Filtrer par abonnement"><option value="">Tous les abonnements</option>{[...new Set(businesses.map((item) => item.plan))].map((value) => <option key={value} value={value}>{value}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>ENTREPRISE</th><th>SECTEUR</th><th>ADMINISTRATEUR</th><th>UTILISATEURS</th><th>ABONNEMENT</th><th>STATUT</th><th>INSCRIPTION</th><th>DERNIÈRE ACTIVITÉ</th><th>ACTIONS</th></tr></thead><tbody>{rows.length ? rows.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.sector ?? '—'}</td><td>{item.owner_email ?? '—'}</td><td>{item.user_count}</td><td><span className="admin-plan-badge">{item.plan}</span></td><td><span className={`business-status business-status-${item.account_status}`}>{statusLabel(item.account_status)}</span></td><td className="muted-cell">{new Date(item.created_at).toLocaleDateString('fr-FR')}</td><td className="muted-cell">{item.last_activity_at ? new Date(item.last_activity_at).toLocaleDateString('fr-FR') : '—'}</td><td className="user-actions"><button type="button" className="outline-button" disabled={loading === item.id} onClick={() => void open(item.id)}><Eye size={14} /> {loading === item.id ? 'Chargement…' : 'Consulter'}</button>{canManage && <select className="business-status-select" value={item.account_status} onChange={(event) => void updateStatus(item, event.target.value as 'active' | 'inactive' | 'suspended')}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspendue</option></select>}</td></tr>) : <tr><td colSpan={9} className="muted-cell">Aucune entreprise.</td></tr>}</tbody></table></div>{selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal-card business-detail-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setSelected(null)}><X size={18} /></button><div className="business-detail-header"><div className="business-logo-placeholder">{selected.name.slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">FICHE ENTREPRISE</p><h2>{selected.name}</h2><p>{selected.sector ?? 'Secteur non renseigné'} · {statusLabel(selected.account_status)}</p></div></div>  <div className="business-detail-tabs"><button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Vue générale</button><button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>Utilisateurs ({selected.users.length})</button><button className={activeTab === 'subscription' ? 'active' : ''} onClick={() => setActiveTab('subscription')}>Abonnement</button><button className={activeTab === 'activity' ? 'active' : ''} onClick={() => setActiveTab('activity')}>Activité</button><button className={activeTab === 'support' ? 'active' : ''} onClick={() => setActiveTab('support')}>Support</button><button className={activeTab === 'audit' ? 'active' : ''} onClick={() => setActiveTab('audit')}>Audit</button></div>{activeTab === 'overview' && <div className="business-detail-grid"><div><h3>Vue générale</h3><div className="admin-checklist"><div><span>Administrateur principal</span><strong>{selected.owner_email ?? '—'}</strong></div><div><span>Coordonnées</span><strong>{selected.email ?? selected.phone ?? '—'}</strong></div><div><span>Adresse</span><strong>{[selected.address, selected.city, selected.country].filter(Boolean).join(', ') || '—'}</strong></div><div><span>Date d'inscription</span><strong>{new Date(selected.created_at).toLocaleDateString('fr-FR')}</strong></div></div><h3>Abonnement</h3><div className="admin-checklist"><div><span>Plan / statut</span><strong>{selected.plan} · {selected.subscription_status}</strong></div><div><span>Expiration</span><strong>{selected.subscription?.expires_at ? new Date(selected.subscription.expires_at).toLocaleDateString('fr-FR') : 'Sans expiration'}</strong></div></div></div><div><h3>Utilisateurs</h3>{selected.users.map((user) => <div key={user.user_id} className="admin-list-item"><strong>{user.name ?? user.email ?? 'Utilisateur'}</strong><span>{user.email} · {user.role}</span></div>)}<h3>Activité</h3><div className="business-metrics"><strong>{selected.activity.invoices}<small>Factures</small></strong><strong>{selected.activity.clients}<small>Clients</small></strong><strong>{selected.activity.products}<small>Produits</small></strong></div>  <h3>Support & audit</h3><p className="muted-cell">{selected.tickets.length} ticket(s) support · {selected.audit.length} événement(s) d’audit</p></div></div>}{activeTab === 'users' && <div className="business-tab-panel"><h3>Utilisateurs de l’entreprise</h3>{selected.users.map((user) => <div key={user.user_id} className="admin-list-item"><strong>{user.name ?? user.email ?? 'Utilisateur'}</strong><span>{user.email ?? '—'} · {user.role}</span></div>)}</div>}{activeTab === 'subscription' && <div className="business-tab-panel"><h3>Abonnement</h3><div className="admin-checklist"><div><span>Plan</span><strong>{selected.subscription?.plan ?? selected.plan}</strong></div><div><span>Statut</span><strong>{selected.subscription?.status ?? selected.subscription_status}</strong></div><div><span>Date de début</span><strong>{selected.subscription?.created_at ? new Date(selected.subscription.created_at).toLocaleDateString('fr-FR') : '—'}</strong></div><div><span>Date d’expiration</span><strong>{selected.subscription?.expires_at ? new Date(selected.subscription.expires_at).toLocaleDateString('fr-FR') : 'Sans expiration'}</strong></div></div></div>}{activeTab === 'activity' && <div className="business-tab-panel"><h3>Activité</h3><div className="business-metrics"><strong>{selected.activity.invoices}<small>Factures</small></strong><strong>{selected.activity.clients}<small>Clients</small></strong><strong>{selected.activity.products}<small>Produits</small></strong></div></div>}{activeTab === 'support' && <div className="business-tab-panel"><h3>Tickets support</h3>{selected.tickets.length ? selected.tickets.map((ticket) => <div key={ticket.id} className="admin-list-item"><strong>{ticket.subject}</strong><span>{ticket.status} · {ticket.priority}</span></div>) : <p className="muted-cell">Aucun ticket ouvert.</p>}</div>}{activeTab === 'audit' && <div className="business-tab-panel"><h3>Audit administratif</h3>{selected.audit.length ? selected.audit.map((event, index) => <div key={`${event.created_at}-${index}`} className="admin-list-item"><strong>{event.action}</strong><span>{event.resource_type} · {new Date(event.created_at).toLocaleString('fr-FR')}</span></div>) : <p className="muted-cell">Aucun événement administratif.</p>}</div>}</div></div>}</section>
}

function SubscriptionManagement({ subscriptions, plans, query, onQueryChange }: { subscriptions: Awaited<ReturnType<typeof loadPlatformAdminSubscriptions>>; plans: Awaited<ReturnType<typeof loadPlatformSubscriptionPlans>>; query: string; onQueryChange: (value: string) => void }) {
  const [selected, setSelected] = useState<Awaited<ReturnType<typeof loadPlatformSubscriptionDetail>> | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const matches = subscriptions.filter((item) => !query.trim() || `${item.business_name} ${item.plan} ${item.status}`.toLowerCase().includes(query.trim().toLowerCase()))
  const open = async (id: string) => {
    setLoading(id)
    try { setSelected(await loadPlatformSubscriptionDetail(id)) } finally { setLoading(null) }
  }
  const statusLabel = (status: string) => ({ active: 'Active', pending: 'En attente', trialing: 'Essai', expired: 'Expiré', cancelled: 'Annulé', suspended: 'Suspendu', past_due: 'En retard', inactive: 'Inactif' }[status] ?? status)
  const effectiveStateFor = (subscriptionRow: { plan?: string | null; status?: string | null; expires_at?: string | null }) => resolveEffectiveSubscriptionState(subscriptionRow)
  return <section className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Abonnements</h2><p>Plans commerciaux, abonnements des entreprises, renouvellements et historique.</p></div><span className="admin-role-context">{matches.length} abonnement(s)</span></div><div className="module-toolbar"><label className="search-box"><Search size={14} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Entreprise, plan ou statut" aria-label="Rechercher un abonnement" /></label></div><div className="subscription-plan-grid">{plans.map((plan) => <article key={plan.id} className="subscription-plan-card"><div><span className="eyebrow">{plan.code.toUpperCase()}</span><h3>{plan.name}</h3></div><strong>{Number(plan.price).toLocaleString('fr-FR')} {plan.currency}<small> / {plan.billing_period === 'yearly' ? 'an' : 'mois'}</small></strong>  <p>{plan.description}</p><ul>{plan.features.slice(0, 4).map((feature) => <li key={feature}>{feature}</li>)}</ul><div className="subscription-plan-limits">{Object.entries(plan.limits).map(([key, value]) => <span key={key}>{key === 'users' ? 'Utilisateurs' : key === 'invoices' ? 'Factures' : key === 'clients' ? 'Clients' : key === 'products' ? 'Produits' : key === 'storage_mb' ? 'Stockage (Mo)' : key}: {Number(value).toLocaleString('fr-FR')}</span>)}</div><span className={`business-status business-status-${plan.status}`}>{plan.status === 'active' ? 'Disponible' : 'Inactif'}</span></article>)}</div><div className="table-wrap"><table><thead><tr><th>ENTREPRISE</th><th>PLAN</th><th>STATUT</th><th>DÉBUT</th><th>RENOUVELLEMENT</th><th>ACTION</th></tr></thead><tbody>{matches.length ? matches.map((subscription) => {
      const normalized = effectiveStateFor(subscription)
      return <tr key={subscription.id}><td><strong>{subscription.business_name}</strong></td><td><span className="admin-plan-badge">{subscriptionPlanLabels[normalized.plan]}</span></td><td><span className={`business-status business-status-${normalized.status}`}>{statusLabel(normalized.status)}</span></td><td className="muted-cell">{new Date(subscription.created_at).toLocaleDateString('fr-FR')}</td><td className="muted-cell">{subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString('fr-FR') : 'Sans expiration'}</td><td><button type="button" className="outline-button" disabled={loading === subscription.id} onClick={() => void open(subscription.id)}><Eye size={14} /> {loading === subscription.id ? 'Chargement…' : 'Consulter'}</button></td></tr>
    }) : <tr><td colSpan={6} className="muted-cell">Aucun abonnement.</td></tr>}</tbody></table></div>{selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal-card subscription-detail-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setSelected(null)}><X size={18} /></button><p className="eyebrow">FICHE ABONNEMENT</p><h2>{selected.business_name}</h2>{(() => { const normalized = effectiveStateFor(selected); return <div className="admin-checklist"><div><span>Plan / statut</span><strong>{subscriptionPlanLabels[normalized.plan]} · {statusLabel(normalized.status)}</strong></div><div><span>Date de début</span><strong>{new Date(selected.created_at).toLocaleDateString('fr-FR')}</strong></div><div><span>Date d’expiration / renouvellement</span><strong>{selected.renewal_at ? new Date(selected.renewal_at).toLocaleDateString('fr-FR') : selected.plan === 'free' ? 'Sans expiration (FREE)' : 'Non définie'}</strong></div></div> })()}<h3>Historique des changements</h3>{selected.history.length ? selected.history.map((item) => <div className="admin-list-item" key={item.id}><strong>{item.from_plan ?? '—'} → {item.to_plan}</strong><span>{item.from_status ?? '—'} → {item.to_status} · {new Date(item.created_at).toLocaleString('fr-FR')}</span></div>) : <p className="muted-cell">Aucun changement enregistré.</p>}<h3>Paiements associés</h3>{selected.payments.length ? selected.payments.map((payment) => <div className="admin-list-item" key={payment.id}><strong>{Number(payment.amount).toLocaleString('fr-FR')} {payment.currency}</strong><span>{payment.plan} · {statusLabel(payment.status)} · {new Date(payment.created_at).toLocaleDateString('fr-FR')}</span></div>) : <p className="muted-cell">Aucun paiement associé.</p>}</div></div>}</section>
}

function PaymentManagement({ payments, query, onQueryChange }: { payments: Awaited<ReturnType<typeof loadPlatformSubscriptionPayments>>; query: string; onQueryChange: (value: string) => void }) {
  const [selected, setSelected] = useState<typeof payments[number] | null>(null)
  const matches = payments.filter((item) => !query.trim() || `${item.business_name} ${item.plan} ${item.provider} ${item.status}`.toLowerCase().includes(query.trim().toLowerCase()))
  const statusLabel = (status: string) => ({ completed: 'Réussi', pending: 'En attente', failed: 'Échoué', refunded: 'Remboursé', cancelled: 'Annulé' }[status] ?? status)
  return <section className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Paiements adressés à FactureFacile</h2><p>Transactions d’abonnement uniquement, séparées des paiements clients.</p></div><span className="admin-role-context">{matches.length} transaction(s)</span></div><div className="module-toolbar"><label className="search-box"><Search size={14} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Entreprise, plan, fournisseur ou statut" aria-label="Rechercher une transaction" /></label></div><div className="table-wrap"><table><thead><tr><th>RÉFÉRENCE</th><th>ENTREPRISE</th><th>ABONNEMENT</th><th>MONTANT</th><th>MOYEN</th><th>DATE</th><th>STATUT</th><th>ACTION</th></tr></thead><tbody>{matches.length ? matches.map((payment) => <tr key={payment.id}><td className="muted-cell">{payment.internal_reference ?? payment.id.slice(0, 8)}</td><td><strong>{payment.business_name}</strong></td><td>{payment.plan}</td><td>{Number(payment.amount).toLocaleString('fr-FR')} {payment.currency}</td><td>{payment.provider}</td><td className="muted-cell">{new Date(payment.created_at).toLocaleDateString('fr-FR')}</td><td><span className={`business-status business-status-${payment.status}`}>{statusLabel(payment.status)}</span></td><td><button className="outline-button" onClick={() => setSelected(payment)}><Eye size={14} /> Consulter</button></td></tr>) : <tr><td colSpan={8} className="muted-cell">Aucune transaction.</td></tr>}</tbody></table></div>{selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal-card subscription-detail-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}><X size={18} /></button><p className="eyebrow">FICHE TRANSACTION</p><h2>{selected.internal_reference ?? selected.id}</h2><div className="admin-checklist"><div><span>Référence prestataire</span><strong>{selected.provider_token ?? 'Non renseignée'}</strong></div><div><span>Entreprise</span><strong>{selected.business_name}</strong></div><div><span>Plan / montant</span><strong>{selected.plan} · {Number(selected.amount).toLocaleString('fr-FR')} {selected.currency}</strong></div><div><span>Date / statut</span><strong>{new Date(selected.created_at).toLocaleString('fr-FR')} · {statusLabel(selected.status)}</strong></div>  <div><span>Confirmation prestataire</span><strong>{selected.provider_confirmed_at ? `Webhook confirmé le ${new Date(selected.provider_confirmed_at).toLocaleString('fr-FR')}` : 'Confirmation en attente du webhook prestataire'}</strong></div><div><span>Données de confirmation</span><strong>{selected.confirmation_data && Object.keys(selected.confirmation_data).length ? JSON.stringify(selected.confirmation_data) : 'Aucune donnée reçue'}</strong></div></div></div></div>}</section>
}

function SupportManagement({ tickets, runAction }: { tickets: Awaited<ReturnType<typeof loadPlatformSupportTickets>>; runAction: (action: () => Promise<void>) => Promise<void> }) {
  const [selected, setSelected] = useState<Awaited<ReturnType<typeof loadPlatformSupportTicketDetail>> | null>(null)
  const [query, setQuery] = useState('')
  const matches = tickets.filter((ticket) => !query.trim() || `${ticket.subject} ${ticket.business_name ?? ''} ${ticket.user_email ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const counts = { open: tickets.filter((t) => t.status === 'open').length, urgent: tickets.filter((t) => t.priority === 'urgent').length, in_progress: tickets.filter((t) => t.status === 'in_progress').length, waiting: tickets.filter((t) => t.status === 'waiting').length, resolved: tickets.filter((t) => t.status === 'resolved').length }
  const open = async (id: string) => setSelected(await loadPlatformSupportTicketDetail(id))
  return <section className="panel module-table admin-data-panel"><div className="panel-heading"><div><h2>Support</h2><p>Tickets, échanges et actions de l’équipe support.</p></div></div><div className="support-counter-grid">{Object.entries(counts).map(([key, value]) => <div className={`support-counter-card support-counter-${key}`} key={key}><span className="support-counter-label">{key === 'in_progress' ? 'En cours' : key === 'urgent' ? 'Urgents' : key === 'waiting' ? 'En attente' : key === 'resolved' ? 'Résolus' : 'Ouverts'}</span><strong>{value}</strong><small>{key === 'urgent' ? 'Priorité immédiate' : key === 'resolved' ? 'Traités par l’équipe' : 'À surveiller'}</small></div>)}</div><div className="module-toolbar"><label className="search-box"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sujet, entreprise ou utilisateur" /></label></div><div className="table-wrap"><table><thead><tr><th>N°</th><th>ENTREPRISE</th><th>UTILISATEUR</th><th>SUJET</th><th>PRIORITÉ</th><th>STATUT</th><th>CRÉÉ LE</th><th>DERNIÈRE ACTIVITÉ</th><th>ADMINISTRATEUR AFFECTÉ</th><th>ACTION</th></tr></thead><tbody>{matches.map((ticket) => <tr key={ticket.id}><td>{ticket.id.slice(0, 8)}</td><td>{ticket.business_name ?? '—'}</td><td>{ticket.user_email ?? '—'}</td><td><strong>{ticket.subject}</strong></td><td>{ticket.priority}</td><td>{ticket.status}</td><td>{new Date(ticket.created_at).toLocaleDateString('fr-FR')}</td><td>{new Date(ticket.updated_at).toLocaleDateString('fr-FR')}</td><td>{ticket.assigned_to ? 'Affecté' : 'Non affecté'}</td><td><button className="outline-button" onClick={() => void open(ticket.id)}><Eye size={14} /> Consulter</button></td></tr>)}</tbody></table></div>{selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal-card subscription-detail-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}><X size={18} /></button><p className="eyebrow">TICKET {selected.id.slice(0, 8)}</p><h2>{selected.subject}</h2><div className="admin-checklist"><div><span>Entreprise / utilisateur</span><strong>{selected.business_name ?? '—'} · {selected.user_email ?? '—'}</strong></div><div><span>Priorité</span><select value={selected.priority} onChange={(event) => void runAction(async () => { await updatePlatformTicketPriority(selected.id, event.target.value); setSelected({ ...selected, priority: event.target.value }) })}><option value="low">Faible</option><option value="normal">Normale</option><option value="high">Élevée</option><option value="urgent">Urgente</option></select></div><div><span>Assignation</span><button className="outline-button" onClick={() => void runAction(async () => { await assignPlatformTicket(selected.id); setSelected({ ...selected, assigned_to: 'current' }) })}>{selected.assigned_to ? 'Réassigner à moi' : 'M’assigner'}</button></div><div><span>Statut</span><select value={selected.status} onChange={(event) => void runAction(async () => { await updatePlatformTicketStatus(selected.id, event.target.value); setSelected({ ...selected, status: event.target.value }) })}><option value="open">Ouvert</option><option value="in_progress">En cours</option><option value="waiting">En attente</option><option value="resolved">Résolu</option><option value="closed">Fermé</option></select></div></div><h3>Historique des échanges</h3>{selected.messages.map((message) => <div className={`support-message ${message.internal ? 'internal' : ''}`} key={message.id}><strong>{message.internal ? 'Note interne' : message.author_email ?? 'Utilisateur'}</strong><span>{message.body}</span><small>{new Date(message.created_at).toLocaleString('fr-FR')}</small></div>)}<div className="support-detail-actions"><button className="outline-button" onClick={() => { const body = window.prompt('Réponse à envoyer à l’utilisateur :'); if (body) void runAction(() => addPlatformTicketMessage(selected.id, body, false)) }}>Répondre</button><button className="outline-button warning-button" onClick={() => { const body = window.prompt('Note interne (invisible pour l’utilisateur) :'); if (body) void runAction(() => addPlatformTicketMessage(selected.id, body, true)) }}>Ajouter une note interne</button></div></div></div>}</section>
}

function PlatformAdminDataTable({ section, role, busy, users, businesses, subscriptions, subscriptionPlans, payments }: {
  section: PlatformAdminSection
  role: string | null
  busy: boolean
  users: Awaited<ReturnType<typeof loadPlatformUsersDetailed>>
  businesses: Awaited<ReturnType<typeof loadPlatformBusinessesDetailed>>
  subscriptions: Awaited<ReturnType<typeof loadPlatformAdminSubscriptions>>
  subscriptionPlans: Awaited<ReturnType<typeof loadPlatformSubscriptionPlans>>
  payments: Awaited<ReturnType<typeof loadPlatformSubscriptionPayments>>
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const normalizedQuery = query.trim().toLowerCase()
  const matches = (value: string | null | undefined) => !normalizedQuery || (value ?? '').toLowerCase().includes(normalizedQuery)
  const filteredUsers = users.filter((user) => matches(user.email) || matches(user.full_name) || matches(user.business_name) || matches(user.business_role) || matches(user.account_status) || matches(user.business_plan))
  const filteredBusinesses = businesses.filter((business) => matches(business.name) || matches(business.owner_email) || matches(business.plan) || matches(business.subscription_status))
  const userRows = filteredUsers.slice(page * 10, page * 10 + 10)
  const businessRows = filteredBusinesses.slice(page * 10, page * 10 + 10)
  if (busy) return <div className="auth-loading admin-inline-loading">Chargement des données administrateur...</div>
  if (section === 'Utilisateurs') return <UserManagementTable users={userRows} role={role} />
  if (section === 'Entreprises') return <BusinessManagementTable businesses={businessRows} role={role} />
  if (section === 'Abonnements') return <SubscriptionManagement subscriptions={subscriptions} plans={subscriptionPlans} query={query} onQueryChange={(value) => { setQuery(value); setPage(0) }} />
  return <PaymentManagement payments={payments} query={query} onQueryChange={(value) => { setQuery(value); setPage(0) }} />
}

function PlatformAdminPage({ overview, role = null, loading = false, error = '', operationalSummary = null, activity = [], onRetry = () => undefined, onOpenSupport = () => undefined, onOpenHealth = () => undefined, onOpenSecurity = () => undefined, onOpenSection = () => undefined, onRefresh = () => undefined }: { overview: NonNullable<Awaited<ReturnType<typeof loadPlatformAdminOverview>>> | null; role?: string | null; loading?: boolean; error?: string; operationalSummary?: Awaited<ReturnType<typeof loadPlatformOperationalSummary>> | null; activity?: Awaited<ReturnType<typeof loadPlatformActivity>>; onRetry?: () => void; onOpenSupport?: () => void; onOpenHealth?: () => void; onOpenSecurity?: () => void; onOpenSection?: (section: PlatformAdminSection) => void; onRefresh?: () => void }) {
  if (!overview) return <div className="auth-loading">Chargement de l’administration...</div>
  const roleLabels: Record<string, string> = { super_admin: 'Super administrateur', admin: 'Administrateur', support: 'Support', finance: 'Finance Manager', analyst: 'Analyste' }
  const canViewFinance = role === 'super_admin' || role === 'admin' || role === 'finance'
  const availableModules = Object.entries(sectionPermissions).filter(([, permission]) => platformRolePermissions[role ?? '']?.has(permission)).map(([label]) => label)
  if (loading) return <section className="module-page"><div className="admin-dashboard-loading"><div className="skeleton-heading" /><div className="skeleton-stats">{[1, 2, 3, 4, 5, 6].map((item) => <div className="dashboard-skeleton-card" key={item} />)}</div><div className="dashboard-skeleton-panel" /></div></section>
  if (error) return <section className="module-page"><div className="dashboard-error-state"><AlertTriangle size={28} /><h2>Données du dashboard indisponibles</h2><p>{error}</p><button className="primary-button" onClick={onRetry}>Réessayer</button></div></section>
  const formatAmount = (amount: number) => `${amount.toLocaleString('fr-FR')} ${overview.currency ?? 'XOF'}`
  const formatHours = (hours: number | null | undefined) => hours == null ? '—' : hours < 24 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} j`
  const change = overview.revenue_change_percent
  const health = operationalSummary?.health_checks ?? []
  const healthStatus = (status: string) => status === 'operational' ? 'Opérationnel' : status === 'incident' ? 'Incident' : 'Attention'
  const healthTone = (status: string) => status === 'operational' ? 'operational' : status === 'incident' ? 'incident' : 'attention'
  const security = operationalSummary
  const quickActions: { label: string; section?: PlatformAdminSection; action?: () => void }[] = [
    { label: 'Tickets urgents', action: onOpenSupport },
    { label: 'Paiements échoués', section: 'Paiements' },
    { label: 'Gérer les utilisateurs', section: 'Utilisateurs' },
    { label: 'Consulter les incidents', action: onOpenHealth },
    { label: 'Ajouter un administrateur', section: 'Administrateurs' },
    { label: 'Modifier les plans', section: 'Abonnements' },
    { label: 'Journal d’audit', section: 'Journal d’audit' },
    { label: 'Actualiser les données', action: onRefresh },
  ]
  return (
    <section className="module-page">
      <div className="module-heading"><div><span className="team-current-role"><ShieldCheck size={15} /> {roleLabels[role ?? ''] ?? 'Rôle en cours de chargement'}</span><p className="admin-role-help">Modules disponibles : {availableModules.length ? availableModules.join(' · ') : 'chargement des permissions'}</p></div><small className="admin-last-update">Dernière mise à jour : {operationalSummary?.checked_at ? new Date(operationalSummary.checked_at).toLocaleString('fr-FR') : '—'}</small></div>
      <div className="stats-grid admin-stats">
        <StatCard period={false} title="Entreprises" value={String(overview.business_count)} change="comptes créés" trend="up" icon={<ShoppingBag size={20} />} tone="blue" />
        <StatCard period={false} title="Utilisateurs" value={String(overview.member_count)} change="membres enregistrés" trend="up" icon={<Users size={20} />} tone="purple" />
        <StatCard period={false} title="Factures" value={String(overview.invoice_count)} change="tous comptes confondus" trend="up" icon={<FileText size={20} />} tone="green" />
        {canViewFinance ? <StatCard period={false} title="Revenus abonnements" value={formatAmount(overview.revenue_month ?? overview.subscription_revenue)} change={`${change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`} vs mois précédent`} trend={change == null || change >= 0 ? 'up' : 'down'} icon={<WalletCards size={20} />} tone="orange" /> : <div className="admin-restricted-card"><LockKeyhole size={18} /><strong>Données financières masquées</strong><span>Votre rôle ne permet pas d’accéder aux revenus.</span></div>}
        <StatCard period={false} title="Tickets ouverts" value={String(overview.open_ticket_count ?? 0)} change={`${overview.urgent_ticket_count ?? 0} urgent(s) · ${overview.unanswered_ticket_count ?? 0} sans réponse`} trend="up" icon={<CircleHelp size={20} />} tone="blue" />
        <StatCard period={false} title="Alertes sécurité" value={String(overview.security_alert_count ?? 0)} change="non lues" trend="up" icon={<ShieldCheck size={20} />} tone="purple" />
      </div>
      {canViewFinance && <div className="panel admin-growth-panel"><div className="panel-heading"><div><h2>Objectifs et croissance</h2><p>Suivi de la période sélectionnée par rapport à la période précédente.</p></div>{(overview.growth_percent ?? 0) < -10 && <span className="admin-warning-badge">Baisse importante</span>}</div>{overview.growth_metrics_error && <div className="data-warning" role="alert">{overview.growth_metrics_error}</div>}<div className="admin-growth-grid"><div><span>Objectif revenus</span><strong>{overview.monthly_revenue_goal == null ? '—' : formatAmount(overview.monthly_revenue_goal)}</strong><small>{overview.goal_progress_percent == null ? '—' : `${overview.goal_progress_percent.toFixed(1)}% atteint`}</small></div><div><span>Croissance</span><strong className={(overview.growth_percent ?? 0) < 0 ? 'negative' : 'positive'}>{overview.growth_percent == null ? '—' : `${overview.growth_percent >= 0 ? '+' : ''}${overview.growth_percent.toFixed(1)}%`}</strong><small>vs période précédente</small></div><div><span>Rétention entreprises</span><strong>{overview.retention_rate == null ? '—' : `${overview.retention_rate.toFixed(1)}%`}</strong><small>sur la période</small></div><div><span>Taux de résiliation</span><strong>{overview.churn_rate == null ? '—' : `${overview.churn_rate.toFixed(1)}%`}</strong><small>sur la période</small></div></div></div>}
      <div className="panel admin-quick-actions">
        <div className="panel-heading"><div><h2>Actions rapides</h2><p>Accédez directement aux tâches administratives prioritaires.</p></div></div>
        <div className="quick-actions-grid">{quickActions.map((item) => <button key={item.label} className="quick-action-button" onClick={() => item.action ? item.action() : item.section && onOpenSection(item.section)}>{item.label}<ChevronRight size={14} /></button>)}</div>
      </div>
      <div className="content-grid admin-content-grid">
        <div className="panel">
          <div className="panel-heading"><div><h2>État de la plateforme</h2><p>Indicateurs opérationnels en temps réel.</p></div></div>
          <div className="admin-summary-list">
            <div><span>Abonnements actifs</span><strong>{overview.active_subscriptions}</strong></div>
            {canViewFinance ? <><div><span>Revenus du mois</span><strong>{formatAmount(overview.revenue_month ?? overview.subscription_revenue)}</strong></div>
            <div><span>Revenus mois précédent</span><strong>{formatAmount(overview.revenue_previous_month ?? 0)}</strong></div>
            <div><span>Chiffre d’affaires encaissé</span><strong>{formatAmount(overview.revenue)}</strong></div>
            <div><span>Montant récurrent mensuel</span><strong>{formatAmount(overview.monthly_recurring_revenue ?? 0)}</strong></div>
            <div><span>Paiements échoués / remboursements</span><strong>{overview.failed_payments ?? 0} / {formatAmount(overview.refund_amount ?? 0)}</strong></div>
            <div><span>Impayés</span><strong>{overview.unpaid_payments?.count ?? overview.pending_payments} · {formatAmount(overview.unpaid_payments?.amount ?? 0)}</strong></div>
            <div><span>Revenus par plan</span><strong>{(overview.revenue_by_plan ?? []).map((item) => `${item.plan}: ${formatAmount(item.amount)}`).join(' · ') || '—'}</strong></div>
            <div><span>Paiements en attente</span><strong>{overview.pending_payments}</strong></div></> : <div className="admin-restricted-row"><LockKeyhole size={15} /><span>Les indicateurs financiers sont masqués pour ce rôle.</span></div>}
          </div>
          <div className="panel admin-operations-panel">
            <div className="panel-heading"><div><h2>Santé de la plateforme</h2><p>État opérationnel des services critiques.</p></div><button className="outline-button" onClick={onOpenHealth}>Voir les incidents</button></div>
            <div className="health-dashboard-grid">{health.filter((check) => ['postgresql', 'payment', 'email', 'storage', 'application'].includes(check.service_key)).map((check) => <div className={`health-dashboard-card ${healthTone(check.status)}`} key={check.service_key}><span className="health-status-dot" /><strong>{check.service_name}</strong><small>{healthStatus(check.status)}</small><em>{check.latency_ms == null ? '—' : `${check.latency_ms} ms`}</em></div>)}</div>
            <div className="admin-operations-footer"><span>Dernière vérification : {security?.checked_at ? new Date(security.checked_at).toLocaleString('fr-FR') : '—'}</span><span>Disponibilité suivie en temps réel</span></div>
            {security?.active_incident && <button className="health-active-incident" onClick={onOpenHealth}>Incident actif : {security.active_incident.title}</button>}
          </div>
          <div className="panel admin-operations-panel">
            <div className="panel-heading"><div><h2>Sécurité</h2><p>Surveillance des accès et actions sensibles.</p></div><button className="outline-button" onClick={onOpenSecurity}>Voir la sécurité</button></div>
            <div className="security-dashboard-grid">
              <div><strong>{security?.failed_login_count ?? 0}</strong><span>Échecs de connexion</span></div>
              <div><strong>{security?.unusual_login_count ?? 0}</strong><span>Connexions inhabituelles</span></div>
              <div><strong>{security?.suspended_account_count ?? 0}</strong><span>Comptes suspendus</span></div>
              <div><strong>{security?.recent_admin_count ?? 0}</strong><span>Admins récemment créés</span></div>
              <div><strong>{security?.active_session_count ?? 0}</strong><span>Sessions actives</span></div>
              <div><strong>{security?.mfa_enabled_count ?? 0}/{security?.mfa_total_count ?? 0}</strong><span>MFA activée</span></div>
            </div>
            <div className="security-dashboard-columns"><div><h3>Dernières connexions administrateur</h3>{(security?.latest_admin_logins ?? []).slice(0, 3).map((login, index) => <p key={`${login.created_at}-${index}`}><strong>{login.actor_email ?? 'Administrateur'}</strong><span>{new Date(login.created_at).toLocaleString('fr-FR')} · {login.result}</span></p>)}</div><div><h3>Actions critiques récentes</h3>{(security?.recent_critical_actions ?? []).slice(0, 3).map((action, index) => <p key={`${action.created_at}-${index}`}><strong>{action.action}</strong><span>{action.actor_email ?? 'Système'} · {new Date(action.created_at).toLocaleString('fr-FR')}</span></p>)}</div></div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading"><div><h2>Support client</h2><p>SLA et charge opérationnelle.</p></div><button className="outline-button" onClick={onOpenSupport}>Traiter les tickets</button></div>
          <div className="admin-summary-list">
            <div><span>Ticket le plus ancien</span><strong>{formatHours(overview.oldest_open_ticket_hours)}</strong></div>
            <div><span>Première réponse moyenne</span><strong>{formatHours(overview.average_first_response_hours)}</strong></div>
            <div><span>Résolution moyenne</span><strong>{formatHours(overview.average_resolution_hours)}</strong></div>
            <div><span>Proches du dépassement SLA</span><strong>{overview.sla_at_risk_ticket_count ?? 0}</strong></div>
            <div><span>Répartition par priorité</span><strong>{(overview.tickets_by_priority ?? []).map((item) => `${item.priority}: ${item.count}`).join(' · ') || '—'}</strong></div>
          </div>
        </div>
        <div className="panel admin-activity-panel">
          <div className="panel-heading"><div><h2>Activité récente</h2><p>Les derniers événements importants de la plateforme.</p></div></div>
          <div className="admin-activity-timeline">{activity.length ? activity.map((item) => <div className="admin-activity-item" key={item.id}><span className={`admin-activity-icon admin-activity-${item.type}`} /><div><strong>{item.label}</strong><p>{item.detail}</p><small>{new Date(item.created_at).toLocaleString('fr-FR')}</small></div></div>) : <p className="muted-cell">Aucune activité récente.</p>}</div>
        </div>
      </div>
    </section>
  )
}

function BusinessPage({ businessId }: { businessId: string }) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [logoError, setLogoError] = useState('')
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { void loadBusinessProfile(businessId).then(setProfile).catch((error: unknown) => setMessage(userFacingError(error, 'Impossible de charger l’entreprise.'))) }, [businessId])
  if (!profile) return <div className="auth-loading">Chargement des informations de l’entreprise...</div>
  const previewIssueDate = getBusinessDateKey(new Date(), profile.timezone)
  const previewDueDate = addDateDays(previewIssueDate, profile.default_due_days)
  const previewInvoiceNumber = formatInvoiceNumberExample(profile.invoice_number_prefix, profile.invoice_number_include_year, profile.invoice_number_sequence_width, Number(previewIssueDate.slice(0, 4)))
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = profile.name.trim()
    const email = profile.email?.trim() ?? ''
    if (!name) {
      setMessage('Le nom de l’entreprise est obligatoire.')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Saisissez une adresse email valide.')
      return
    }
    if ((profile.payment_instructions?.length ?? 0) > 500 || (profile.invoice_legal_notice?.length ?? 0) > 500) {
      setMessage('Les modalités de règlement et la mention de facture sont limitées à 500 caractères chacune.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const nextProfile = { ...profile, name, email: email || null }
      await updateBusinessProfile(businessId, { name, phone: nextProfile.phone, email: nextProfile.email, address: nextProfile.address, city: nextProfile.city, country: nextProfile.country, tax_id: nextProfile.tax_id, logo_url: nextProfile.logo_url, payment_instructions: nextProfile.payment_instructions?.trim() || null, invoice_legal_notice: nextProfile.invoice_legal_notice?.trim() || null, default_due_days: nextProfile.default_due_days, default_tax_rate: nextProfile.default_tax_rate, currency: nextProfile.currency, timezone: nextProfile.timezone, invoice_number_prefix: nextProfile.invoice_number_prefix, invoice_number_include_year: nextProfile.invoice_number_include_year, invoice_number_sequence_width: nextProfile.invoice_number_sequence_width })
      setProfile(nextProfile)
      setMessage('Informations enregistrées.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible d’enregistrer les informations.'))
    } finally {
      setBusy(false)
    }
  }
  const updateField = (field: keyof BusinessProfile, value: string) => setProfile({ ...profile, [field]: value })
  const previewSubtotal = 10_000
  const previewTax = Math.round(previewSubtotal * profile.default_tax_rate / 100)
  const previewTotal = previewSubtotal + previewTax
  const logoFileChanged = async (file: File | undefined) => {
    if (!file) return
    setLogoError('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError('Format non accepté. Choisissez un fichier PNG, JPEG ou WEBP.')
      if (logoInputRef.current) logoInputRef.current.value = ''
      return
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setLogoError(file.size === 0 ? 'Le fichier du logo est vide.' : 'Le logo ne doit pas dépasser 2 Mo.')
      if (logoInputRef.current) logoInputRef.current.value = ''
      return
    }
    setBusy(true)
    setMessage('Validation et téléversement du logo...')
    try {
      const logoUrl = await uploadBusinessLogo(businessId, file)
      setProfile((current) => current ? { ...current, logo_url: logoUrl } : current)
      setLogoPreviewFailed(false)
      setMessage('Logo validé et téléversé. Enregistrez les autres informations pour les appliquer.')
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'Impossible de valider le logo.')
      if (logoInputRef.current) logoInputRef.current.value = ''
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="module-page">
      <div className="module-heading">
        <div>
          <p className="eyebrow">CONFIGURATION</p>
          <h1>Mon entreprise</h1>
          <p>Complétez les coordonnées, les modalités de règlement et les mentions à afficher sur les documents.</p>
        </div>
      </div>
      <div className="settings-layout">
        <form className="panel settings-form" onSubmit={save}>
          <div className="settings-section-heading">
            <div className="settings-section-icon"><ShoppingBag size={19} /></div>
            <div><h2>Identité de l’entreprise</h2><p>Présentez clairement votre activité à vos clients.</p></div>
          </div>
          <div className="business-fields">
            <label className="business-field-wide"><span>Nom de l’entreprise <b>*</b></span><input required value={profile.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Ex. Atelier Créatif" /></label>
            <label><span>Email professionnel</span><input type="email" value={profile.email ?? ''} onChange={(event) => updateField('email', event.target.value)} placeholder="contact@entreprise.bj" /></label>
            <label><span>Téléphone</span><input type="tel" value={profile.phone ?? ''} onChange={(event) => updateField('phone', event.target.value)} placeholder="+229 97 00 00 00" /></label>
            <label className="business-field-wide"><span>Adresse</span><input value={profile.address ?? ''} onChange={(event) => updateField('address', event.target.value)} placeholder="Adresse de l’entreprise" /></label>
            <label><span>Ville</span><input value={profile.city ?? ''} onChange={(event) => updateField('city', event.target.value)} placeholder="Cotonou" /></label>
            <label><span>Pays</span><input value={profile.country} onChange={(event) => updateField('country', event.target.value)} placeholder="Bénin" /></label>
            <label className="business-field-wide"><span>Identifiant fiscal <small>facultatif</small></span><input value={profile.tax_id ?? ''} onChange={(event) => updateField('tax_id', event.target.value)} placeholder="IFU ou numéro fiscal" /></label>
            <label className="business-field-wide"><span>Modalités de règlement <small>facultatif · 500 caractères max.</small></span><textarea maxLength={500} rows={3} value={profile.payment_instructions ?? ''} onChange={(event) => updateField('payment_instructions', event.target.value)} placeholder="Ex. Virement bancaire ou Mobile Money — indiquez votre référence de paiement." /><small className="field-hint">N’ajoutez que les coordonnées nécessaires au règlement. Elles seront visibles sur les factures.</small></label>
            <label className="business-field-wide"><span>Mentions complémentaires sur les factures <small>facultatif · 500 caractères max.</small></span><textarea maxLength={500} rows={3} value={profile.invoice_legal_notice ?? ''} onChange={(event) => updateField('invoice_legal_notice', event.target.value)} placeholder="Mention propre à votre activité ou à votre processus de facturation." /><small className="field-hint">Faites vérifier la conformité des mentions applicables au Bénin avant usage en production.</small></label>
            <label className="business-field-wide"><span>Logo de l’entreprise <small>PNG, JPEG ou WEBP · 2 Mo max. · 5 000 × 5 000 px max.</small></span><input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => void logoFileChanged(event.target.files?.[0])} />{logoError && <small className="business-logo-error" role="alert">{logoError}</small>}</label>
          </div>
          {message && <div className={`settings-message ${message === 'Informations enregistrées.' ? 'success' : ''}`}>{message}</div>}
          <div className="settings-actions">
            <span>Ces informations seront visibles sur vos factures.</span>
            <button className="primary-button" disabled={busy}>{busy ? 'Enregistrement...' : 'Enregistrer les informations'}</button>
          </div>
        </form>
        <aside className="business-document-preview">
          <div className="business-preview-toolbar"><div><p className="eyebrow">APERÇU DOCUMENT</p><strong>Structure utilisée dans le PDF</strong></div><FileText size={18} /></div>
          <div className="invoice-preview-paper">
            <header className="invoice-preview-header">
              <div className="invoice-preview-sender">
                {profile.logo_url && !logoPreviewFailed ? <img className="invoice-preview-logo" src={profile.logo_url} alt={`Logo ${profile.name}`} onError={() => setLogoPreviewFailed(true)} /> : <div className="invoice-preview-logo-placeholder">{profile.name.slice(0, 1).toUpperCase() || 'E'}</div>}
                <span className="invoice-preview-document-title">FACTURE</span>
                <strong>{profile.name || 'Nom de l’entreprise'}</strong>
                <p>{profile.address || 'Adresse'}<br />{[profile.city, profile.country].filter(Boolean).join(', ') || 'Ville, Bénin'}<br />{profile.email || 'E-mail'}{profile.phone ? ` · ${profile.phone}` : ''}<br />{profile.tax_id ? `IFU : ${profile.tax_id}` : 'IFU non renseigné'}</p>
              </div>
              <div className="invoice-preview-reference"><strong>{previewInvoiceNumber}</strong><span>Date d’émission : {formatBusinessDateKey(previewIssueDate, profile.timezone)}</span><span>Date d’échéance : {formatBusinessDateKey(previewDueDate, profile.timezone)}</span><span>Devise : {profile.currency}</span></div>
            </header>
            <div className="invoice-preview-client"><strong>FACTURÉ À</strong><span>Nom du client</span><span>E-mail · Téléphone</span></div>
            <table className="invoice-preview-table"><thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody><tr><td>Produit ou service</td><td>1</td><td>{previewSubtotal.toLocaleString('fr-FR')} {profile.currency}</td><td>{previewSubtotal.toLocaleString('fr-FR')} {profile.currency}</td></tr></tbody></table>
            <div className="invoice-preview-totals"><span>Sous-total<strong>{previewSubtotal.toLocaleString('fr-FR')} {profile.currency}</strong></span><span>Réduction<strong>0 {profile.currency}</strong></span><span>TVA / taxe<strong>{previewTax.toLocaleString('fr-FR')} {profile.currency} ({profile.default_tax_rate}%)</strong></span><b>TOTAL À PAYER<strong>{previewTotal.toLocaleString('fr-FR')} {profile.currency}</strong></b></div>
            <div className="invoice-preview-footer"><p>Facture commerciale établie au Bénin. Conditions de règlement : paiement à la date d’échéance indiquée ci-dessus.</p>{profile.payment_instructions?.trim() && <p><strong>Modalités de règlement :</strong> {profile.payment_instructions}</p>}{profile.invoice_legal_notice?.trim() && <p>{profile.invoice_legal_notice}</p>}<p>Document établi au Bénin - conserver cette facture pour votre comptabilité.</p></div>
          </div>
          <p className="business-preview-note">Aperçu illustratif : le PDF final reprend ces blocs avec les données et montants de la facture sélectionnée. La validité des mentions légales et fiscales doit être confirmée par un professionnel compétent.</p>
        </aside>
      </div>
    </section>
  )
}

function AccountSecurityPage({ email, businessId, fullName, phone, avatarUrl, onAvatarChanged }: { email: string; businessId: string; fullName: string; phone: string; avatarUrl: string; onAvatarChanged: (url: string) => void }) {
  const [profileName, setProfileName] = useState(fullName)
  const [profilePhone, setProfilePhone] = useState(phone)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(avatarUrl)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [totpFactor, setTotpFactor] = useState<{ id: string; friendly_name?: string | null } | null>(null)
  const [totpQrCode, setTotpQrCode] = useState('')
  const [totpSecret, setTotpSecret] = useState('')
  const [totpPendingFactorId, setTotpPendingFactorId] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpMessage, setTotpMessage] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [confirmDeletionRequest, setConfirmDeletionRequest] = useState(false)

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusyAction('profile')
    setMessage('')
    try {
      await updateAccountProfile({ fullName: profileName, phone: profilePhone })
      setProfileName(profileName.trim())
      setProfilePhone(profilePhone.trim())
      setMessage('Votre profil a été mis à jour.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible de mettre à jour votre profil.'))
    } finally {
      setBusyAction('')
    }
  }

  const changeProfilePhoto = async (file: File | undefined) => {
    if (!file) return
    setBusyAction('photo')
    setMessage('')
    try {
      const url = await uploadAccountProfilePhoto(file)
      setProfilePhotoUrl(url)
      onAvatarChanged(url)
      setMessage('Votre photo de profil a été mise à jour.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible de mettre à jour votre photo de profil.'))
    } finally {
      setBusyAction('')
    }
  }

  useEffect(() => {
    let cancelled = false
    void supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setTotpMessage(userFacingError(error, 'Impossible de vérifier vos facteurs MFA.'))
        return
      }
      setTotpFactor(data.totp.find((factor) => factor.status === 'verified') ?? null)
    }).catch((error: unknown) => {
      if (!cancelled) setTotpMessage(userFacingError(error, 'Impossible de charger les paramètres MFA.'))
    })
    return () => { cancelled = true }
  }, [])

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    if (password.length < 8) {
      setMessage('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmation) {
      setMessage('Les mots de passe ne correspondent pas.')
      return
    }

    setBusyAction('password')
    try {
      await updateAccountPassword(password)
      setPassword('')
      setConfirmation('')
      setMessage('Votre mot de passe a été modifié.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible de modifier le mot de passe.'))
    } finally {
      setBusyAction('')
    }
  }

  const requestPasswordRecovery = async () => {
    setBusyAction('recovery')
    setMessage('')
    try {
      const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      if (result.error) throw result.error
      setMessage('Un lien de récupération a été envoyé si cette adresse est associée à un compte.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible d’envoyer le lien de récupération.'))
    } finally {
      setBusyAction('')
    }
  }

  const requestEmailChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextEmail = newEmail.trim()
    if (!nextEmail || nextEmail.toLowerCase() === email.toLowerCase()) {
      setMessage('Saisissez une nouvelle adresse e-mail différente de l’adresse actuelle.')
      return
    }
    setBusyAction('email')
    setMessage('')
    try {
      const result = await supabase.auth.updateUser({ email: nextEmail })
      if (result.error) throw result.error
      setNewEmail('')
      setMessage('Un lien de confirmation a été envoyé à la nouvelle adresse. Le changement sera effectif après validation.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible de demander le changement d’adresse e-mail.'))
    } finally {
      setBusyAction('')
    }
  }

  const startTotpEnrollment = async () => {
    setBusyAction('mfa')
    setTotpMessage('')
    try {
      const enforcement = await supabase.rpc('mfa_requirement_satisfied')
      if (enforcement.error) throw new Error('Le contrôle MFA côté base n’est pas activé. Demandez à l’administrateur d’appliquer la migration 20261019008000_mfa_enforcement.sql.')
      const result = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'FactureFacile' })
      if (result.error) throw result.error
      setTotpPendingFactorId(result.data.id)
      setTotpQrCode(result.data.totp.qr_code)
      setTotpSecret(result.data.totp.secret)
      setTotpMessage('Scannez le QR code avec votre application d’authentification, puis saisissez le code affiché.')
    } catch (error) {
      setTotpMessage(userFacingError(error, 'Impossible de démarrer la configuration MFA.'))
    } finally {
      setBusyAction('')
    }
  }

  const verifyTotpEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(totpCode)) {
      setTotpMessage('Saisissez le code temporaire à 6 chiffres.')
      return
    }
    setBusyAction('mfa')
    setTotpMessage('')
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: totpPendingFactorId })
      if (challenge.error) throw challenge.error
      const verification = await supabase.auth.mfa.verify({ factorId: totpPendingFactorId, challengeId: challenge.data.id, code: totpCode })
      if (verification.error) throw verification.error
      setTotpFactor({ id: totpPendingFactorId, friendly_name: 'FactureFacile' })
      setTotpPendingFactorId('')
      setTotpQrCode('')
      setTotpSecret('')
      setTotpCode('')
      setTotpMessage('L’authentification multifacteur est activée.')
    } catch (error) {
      setTotpMessage(userFacingError(error, 'Le code MFA est invalide ou la configuration a échoué.'))
    } finally {
      setBusyAction('')
    }
  }

  const removeTotpFactor = async () => {
    if (!totpFactor) return
    setBusyAction('mfa')
    setTotpMessage('')
    try {
      const result = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id })
      if (result.error) throw result.error
      setTotpFactor(null)
      setTotpMessage('L’authentification multifacteur a été désactivée.')
    } catch (error) {
      setTotpMessage(userFacingError(error, 'Impossible de désactiver le facteur MFA.'))
    } finally {
      setBusyAction('')
    }
  }

  const revokeOtherSessions = async () => {
    setBusyAction('sessions')
    setMessage('')
    try {
      const result = await supabase.auth.signOut({ scope: 'others' })
      if (result.error) throw result.error
      setMessage('Les autres sessions ont été déconnectées. Votre session actuelle reste active.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible de fermer les autres sessions.'))
    } finally {
      setBusyAction('')
    }
  }

  const downloadDataExport = async () => {
    setBusyAction('export')
    setMessage('')
    try {
      const data = await exportBusinessData(businessId)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `facturefacile-export-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setMessage('L’export JSON de vos données accessibles a été téléchargé.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible de préparer l’export JSON.'))
    } finally {
      setBusyAction('')
    }
  }

  const requestAccountDeletion = async () => {
    if (!confirmDeletionRequest) {
      setMessage('Confirmez que vous souhaitez transmettre une demande au support.')
      return
    }
    setBusyAction('deletion')
    setMessage('')
    try {
      const result = await submitPublicSupportRequest({
        name: (fullName || email).slice(0, 120),
        email,
        subject: 'Demande de suppression du compte',
        body: `Je demande l’examen de la suppression de mon compte et des données personnelles associées. Cette demande ne déclenche pas une suppression automatique. Merci de confirmer les données concernées et les éventuelles obligations de conservation avant toute action.${deleteReason.trim() ? `\n\nPrécisions : ${deleteReason.trim()}` : ''}`,
      })
      setConfirmDeletionRequest(false)
      setDeleteReason('')
      setMessage(`La demande a été transmise au support. Identifiant : ${result.ticket_id} · code de suivi : ${result.access_code}. Aucune donnée n’a été supprimée.`)
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible de transmettre la demande de suppression.'))
    } finally {
      setBusyAction('')
    }
  }

  return (
    <section className="module-page">
      <div className="module-heading">
        <div>
          <p className="eyebrow">PROFIL ET SÉCURITÉ</p>
          <h1>Mon compte</h1>
          <p>Gérez vos coordonnées personnelles, vos identifiants et la sécurité de votre accès.</p>
        </div>
      </div>
      {message && <div className={`settings-message ${message === 'Votre profil a été mis à jour.' || message === 'Votre mot de passe a été modifié.' ? 'success' : ''}`} role="status">{message}</div>}
      <div className="account-security-grid">
        <section className="panel account-security-panel">
          <div className="settings-section-heading"><div className="settings-section-icon"><UserRound size={19} /></div><div><h2>Mon profil</h2><p>Ces coordonnées sont associées à votre compte personnel, pas à votre entreprise.</p></div></div>
          <div className="account-profile-photo">
            <div className="account-profile-photo-preview">{profilePhotoUrl ? <img src={profilePhotoUrl} alt="Photo de profil actuelle" /> : <UserRound size={30} />}</div>
            <div className="account-profile-photo-actions">
              <label className="outline-button account-photo-upload">{busyAction === 'photo' ? 'Téléversement...' : profilePhotoUrl ? 'Changer la photo' : 'Ajouter une photo'}
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busyAction)} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void changeProfilePhoto(file) }} />
              </label>
              <small className="field-hint">PNG, JPEG ou WEBP · 2 Mo max. · 5 000 × 5 000 px max. La photo est accessible publiquement via son URL.</small>
            </div>
          </div>
          <form className="account-inline-form" onSubmit={(event) => void saveProfile(event)}>
            <label><span>Nom complet</span><input type="text" autoComplete="name" maxLength={120} required value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Votre nom complet" /></label>
            <label><span>Téléphone de contact <small>facultatif</small></span><input type="tel" autoComplete="tel" maxLength={30} value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="+229 97 00 00 00" /></label>
            <p className="field-hint">Adresse de connexion : {email || 'non renseignée'}. Pour la modifier, utilisez la section « Adresse e-mail ».</p>
            <button className="primary-button" disabled={Boolean(busyAction)}>{busyAction === 'profile' ? 'Enregistrement...' : 'Enregistrer le profil'}</button>
          </form>
        </section>
        <section className="panel account-security-panel">
          <div className="settings-section-heading"><div className="settings-section-icon"><LockKeyhole size={19} /></div><div><h2>Mot de passe et récupération</h2><p>Connecté en tant que {email || 'utilisateur'}.</p></div></div>
          <form className="settings-fields account-password-form" onSubmit={(event) => void savePassword(event)}>
            <label><span>Nouveau mot de passe</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /><small className="field-hint">Utilisez au moins 8 caractères.</small></label>
            <label><span>Confirmer le nouveau mot de passe</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <button className="primary-button" disabled={Boolean(busyAction)}>{busyAction === 'password' ? 'Modification...' : 'Modifier le mot de passe'}</button>
          </form>
          <button className="outline-button" disabled={Boolean(busyAction)} onClick={() => void requestPasswordRecovery()}>{busyAction === 'recovery' ? 'Envoi...' : 'Envoyer un lien de récupération'}</button>
        </section>
        <section className="panel account-security-panel">
          <div className="settings-section-heading"><div className="settings-section-icon"><Mail size={19} /></div><div><h2>Adresse e-mail</h2><p>L’adresse actuelle reste active jusqu’à confirmation de la nouvelle.</p></div></div>
          <form className="account-inline-form" onSubmit={(event) => void requestEmailChange(event)}>
            <label><span>Nouvelle adresse e-mail</span><input type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="nouvelle-adresse@exemple.com" /></label>
            <button className="outline-button" disabled={Boolean(busyAction)}>{busyAction === 'email' ? 'Envoi...' : 'Demander le changement'}</button>
          </form>
        </section>
        <section className="panel account-security-panel">
          <div className="settings-section-heading"><div className="settings-section-icon"><ShieldCheck size={19} /></div><div><h2>Authentification multifacteur</h2><p>Ajoutez un code TOTP depuis une application d’authentification standard, sans abonnement à un fournisseur externe. L’administrateur doit avoir activé et migré le contrôle MFA du projet Supabase.</p></div></div>
          {totpFactor ? <div className="account-security-actions"><p className="settings-message success">Un facteur TOTP vérifié est actif.</p><button className="outline-button" disabled={Boolean(busyAction)} onClick={() => void removeTotpFactor()}>{busyAction === 'mfa' ? 'Mise à jour...' : 'Désactiver le MFA'}</button></div> : totpPendingFactorId ? <form className="account-inline-form" onSubmit={(event) => void verifyTotpEnrollment(event)}><div>{totpQrCode && <img className="account-mfa-qr" src={totpQrCode} alt="QR code de configuration MFA" />}<p>Clé de configuration manuelle : <code>{totpSecret}</code></p></div><label><span>Code à 6 chiffres</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button className="primary-button" disabled={Boolean(busyAction)}>{busyAction === 'mfa' ? 'Vérification...' : 'Vérifier et activer'}</button></form> : <button className="primary-button" disabled={Boolean(busyAction)} onClick={() => void startTotpEnrollment()}>{busyAction === 'mfa' ? 'Préparation...' : 'Configurer une application TOTP'}</button>}
          {totpMessage && <p className="settings-message" role="status">{totpMessage}</p>}
        </section>
        <section className="panel account-security-panel">
          <div className="settings-section-heading"><div className="settings-section-icon"><LockKeyhole size={19} /></div><div><h2>Sessions actives</h2><p>La liste détaillée des appareils n’est pas fournie par l’API cliente ; vous pouvez fermer toutes les autres sessions.</p></div></div>
          <button className="outline-button" disabled={Boolean(busyAction)} onClick={() => void revokeOtherSessions()}>{busyAction === 'sessions' ? 'Déconnexion...' : 'Déconnecter les autres sessions'}</button>
        </section>
        <section className="panel account-security-panel">
          <div className="settings-section-heading"><div className="settings-section-icon"><Download size={19} /></div><div><h2>Exporter mes données</h2><p>Télécharge un JSON du profil, des données d’entreprise visibles par votre rôle et de vos demandes de support. Les fichiers justificatifs ne sont pas intégrés au JSON.</p></div></div>
          <button className="outline-button" disabled={Boolean(busyAction)} onClick={() => void downloadDataExport()}>{busyAction === 'export' ? 'Préparation...' : 'Télécharger l’export JSON'}</button>
        </section>
        <section className="panel account-security-panel account-deletion-panel">
          <div className="settings-section-heading"><div className="settings-section-icon"><CircleHelp size={19} /></div><div><h2>Demander la suppression</h2><p>Cette demande est examinée par le support. Elle ne supprime pas automatiquement votre compte, les données partagées de l’entreprise ou les documents soumis à conservation.</p></div></div>
          <label><span>Précisions facultatives</span><textarea rows={3} maxLength={1000} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Précisez les données ou le compte concernés." /></label>
          <label className="settings-checkbox-field"><input type="checkbox" checked={confirmDeletionRequest} onChange={(event) => setConfirmDeletionRequest(event.target.checked)} /><span>Je confirme vouloir transmettre une demande au support.</span></label>
          <button className="outline-button" disabled={Boolean(busyAction)} onClick={() => void requestAccountDeletion()}>{busyAction === 'deletion' ? 'Transmission...' : 'Envoyer une demande de suppression'}</button>
        </section>
      </div>
    </section>
  )
}

function MfaChallengeScreen({ onVerified }: { onVerified: (session: Session) => void }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setMessage('Saisissez le code temporaire à 6 chiffres.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const factors = await supabase.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      const factor = factors.data.totp.find((item) => item.status === 'verified')
      if (!factor) throw new Error('Aucun facteur TOTP vérifié n’est associé à ce compte.')
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challenge.error) throw challenge.error
      const verification = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.data.id, code })
      if (verification.error) throw verification.error
      const currentSession = await supabase.auth.getSession()
      if (currentSession.error) throw currentSession.error
      if (!currentSession.data.session) throw new Error('La session sécurisée n’a pas pu être actualisée.')
      onVerified(currentSession.data.session)
    } catch (error) {
      setMessage(userFacingError(error, 'Le code ne peut pas être vérifié. Réessayez.'))
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">VÉRIFICATION DE SÉCURITÉ</p><h1>Confirmez votre identité</h1><p className="auth-subtitle">Saisissez le code de votre application d’authentification pour accéder à votre espace.</p><form onSubmit={(event) => void verifyCode(event)}><label>Code temporaire à 6 chiffres<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button className="primary-button full-width" disabled={busy}>{busy ? 'Vérification...' : 'Vérifier et continuer'}</button></form>{message && <p className="auth-message" role="alert">{message}</p>}<button className="outline-button full-width" onClick={() => void supabase.auth.signOut()}>Se déconnecter</button></section></main>
}

function SettingsPage({ businessId, onProfileChanged }: { businessId: string; onProfileChanged: (profile: BusinessProfile) => void }) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { void loadBusinessProfile(businessId).then(setProfile).catch((error: unknown) => setMessage(userFacingError(error, 'Impossible de charger les paramètres.'))) }, [businessId])
  if (!profile) return <div className="auth-loading">Chargement des paramètres...</div>
  const dueDays = String(profile.default_due_days)
  const taxRate = String(profile.default_tax_rate)
  const currentBusinessYear = Number(getBusinessDateKey(new Date(), profile.timezone).slice(0, 4))
  const invoiceNumberExample = formatInvoiceNumberExample(profile.invoice_number_prefix, profile.invoice_number_include_year, profile.invoice_number_sequence_width, currentBusinessYear)
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextDueDays = Number(dueDays)
    const nextTaxRate = Number(taxRate)
    if (!Number.isInteger(nextDueDays) || nextDueDays < 0 || nextDueDays > 365) {
      setMessage('Le délai doit être un nombre entier compris entre 0 et 365 jours.')
      return
    }
    if (!Number.isFinite(nextTaxRate) || nextTaxRate < 0 || nextTaxRate > 100) {
      setMessage('Le taux de taxe doit être compris entre 0 et 100 %.')
      return
    }
    const nextPrefix = profile.invoice_number_prefix.trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(nextPrefix)) {
      setMessage('Le préfixe doit contenir de 1 à 12 caractères : lettres, chiffres et tirets, en commençant par une lettre ou un chiffre.')
      return
    }
    if (!Number.isInteger(profile.invoice_number_sequence_width) || profile.invoice_number_sequence_width < 3 || profile.invoice_number_sequence_width > 8) {
      setMessage('La largeur de séquence doit être un nombre entier compris entre 3 et 8.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const nextProfile = { ...profile, default_due_days: nextDueDays, default_tax_rate: nextTaxRate, invoice_number_prefix: nextPrefix }
      await updateBusinessProfile(businessId, {
        name: nextProfile.name, phone: nextProfile.phone, email: nextProfile.email, address: nextProfile.address, city: nextProfile.city,
        country: nextProfile.country, tax_id: nextProfile.tax_id, logo_url: nextProfile.logo_url, payment_instructions: nextProfile.payment_instructions,
        invoice_legal_notice: nextProfile.invoice_legal_notice, default_due_days: nextProfile.default_due_days, default_tax_rate: nextProfile.default_tax_rate,
        currency: nextProfile.currency, timezone: nextProfile.timezone, invoice_number_prefix: nextProfile.invoice_number_prefix,
        invoice_number_include_year: nextProfile.invoice_number_include_year, invoice_number_sequence_width: nextProfile.invoice_number_sequence_width,
      })
      setProfile(nextProfile)
      onProfileChanged(nextProfile)
      setMessage('Paramètres enregistrés.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible d’enregistrer les paramètres.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="module-page">
      <div className="module-heading">
        <div>
          <p className="eyebrow">PRÉFÉRENCES</p>
          <h1>Paramètres</h1>
          <p>Définissez les valeurs utilisées automatiquement lors de la création de vos factures.</p>
        </div>
      </div>
      <div className="settings-layout">
        <form className="panel settings-form" onSubmit={save}>
          <div className="settings-section-heading">
            <div className="settings-section-icon"><Settings size={19} /></div>
            <div><h2>Valeurs par défaut</h2><p>Ces valeurs restent modifiables sur chaque facture.</p></div>
          </div>
          <div className="settings-fields">
            <label>
              <span>Délai d’échéance par défaut <small>en jours</small></span>
              <input type="number" min="0" max="365" step="1" value={dueDays} onChange={(event) => setProfile({ ...profile, default_due_days: Number(event.target.value) })} />
              <small className="field-hint">Exemple : 30 jours après la date de facture.</small>
            </label>
            <label>
              <span>Taux de taxe par défaut <small>en %</small></span>
              <input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setProfile({ ...profile, default_tax_rate: Number(event.target.value) })} />
              <small className="field-hint">Utilisez 0 si vos factures ne sont pas taxées.</small>
            </label>
            <label>
              <span>Devise des factures</span>
              <select value={profile.currency} onChange={(event) => setProfile({ ...profile, currency: event.target.value })}>
                <option value="XOF">FCFA (XOF)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="USD">Dollar (USD)</option>
              </select>
              <small className="field-hint">Cette devise s’applique aux nouvelles factures. Les factures déjà émises conservent leur devise enregistrée. Pour les anciennes factures antérieures à ce réglage, la devise historique n’est pas reconstituable et a été initialisée avec la devise actuelle de l’entreprise.</small>
            </label>
            <label>
              <span>Fuseau horaire de l’entreprise</span>
              <select value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })}>
                {businessTimeZones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
              </select>
              <small className="field-hint">Utilisé pour déterminer la date du jour et présenter les dates des factures.</small>
            </label>
            <label>
              <span>Langue de l’application</span>
              <input value="Français" readOnly aria-readonly="true" />
              <small className="field-hint">L’application est actuellement disponible en français uniquement.</small>
            </label>
            <label>
              <span>Préfixe des numéros</span>
              <input maxLength={12} value={profile.invoice_number_prefix} onChange={(event) => setProfile({ ...profile, invoice_number_prefix: event.target.value.toUpperCase() })} />
              <small className="field-hint">De 1 à 12 lettres, chiffres ou tirets, en commençant par une lettre ou un chiffre.</small>
            </label>
            <label className="settings-checkbox-field">
              <span>Inclure l’année dans le numéro</span>
              <input type="checkbox" checked={profile.invoice_number_include_year} onChange={(event) => setProfile({ ...profile, invoice_number_include_year: event.target.checked })} />
              <small className="field-hint">Désactivé, le compteur est continu pour l’entreprise.</small>
            </label>
            <label>
              <span>Largeur de la séquence</span>
              <input type="number" min="3" max="8" step="1" value={profile.invoice_number_sequence_width} onChange={(event) => setProfile({ ...profile, invoice_number_sequence_width: Number(event.target.value) })} />
              <small className="field-hint">Nombre de chiffres minimal, entre 3 et 8.</small>
            </label>
          </div>
          {message && <div className={`settings-message ${message === 'Paramètres enregistrés.' ? 'success' : ''}`}>{message}</div>}
          <div className="settings-actions">
            <span>Les changements s’appliquent aux prochaines factures.</span>
            <button className="primary-button" disabled={busy}>{busy ? 'Enregistrement...' : 'Enregistrer les paramètres'}</button>
          </div>
        </form>
        <aside className="panel settings-preview">
          <p className="eyebrow">APERÇU</p>
          <h2>Votre configuration</h2>
          <div className="settings-preview-row"><span>Échéance</span><strong>{dueDays || '—'} jours</strong></div>
          <div className="settings-preview-row"><span>Taxe</span><strong>{taxRate || '—'} %</strong></div>
          <div className="settings-preview-row"><span>Devise</span><strong>{profile.currency}</strong></div>
          <div className="settings-preview-row"><span>Fuseau</span><strong>{profile.timezone}</strong></div>
          <div className="settings-preview-row"><span>Exemple de numéro</span><strong>{invoiceNumberExample}</strong></div>
          <p className="settings-preview-note">Le délai, le taux de taxe et la devise sont des valeurs par défaut pour les nouvelles factures. Modifier ces paramètres ne recalcule pas les factures déjà émises. Le format de numérotation choisi sera utilisé pour les prochaines factures, y compris les récurrences.</p>
        </aside>
      </div>
    </section>
  )
}

function AuditPage({ businessId }: { businessId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [error, setError] = useState('')
  const [businessRole, setBusinessRole] = useState<Awaited<ReturnType<typeof loadBusinessRole>> | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<AuditLog | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [tableName, setTableName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadAuditLogs(businessId, { query, action, tableName, from, to }),
      loadBusinessRole(businessId),
    ])
      .then(([items, role]) => {
        if (!cancelled) {
          setLogs(items)
          setBusinessRole(role)
          setError('')
        }
      })
      .catch((reason: unknown) => { if (!cancelled) setError(diagnosticErrorMessage(reason)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [businessId, query, action, tableName, from, to, reloadKey])
  const canDelete = businessRole === 'owner' || businessRole === 'admin'
  const removeAuditLog = async () => {
    if (!pendingDeletion) return
    setDeleting(true)
    setError('')
    try {
      await deleteAuditLog(businessId, pendingDeletion.id)
      setPendingDeletion(null)
      setLoading(true)
      setReloadKey((value) => value + 1)
    } catch (reason) {
      setError(diagnosticErrorMessage(reason))
    } finally {
      setDeleting(false)
    }
  }
  const tableLabels: Record<string, string> = {
    clients: 'Clients',
    products: 'Produits & services',
    invoices: 'Factures',
    payments: 'Paiements',
    expenses: 'Dépenses',
    recurring_invoices: 'Factures récurrentes',
    stock_movements: 'Mouvements de stock',
    business_subscriptions: 'Abonnements',
    subscription_payments: 'Paiements d’abonnement',
  }
  const actionLabels: Record<string, string> = { INSERT: 'Création', UPDATE: 'Modification', DELETE: 'Suppression' }
  return <section className="module-page"><div className="module-heading"><div><p className="eyebrow">SÉCURITÉ</p><h1>Journal d’audit</h1><p>Historique des actions; une suppression est réservée au propriétaire ou à un administrateur et laisse une trace de maintenance.</p></div><button type="button" className="outline-button" onClick={() => { setLoading(true); setReloadKey((value) => value + 1) }} disabled={loading}><RefreshCw size={16} /> Actualiser</button></div>{error && <div className="data-warning" role="alert">{error}</div>}<div className="panel module-table"><div className="module-toolbar audit-filters"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher acteur, action ou identifiant..." /></label><select className="outline-button" value={action} onChange={(event) => setAction(event.target.value)} aria-label="Filtrer par action"><option value="">Toutes les actions</option><option value="INSERT">Création</option><option value="UPDATE">Modification</option><option value="DELETE">Suppression</option></select><select className="outline-button" value={tableName} onChange={(event) => setTableName(event.target.value)} aria-label="Filtrer par type de donnée"><option value="">Toutes les données</option>{Object.entries(tableLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="date-filter">Du <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label className="date-filter">Au <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label></div><div className="panel-heading"><div><h2>Activité récente</h2><p>Jusqu’aux 500 dernières entrées correspondant aux filtres.</p></div><span className="team-count">{logs.length} entrée{logs.length > 1 ? 's' : ''}</span></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>ACTEUR</th><th>ACTION</th><th>DONNÉE</th><th>DÉTAIL</th>{canDelete && <th>GESTION</th>}</tr></thead><tbody>{loading ? <tr><td colSpan={canDelete ? 6 : 5}>Chargement du journal…</td></tr> : error ? <tr><td colSpan={canDelete ? 6 : 5}>Le journal n’est pas disponible.</td></tr> : logs.length ? logs.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString('fr-FR')}</td><td>{log.actor_label}</td><td><span className={`audit-action audit-action-${log.action.toLowerCase()}`}>{actionLabels[log.action] ?? log.action}</span></td><td>{tableLabels[log.table_name] ?? log.table_name}</td><td><span className="audit-record-detail">{log.record_id ?? '—'}</span>{log.changed_fields?.length ? <small className="audit-changed-fields">Champs : {log.changed_fields.map(invoiceFieldLabel).join(', ')}</small> : null}</td>{canDelete && <td><button type="button" className="danger-button compact-button" onClick={() => setPendingDeletion(log)} disabled={deleting}>Supprimer</button></td>}</tr>) : <tr><td colSpan={canDelete ? 6 : 5}>Aucune activité correspondant aux filtres.</td></tr>}</tbody></table></div></div>{pendingDeletion && <div className="modal-backdrop" onClick={() => !deleting && setPendingDeletion(null)}><div className="modal-card team-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="audit-delete-title" onClick={(event) => event.stopPropagation()}><p className="eyebrow">CONFIRMATION REQUISE</p><h2 id="audit-delete-title">Supprimer cette entrée d’audit ?</h2><p>Cette action supprimera définitivement l’entrée <strong>{actionLabels[pendingDeletion.action] ?? pendingDeletion.action} · {tableLabels[pendingDeletion.table_name] ?? pendingDeletion.table_name}</strong> concernant <strong>{pendingDeletion.record_id ?? 'un enregistrement'}</strong>. Une trace de maintenance sera conservée.</p><div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => setPendingDeletion(null)} disabled={deleting}>Annuler</button><button type="button" className="danger-button" onClick={() => void removeAuditLog()} disabled={deleting}>{deleting ? 'Suppression…' : 'Confirmer la suppression'}</button></div></div></div>}</section>
}

function AutomationHistoryPanel({ businessId, canEdit, onOpenInvoice }: { businessId: string; canEdit: boolean; onOpenInvoice: (invoiceNumber: string) => void }) {
  const [runs, setRuns] = useState<RecurringInvoiceRun[]>([])
  const [missed, setMissed] = useState<MissedRecurringInvoice[]>([])
  const [query, setQuery] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const loadRuns = useCallback(() => loadRecurringInvoiceRuns(businessId), [businessId])
  useEffect(() => {
    let cancelled = false
    void loadRuns()
      .then((result) => {
        if (!cancelled) {
          setRuns(result.runs)
          setMissed(result.missed)
          setError('')
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Impossible de charger l’historique automatisation.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [loadRuns, reloadKey])
  const visibleRuns = runs.filter((run) => {
    const text = `${run.invoice_number ?? ''} ${run.message ?? ''} ${run.status} ${run.id}`.toLocaleLowerCase('fr-FR')
    return (!query || text.includes(query.toLocaleLowerCase('fr-FR')))
      && (!resultFilter || run.status === resultFilter)
      && (!from || run.issue_date >= from)
      && (!to || run.issue_date <= to)
  })
  const statusLabels: Record<RecurringInvoiceRun['status'], string> = {
    issued: 'Facture générée',
    failed: 'Échec',
    skipped_stock: 'Ignorée · stock insuffisant',
    skipped_subscription: 'Ignorée · abonnement',
  }
  const retry = async (recurringInvoiceId: string, issueDate: string, operationId: string) => {
    if (issueDate > new Date().toISOString().slice(0, 10)) return
    if (!window.confirm(`Traiter manuellement l’échéance du ${new Date(`${issueDate}T00:00:00`).toLocaleDateString('fr-FR')} ? Cette opération peut créer une facture et mettre à jour le stock.`)) return
    setBusyId(operationId)
    setLoading(true)
    setError('')
    try {
      await retryRecurringInvoice(businessId, recurringInvoiceId)
      setReloadKey((value) => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de relancer cette échéance.')
      setLoading(false)
    } finally {
      setBusyId('')
    }
  }
  return <section className="panel module-table automation-history">
    <div className="panel-heading"><div><h2>Exécutions des factures récurrentes</h2><p>Les filtres portent sur la date d’émission prévue. Une reprise ne traite que l’échéance arrivée sélectionnée, après vérification de l’historique.</p></div><button type="button" className="outline-button" onClick={() => { setLoading(true); setReloadKey((value) => value + 1) }} disabled={loading}><RefreshCw size={16} /> Actualiser</button></div>
    {error && <div className="data-warning" role="alert">{error}</div>}
    {missed.length > 0 && <div className="automation-missed" role="status"><strong>{missed.length} échéance(s) active(s) toujours en retard</strong><p>Vérifiez qu’aucune facture n’a déjà été créée avant toute reprise. Le traitement manuel peut créer une facture et mettre à jour le stock.</p><ul>{missed.map((item) => {
      const matchingRun = runs.find((run) => run.recurring_invoice_id === item.id && run.issue_date === item.next_issue_date)
      return <li key={item.id}><span>{new Date(`${item.next_issue_date}T00:00:00`).toLocaleDateString('fr-FR')} · {matchingRun ? `Exécution ${statusLabels[matchingRun.status].toLocaleLowerCase('fr-FR')}` : 'Aucune exécution enregistrée'}{item.last_error ? ` · ${item.last_error}` : ''}</span><small>Récurrence {item.id.slice(0, 8)}{item.consecutive_failures ? ` · ${item.consecutive_failures} échec(s)` : ''}</small>{canEdit && !matchingRun && <button type="button" className="outline-button" onClick={() => void retry(item.id, item.next_issue_date, `missed-${item.id}`)} disabled={loading || Boolean(busyId)}>{busyId === `missed-${item.id}` ? 'Traitement…' : 'Traiter l’échéance manquée'}</button>}</li>
    })}</ul></div>}
    <div className="module-toolbar automation-history-filters"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher facture, résultat ou identifiant..." /></label><select className="outline-button" value={resultFilter} onChange={(event) => setResultFilter(event.target.value)} aria-label="Filtrer les exécutions par résultat"><option value="">Tous les résultats</option><option value="issued">Facture générée</option><option value="failed">Échec</option><option value="skipped_stock">Stock insuffisant</option><option value="skipped_subscription">Abonnement</option></select><label className="date-filter">Du <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label className="date-filter">Au <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label></div>
    <div className="table-wrap"><table><thead><tr><th>DATE PRÉVUE</th><th>RÉSULTAT</th><th>FACTURE</th><th>DÉTAIL</th><th>TRAITÉ LE</th><th>ACTION</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>Chargement des exécutions…</td></tr> : error ? <tr><td colSpan={6}>L’historique n’est pas disponible.</td></tr> : visibleRuns.length ? visibleRuns.map((run) => <tr key={run.id}><td>{new Date(`${run.issue_date}T00:00:00`).toLocaleDateString('fr-FR')}</td><td><span className={`recurring-status ${run.status === 'issued' ? 'active' : 'inactive'}`}>{statusLabels[run.status]}{run.status === 'failed' ? ` · tentative ${run.attempt_number}/3` : ''}</span></td><td>{run.invoice_number ?? '—'}{run.invoice_number && <button type="button" className="automation-link" onClick={() => onOpenInvoice(run.invoice_number!)}>Ouvrir la facture</button>}</td><td><details><summary>Voir le détail</summary><p>{run.message ?? 'Aucun message complémentaire.'}</p><small>Identifiant d’exécution : {run.id}</small></details></td><td>{new Date(run.created_at).toLocaleString('fr-FR')}</td><td>{canEdit && run.status === 'failed' && run.recurring_invoice_id && run.issue_date <= new Date().toISOString().slice(0, 10) ? <button type="button" className="outline-button" onClick={() => void retry(run.recurring_invoice_id!, run.issue_date, run.id)} disabled={loading || Boolean(busyId)}>{busyId === run.id ? 'Relance…' : 'Relancer'}</button> : '—'}</td></tr>) : <tr><td colSpan={6}>Aucune exécution ne correspond aux filtres.</td></tr>}</tbody></table></div>
  </section>
}

function TeamPage({ businessId, userId }: { businessId: string; userId: string }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [invitations, setInvitations] = useState<Awaited<ReturnType<typeof loadTeamInvitations>>>([])
  const [members, setMembers] = useState<Awaited<ReturnType<typeof loadTeamMembers>>>([])
  const [query, setQuery] = useState('')
  const [acceptToken, setAcceptToken] = useState(() => new URLSearchParams(window.location.search).get('invitation') ?? '')
  const [message, setMessage] = useState('')
  const [businessRole, setBusinessRole] = useState<Awaited<ReturnType<typeof loadBusinessRole>> | null>(null)
  const [busyId, setBusyId] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState<Awaited<ReturnType<typeof loadTeamMembers>>[number] | null>(null)
  const [pendingRole, setPendingRole] = useState<{ member: Awaited<ReturnType<typeof loadTeamMembers>>[number]; role: 'admin' | 'member' | 'viewer' } | null>(null)
  const isOwner = businessRole === 'owner'
  const canManage = isOwner || businessRole === 'admin'
  const refresh = () => void loadBusinessRole(businessId).then(async (nextRole) => {
    setBusinessRole(nextRole)
    const [nextInvitations, nextMembers] = await Promise.all([
      nextRole === 'owner' || nextRole === 'admin' ? loadTeamInvitations(businessId) : Promise.resolve([]),
      loadTeamMembers(businessId),
    ])
    setInvitations(nextInvitations)
    setMembers(nextMembers)
  }).catch((error: unknown) => setMessage(userFacingError(error, 'Impossible de charger l’équipe.')))
  useEffect(refresh, [businessId])
  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage('')
    try { const created = await createTeamAccount(businessId, firstName, lastName, email, password, role); setCredentials((current) => ({ ...current, [created.invitationId]: password })); setFirstName(''); setLastName(''); setEmail(''); setPassword(''); setMessage('Compte créé. Validez-le pour activer et préparer les informations de connexion.'); refresh() }
    catch (error) { setMessage(userFacingError(error, 'Impossible de créer l’invitation.')) }
  }

  const accept = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await acceptBusinessInvitation(acceptToken); setAcceptToken(''); window.history.replaceState({}, '', window.location.pathname); setMessage('Invitation acceptée.'); refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible d’accepter l’invitation.') } }
  const cancel = async (id: string) => { setBusyId(id); try { await cancelTeamInvitation(id); setMessage('Invitation annulée.'); refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible d’annuler l’invitation.') } finally { setBusyId('') } }
  const validateInvitation = async (id: string) => { setBusyId(id); try { await validateTeamInvitation(id); setMessage('Compte validé et activé.'); refresh() } catch (error) { setMessage(userFacingError(error, 'Impossible d’activer le compte.')); refresh() } finally { setBusyId('') } }
  const downloadCredentials = (invitation: Awaited<ReturnType<typeof loadTeamInvitations>>[number]) => { const passwordValue = credentials[invitation.id]; const content = [`Informations de connexion FactureFacile`, `Nom : ${invitation.full_name ?? '—'}`, `Email : ${invitation.email}`, `Mot de passe : ${passwordValue ?? 'Mot de passe défini lors de la création'}`, `Lien : ${window.location.origin}`].join('\n'); const blob = new Blob([content], { type: 'text/plain;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `acces-${invitation.email.replace(/[^a-z0-9]+/gi, '-')}.txt`; link.click(); URL.revokeObjectURL(link.href); setMessage(passwordValue ? 'Informations de connexion téléchargées.' : 'Téléchargement effectué, mais le mot de passe n’est plus disponible dans cette session.') }
  const remove = async (id: string) => { if (!pendingRemoval) return; setBusyId(id); try { await removeTeamMember(id); setPendingRemoval(null); setMessage('Membre retiré.'); refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de retirer le membre.') } finally { setBusyId('') } }
  const changeRole = async () => { if (!pendingRole) return; setBusyId(pendingRole.member.id); try { await updateTeamMemberRole(pendingRole.member.id, pendingRole.role); setPendingRole(null); setMessage('Rôle mis à jour.'); refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de modifier le rôle.') } finally { setBusyId('') } }
  if (!businessRole) return <div className="auth-loading">Chargement des droits de l’équipe...</div>
  const roleLabels = { admin: 'Administrateur', member: 'Membre', viewer: 'Lecteur' }
  const filteredMembers = members.filter((member) => !query.trim() || `${member.email ?? ''} ${member.full_name ?? ''} ${member.user_id}`.toLowerCase().includes(query.trim().toLowerCase()))
  const filteredInvitations = invitations.filter((invitation) => !query.trim() || `${invitation.email} ${roleLabels[invitation.role]}`.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <section className="module-page">
      <div className="module-heading">
        <div><p className="eyebrow">COLLABORATION</p><h1>Équipe</h1><p>Invitez vos collaborateurs et contrôlez leur niveau d’accès.</p></div>
        <span className="team-current-role">Votre rôle : {businessRole === 'owner' ? 'Propriétaire' : businessRole === 'none' ? 'Aucun accès' : roleLabels[businessRole]}</span>
      </div>
      {canManage && <div className="team-top-grid">
        <form className="panel team-invite-form" onSubmit={invite}>
          <div className="settings-section-heading"><div className="settings-section-icon"><Users size={19} /></div><div><h2>Inviter un collaborateur</h2><p>Donnez-lui accès à l’espace de votre entreprise.</p></div></div>
          <div className="team-form-fields"><label><span>Prénom</span><input required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label><span>Nom</span><input required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label><span>Adresse email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="collaborateur@exemple.com" /></label><label><span>Mot de passe initial</span><input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" /></label><label><span>Rôle</span><select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="admin">Administrateur</option><option value="member">Membre</option><option value="viewer">Lecteur</option></select></label></div>
          <button className="primary-button"><Users size={17} />Créer le compte</button>
        </form>
        <div className="panel team-roles-card"><p className="eyebrow">RÔLES DISPONIBLES</p><div><strong>Administrateur</strong><span>Gère les opérations et l’équipe.</span></div><div><strong>Membre</strong><span>Crée et suit les données métier.</span></div><div><strong>Lecteur</strong><span>Consulte les informations sans modifier.</span></div></div>
      </div>}
      {!isOwner && <form className="panel team-accept-form" onSubmit={accept}><div><p className="eyebrow">INVITATION</p><h2>Rejoindre une entreprise</h2><p>Collez le lien ou le token reçu par email pour activer votre accès.</p></div><div className="team-accept-row"><input required value={acceptToken} onChange={(event) => setAcceptToken(event.target.value)} placeholder="Token d’invitation" /><button className="outline-button">Activer mon accès</button></div></form>}
      {message && <div className={`settings-message ${message.endsWith('.') && !message.startsWith('Impossible') ? 'success' : ''}`}>{message}</div>}
      {canManage && <div className="panel module-table team-table"><div className="panel-heading"><div><h2>Comptes à activer</h2><p>Validez le compte puis téléchargez séparément ses informations de connexion.</p></div><span className="team-count">{filteredInvitations.length} compte{filteredInvitations.length > 1 ? 's' : ''}</span></div><div className="table-wrap"><table><thead><tr><th>NOM</th><th>EMAIL</th><th>RÔLE</th><th>STATUT</th><th>ACTION</th></tr></thead><tbody>{filteredInvitations.length ? filteredInvitations.map((invitation) => { const expired = new Date(invitation.expires_at) < new Date(); const activated = Boolean(invitation.accepted_at || invitation.validated_at); return <tr key={invitation.id}><td>{invitation.full_name ?? '—'}</td><td>{invitation.email}</td><td><span className="team-role-badge">{roleLabels[invitation.role]}</span></td><td><span className={`team-status ${activated ? 'accepted' : expired ? 'expired' : invitation.sent_at ? 'sent' : 'pending'}`}>{activated ? 'Activé' : expired ? 'Expiré' : invitation.sent_at ? 'Actif' : 'À valider'}</span></td><td><div className="team-actions">{!activated && !expired && <button type="button" className="primary-button compact-button" disabled={busyId === invitation.id} onClick={() => void validateInvitation(invitation.id)}>Valider</button>}{activated && <button type="button" className="outline-button compact-button" onClick={() => downloadCredentials(invitation)}>Télécharger</button>}{!activated && !expired && <button type="button" className="outline-button" disabled={busyId === invitation.id} onClick={() => void cancel(invitation.id)}>Annuler</button>}</div></td></tr> }) : <tr><td colSpan={5}>Aucun compte trouvé.</td></tr>}</tbody></table></div></div>}
      <div className="panel module-table team-table"><div className="panel-heading"><div><h2>Membres de l’équipe</h2><p>Les personnes qui ont accès à cette entreprise.</p></div><div className="team-panel-tools"><label className="search-box"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un membre..." aria-label="Rechercher un membre" /></label><span className="team-count">{filteredMembers.length} membre{filteredMembers.length > 1 ? 's' : ''}</span></div></div><div className="table-wrap"><table><thead><tr><th>UTILISATEUR</th><th>RÔLE</th><th>AJOUTÉ LE</th>{canManage && <th>ACTION</th>}</tr></thead><tbody>{filteredMembers.length ? filteredMembers.map((member) => <tr key={member.id}><td><div className="team-member-cell"><span className="team-avatar">{(member.full_name ?? member.email ?? member.user_id).slice(0, 2).toUpperCase()}</span><span><strong>{member.full_name || 'Utilisateur'}</strong><small>{member.email ?? member.user_id}</small></span></div></td><td>{canManage && member.user_id !== userId ? <select className="team-role-select" value={member.role} disabled={busyId === member.id} onChange={(event) => setPendingRole({ member, role: event.target.value as 'admin' | 'member' | 'viewer' })}><option value="admin">Administrateur</option><option value="member">Membre</option><option value="viewer">Lecteur</option></select> : <span className="team-role-badge">{roleLabels[member.role]}</span>}</td><td>{new Date(member.created_at).toLocaleDateString('fr-FR')}</td>{canManage && <td>{member.user_id !== userId && <button type="button" className="outline-button" disabled={busyId === member.id} onClick={() => setPendingRemoval(member)}>Retirer</button>}</td>}</tr>) : <tr><td colSpan={canManage ? 4 : 3}>Aucun membre trouvé.</td></tr>}</tbody></table></div></div>
      {pendingRole && <div className="modal-backdrop" onClick={() => !busyId && setPendingRole(null)}><div className="modal-card team-confirm-modal" onClick={(event) => event.stopPropagation()}><p className="eyebrow">DEUXIÈME ÉTAPE</p><h2>Confirmer le changement de rôle</h2><p>Le rôle de <strong>{pendingRole.member.full_name || pendingRole.member.email}</strong> deviendra <strong>{roleLabels[pendingRole.role]}</strong>.</p><div className="delete-modal-actions"><button className="outline-button" onClick={() => setPendingRole(null)} disabled={Boolean(busyId)}>Annuler</button><button className="primary-button" onClick={() => void changeRole()} disabled={Boolean(busyId)}>{busyId ? 'Enregistrement...' : 'Confirmer le rôle'}</button></div></div></div>}
      {pendingRemoval && <div className="modal-backdrop" onClick={() => !busyId && setPendingRemoval(null)}><div className="modal-card team-confirm-modal" onClick={(event) => event.stopPropagation()}><p className="eyebrow">DEUXIÈME ÉTAPE</p><h2>Confirmer la suppression</h2><p>Retirer <strong>{pendingRemoval.full_name || pendingRemoval.email}</strong> supprimera son accès à cette entreprise.</p><div className="delete-modal-actions"><button className="outline-button" onClick={() => setPendingRemoval(null)} disabled={Boolean(busyId)}>Annuler</button><button className="danger-button" onClick={() => void remove(pendingRemoval.id)} disabled={Boolean(busyId)}>{busyId ? 'Suppression...' : 'Confirmer la suppression'}</button></div></div></div>}
    </section>
  )
}

function SubscriptionPage({
  businessId,
  demoAccess,
  onSubscriptionChange,
}: {
  businessId: string
  demoAccess: boolean
  onSubscriptionChange: (subscription: Awaited<ReturnType<typeof loadBusinessSubscription>>) => void
}) {
  const [subscription, setSubscription] = useState<Awaited<ReturnType<typeof loadBusinessSubscription>>>(null)
  const [publicPlans, setPublicPlans] = useState<Awaited<ReturnType<typeof loadPublicSubscriptionPlans>>>([])
  const [loadedBusinessId, setLoadedBusinessId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentNotice, setPaymentNotice] = useState('')
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof loadSubscriptionPayments>>>([])
  const activePaymentRef = useRef<(SubscriptionCheckout & { plan: 'starter' | 'pro' }) | null>(null)
  const listenersRegisteredRef = useRef(false)
  const successListenerRef = useRef<((result: KkiapayWidgetResult) => void) | null>(null)
  const failedListenerRef = useRef<((error: unknown) => void) | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [loaded, paymentHistory, loadedPublicPlans] = await Promise.all([
        loadBusinessSubscription(businessId),
        loadSubscriptionPayments(businessId),
        loadPublicSubscriptionPlans(),
      ])
      if (cancelled) return
      setSubscription(loaded)
      setPayments(paymentHistory)
      setPublicPlans(loadedPublicPlans)
      onSubscriptionChange(loaded)
      setLoadedBusinessId(businessId)
    }
    void load().catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : 'Impossible de charger l’abonnement.')
        setLoadedBusinessId(businessId)
      }
    })
    return () => { cancelled = true }
  }, [businessId, onSubscriptionChange])
  useEffect(() => () => {
    if (successListenerRef.current) window.removeSuccessListener?.(successListenerRef.current)
    if (failedListenerRef.current) window.removeFailedListener?.(failedListenerRef.current)
    listenersRegisteredRef.current = false
  }, [])
  const registerKkiapayListeners = () => {
    if (listenersRegisteredRef.current) return
    if (!window.addSuccessListener || !window.addFailedListener) {
      throw new Error('Les événements KKiaPay ne sont pas disponibles. Rechargez la page puis réessayez.')
    }
    const onSuccess = (result: KkiapayWidgetResult) => {
      const payment = activePaymentRef.current
      if (!payment) return
      const transactionId = typeof result.transactionId === 'string'
        ? result.transactionId
        : typeof result.transaction_id === 'string'
          ? result.transaction_id
          : ''
      if (!transactionId) {
        activePaymentRef.current = null
        setPaymentError('KKiaPay n’a pas retourné de référence de transaction. Aucun abonnement n’a été activé.')
        return
      }
      activePaymentRef.current = null
      setBusy(true)
      setPaymentError('')
      void verifySubscriptionPayment(payment.paymentId, transactionId)
        .then(async () => {
          const refreshed = await loadBusinessSubscription(businessId)
          if (!refreshed || refreshed.plan !== payment.plan) {
            throw new Error('Le paiement est confirmé, mais l’abonnement ne s’est pas actualisé. Rechargez la page.')
          }
          setSubscription(refreshed)
          onSubscriptionChange(refreshed)
          setPaymentNotice(`Paiement confirmé par KKiaPay. Votre formule ${payment.plan === 'starter' ? 'Starter' : 'Pro'} est active.`)
        })
        .catch((reason: unknown) => {
          setPaymentError(reason instanceof Error ? reason.message : 'Impossible de confirmer le paiement KKiaPay.')
        })
        .finally(() => setBusy(false))
    }
    const onFailed = (_error: unknown) => {
      if (!activePaymentRef.current) return
      activePaymentRef.current = null
      setPaymentError('Le paiement KKiaPay a été annulé ou a échoué. Vous pouvez réessayer.')
    }
    successListenerRef.current = onSuccess
    failedListenerRef.current = onFailed
    window.addSuccessListener(onSuccess)
    window.addFailedListener(onFailed)
    listenersRegisteredRef.current = true
  }
  if (error) return <div className="data-warning">{error}</div>
  if (loadedBusinessId !== businessId) return <section className="module-page"><div className="auth-loading">Chargement de votre abonnement...</div></section>
  const startPayment = async (nextPlan: 'free' | 'starter' | 'pro' | 'business') => {
    setBusy(true)
    setPaymentError('')
    setPaymentNotice('')
    try {
      if (nextPlan === 'free') {
        await updateBusinessSubscription(businessId, 'free', 'active', null)
        const refreshed = await loadBusinessSubscription(businessId)
        setSubscription(refreshed)
        onSubscriptionChange(refreshed)
        return
      }
      if (nextPlan === 'business') {
        window.location.assign('mailto:contact@facturefacile.bj?subject=Plan%20Business')
        return
      }
      if (activePaymentRef.current) throw new Error('Une fenêtre de paiement KKiaPay est déjà ouverte.')
      await loadKkiapaySdk()
      registerKkiapayListeners()
      const payment = await createSubscriptionCheckout(businessId, nextPlan)
      activePaymentRef.current = { ...payment, plan: nextPlan }
      if (!window.openKkiapayWidget) throw new Error('Le module de paiement KKiaPay ne répond pas. Réessayez.')
      window.openKkiapayWidget({
        amount: payment.amount,
        key: payment.publicKey,
        partnerId: payment.paymentId,
        position: 'center',
        theme: '#2563EB',
        sandbox: payment.sandbox,
        email: payment.email,
        name: payment.name,
      })
    } catch (reason) {
      activePaymentRef.current = null
      setPaymentError(reason instanceof Error ? reason.message : 'Impossible de démarrer le paiement.')
    } finally {
      setBusy(false)
    }
  }
  const subscriptionState = resolveEffectiveSubscriptionState(subscription)
  const effectivePlan = subscriptionState.plan
  const defaultPlanCards = [
    { id: 'free', code: 'free', name: 'Gratuit', description: 'Pour démarrer la facturation simplement.', price: 0, currency: 'XOF', billing_period: 'monthly', features: ['20 factures / mois', '50 clients', '1 utilisateur', 'Factures standard'], limits: { users: 1, invoices: 20, clients: 50 } },
    { id: 'starter', code: 'starter', name: 'Starter', description: 'Les essentiels pour une petite entreprise.', price: 5000, currency: 'XOF', billing_period: 'monthly', features: ['100 factures / mois', '250 clients', '1 utilisateur', 'Factures avancées', 'Factures récurrentes', 'Stock', 'Exports', 'Rapports'], limits: { users: 1, invoices: 100, clients: 250 } },
    { id: 'pro', code: 'pro', name: 'Pro', description: 'Les outils avancés pour une équipe en croissance.', price: 15000, currency: 'XOF', billing_period: 'monthly', features: ['500 factures / mois', '1 000 clients', '5 utilisateurs', 'Toutes les factures avancées', 'Tableau de bord avancé', 'Équipe', 'Audit', 'Exports', 'Rapports'], limits: { users: 5, invoices: 500, clients: 1000 } },
    { id: 'business', code: 'business', name: 'Business', description: 'Une offre complète pour les organisations structurées.', price: 35000, currency: 'XOF', billing_period: 'monthly', features: ['2 000 factures / mois', '10 000 clients', '25 utilisateurs', 'Toutes les fonctionnalités Pro', 'Support prioritaire'], limits: { users: 25, invoices: 2000, clients: 10000 } },
  ]
  const planCards = publicPlans.length ? publicPlans : defaultPlanCards
  const planCardsByCode = new Map(planCards.map((plan) => [plan.code, plan]))
  const currentPlan = planCardsByCode.get(effectivePlan) ?? defaultPlanCards.find((item) => item.code === effectivePlan) ?? defaultPlanCards[0]
  const statusLabel = demoAccess ? 'Accès démo' : subscriptionState.isActive ? 'Actif' : subscriptionState.status === 'expired' ? 'Expiré' : 'Inactif'
  const statusClass = demoAccess ? 'active' : subscriptionState.isActive ? 'active' : 'cancelled'
  const nextRenewalLabel = subscription?.expires_at ? new Date(subscription.expires_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Aucune échéance planifiée'
  const planLabel = subscriptionState.isActive && subscription ? `${subscription.plan.charAt(0).toUpperCase()}${subscription.plan.slice(1)}` : 'Gratuit'

  return (
    <section className="module-page">
      <div className="module-heading">
        <div><p className="eyebrow">ABONNEMENT</p><h1>Abonnements</h1><p>Choisissez la formule qu’il vous faut pour faire évoluer votre activité.</p></div>
      </div>
      {demoAccess && <div className="settings-message">Mode démo : les fonctionnalités payantes sont accessibles pour la prévisualisation. Cette ouverture ne modifie pas la formule enregistrée.</div>}
      {!subscription && <div className="data-warning">Aucun abonnement n’est encore enregistré pour cette entreprise. Choisissez une formule pour en créer un.</div>}
      {paymentNotice && <div className="settings-message success">{paymentNotice}</div>}
      {paymentError && <div className="settings-message">{paymentError}</div>}
      <div className="subscription-overview">
        <div className="panel subscription-current">
          <div className="subscription-current-top">
            <div>
              <p className="eyebrow">FORMULE ACTUELLE</p>
              <h2>{demoAccess ? 'Démo • ' : ''}{currentPlan.name}</h2>
              <p className="subscription-description">{demoAccess ? 'Le mode démo donne un aperçu des fonctionnalités payantes sans modifier votre plan enregistré.' : subscriptionState.isActive ? 'Votre formule est active et les fonctionnalités associées sont accessibles.' : 'Votre formule actuelle est inactive ou expirée. Vous pouvez choisir une autre formule ci-dessous.'}</p>
            </div>
            <span className={`subscription-status ${statusClass}`}>{statusLabel}</span>
          </div>
          <div className="subscription-metrics">
            <div>
              <span>Plan</span>
              <strong>{planLabel}</strong>
            </div>
            <div>
              <span>Renouvellement</span>
              <strong>{nextRenewalLabel}</strong>
            </div>
            <div>
              <span>Factures du mois</span>
              <strong>{subscription?.monthly_invoice_count ?? 0}</strong>
              <small>{subscription ? `sur ${subscription.monthly_invoice_limit ?? 0} autorisées` : 'non disponible'}</small>
            </div>
            <div>
              <span>État</span>
              <strong>{demoAccess ? 'Prévisualisation' : subscriptionState.isActive ? 'Actif' : 'À activer'}</strong>
            </div>
          </div>
        </div>
        <div className="panel subscription-upgrade">
          <p className="eyebrow">RENOUVELLEMENT</p>
          <h2>Suivi de votre abonnement</h2>
          <p>Les plans Starter et Pro sont activés après validation d’un paiement KKiaPay. Le plan gratuit reste disponible sans facturation.</p>
          <div className="subscription-metrics">
            <div>
              <span>Formule enregistrée</span>
              <strong>{subscription ? subscription.plan : 'free'}</strong>
            </div>
            <div>
              <span>Prochaine échéance</span>
              <strong>{nextRenewalLabel}</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="panel subscription-admin">
        <div className="panel-heading">
          <div>
            <h2>Historique des paiements</h2>
            <p>Les derniers paiements et validations KKiaPay liés à votre abonnement.</p>
          </div>
          <span className="team-count">{payments.length}</span>
        </div>
        {payments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Formule</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Preuve</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.created_at).toLocaleString('fr-FR')}</td>
                    <td>{payment.plan === 'starter' ? 'Starter' : 'Pro'}</td>
                    <td>{Number(payment.amount).toLocaleString('fr-FR')} {payment.currency}</td>
                    <td>
                      <span className={`subscription-payment-status ${payment.status === 'completed' ? 'completed' : payment.status === 'cancelled' || payment.status === 'failed' ? 'cancelled' : ''}`}>
                        {payment.status === 'completed' ? 'Confirmé' : payment.status === 'pending' ? 'En attente' : payment.status === 'failed' ? 'Échec' : 'Annulé'}
                      </span>
                    </td>
                    <td>{payment.provider_url ? <a href={payment.provider_url} target="_blank" rel="noreferrer">Voir</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subscription-description">Aucun paiement enregistré pour cette entreprise. Les paiements Starter et Pro apparaîtront ici après validation.</p>
        )}
      </div>
      <div className="landing-pricing">
        {(['free', 'starter', 'pro', 'business'] as const).map((planCode) => {
          const plan = planCardsByCode.get(planCode) ?? defaultPlanCards.find((item) => item.code === planCode)
          if (!plan) return null
          const isCurrentPlan = subscription !== null && planCode === effectivePlan
          const showPrice = plan.price === 0 ? 'Gratuit' : `${plan.price.toLocaleString('fr-FR')} ${plan.currency}`
          const showSuffix = plan.price === 0 ? ' pour commencer' : plan.billing_period === 'yearly' ? ' / an' : ' / mois'
          const buttonText = planCode === 'free' ? 'Choisir le plan gratuit' : planCode === 'business' ? 'Contacter l’équipe' : 'Choisir ce plan'
          const handleClick = () => void startPayment(planCode)
          const showArrow = planCode === 'starter' || planCode === 'pro'
          const featured = isCurrentPlan ? 'featured' : ''
          return (
            <article className={`pricing-card ${featured}`.trim()} key={plan.id}>
              <div>
                <span className="pricing-label">FORMULE {plan.code.toUpperCase()}</span>
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <div className="pricing-meta">
                  <span>{plan.billing_period === 'yearly' ? 'Facturation annuelle' : 'Facturation mensuelle'}</span>
                  <span>{plan.limits.users ?? 1} utilisateur{(plan.limits.users ?? 1) > 1 ? 's' : ''}</span>
                  <span>{plan.limits.invoices ?? 0} factures / mois</span>
                </div>
                <ul>{plan.features.slice(0, 4).map((feature, index) => <li key={`${feature}-${index}`}>{feature}</li>)}</ul>
              </div>
              <strong>{showPrice}<small>{showSuffix}</small></strong>
              {planCode === 'business' ? <a className="primary-button" href="mailto:contact@facturefacile.bj?subject=Plan%20Business">Contacter l’équipe <ArrowRight size={15} /></a> : <button className="primary-button" disabled={busy || isCurrentPlan} onClick={handleClick}>{isCurrentPlan ? 'Plan actuel' : buttonText}{showArrow && <ArrowRight size={15} />}</button>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

const moduleData: Record<string, { title: string; description: string; action: string; columns: string[]; rows: string[][] }> = {
  Clients: {
    title: 'Clients', description: 'Centralisez les informations de vos clients.', action: 'Ajouter un client',
    columns: ['CLIENT', 'TYPE', 'STATUT', 'CONTACT', 'SOLDE'],
    rows: [['Bénin Digital', 'Entreprise', 'Actif', 'contact@benindigital.bj', '0 FCFA'], ['Atelier Kora', 'Particulier', 'Actif', 'atelier.kora@gmail.com', '0 FCFA'], ['Maison Aïcha', 'Entreprise', 'Actif', '+229 97 00 00 00', '0 FCFA']],
  },
  Dépenses: {
    title: 'Dépenses', description: 'Suivez les charges de votre activité.', action: 'Ajouter une dépense',
    columns: ['DÉSIGNATION', 'CATÉGORIE', 'DATE', 'MONTANT', 'FOURNISSEUR', 'MOYEN DE PAIEMENT', 'JUSTIFICATIF'],
    rows: [],
  },
  'Factures récurrentes': {
    title: 'Factures récurrentes', description: 'Automatisez vos factures périodiques.', action: 'Créer une récurrence',
    columns: ['CLIENT', 'SERVICE', 'MONTANT', 'FRÉQUENCE', 'PROCHAINE DATE', 'STATUT'],
    rows: [],
  },
  'Historique automatisation': {
    title: 'Historique automatisation', description: 'Consultez les traitements de vos factures récurrentes.', action: 'Actualiser',
    columns: ['DATE D’ÉMISSION', 'FACTURE', 'RÉSULTAT', 'DÉTAIL', 'TRAITÉ LE'],
    rows: [],
  },
  'Produits & Services': {
    title: 'Produits & Services', description: 'Gérez votre catalogue et vos tarifs.', action: 'Ajouter un produit',
    columns: ['DÉSIGNATION', 'TYPE', 'RÉFÉRENCE', 'CATÉGORIE', 'STATUT', 'STOCK', 'MARGE'],
    rows: [['Création de site web', 'Service', 'REF-WEB', 'Service', 'Actif', '25'], ['Identité visuelle', 'Service', 'REF-IDENTITY', 'Design', 'Actif', '18'], ['Maintenance mensuelle', 'Service', 'REF-MAINT', 'Service', 'Actif', '12']],
  },
  Stock: {
    title: 'Stock', description: 'Suivez les entrées, sorties et ajustements de vos produits.', action: 'Enregistrer un mouvement',
    columns: ['ID', 'PRODUIT', 'RÉFÉRENCE', 'TYPE', 'QUANTITÉ', 'AVANT', 'APRÈS', 'FOURNISSEUR', 'NOTE', 'DATE ET HEURE'],
    rows: [],
  },
  Factures: {
    title: 'Factures', description: 'Créez, envoyez et suivez vos factures.', action: 'Nouvelle facture',
    columns: ['N° DE FACTURE', 'CLIENT', 'DATE', 'MONTANT', 'STATUT'],
    rows: [],
  },
  Paiements: {
    title: 'Paiements', description: 'Suivez les encaissements et les soldes restants.', action: 'Enregistrer un paiement',
    columns: ['FACTURE', 'CLIENT', 'DATE', 'MONTANT', 'MÉTHODE'],
    rows: [],
  },
}

function ClientManagementTools({ businessId, clients, summaryMap, currency, onRefresh }: {
  businessId: string
  clients: ClientRecord[]
  summaryMap: Map<string, { count: number; total: number; remaining: number }>
  currency: string
  onRefresh: () => Promise<ClientRecord[]>
}) {
  const importRef = useRef<HTMLInputElement>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [importRows, setImportRows] = useState<{ client: ImportedClient; duplicates: ReturnType<typeof findClientDuplicates> }[]>([])
  const [importSummary, setImportSummary] = useState('')
  const [statementClientId, setStatementClientId] = useState('')
  const [reminderClientId, setReminderClientId] = useState('')
  const [reminderHref, setReminderHref] = useState('')
  const [selectionQuery, setSelectionQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectedClients = clients.filter((client) => selectedIds.has(client.id))
  const visibleSelectionClients = clients.filter((client) => {
    const query = selectionQuery.trim().toLocaleLowerCase('fr-FR')
    return !query || [client.name, client.email, client.phone].some((value) => value?.toLocaleLowerCase('fr-FR').includes(query))
  })
  const selectedActive = selectedClients.filter((client) => client.status === 'active')
  const selectedArchived = selectedClients.filter((client) => client.status === 'archived')
  const clientForStatement = clients.find((client) => client.id === statementClientId)
  const clientForReminder = clients.find((client) => client.id === reminderClientId)

  const handleImportFile = async (file: File) => {
    setError('')
    setImportSummary('')
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('Le fichier ne contient aucune feuille.')
      const parsed = parseClientImportRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' }))
      if (!parsed.length) throw new Error('Aucun client avec un nom exploitable n’a été trouvé.')
      const seen: ClientRecord[] = [...clients]
      const reviewRows = parsed.map((client, index) => {
        const duplicates = findClientDuplicates(client, seen)
        if (!duplicates.length) {
          seen.push({
            id: `import-${index}`,
            name: client.name,
            email: client.email || null,
            phone: client.phone || null,
            address: client.address || null,
            client_type: client.clientType,
            notes: client.notes || null,
            status: 'active',
          })
        }
        return { client, duplicates }
      })
      setImportRows(reviewRows)
      setImportSummary(`${parsed.length} ligne(s) prête(s) à vérifier. Les doublons détectés seront ignorés.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de lire le fichier clients.')
    }
  }

  const confirmImport = async () => {
    const importable = importRows.filter((row) => !row.duplicates.length)
    if (!importable.length) {
      setError('Aucun client importable : toutes les lignes sont des doublons.')
      return
    }
    setBusy(true)
    setError('')
    let imported = 0
    const failures: string[] = []
    const failedRows: typeof importRows = []
    for (const row of importRows) {
      if (row.duplicates.length) continue
      try {
        await createClient(businessId, row.client.name, row.client.email, row.client.phone, row.client.address, row.client.clientType, row.client.notes)
        imported += 1
      } catch (reason) {
        failures.push(`${row.client.name}: ${reason instanceof Error ? reason.message : 'erreur inconnue'}`)
        failedRows.push(row)
      }
    }
    try {
      const refreshedClients = await onRefresh()
      setImportRows(failedRows.map(({ client }) => ({ client, duplicates: findClientDuplicates(client, refreshedClients) })))
      setImportSummary(`${imported} client(s) importé(s), ${importRows.length - importable.length} doublon(s) ignoré(s), ${failures.length} erreur(s).`)
      if (failures.length) setError(failures.slice(0, 3).join(' · '))
    } catch (reason) {
      setImportRows([])
      setError(`Import effectué (${imported} client(s)), mais la liste n’a pas pu être actualisée : ${reason instanceof Error ? reason.message : 'erreur inconnue'}`)
    } finally {
      setBusy(false)
    }
  }

  const updateSelection = (clientId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(clientId)
      else next.delete(clientId)
      return next
    })
  }

  const applyBulkStatus = async (status: 'active' | 'archived') => {
    const targets = selectedClients.filter((client) => client.status !== status)
    if (!targets.length) return
    const action = status === 'archived' ? 'archiver' : 'réactiver'
    if (!window.confirm(`Confirmer : ${action} ${targets.length} client(s) sélectionné(s) ?`)) return
    setBusy(true)
    const results = await Promise.allSettled(targets.map((client) => archiveClient(businessId, client.id, status === 'archived')))
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [targets[index].id] : [])
    try {
      await onRefresh()
      setSelectedIds(new Set(failures))
      setImportSummary(`${targets.length - failures.length} client(s) ${status === 'archived' ? 'archivé(s)' : 'réactivé(s)'}.${failures.length ? ` ${failures.length} échec(s), conservé(s) dans la sélection.` : ''}`)
      if (failures.length) setError('Certaines opérations ont échoué. Vérifiez vos droits et réessayez pour les clients encore sélectionnés.')
      else setError('')
    } catch (reason) {
      setError(`Les changements ont été envoyés, mais la liste n’a pas pu être actualisée : ${reason instanceof Error ? reason.message : 'erreur inconnue'}`)
    } finally {
      setBusy(false)
    }
  }

  const exportSelectedClients = () => {
    const selected = selectedClients.map((client) => {
      const summary = summaryMap.get(client.id) ?? { count: 0, total: 0, remaining: 0 }
      return [client.name, client.email ?? '', client.phone ?? '', client.address ?? '', client.client_type === 'company' ? 'Entreprise' : 'Particulier', client.status === 'active' ? 'Actif' : 'Archivé', String(summary.count), String(summary.total), String(summary.remaining)]
    })
    downloadCsv('clients-selection.csv', ['Nom', 'Email', 'Téléphone', 'Adresse', 'Type', 'Statut', 'Factures', `Total facturé (${currency})`, `Solde dû (${currency})`], selected)
  }

  const exportStatement = async () => {
    if (!clientForStatement) return
    setBusy(true)
    setError('')
    try {
      const [history, business] = await Promise.all([
        loadClientHistory(businessId, clientForStatement.id),
        loadBusinessProfile(businessId),
      ])
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ format: 'a4', unit: 'mm' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 15
      const contentWidth = pageWidth - margin * 2
      const formatAmount = (amount: number) => `${amount.toLocaleString('fr-FR')} ${currency}`
      const formatDate = (date: string | null | undefined) => date ? new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR') : '—'
      const statusLabel = (status: string) => ({
        PAID: 'Payée',
        PARTIALLY_PAID: 'Partiellement payée',
        SENT: 'Émise',
        PENDING: 'En attente',
        OVERDUE: 'En retard',
        CANCELLED: 'Annulée',
        DRAFT: 'Brouillon',
      }[status.toUpperCase()] ?? status)
      const paymentMethodLabel = (method: string) => ({
        cash: 'Espèces',
        mobile_money: 'Mobile Money',
        bank_transfer: 'Virement bancaire',
        card: 'Carte bancaire',
        check: 'Chèque',
      }[method.toLowerCase()] ?? method)
      let y = 0

      const addPageFooter = (page: number, totalPages: number) => {
        pdf.setDrawColor(222, 229, 238)
        pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(115, 128, 146)
        pdf.text(`${business.name} · Relevé client · Édité le ${formatDate(new Date().toISOString())}`, margin, pageHeight - 9)
        pdf.text(`${page} / ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: 'right' })
      }

      const ensureSpace = (height: number) => {
        if (y + height <= pageHeight - 20) return
        pdf.addPage()
        y = margin
      }

      const addSectionTitle = (title: string, subtitle?: string) => {
        ensureSpace(subtitle ? 15 : 10)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.setTextColor(25, 45, 70)
        pdf.text(title.toLocaleUpperCase('fr-FR'), margin, y + 4)
        if (subtitle) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
          pdf.setTextColor(112, 126, 145)
          pdf.text(subtitle, pageWidth - margin, y + 4, { align: 'right' })
        }
        pdf.setDrawColor(226, 232, 240)
        pdf.line(margin, y + 7, pageWidth - margin, y + 7)
        y += 12
      }

      const drawTable = (headers: string[], rows: string[][], widths: number[], rightAligned: number[] = []) => {
        const headerHeight = 9
        const rowPadding = 3
        const drawHeader = () => {
          pdf.setFillColor(243, 247, 252)
          pdf.roundedRect(margin, y, contentWidth, headerHeight, 1.5, 1.5, 'F')
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(7)
          pdf.setTextColor(83, 100, 120)
          let x = margin + 3
          headers.forEach((header, index) => {
            const alignRight = rightAligned.includes(index)
            pdf.text(header, alignRight ? x + widths[index] - 6 : x, y + 5.8, { align: alignRight ? 'right' : 'left' })
            x += widths[index]
          })
          y += headerHeight
        }

        ensureSpace(headerHeight + 8)
        drawHeader()
        if (!rows.length) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
          pdf.setTextColor(120, 132, 148)
          pdf.text('Aucune donnée pour cette période.', margin + 3, y + 6)
          y += 12
          return
        }

        rows.forEach((row, rowIndex) => {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(7.5)
          const wrapped = row.map((value, index) => pdf.splitTextToSize(value || '—', widths[index] - 6) as string[])
          const lineCount = Math.max(...wrapped.map((lines) => lines.length), 1)
          const rowHeight = Math.max(8, lineCount * 3.8 + rowPadding * 2)
          if (y + rowHeight > pageHeight - 20) {
            pdf.addPage()
            y = margin
            drawHeader()
          }
          if (rowIndex % 2 === 1) {
            pdf.setFillColor(250, 251, 253)
            pdf.rect(margin, y, contentWidth, rowHeight, 'F')
          }
          pdf.setDrawColor(235, 239, 244)
          pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight)
          pdf.setTextColor(55, 70, 90)
          let x = margin + 3
          wrapped.forEach((lines, index) => {
            const alignRight = rightAligned.includes(index)
            pdf.text(lines, alignRight ? x + widths[index] - 6 : x, y + rowPadding + 3.2, { align: alignRight ? 'right' : 'left' })
            x += widths[index]
          })
          y += rowHeight
        })
        y += 5
      }

      pdf.setFillColor(22, 42, 67)
      pdf.rect(0, 0, pageWidth, 48, 'F')
      pdf.setFillColor(39, 123, 234)
      pdf.rect(0, 46, pageWidth, 2, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text(business.name, margin, 15)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      const businessDetails = [business.address, business.city, business.country, business.phone, business.email, business.tax_id ? `IFU : ${business.tax_id}` : ''].filter(Boolean)
      pdf.text(pdf.splitTextToSize(businessDetails.join(' · ') || 'Coordonnées non renseignées', 105), margin, 21)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('RELEVÉ DE COMPTE CLIENT', pageWidth - margin, 15, { align: 'right' })
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text(`Édité le ${formatDate(new Date().toISOString())}`, pageWidth - margin, 21, { align: 'right' })
      y = 57

      pdf.setFillColor(247, 249, 252)
      pdf.setDrawColor(228, 234, 242)
      pdf.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(25, 45, 70)
      pdf.text(history.client.name, margin + 5, y + 8)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(94, 108, 128)
      const clientDetails = [history.client.email, history.client.phone, history.client.address, history.client.tax_id ? `IFU : ${history.client.tax_id}` : ''].filter(Boolean)
      pdf.text(pdf.splitTextToSize(clientDetails.join(' · ') || 'Coordonnées non renseignées', contentWidth - 10), margin + 5, y + 15)
      y += 34

      const summaryGap = 4
      const summaryWidth = (contentWidth - summaryGap * 2) / 3
      const summaryCards = [
        { title: 'TOTAL FACTURÉ', value: formatAmount(history.totalInvoiced), color: [39, 123, 234] as const },
        { title: 'TOTAL ENCAISSÉ', value: formatAmount(history.totalPaid), color: [16, 148, 105] as const },
        { title: 'SOLDE RESTANT', value: formatAmount(history.totalRemaining), color: [220, 115, 38] as const },
      ]
      summaryCards.forEach((card, index) => {
        const x = margin + index * (summaryWidth + summaryGap)
        pdf.setFillColor(255, 255, 255)
        pdf.setDrawColor(228, 234, 242)
        pdf.roundedRect(x, y, summaryWidth, 21, 2, 2, 'FD')
        pdf.setFillColor(card.color[0], card.color[1], card.color[2])
        pdf.roundedRect(x, y, 1.5, 21, 0.7, 0.7, 'F')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(6.5)
        pdf.setTextColor(112, 126, 145)
        pdf.text(card.title, x + 5, y + 7)
        pdf.setFontSize(9)
        pdf.setTextColor(25, 45, 70)
        pdf.text(card.value, x + 5, y + 15)
      })
      y += 30

      const eligibleInvoices = history.invoices.filter((invoice) => !['CANCELLED', 'DRAFT'].includes(invoice.status.toUpperCase()))
      addSectionTitle('Factures', `${eligibleInvoices.length} facture(s) comptabilisée(s)`)
      const invoiceRows = history.invoices.map((invoice) => [
        invoice.invoice_number,
        formatDate(invoice.issue_date),
        formatDate(invoice.due_date),
        statusLabel(invoice.status),
        formatAmount(invoice.total),
        formatAmount(invoice.paid),
        formatAmount(invoice.remaining),
      ])
      drawTable(
        ['N° FACTURE', 'ÉMISE LE', 'ÉCHÉANCE', 'STATUT', 'TOTAL', 'PAYÉ', 'SOLDE'],
        invoiceRows,
        [36, 21, 21, 29, 27, 25, 21],
        [4, 5, 6],
      )

      addSectionTitle('Paiements', `${history.payments.length} paiement(s) enregistré(s)`)
      const paymentRows = history.payments.map((payment) => [
        formatDate(payment.payment_date),
        payment.invoice_number,
        paymentMethodLabel(payment.method),
        payment.reference ?? '—',
        formatAmount(payment.amount),
      ])
      drawTable(
        ['DATE', 'FACTURE', 'MODE DE PAIEMENT', 'RÉFÉRENCE', 'MONTANT'],
        paymentRows,
        [25, 34, 42, 40, 39],
        [4],
      )

      ensureSpace(18)
      pdf.setFillColor(240, 246, 255)
      pdf.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(31, 85, 155)
      pdf.text('Solde restant dû', margin + 5, y + 9)
      pdf.text(formatAmount(history.totalRemaining), pageWidth - margin - 5, y + 9, { align: 'right' })
      y += 18
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(115, 128, 146)
      pdf.text('Les totaux facturés et les soldes excluent les brouillons et les factures annulées.', margin, Math.min(y + 2, pageHeight - 19))

      const pageCount = pdf.getNumberOfPages()
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page)
        addPageFooter(page, pageCount)
      }
      pdf.save(`releve-${history.client.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`)
      setImportSummary(`Relevé client exporté pour ${history.client.name}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de générer le relevé client.')
    } finally {
      setBusy(false)
    }
  }

  const prepareReminder = async () => {
    if (!clientForReminder) return
    if (!clientForReminder.email) {
      setError('Ajoutez une adresse email au client avant de préparer la relance.')
      setReminderHref('')
      return
    }
    const [localPart, domain, ...extraParts] = clientForReminder.email.trim().split('@')
    if (!localPart || !domain || extraParts.length || /\s/.test(clientForReminder.email) || !domain.includes('.')) {
      setError('L’adresse email du client est invalide. Corrigez-la avant de préparer la relance.')
      setReminderHref('')
      return
    }
    setBusy(true)
    setError('')
    try {
      const history = await loadClientHistory(businessId, clientForReminder.id)
      const outstanding = history.invoices.filter((invoice) => invoice.remaining > 0 && !['DRAFT', 'CANCELLED'].includes(invoice.status))
      if (!outstanding.length) throw new Error('Ce client n’a aucun solde à relancer.')
      const lines = outstanding.map((invoice) => `- ${invoice.invoice_number} : ${invoice.remaining.toLocaleString('fr-FR')} ${currency}${invoice.due_date ? ` (échéance ${new Date(invoice.due_date).toLocaleDateString('fr-FR')})` : ''}`)
      const subject = `Rappel de paiement – ${clientForReminder.name}`
      const body = [
        `Bonjour ${clientForReminder.name},`,
        '',
        'Sauf erreur de notre part, les factures suivantes présentent encore un solde à régler :',
        ...lines,
        '',
        `Total restant dû : ${history.totalRemaining.toLocaleString('fr-FR')} ${currency}.`,
        '',
        'Merci de nous tenir informés de la date prévue de règlement.',
        'Cordialement,',
      ].join('\n')
      const recipient = `${encodeURIComponent(localPart)}@${encodeURIComponent(domain)}`
      setReminderHref(`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      setImportSummary(`Brouillon de relance préparé pour ${clientForReminder.name}. Vérifiez-le avant envoi.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de préparer la relance.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel client-management-tools">
    <div className="client-tools-heading">
      <div><span className="eyebrow">ESPACE CLIENTS</span><h2>Gérez vos relations clients</h2><p>Importez vos contacts, suivez les soldes et préparez vos documents.</p></div>
      <span className="client-selection-count"><Users size={15} />{selectedClients.length} sélectionné(s)</span>
    </div>
    {error && <div className="data-warning client-tools-feedback" role="alert">{error}</div>}
    {importSummary && <div className="settings-message success client-tools-feedback" role="status">{importSummary}</div>}
    <div className="client-tools-grid">
      <div className="client-tool-block">
        <div className="client-tool-title"><span className="client-tool-icon blue"><FileText size={17} /></span><div><h3>Importer des clients</h3><span>CSV ou Excel</span></div></div>
        <p>Ajoutez plusieurs contacts en une fois. Un aperçu signale les doublons avant l’import.</p>
        <button type="button" className="outline-button client-tool-primary-action" disabled={busy} onClick={() => importRef.current?.click()}><Upload size={15} />Choisir un fichier</button>
        <input ref={importRef} hidden type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void handleImportFile(file); event.currentTarget.value = '' }} />
        {importRows.length > 0 && <div className="client-import-review"><div className="client-import-counts"><strong>{importRows.filter((row) => !row.duplicates.length).length} importable(s)</strong><span>{importRows.filter((row) => row.duplicates.length).length} doublon(s) ignoré(s)</span></div><ul>{importRows.slice(0, 5).map((row, index) => <li key={`${row.client.name}-${index}`}><span>{row.client.name}</span>{row.duplicates.length > 0 && <small>Doublon {row.duplicates.map((match) => match.fields.map((field) => field === 'email' ? 'email' : 'téléphone').join(' et ')).join(', ')} avec {row.duplicates.map((match) => match.client.name).join(', ')}</small>}</li>)}</ul><button type="button" className="primary-button" disabled={busy || !importRows.some((row) => !row.duplicates.length)} onClick={() => void confirmImport()}>{busy ? 'Import en cours…' : 'Importer les lignes sans doublon'}</button></div>}
      </div>
      <div className="client-tool-block">
        <div className="client-tool-title"><span className="client-tool-icon violet"><Users size={17} /></span><div><h3>Actions groupées</h3><span>{selectedClients.length ? `${selectedClients.length} contact(s) prêt(s)` : 'Sélectionnez des contacts'}</span></div></div>
        <p>Archivez, réactivez ou exportez les contacts cochés dans la liste ci-dessous.</p>
        <div className="client-tool-buttons"><button type="button" className="outline-button" disabled={busy || !selectedActive.length} onClick={() => void applyBulkStatus('archived')}>Archiver ({selectedActive.length})</button><button type="button" className="outline-button" disabled={busy || !selectedArchived.length} onClick={() => void applyBulkStatus('active')}>Réactiver ({selectedArchived.length})</button><button type="button" className="outline-button" disabled={!selectedClients.length} onClick={exportSelectedClients}><Download size={14} />Exporter</button></div>
      </div>
      <div className="client-tool-block">
        <div className="client-tool-title"><span className="client-tool-icon blue"><FileText size={17} /></span><div><h3>Relevé client</h3><span>Document PDF détaillé</span></div></div>
        <p>Un état clair des factures, paiements et soldes, prêt à partager avec votre client.</p>
        <div className="client-tool-action"><select value={statementClientId} onChange={(event) => setStatementClientId(event.target.value)} aria-label="Client pour le relevé"><option value="">Choisir un client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><button type="button" className="primary-button" disabled={busy || !statementClientId} onClick={() => void exportStatement()}>{busy && statementClientId ? 'Préparation…' : <><Download size={15} />Télécharger le PDF</>}</button></div>
        {clientForStatement && <div className="client-action-preview"><strong>{clientForStatement.name}</strong><span>{(summaryMap.get(clientForStatement.id)?.count ?? 0)} facture(s) · {formatMoney(summaryMap.get(clientForStatement.id)?.remaining ?? 0, currency)} à recouvrer</span></div>}
      </div>
      <div className="client-tool-block">
        <div className="client-tool-title"><span className="client-tool-icon orange"><Mail size={17} /></span><div><h3>Relance de solde</h3><span>Courriel à vérifier avant envoi</span></div></div>
        <p>Prépare un message avec le détail des factures présentant encore un solde.</p>
        <div className="client-tool-action"><select value={reminderClientId} onChange={(event) => { setReminderClientId(event.target.value); setReminderHref('') }} aria-label="Client à relancer"><option value="">Choisir un client</option>{clients.filter((client) => (summaryMap.get(client.id)?.remaining ?? 0) > 0).map((client) => <option key={client.id} value={client.id}>{client.name} · {formatMoney(summaryMap.get(client.id)?.remaining ?? 0, currency)}</option>)}</select><button type="button" className="outline-button" disabled={busy || !reminderClientId} onClick={() => void prepareReminder()}>{busy && reminderClientId ? 'Préparation…' : 'Préparer le message'}</button>{reminderHref && <a className="primary-button client-reminder-link" href={reminderHref}><Mail size={15} />Ouvrir le courriel</a>}</div>
      </div>
    </div>
    <div className="client-bulk-selection">
      <div className="client-bulk-selection-heading"><div><h3>Sélection des clients</h3><p>{visibleSelectionClients.length} contact(s) affiché(s) · cochez les contacts pour les actions groupées</p></div><label><input type="checkbox" checked={visibleSelectionClients.length > 0 && visibleSelectionClients.every((client) => selectedIds.has(client.id))} onChange={(event) => { const checked = event.currentTarget.checked; setSelectedIds((current) => { const next = new Set(current); visibleSelectionClients.forEach((client) => checked ? next.add(client.id) : next.delete(client.id)); return next }) }} />Tout sélectionner</label></div>
      <div className="client-selection-tools"><label className="client-search"><Search size={15} /><input type="search" value={selectionQuery} onChange={(event) => setSelectionQuery(event.target.value)} placeholder="Rechercher un client…" aria-label="Rechercher un client dans la sélection" /></label><span>{selectedClients.length} sélectionné(s)</span></div>
      <div className="client-selection-list">{visibleSelectionClients.map((client) => { const summary = summaryMap.get(client.id) ?? { count: 0, total: 0, remaining: 0 }; return <label className={selectedIds.has(client.id) ? 'selected' : ''} key={client.id}><input type="checkbox" checked={selectedIds.has(client.id)} onChange={(event) => updateSelection(client.id, event.target.checked)} /><span className="client-selection-avatar">{client.name.trim().slice(0, 1).toLocaleUpperCase('fr-FR')}</span><span className="client-selection-info"><strong>{client.name}</strong><small>{client.email ?? client.phone ?? 'Coordonnée absente'}</small><span className="client-selection-meta"><small>{summary.count} facture(s)</small><small className={summary.remaining > 0 ? 'has-balance' : ''}>{formatMoney(summary.remaining, currency)} dû</small></span></span><span className={`client-status-pill ${client.status}`}>{client.status === 'active' ? 'Actif' : 'Archivé'}</span></label> })}</div>
      {visibleSelectionClients.length === 0 && <div className="client-selection-empty"><Search size={18} /><span>Aucun client ne correspond à cette recherche.</span></div>}
    </div>
  </section>
}

function ProductManagementTools({ businessId, products, currency, canEdit, onRefresh }: {
  businessId: string
  products: ProductRecord[]
  currency: string
  canEdit: boolean
  onRefresh: () => Promise<ProductRecord[]>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [previewRows, setPreviewRows] = useState<ProductImportRow[]>([])
  const [query, setQuery] = useState('')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedProducts = products.filter((product) => selectedIds.has(product.id))
  const visibleProducts = products.filter((product) => {
    const search = query.trim().toLocaleLowerCase('fr-FR')
    return !search || `${product.name} ${product.reference ?? ''}`.toLocaleLowerCase('fr-FR').includes(search)
  })
  const validRows = previewRows.filter((row) => !row.errors.length)
  const invalidRows = previewRows.filter((row) => row.errors.length > 0)

  const previewFile = async (file: File) => {
    setError('')
    setSummary('')
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('Le fichier ne contient aucune feuille.')
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
      if (!rows.length) throw new Error('Aucune ligne de produit n’a été trouvée.')
      setPreviewRows(parseProductImportRows(rows, products))
    } catch (reason) {
      setPreviewRows([])
      setError(reason instanceof Error ? reason.message : 'Impossible de lire le fichier catalogue.')
    }
  }

  const confirmImport = async () => {
    if (!validRows.length) {
      setError('Aucune ligne valide à importer. Corrigez les erreurs ou choisissez un autre fichier.')
      return
    }
    setBusy(true)
    setError('')
    const failures: ProductImportRow[] = []
    let imported = 0
    for (const row of validRows) {
      const product = row.product
      try {
        await createProduct(
          businessId,
          product.name,
          product.description,
          product.unit,
          product.purchasePrice,
          product.salePrice,
          product.productType,
          product.stockQuantity,
          product.lowStockThreshold,
          product.reference,
          product.category,
          product.subCategory,
          product.active,
          product.imageUrl,
        )
        imported += 1
      } catch (reason) {
        failures.push({
          product,
          errors: [reason instanceof Error ? reason.message : 'Erreur inconnue lors de la création.'],
        })
      }
    }
    try {
      const updatedProducts = await onRefresh()
      const retryRows = parseProductImportRows(failures.map(({ product }) => ({
        Nom: product.name,
        Type: product.productType === 'product' ? 'Produit' : 'Service',
        Description: product.description,
        Unité: product.unit,
        'Prix achat': product.purchasePrice,
        'Prix vente': product.salePrice,
        Stock: product.stockQuantity,
        'Seuil alerte': product.lowStockThreshold,
        Référence: product.reference,
        Catégorie: product.category,
        'Sous-catégorie': product.subCategory,
        Statut: product.active ? 'Actif' : 'Inactif',
        Image: product.imageUrl,
      })), updatedProducts)
      setPreviewRows([...invalidRows, ...retryRows])
      setSummary(`${imported} produit(s) importé(s), ${invalidRows.length} ligne(s) à corriger, ${failures.length} échec(s) à reprendre.`)
      if (failures.length) setError(failures.slice(0, 3).map(({ product, errors }) => `${product.name} : ${errors[0]}`).join(' · '))
      if (!failures.length && !invalidRows.length) setPreviewRows([])
      setSelectedIds((current) => new Set([...current].filter((id) => updatedProducts.some((product) => product.id === id))))
    } catch (reason) {
      setError(`Import effectué (${imported} produit(s)), mais le catalogue n’a pas pu être actualisé : ${reason instanceof Error ? reason.message : 'erreur inconnue'}`)
    } finally {
      setBusy(false)
    }
  }

  const setSelectedStatus = async (active: boolean) => {
    const targets = selectedProducts.filter((product) => product.active !== active)
    if (!targets.length) return
    const label = active ? 'réactiver' : 'désactiver'
    if (!window.confirm(`Confirmer : ${label} ${targets.length} produit(s)/service(s) ?`)) return
    setBusy(true)
    setError('')
    const results = await Promise.allSettled(targets.map((product) => updateProduct(
      businessId,
      product.id,
      product.name,
      product.description ?? '',
      product.unit,
      product.purchase_price,
      product.price,
      product.product_type === 'service' ? 'service' : 'product',
      product.stock_quantity,
      product.low_stock_threshold,
      product.reference ?? '',
      product.category,
      product.sub_category ?? '',
      active,
    )))
    const failedIds = results.flatMap((result, index) => result.status === 'rejected' ? [targets[index].id] : [])
    try {
      await onRefresh()
      setSelectedIds(new Set(failedIds))
      setSummary(`${targets.length - failedIds.length} élément(s) ${active ? 'réactivé(s)' : 'désactivé(s)'}${failedIds.length ? ` · ${failedIds.length} échec(s)` : ''}.`)
      if (failedIds.length) setError('Certaines modifications ont échoué. Les éléments concernés restent sélectionnés.')
    } catch (reason) {
      setError(`Les modifications ont été envoyées, mais le catalogue n’a pas pu être actualisé : ${reason instanceof Error ? reason.message : 'erreur inconnue'}`)
    } finally {
      setBusy(false)
    }
  }

  const exportSelected = (format: 'csv' | 'xlsx') => {
    const rows = productExportRows(selectedProducts)
    if (format === 'csv') {
      downloadCsv('catalogue-selection.csv', productExportHeaders, rows)
      return
    }
    const sheet = XLSX.utils.aoa_to_sheet([productExportHeaders, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sélection')
    XLSX.writeFile(workbook, 'catalogue-selection.xlsx')
  }

  return <section className="panel product-management-tools">
    <div className="product-tools-heading"><div><span className="eyebrow">CATALOGUE</span><h2>Import et actions groupées</h2><p>Contrôlez vos imports avant validation et gérez plusieurs références à la fois.</p></div><span className="product-selection-count">{selectedProducts.length} sélectionné(s)</span></div>
    {error && <div className="data-warning product-tools-feedback" role="alert">{error}</div>}
    {summary && <div className="settings-message success product-tools-feedback" role="status">{summary}</div>}
    <div className="product-tools-actions">
      <div className="product-import-action"><div><strong>Importer le catalogue</strong><span>CSV ou Excel · aperçu et contrôle des erreurs inclus</span></div><button type="button" className="outline-button" disabled={!canEdit || busy} onClick={() => fileRef.current?.click()}><Upload size={15} />Choisir un fichier</button><input ref={fileRef} hidden type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void previewFile(file); event.currentTarget.value = '' }} /></div>
      <div className="product-bulk-actions"><div><strong>Actions groupées</strong><span>{selectedProducts.length ? `${selectedProducts.length} élément(s) sélectionné(s)` : 'Sélectionnez des lignes du tableau'}</span></div><button type="button" className="outline-button" disabled={!canEdit || busy || !selectedProducts.some((product) => product.active)} onClick={() => void setSelectedStatus(false)}>Désactiver</button><button type="button" className="outline-button" disabled={!canEdit || busy || !selectedProducts.some((product) => !product.active)} onClick={() => void setSelectedStatus(true)}>Réactiver</button><button type="button" className="outline-button" disabled={!selectedProducts.length} onClick={() => exportSelected('csv')}><Download size={14} />CSV</button><button type="button" className="outline-button" disabled={!selectedProducts.length} onClick={() => exportSelected('xlsx')}><Download size={14} />Excel</button></div>
    </div>
    {previewRows.length > 0 && <div className="product-import-preview">
      <div className="product-import-preview-heading"><div><h3>Aperçu avant import</h3><p>{previewRows.length} ligne(s) contrôlée(s); les lignes signalées seront ignorées jusqu’à correction.</p></div><div className="product-import-totals"><span className="valid">{validRows.length} valides</span><span className={invalidRows.length ? 'invalid' : ''}>{invalidRows.length} à corriger</span></div></div>
      <div className="product-import-table-wrap"><table><thead><tr><th>LIGNE</th><th>NOM</th><th>TYPE</th><th>ACHAT</th><th>VENTE</th><th>STOCK</th><th>RÉSULTAT</th></tr></thead><tbody>{previewRows.slice(0, 100).map((row, index) => <tr key={`import-row-${index}`} className={row.errors.length ? 'has-errors' : ''}><td>{index + 2}</td><td>{row.product.name || '—'}</td><td>{row.product.productType === 'product' ? 'Produit' : 'Service'}</td><td>{formatMoney(row.product.purchasePrice, currency)}</td><td>{formatMoney(row.product.salePrice, currency)}</td><td>{row.product.productType === 'product' ? row.product.stockQuantity : '—'}</td><td>{row.errors.length ? <ul>{row.errors.map((message, errorIndex) => <li key={`import-error-${index}-${errorIndex}`}>{message}</li>)}</ul> : <span className="product-import-valid">Prêt à importer</span>}</td></tr>)}</tbody></table></div>
      {previewRows.length > 100 && <p className="product-import-limit">Aperçu limité aux 100 premières lignes; toutes les lignes valides seront importées.</p>}
      <div className="product-import-footer"><span>{validRows.length} ligne(s) importable(s) · {invalidRows.length} ligne(s) avec erreur</span><button type="button" className="primary-button" disabled={!canEdit || busy || !validRows.length} onClick={() => void confirmImport()}>{busy ? 'Import en cours…' : `Importer ${validRows.length} ligne(s) valide(s)`}</button></div>
    </div>}
    <details className="product-selection-details">
      <summary><span>Sélectionner dans le catalogue</span><span>{selectedProducts.length} sélectionné(s) · {products.length} références</span></summary>
      <div className="product-selection-bar"><label className="product-tools-search"><Search size={15} /><input type="search" aria-label="Rechercher dans le catalogue" placeholder="Rechercher une référence…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="product-select-visible"><input type="checkbox" checked={visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.has(product.id))} onChange={(event) => { const checked = event.currentTarget.checked; setSelectedIds((current) => { const next = new Set(current); visibleProducts.forEach((product) => checked ? next.add(product.id) : next.delete(product.id)); return next }) }} />Tout sélectionner ({visibleProducts.length})</label></div>
      <div className="product-selection-list">{visibleProducts.map((product) => <label className={selectedIds.has(product.id) ? 'selected' : ''} key={product.id}><input type="checkbox" checked={selectedIds.has(product.id)} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.currentTarget.checked) next.add(product.id); else next.delete(product.id); return next })} /><span className="product-selection-info"><strong>{product.name}</strong><small>{product.reference || 'Sans référence'} · {product.product_type === 'product' ? 'Produit' : 'Service'}</small></span><span className={`client-status-pill ${product.active ? 'active' : 'archived'}`}>{product.active ? 'Actif' : 'Inactif'}</span></label>)}</div>
      {!visibleProducts.length && <div className="product-selection-empty">Aucun produit ou service ne correspond à cette recherche.</div>}
    </details>
  </section>
}

function StockManagementTools({ businessId, products, canEdit, onRefresh }: {
  businessId: string
  products: ProductRecord[]
  canEdit: boolean
  onRefresh: () => Promise<void>
}) {
  const [productId, setProductId] = useState('')
  const [movementType, setMovementType] = useState<'in' | 'out' | 'adjustment'>('in')
  const [quantity, setQuantity] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const selectedProduct = products.find((product) => product.id === productId)
  const enteredQuantity = Number(quantity)
  const stockDifference = selectedProduct && quantity !== '' && Number.isFinite(enteredQuantity)
    ? calculateStockDifference(selectedProduct.stock_quantity, enteredQuantity)
    : null
  const isValid = Boolean(selectedProduct)
    && quantity !== ''
    && isValidStockMovementQuantity(enteredQuantity, movementType)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit || !isValid || !selectedProduct) return
    if (movementType === 'adjustment' && !window.confirm(`Confirmer l’inventaire de « ${selectedProduct.name} » : stock réel ${enteredQuantity} (théorique ${selectedProduct.stock_quantity}) ?`)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const movementNote = movementType === 'adjustment'
        ? `${note.trim() ? `${note.trim()} · ` : ''}Inventaire physique`
        : note
      const movement = await updateStock(businessId, selectedProduct.id, enteredQuantity, movementType, movementNote, supplierName)
      const difference = movement.newStock - movement.previousStock
      const differenceLabel = difference > 0 ? `+${difference.toLocaleString('fr-FR')}` : difference.toLocaleString('fr-FR')
      setMessage(movementType === 'adjustment'
        ? `Inventaire enregistré : écart ${difference === 0 ? 'nul' : differenceLabel} ${selectedProduct.unit}.`
        : 'Mouvement de stock enregistré.')
      setQuantity('')
      setSupplierName('')
      setNote('')
      try {
        await onRefresh()
      } catch (reason) {
        setError(`Le mouvement est enregistré, mais les données n’ont pas pu être actualisées : ${reason instanceof Error ? reason.message : 'erreur inconnue'}`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer le mouvement de stock.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel stock-management-tools">
    <div className="panel-heading"><div><h2>Inventaire et mouvements</h2><p>Les entrées, sorties et comptages physiques sont enregistrés dans un historique commun.</p></div></div>
    {error && <div className="data-warning" role="alert">{error}</div>}
    {message && <div className="settings-message success" role="status">{message}</div>}
    <form className="stock-entry-form" onSubmit={(event) => void submit(event)}>
      <label>Produit<select value={productId} onChange={(event) => { const id = event.target.value; setProductId(id); if (movementType === 'adjustment') setQuantity(String(products.find((product) => product.id === id)?.stock_quantity ?? '')) }} disabled={!canEdit || busy}><option value="">Sélectionner un produit</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · théorique {product.stock_quantity} {product.unit}</option>)}</select></label>
      <label>Opération<select value={movementType} onChange={(event) => { const next = event.target.value as 'in' | 'out' | 'adjustment'; setMovementType(next); setQuantity(next === 'adjustment' ? String(selectedProduct?.stock_quantity ?? '') : ''); if (next !== 'in') setSupplierName('') }} disabled={!canEdit || busy}><option value="in">Entrée de stock</option><option value="out">Sortie de stock</option><option value="adjustment">Inventaire physique / rapprochement</option></select></label>
      <label>{movementType === 'adjustment' ? 'Quantité réellement comptée' : 'Quantité du mouvement'}<input type="number" min={movementType === 'adjustment' ? '0' : '0.01'} step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={movementType === 'adjustment' ? 'Comptez les unités présentes' : 'Quantité'} disabled={!canEdit || busy} /></label>
      {movementType === 'in' && <label>Fournisseur (facultatif)<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Nom du fournisseur" disabled={!canEdit || busy} /></label>}
      <label className="stock-entry-note">Note{movementType === 'adjustment' ? ' du comptage' : ''}<input value={note} onChange={(event) => setNote(event.target.value)} placeholder={movementType === 'adjustment' ? 'Casse, inventaire du jour…' : 'Bon de livraison, motif…'} disabled={!canEdit || busy} /></label>
      {selectedProduct && <div className={`stock-count-difference ${stockDifference && stockDifference < 0 ? 'negative' : ''}`} aria-live="polite">
        <span>Stock théorique</span><strong>{selectedProduct.stock_quantity.toLocaleString('fr-FR')} {selectedProduct.unit}</strong>
        {movementType === 'adjustment' && stockDifference !== null && <><span>Écart de comptage</span><strong>{stockDifference > 0 ? '+' : ''}{stockDifference.toLocaleString('fr-FR')} {selectedProduct.unit}</strong></>}
      </div>}
      <button type="submit" className="primary-button" disabled={!canEdit || busy || !isValid}>{busy ? 'Enregistrement…' : movementType === 'adjustment' ? 'Valider le comptage' : 'Enregistrer le mouvement'}</button>
    </form>
  </section>
}


function ExpenseEditorModal({ businessId, currency, expense, onClose, onSaved }: {
  businessId: string
  currency: string
  expense: ExpenseRecord | null
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const [label, setLabel] = useState(expense?.label ?? '')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [date, setDate] = useState(expense?.expense_date ?? new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState(expense && !expenseCategoryLabels[expense.category] ? 'custom' : expense?.category ?? 'other')
  const [customCategory, setCustomCategory] = useState(expense && !expenseCategoryLabels[expense.category] ? expense.category : '')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [supplier, setSupplier] = useState(expense?.supplier_name ?? '')
  const [paymentMethod, setPaymentMethod] = useState<ExpenseRecord['payment_method']>(expense?.payment_method ?? 'cash')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const finalCategory = category === 'custom' ? customCategory.trim() : category
    if (!label.trim() || !finalCategory || !date || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setError('Renseignez une désignation, un montant positif, une date et une catégorie.')
      return
    }
    setBusy(true)
    setError('')
    try {
      let expenseId: string
      if (expense) {
        await updateExpense(businessId, expense.id, label, Number(amount), finalCategory, date, notes, supplier, paymentMethod)
        expenseId = expense.id
      } else {
        expenseId = await createExpense(businessId, label, Number(amount), finalCategory, date, notes, supplier, paymentMethod)
      }
      let message = expense ? 'Dépense modifiée.' : 'Dépense enregistrée.'
      if (receipt) {
        try {
          const receiptWarning = await uploadExpenseReceipt(businessId, expenseId, receipt)
          if (receiptWarning) message = `${message} ${receiptWarning}`
        } catch (cause) {
          message = `La dépense est enregistrée, mais le justificatif n’a pas pu être joint : ${cause instanceof Error ? cause.message : 'erreur inconnue'}`
        }
      }
      await onSaved(message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer la dépense.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop" onClick={() => !busy && onClose()}>
    <form className="invoice-modal" onSubmit={(event) => void submit(event)} onClick={(event) => event.stopPropagation()}>
      <div className="modal-header">
        <div><p className="eyebrow">{expense ? 'MODIFIER' : 'NOUVELLE DÉPENSE'}</p><h2>{expense ? 'Modifier la dépense' : 'Ajouter une dépense'}</h2></div>
        <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Fermer"><X size={20} /></button>
      </div>
      <label>Désignation<input required value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Loyer, fournitures..." /></label>
      <label>Montant ({currency})<input type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50000" /></label>
      <label>Date<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>Catégorie<select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="other">Autre</option><option value="custom">Personnalisée</option><option value="office">Bureau</option><option value="rent">Loyer</option><option value="supplies">Fournitures</option><option value="transport">Transport</option><option value="salary">Salaires</option><option value="tax">Taxes</option><option value="marketing">Marketing</option>
      </select>{category === 'custom' && <input required value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="Précisez la catégorie" />}</label>
      <label>Fournisseur<input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Nom du fournisseur" /></label>
      <label>Moyen de paiement<select value={paymentMethod} onChange={(event) => { if (isExpensePaymentMethod(event.target.value)) setPaymentMethod(event.target.value) }}>
        <option value="cash">Espèces</option><option value="mobile_money">Mobile Money</option><option value="bank_transfer">Virement bancaire</option><option value="card">Carte</option><option value="check">Chèque</option><option value="other">Autre</option>
      </select></label>
      <label>Justificatif (PDF ou image, 10 Mo max.)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} />
        {receipt && <small>Fichier sélectionné : {receipt.name}</small>}
        {expense?.receipt_path && <small>Un justificatif est déjà joint. Ajoutez un fichier pour le remplacer.</small>}
      </label>
      <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informations complémentaires (facultatif)" rows={3} /></label>
      {error && <div className="data-warning" role="alert">{error}</div>}
      <div className="delete-modal-actions">
        <button type="button" className="outline-button" onClick={onClose} disabled={busy}>Annuler</button>
        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : expense ? 'Enregistrer les modifications' : 'Enregistrer la dépense'}</button>
      </div>
    </form>
  </div>
}

function PaymentManagementTools({ businessId, currency, canEdit, payments, query, loading, loadError, onRefresh }: {
  businessId: string
  currency: string
  canEdit: boolean
  payments: PaymentRecord[]
  query: string
  loading: boolean
  loadError: string
  onRefresh: () => Promise<void>
}) {
  const [selected, setSelected] = useState<PaymentRecord | null>(null)
  const [mode, setMode] = useState<'reconcile' | 'correct' | 'cancel' | 'refund' | null>(null)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const visiblePayments = payments.filter((payment) =>
    `${payment.invoice_number} ${payment.client_name} ${payment.reference ?? ''} ${payment.reconciliation_reference ?? ''} ${payment.method} ${payment.transaction_type} ${paymentStatusLabel(payment.status)}`
      .toLocaleLowerCase('fr-FR').includes(query.toLocaleLowerCase('fr-FR')))
  const reconciledTotal = visiblePayments.reduce((sum, payment) =>
    sum + (payment.status === 'reconciled' ? (payment.transaction_type === 'refund' ? -payment.amount : payment.amount) : 0), 0)
  const pendingCount = visiblePayments.filter((payment) => payment.status === 'pending').length
  const excessInvoiceCount = new Set(visiblePayments.filter((payment) => payment.status === 'reconciled' && payment.invoice_paid > payment.invoice_total).map((payment) => payment.invoice_id)).size

  const openAction = (payment: PaymentRecord, nextMode: NonNullable<typeof mode>) => {
    setSelected(payment)
    setMode(nextMode)
    setAmount(nextMode === 'refund' ? String(Math.max(0, payment.amount - payment.refunded_amount)) : String(payment.amount))
    setPaymentDate(nextMode === 'correct' ? payment.payment_date : new Date().toISOString().slice(0, 10))
    setMethod(payment.method)
    setReference(payment.reference ?? '')
    setReason('')
    setError('')
    setMessage('')
  }

  const downloadReceipt = async (payment: PaymentRecord) => {
    setError('')
    try {
      const profile = await loadBusinessProfile(businessId)
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ format: 'a4', unit: 'mm' })
      const isPending = payment.status === 'pending'
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(19)
      pdf.text(payment.transaction_type === 'refund' ? 'AVIS DE REMBOURSEMENT' : 'REÇU DE PAIEMENT', 18, 24)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.text(profile.name, 18, 36)
      const details = [profile.address, profile.city, profile.phone, profile.email, profile.tax_id ? `IFU : ${profile.tax_id}` : null].filter((value): value is string => Boolean(value))
      pdf.text(details.length ? details : ['Coordonnées non renseignées'], 18, 44)
      let y = 72
      if (isPending || payment.status === 'cancelled') {
        pdf.setTextColor(isPending ? 180 : 185, isPending ? 83 : 28, isPending ? 9 : 28)
        pdf.setFont('helvetica', 'bold')
        pdf.text(isPending ? 'EN ATTENTE DE RAPPROCHEMENT — CE DOCUMENT NE CONFIRME PAS UN ENCAISSEMENT.' : 'ANNULÉ — DOCUMENT SANS VALEUR DE REÇU.', 18, y, { maxWidth: 175 })
        y += 14
      }
      pdf.setTextColor(35, 48, 65)
      pdf.setFont('helvetica', 'normal')
      pdf.text([
        `Client : ${payment.client_name}`,
        `Facture : ${payment.invoice_number}`,
        `Date de l’opération : ${new Date(`${payment.payment_date}T00:00:00`).toLocaleDateString('fr-FR')}`,
        `Nature : ${payment.transaction_type === 'refund' ? 'Remboursement' : 'Encaissement'}`,
        `Montant : ${payment.amount.toLocaleString('fr-FR')} ${currency}`,
        `Mode : ${paymentMethodLabel(payment.method)}`,
        `Référence : ${payment.reference ?? 'Non renseignée'}`,
        `Rapprochement : ${payment.reconciliation_reference ?? (isPending ? 'En attente' : 'Confirmé')}`,
        `Solde rapproché facture : ${Math.max(0, payment.invoice_total - payment.invoice_paid).toLocaleString('fr-FR')} ${currency}`,
        `Émis le : ${new Date().toLocaleString('fr-FR')}`,
      ], 18, y, { lineHeightFactor: 1.8 })
      pdf.setFontSize(9)
      pdf.setTextColor(100, 116, 139)
      pdf.text('Ce document retrace une opération enregistrée. Vérifiez les informations auprès de votre établissement de paiement.', 18, 270, { maxWidth: 175 })
      pdf.save(`${payment.transaction_type === 'refund' ? 'remboursement' : 'recu'}-${payment.invoice_number}-${payment.id.slice(0, 8)}.pdf`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de générer le reçu PDF.')
    }
  }

  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !mode) return
    if ((mode === 'cancel' || mode === 'refund') && !reason.trim()) {
      setError('Le motif est obligatoire.')
      return
    }
    if ((mode === 'correct' || mode === 'refund') && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
      setError('Indiquez un montant supérieur à zéro.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (mode === 'reconcile') await reconcilePayment(businessId, selected.id, reference)
      if (mode === 'correct') await correctPayment(businessId, selected.id, Number(amount), paymentDate, method, reference, reason)
      if (mode === 'cancel') await cancelPayment(businessId, selected.id, reason)
      if (mode === 'refund') await refundPayment(businessId, selected.id, Number(amount), paymentDate, reference, reason)
      const success = mode === 'reconcile' ? 'Paiement rapproché.' : mode === 'correct' ? 'Paiement corrigé et historisé.' : mode === 'cancel' ? 'Paiement annulé sans suppression de son historique.' : 'Remboursement créé en attente de rapprochement.'
      setSelected(null)
      setMode(null)
      setMessage(success)
      try {
        await onRefresh()
      } catch (cause) {
        setError(`L’opération est enregistrée, mais la liste n’a pas pu être actualisée : ${cause instanceof Error ? cause.message : 'erreur inconnue'}`)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’effectuer cette action.')
    } finally {
      setBusy(false)
    }
  }

  const retryLoad = async () => {
    setRefreshing(true)
    setRefreshError('')
    try {
      await onRefresh()
    } catch (cause) {
      setRefreshError(diagnosticErrorMessage(cause))
    } finally {
      setRefreshing(false)
    }
  }

  if (loading || refreshing || loadError || refreshError) {
    const errorMessage = loadError || refreshError
    return <section className={`panel payment-load-state ${errorMessage ? 'has-error' : ''}`} aria-live="polite">
      {errorMessage
        ? <><AlertTriangle size={22} /><h2>Impossible de charger les paiements</h2><p>{errorMessage}</p><button type="button" className="outline-button" onClick={() => void retryLoad()} disabled={refreshing}>{refreshing ? 'Nouvel essai…' : 'Réessayer'}</button></>
        : <><div className="loading-spinner" /><h2>Chargement des paiements</h2><p>Les opérations réelles sont récupérées depuis votre espace.</p></>}
    </section>
  }

  return <>
    {message && <div className="settings-message success" role="status">{message}</div>}
    {error && !selected && <div className="data-warning" role="alert">{error}</div>}
    <div className="stats-grid report-stats payment-summary">
      <StatCard title="Net rapproché" value={reconciledTotal.toLocaleString('fr-FR')} suffix={currency} change="encaissements confirmés moins remboursements" trend="up" icon={<WalletCards size={20} />} tone="green" period={false} />
      <StatCard title="À rapprocher" value={String(pendingCount)} suffix="opération(s)" change="sans effet sur le solde avant vérification" trend="down" icon={<Clock3 size={20} />} tone="orange" period={false} />
      <StatCard title="Factures en trop-perçu" value={String(excessInvoiceCount)} change="crédit client à affecter ou rembourser" trend="up" icon={<AlertTriangle size={20} />} tone="purple" period={false} />
    </div>
    <div className="panel payment-reconciliation-note"><strong>Rapprochement requis</strong><span>Une opération saisie reste en attente et ne réduit pas le solde de la facture avant vérification de sa réception réelle. Les remboursements suivent le même principe.</span></div>
    <div className="panel module-table payment-journal">
      <div className="panel-heading"><div><h2>Journal des paiements</h2><p>{visiblePayments.length} opération(s) · les corrections et annulations restent historisées.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>DATE</th><th>FACTURE</th><th>CLIENT</th><th>OPÉRATION</th><th>MONTANT</th><th>MODE / RÉFÉRENCE</th><th>STATUT</th><th>ACTIONS</th></tr></thead>
        <tbody>{visiblePayments.length ? visiblePayments.map((payment) => <tr key={payment.id}>
          <td>{new Date(`${payment.payment_date}T00:00:00`).toLocaleDateString('fr-FR')}</td>
          <td className="invoice-number">{payment.invoice_number}</td><td>{payment.client_name}</td>
          <td>{payment.transaction_type === 'refund' ? `Remboursement${payment.original_payment_id ? ` · reçu ${payment.original_payment_id.slice(0, 8)}` : ''}` : 'Encaissement'}</td>
          <td>{payment.transaction_type === 'refund' ? '−' : ''}{payment.amount.toLocaleString('fr-FR')} {currency}
            {payment.transaction_type === 'receipt' && payment.status === 'reconciled' && payment.invoice_paid > payment.invoice_total && <small className="payment-excess-note">Trop-perçu : {(payment.invoice_paid - payment.invoice_total).toLocaleString('fr-FR')} {currency}</small>}
          </td>
          <td>{paymentMethodLabel(payment.method)}<small className="payment-excess-note">{payment.reference ?? 'Sans référence'}</small>{payment.reconciliation_reference && <small className="payment-excess-note">Rapprochement : {payment.reconciliation_reference}</small>}</td>
          <td><span className={`payment-status payment-status-${payment.status}`}>{paymentStatusLabel(payment.status)}</span>{payment.reversal_reason && <small className="payment-excess-note">{payment.reversal_reason}</small>}</td>
          <td><div className="row-actions">
            <button type="button" className="action-button" onClick={() => void downloadReceipt(payment)} title="Télécharger le reçu PDF"><Download size={15} /><span>Reçu</span></button>
            {canEdit && payment.status === 'pending' && <button type="button" className="outline-button" onClick={() => openAction(payment, 'reconcile')}>Rapprocher</button>}
            {canEdit && payment.status === 'pending' && payment.transaction_type === 'receipt' && <button type="button" className="outline-button" onClick={() => openAction(payment, 'correct')}>Corriger</button>}
            {canEdit && payment.status === 'reconciled' && payment.transaction_type === 'receipt' && payment.refunded_amount < payment.amount && <button type="button" className="outline-button" onClick={() => openAction(payment, 'refund')}>Rembourser</button>}
            {canEdit && payment.status !== 'cancelled' && (payment.transaction_type !== 'receipt' || payment.refunded_amount === 0) && <button type="button" className="outline-button warning-button" onClick={() => openAction(payment, 'cancel')}>Annuler</button>}
          </div></td>
        </tr>) : <tr><td colSpan={8} className="muted-cell">{query ? 'Aucun paiement ne correspond à cette recherche.' : 'Aucun paiement réel n’est encore enregistré.'}</td></tr>}</tbody>
      </table></div>
    </div>
    {selected && mode && <div className="modal-backdrop" onClick={() => !busy && (setSelected(null), setMode(null))}>
      <form className="invoice-modal payment-action-modal" onSubmit={(event) => void submitAction(event)} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">GESTION CONTRÔLÉE DU PAIEMENT</p><h2>{mode === 'reconcile' ? 'Confirmer le rapprochement' : mode === 'correct' ? 'Corriger le paiement' : mode === 'cancel' ? 'Annuler le paiement' : 'Enregistrer un remboursement'}</h2></div>
          <button type="button" className="icon-button" onClick={() => { setSelected(null); setMode(null) }} aria-label="Fermer"><X size={20} /></button>
        </div>
        <p className="muted-cell">{selected.transaction_type === 'refund' ? 'Remboursement' : 'Encaissement'} · {selected.invoice_number} · {selected.client_name}</p>
        {mode === 'reconcile' && <><div className="payment-reconciliation-note"><strong>Confirmez uniquement après vérification</strong><span>Vérifiez le montant et la référence sur le relevé bancaire ou auprès du prestataire.</span></div><label>Référence de relevé ou transaction<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Référence bancaire (facultatif)" /></label></>}
        {mode === 'correct' && <><label>Montant ({currency})<input type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Date réelle du paiement<input type="date" required max={new Date().toISOString().slice(0, 10)} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label><label>Méthode<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Espèces</option><option value="mobile_money">Mobile Money</option><option value="bank_transfer">Virement</option><option value="card">Carte</option><option value="check">Chèque</option></select></label><label>Référence<input value={reference} onChange={(event) => setReference(event.target.value)} /></label><label>Motif obligatoire<input required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex. erreur de saisie" /></label><p className="payment-history-footnote">La correction est réservée aux opérations non rapprochées.</p></>}
        {mode === 'cancel' && <><p className="delete-warning">L’opération restera visible dans l’historique mais ne comptera plus dans le solde de la facture.</p><label>Motif obligatoire<textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Expliquez l’annulation" /></label></>}
        {mode === 'refund' && <><div className="payment-reconciliation-note"><span>Montant remboursable restant : <strong>{Math.max(0, selected.amount - selected.refunded_amount).toLocaleString('fr-FR')} {currency}</strong>. Le remboursement restera en attente avant rapprochement.</span></div><label>Montant du remboursement<input type="number" min="0.01" max={Math.max(0, selected.amount - selected.refunded_amount)} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Date du remboursement<input type="date" required max={new Date().toISOString().slice(0, 10)} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label><label>Référence du remboursement<input value={reference} onChange={(event) => setReference(event.target.value)} /></label><label>Motif obligatoire<textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></label></>}
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => { setSelected(null); setMode(null) }} disabled={busy}>Fermer</button><button type="submit" className={mode === 'cancel' ? 'danger-button' : 'primary-button'} disabled={busy}>{busy ? 'Traitement…' : mode === 'reconcile' ? 'Confirmer reçu' : mode === 'correct' ? 'Enregistrer la correction' : mode === 'cancel' ? 'Confirmer l’annulation' : 'Créer le remboursement'}</button></div>
      </form>
    </div>}
  </>
}

function ModulePage({ page, businessId, currency, timezone, canEdit, canEmail, invoiceRefreshKey, onBack, onCreate, onPrint, onDownload, onEmail }: { page: string; businessId: string; currency: string; timezone: string; canEdit: boolean; canEmail: boolean; invoiceRefreshKey: number; onBack: () => void; onCreate: () => void; onPrint: (invoiceNumber: string) => void; onDownload: (invoiceNumber: string) => void; onEmail: (invoiceNumber: string) => Promise<{ success: boolean; message: string }> }) {
  const data = moduleData[page]
  const [rows, setRows] = useState<string[][]>(data?.rows ?? [])
  const [clientRecords, setClientRecords] = useState<ClientRecord[]>([])
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([])
  const [expenseEditorOpen, setExpenseEditorOpen] = useState(false)
  const [editingExpenseRecord, setEditingExpenseRecord] = useState<ExpenseRecord | null>(null)
  const [recurringRecords, setRecurringRecords] = useState<RecurringInvoiceRow[]>([])
  const [productRecords, setProductRecords] = useState<ProductRecord[]>([])
  const [editingId, setEditingId] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)
  const [cancelCandidate, setCancelCandidate] = useState('')
  const [cancelConfirmation, setCancelConfirmation] = useState('')
  const [invoiceDetailBusy, setInvoiceDetailBusy] = useState(false)
  const [invoiceAuditHistory, setInvoiceAuditHistory] = useState<Awaited<ReturnType<typeof loadInvoiceAuditLogs>>>([])
  const [invoiceCommunicationHistory, setInvoiceCommunicationHistory] = useState<Awaited<ReturnType<typeof loadInvoiceCommunications>>>([])
  const [invoiceHistoryBusy, setInvoiceHistoryBusy] = useState(false)
  const [invoiceHistoryError, setInvoiceHistoryError] = useState('')
  const [invoiceHistoryNumber, setInvoiceHistoryNumber] = useState('')
  const [selectedInvoiceHistory, setSelectedInvoiceHistory] = useState<InvoiceDetail | null>(null)
  const [selectedClient, setSelectedClient] = useState<ClientHistory | null>(null)
  const [clientDetailTab, setClientDetailTab] = useState<'informations' | 'factures' | 'paiements' | 'historique'>('informations')
  const [clientFilters, setClientFilters] = useState<{ type: 'Tous' | 'Particulier' | 'Entreprise'; status: 'Tous' | 'Actif' | 'Archivé'; balance: 'Tous' | 'À payer' | 'Régler' }>({ type: 'Tous', status: 'Tous', balance: 'Tous' })
  const [clientSummaryMap, setClientSummaryMap] = useState<Map<string, { count: number; total: number; remaining: number }>>(new Map())
  const [selectedProduct, setSelectedProduct] = useState<{ product: ProductRecord | null; totalSold: number; totalRevenue: number; usage: { invoice_number: string; issue_date: string; client_name: string; quantity: number; total: number; status: string }[] } | null>(null)
  const [clientHistoryBusy, setClientHistoryBusy] = useState(false)
  const [productHistoryBusy, setProductHistoryBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<ClientRecord | ProductRecord | null>(null)
  const [stockDeleteCandidate, setStockDeleteCandidate] = useState('')
  const [stockDeleteConfirmation, setStockDeleteConfirmation] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [loadedKey, setLoadedKey] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('Toutes')
  const [productTypeFilter, setProductTypeFilter] = useState('Tous')
  const [productCategoryFilter, setProductCategoryFilter] = useState('Toutes')
  const [productStatusFilter, setProductStatusFilter] = useState('Tous')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('Toutes')
  const [expenseFromDate, setExpenseFromDate] = useState('')
  const [expenseToDate, setExpenseToDate] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [invoicePage, setInvoicePage] = useState(1)
  const [expensePage, setExpensePage] = useState(1)
  const [recurringPage, setRecurringPage] = useState(1)
  const [stockMovementFilter, setStockMovementFilter] = useState('Tous')
  const [stockHistoryPage, setStockHistoryPage] = useState(1)
  const productsPerPage = 25
  const stockMovementsPerPage = 25
  const invoicesPerPage = 25
  const recurringPerPage = 10
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formClientType, setFormClientType] = useState<'individual' | 'company'>('individual')
  const [formClientNotes, setFormClientNotes] = useState('')
  const [formClientStatus, setFormClientStatus] = useState<'active' | 'archived'>('active')
  const [formPrice, setFormPrice] = useState('')
  const [formPurchasePrice, setFormPurchasePrice] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formUnit, setFormUnit] = useState('unité')
  const [formType, setFormType] = useState<'service' | 'product'>('service')
  const [formReference, setFormReference] = useState('')
  const [formCategory, setFormCategory] = useState('other')
  const [formSubCategory, setFormSubCategory] = useState('')
  const [formProductStatus, setFormProductStatus] = useState<'active' | 'inactive'>('active')
  const [stockQuantity, setStockQuantity] = useState('')
  const [stockThreshold, setStockThreshold] = useState('')
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [paymentInvoices, setPaymentInvoices] = useState<PaymentInvoiceOption[]>([])
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])
  const [paymentLoadError, setPaymentLoadError] = useState('')
  const [paymentInvoice, setPaymentInvoice] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('custom')
  const [expenseCustomCategory, setExpenseCustomCategory] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [expenseNotes, setExpenseNotes] = useState('')
  const [expenseSupplier, setExpenseSupplier] = useState('')
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<ExpenseRecord['payment_method']>('cash')
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null)
  const [recurringClients, setRecurringClients] = useState<ClientOption[]>([])
  const [recurringProducts, setRecurringProducts] = useState<ProductOption[]>([])
  const [recurringClient, setRecurringClient] = useState('')
  const [recurringProduct, setRecurringProduct] = useState('')
  const [recurringFrequency, setRecurringFrequency] = useState('monthly')
  const [recurringDate, setRecurringDate] = useState(new Date().toISOString().slice(0, 10))
  const [recurringDueDays, setRecurringDueDays] = useState('30')
  const [recurringDeleteCandidate, setRecurringDeleteCandidate] = useState<RecurringInvoiceRow | null>(null)
  const [stockProducts, setStockProducts] = useState<ProductRecord[]>([])
  const [stockProduct, setStockProduct] = useState('')
  const [stockMovementType, setStockMovementType] = useState<'in' | 'out' | 'adjustment'>('in')
  const [stockQuantityValue, setStockQuantityValue] = useState('')
  const [stockSupplierName, setStockSupplierName] = useState('')
  const [stockNote, setStockNote] = useState('')
  const [expenseEditId, setExpenseEditId] = useState('')
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null)
  useEffect(() => {
    if (!businessId || !data) return
    let cancelled = false
    const loadKey = `${businessId}:${page}:${invoiceRefreshKey}`
    const load = async () => {
      setModuleError('')
      if (page === 'Paiements') setPaymentLoadError('')
      if (['Clients', 'Produits & Services', 'Paiements', 'Dépenses', 'Factures récurrentes', 'Stock', 'Factures'].includes(page)) setRows([])
      let currentProfile = businessProfile
      if ((page === 'Dépenses' || page === 'Factures') && !currentProfile) {
        currentProfile = await loadBusinessProfile(businessId)
        if (cancelled) return
        setBusinessProfile(currentProfile)
      }
      if (page === 'Clients') {
        const { clients, summary } = await loadClientSummaries(businessId)
        if (cancelled) return
        setClientRecords(clients as ClientRecord[])
        setClientSummaryMap(summary)
        setRows(clients.map((client) => {
          const clientSummary = summary.get(client.id) ?? { count: 0, total: 0, remaining: 0 }
          return [client.name, client.email ?? client.phone ?? '—', client.address ?? '—', `${clientSummary.count} facture${clientSummary.count > 1 ? 's' : ''}`, `${clientSummary.remaining.toLocaleString('fr-FR')} FCFA restant`]
        }))
      } else if (page === 'Produits & Services') {
        const products = await loadProducts(businessId)
        if (cancelled) return
        setProductRecords(products)
        setRows(products.map((product) => [product.name, product.product_type === 'product' ? 'Produit' : 'Service', product.reference ?? '—', productCategoryLabels[product.category] ?? 'Autre', product.active ? 'Actif' : 'Inactif', product.product_type === 'product' ? `${product.stock_quantity} / ${product.low_stock_threshold}` : 'Non applicable', `${(product.price - product.purchase_price).toLocaleString('fr-FR')} FCFA`]))
      } else if (page === 'Paiements') {
        const [payments, invoices] = await Promise.all([loadPayments(businessId), loadPaymentInvoices(businessId)])
        if (cancelled) return
        setPaymentRecords(payments)
        setPaymentInvoices(invoices)
      } else if (page === 'Dépenses') {
        const expenses = await loadExpenseRecords(businessId)
        if (cancelled) return
        setExpenseRecords(expenses)
        setRows(expenses.map((expense) => expenseTableRow(expense, currency)))
      } else if (page === 'Factures récurrentes') {
        const [recurrences, options] = await Promise.all([loadRecurringInvoices(businessId), loadRecurringOptions(businessId)])
        if (cancelled) return
        setRecurringRecords(recurrences)
        setRows(recurrences.map((recurrence) => [recurrence.clientName, recurrence.productName, `${recurrence.amount.toLocaleString('fr-FR')} ${currency}`, recurrence.frequency === 'monthly' ? 'Mensuelle' : recurrence.frequency === 'quarterly' ? 'Trimestrielle' : recurrence.frequency === 'yearly' ? 'Annuelle' : 'Hebdomadaire', new Date(recurrence.nextIssueDate).toLocaleDateString('fr-FR'), recurrence.active ? 'Active' : 'Inactive']))
        setRecurringClients(options.clients)
        setRecurringProducts(options.products)
      } else if (page === 'Stock') {
        const [movements, products] = await Promise.all([loadStockMovements(businessId), loadProducts(businessId)])
        if (cancelled) return
        setRows(movements)
        setStockProducts(products.filter((product) => product.product_type === 'product'))
      } else if (page === 'Factures') {
        const invoices = await loadInvoices(businessId, currentProfile?.timezone)
        if (cancelled) return
        setRows(invoices.map((invoice) => [invoice.number, invoice.customer, invoice.date, invoice.amount, invoice.status]))
      }

    }
    void load()
      .catch((error) => {
        if (cancelled) return
        const diagnostic = diagnosticErrorMessage(error)
        if (page === 'Paiements') setPaymentLoadError(diagnostic)
        if (page === 'Factures') setRows([])
        setModuleError(diagnostic)
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(loadKey)
      })
    return () => { cancelled = true }
  }, [businessId, page, data, invoiceRefreshKey])
  const refreshClients = async () => {
    const { clients, summary } = await loadClientSummaries(businessId)
    setClientRecords(clients as ClientRecord[])
    setClientSummaryMap(summary)
    setRows(clients.map((client) => {
      const clientSummary = summary.get(client.id) ?? { count: 0, total: 0, remaining: 0 }
      return [client.name, client.email ?? client.phone ?? '—', client.address ?? '—', `${clientSummary.count} facture${clientSummary.count > 1 ? 's' : ''}`, `${clientSummary.remaining.toLocaleString('fr-FR')} ${currency} restant`]
    }))
    return clients as ClientRecord[]
  }
  const refreshProducts = async () => {
    const products = await loadProducts(businessId)
    setProductRecords(products)
    setRows(products.map((product) => [product.name, product.product_type === 'product' ? 'Produit' : 'Service', product.reference ?? '—', productCategoryLabels[product.category] ?? 'Autre', product.active ? 'Actif' : 'Inactif', product.product_type === 'product' ? `${product.stock_quantity} / ${product.low_stock_threshold}` : 'Non applicable', `${(product.price - product.purchase_price).toLocaleString('fr-FR')} ${currency}`]))
    return products
  }
  const refreshStock = async () => {
    const [movements, products] = await Promise.all([loadStockMovements(businessId), loadProducts(businessId)])
    setRows(movements)
    setStockProducts(products.filter((product) => product.product_type === 'product'))
  }
  const refreshPayments = async () => {
    setPaymentLoadError('')
    const [payments, invoices] = await Promise.all([loadPayments(businessId), loadPaymentInvoices(businessId)])
    setPaymentRecords(payments)
    setPaymentInvoices(invoices)
  }
  const save = async () => {
    if ((!formName.trim() && !['Paiements', 'Factures récurrentes', 'Stock'].includes(page)) || (!paymentInvoice && page === 'Paiements') || (page === 'Dépenses' && (!expenseAmount || Number(expenseAmount) <= 0)) || (page === 'Factures récurrentes' && (!recurringClient || !recurringProduct || !recurringDate || !recurringDueDays || !Number.isInteger(Number(recurringDueDays)) || Number(recurringDueDays) < 0 || Number(recurringDueDays) > 365)) || (page === 'Stock' && (!stockProduct || stockQuantityValue === '' || !Number.isFinite(Number(stockQuantityValue)) || Number(stockQuantityValue) < 0 || (stockMovementType !== 'adjustment' && Number(stockQuantityValue) === 0))) || !businessId) {
      if (page === 'Factures récurrentes') setModuleError('Sélectionnez un client, un produit, une date et un délai de paiement valide.')
      return
    }
    if (page === 'Produits & Services') {
      const values = [Number(formPurchasePrice || 0), Number(formPrice), Number(stockQuantity || 0), Number(stockThreshold || 0)]
      if (values.some((value) => !Number.isFinite(value) || value < 0) || (formType === 'product' && !formPrice.trim())) {
        setModuleError('Les prix, le stock et le seuil doivent être des valeurs positives ou nulles.')
        return
      }
    }
    if (page === 'Clients') {
      const duplicates = findClientDuplicates({ email: formEmail, phone: formPhone }, clientRecords, editingId || undefined)
      if (duplicates.length) {
        const matchDetails = duplicates.map(({ client, fields }) => {
          const matchedValues = fields.map((field) => field === 'email' ? `email ${client.email}` : `téléphone ${client.phone}`).join(' et ')
          return `${client.name} (${matchedValues})`
        }).join(', ')
        if (!window.confirm(`Des coordonnées existent déjà pour ${matchDetails}. Enregistrer quand même ce client ? Vérifiez qu’il ne s’agit pas d’un doublon.`)) return
      }
    }
    setBusy(true)
    try {
      if (page === 'Clients') {
        if (editingId) await updateClient(businessId, editingId, formName, formEmail, formPhone, formAddress, formClientType, formClientNotes, formClientStatus)
        else await createClient(businessId, formName.trim(), formEmail.trim(), formPhone.trim(), formAddress, formClientType, formClientNotes, formClientStatus)
      }
      if (page === 'Produits & Services') {
        const productStock = formType === 'product' ? Number(stockQuantity || 0) : 0
        const productThreshold = formType === 'product' ? Number(stockThreshold || 0) : 0
        let productId = editingId
        if (editingId) await updateProduct(businessId, editingId, formName, formDescription, formUnit, Number(formPurchasePrice || 0), Number(formPrice), formType, productStock, productThreshold, formReference, formCategory, formSubCategory, formProductStatus === 'active')
        else productId = await createProduct(businessId, formName.trim(), formDescription, formUnit, Number(formPurchasePrice || 0), Number(formPrice), formType, productStock, productThreshold, formReference, formCategory, formSubCategory, formProductStatus === 'active')
        if (productImageFile) await uploadProductImage(businessId, productId, productImageFile)
      }
      if (page === 'Paiements') {
        await createPayment(businessId, paymentInvoice, Number(paymentAmount), paymentMethod, paymentReference, paymentDate)
        setActionMessage('Paiement enregistré en attente de rapprochement; il ne réduit pas encore le solde de la facture.')
      }
      if (page === 'Dépenses') {
        const category = expenseCategory === 'custom' ? expenseCustomCategory.trim() : expenseCategory
        if (!category) throw new Error('La catégorie personnalisée est obligatoire.')
        const expenseId = expenseEditId
          ? (await updateExpense(businessId, expenseEditId, formName.trim(), Number(expenseAmount), category, expenseDate, expenseNotes, expenseSupplier, expensePaymentMethod), expenseEditId)
          : await createExpense(businessId, formName.trim(), Number(expenseAmount), category, expenseDate, expenseNotes, expenseSupplier, expensePaymentMethod)
        let receiptWarning = ''
        if (expenseReceiptFile) {
          try {
            await uploadExpenseReceipt(businessId, expenseId, expenseReceiptFile)
          } catch (error) {
            receiptWarning = `La dépense est enregistrée, mais le justificatif n’a pas pu être joint : ${error instanceof Error ? error.message : 'erreur inconnue'}`
          }
        }
        setActionMessage(receiptWarning || (expenseEditId ? 'Dépense modifiée.' : 'Dépense enregistrée.'))
      }
      if (page === 'Factures récurrentes' && editingId) {
        await saveRecurring()
      } else if (page === 'Factures récurrentes') {
        if (!recurringClient || !recurringProduct) return
        await createRecurringInvoice(businessId, recurringClient, recurringProduct, recurringFrequency, recurringDate, Number(recurringDueDays))
      }
      if (page === 'Stock') {
        const product = stockProducts.find((item) => item.id === stockProduct)
        if (!product) throw new Error('Produit introuvable.')
        const movementNote = stockMovementType === 'adjustment'
          ? `${stockNote.trim() ? `${stockNote.trim()} · ` : ''}Inventaire physique`
          : stockNote
        await updateStock(businessId, product.id, Number(stockQuantityValue), stockMovementType, movementNote, stockSupplierName)
      }
      setShowForm(false); setEditingId(''); setFormName(''); setFormEmail(''); setFormPhone(''); setFormAddress(''); setFormClientType('individual'); setFormClientNotes(''); setFormClientStatus('active'); setFormPrice(''); setFormPurchasePrice(''); setFormDescription(''); setFormUnit('unité'); setFormReference(''); setFormCategory('other'); setFormSubCategory(''); setFormProductStatus('active'); setProductImageFile(null)
      setExpenseReceiptFile(null)
      if (page === 'Clients') {
        const { clients, summary } = await loadClientSummaries(businessId)
        setClientRecords(clients as ClientRecord[])
        setClientSummaryMap(summary)
        setRows(clients.map((client) => {
          const clientSummary = summary.get(client.id) ?? { count: 0, total: 0, remaining: 0 }
          const typeLabel = client.client_type === 'company' ? 'Entreprise' : 'Particulier'
          const statusLabel = client.status === 'archived' ? 'Archivé' : 'Actif'
          return [client.name, typeLabel, statusLabel, client.email ?? client.phone ?? '—', `${clientSummary.remaining.toLocaleString('fr-FR')} FCFA restant`]
        }))
      } else if (page === 'Produits & Services') {
        const products = await loadProducts(businessId)
        setProductRecords(products)
        setRows(products.map((product) => [product.name, product.product_type === 'product' ? 'Produit' : 'Service', product.reference ?? '—', productCategoryLabels[product.category] ?? 'Autre', product.active ? 'Actif' : 'Inactif', product.product_type === 'product' ? `${product.stock_quantity} / ${product.low_stock_threshold}` : 'Non applicable', `${(product.price - product.purchase_price).toLocaleString('fr-FR')} FCFA`]))
      }
      if (page === 'Paiements') {
        await refreshPayments()
        setPaymentInvoice(''); setPaymentAmount(''); setPaymentReference(''); setPaymentDate(new Date().toISOString().slice(0, 10))
      }
      if (page === 'Dépenses') {
        const expenses = await loadExpenseRecords(businessId)
        setExpenseRecords(expenses)
        setRows(expenses.map((expense) => expenseTableRow(expense, currency)))
        setExpenseAmount(''); setExpenseNotes(''); setExpenseCustomCategory(''); setExpenseCategory('custom'); setExpenseEditId('')
        setExpenseSupplier(''); setExpensePaymentMethod('cash')
      }
      if (page === 'Factures récurrentes') {
        const recurrences = await loadRecurringInvoices(businessId)
        setRecurringRecords(recurrences)
        setRows(recurrences.map((recurrence) => [recurrence.clientName, recurrence.productName, `${recurrence.amount.toLocaleString('fr-FR')} ${currency}`, recurrence.frequency === 'monthly' ? 'Mensuelle' : recurrence.frequency === 'quarterly' ? 'Trimestrielle' : recurrence.frequency === 'yearly' ? 'Annuelle' : 'Hebdomadaire', new Date(recurrence.nextIssueDate).toLocaleDateString('fr-FR'), recurrence.active ? 'Active' : 'Inactive']))
        setRecurringClient(''); setRecurringProduct('')
      }
      if (page === 'Stock') {
        const [movements, products] = await Promise.all([loadStockMovements(businessId), loadProducts(businessId)])
        setRows(movements)
        setStockProducts(products.filter((product) => product.product_type === 'product'))
        setStockProduct(''); setStockQuantityValue(''); setStockSupplierName(''); setStockNote('')
      }
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible d’enregistrer les données.')
    } finally { setBusy(false) }
  }
  const loading = loadedKey !== `${businessId}:${page}:${invoiceRefreshKey}`
  const startEdit = (record: ClientRecord | ProductRecord) => {
    setEditingId(record.id)
    setFormName(record.name)
    if (page === 'Clients') {
      const client = record as ClientRecord
      setFormEmail(client.email ?? '')
      setFormPhone(client.phone ?? '')
      setFormAddress(client.address ?? '')
      setFormClientType(client.client_type ?? 'individual')
      setFormClientNotes(client.notes ?? '')
      setFormClientStatus(client.status ?? 'active')
    } else {
      const product = record as ProductRecord
      setFormPrice(String(product.price))
        setFormPurchasePrice(String(product.purchase_price))
        setFormDescription(product.description ?? '')
        setFormUnit(product.unit || 'unité')
      setFormType(product.product_type === 'product' ? 'product' : 'service')
      setFormReference(product.reference ?? '')
      setFormCategory(product.category || 'other')
      setFormSubCategory(product.sub_category ?? '')
      setFormProductStatus(product.active ? 'active' : 'inactive')
      setProductImageFile(null)
      setStockQuantity(String(product.stock_quantity))
      setStockThreshold(String(product.low_stock_threshold))
    }
    setShowForm(true)
  }
  const removeRecord = (record: ClientRecord | ProductRecord) => {
    setDeleteCandidate(record)
    setDeleteConfirmation('')
  }
  const editExpense = (expense: ExpenseRecord) => {
    setEditingExpenseRecord(expense)
    setExpenseEditorOpen(true)
  }
  const confirmDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Supprimer définitivement cette dépense ?')) return
    setBusy(true)
    try {
      const cleanupWarning = await deleteExpense(businessId, expenseId)
      const expenses = await loadExpenseRecords(businessId)
      setExpenseRecords(expenses)
      setRows(expenses.map((expense) => expenseTableRow(expense, currency)))
      setActionMessage(cleanupWarning || 'Dépense supprimée.')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible de supprimer la dépense.')
    } finally {
      setBusy(false)
    }
  }
  const openExpenseReceipt = async (expense: ExpenseRecord) => {
    if (!expense.receipt_path) return
    const receiptWindow = window.open('', '_blank')
    if (!receiptWindow) {
      setModuleError('Autorisez les fenêtres contextuelles pour ouvrir ce justificatif.')
      return
    }
    try {
      const url = await createExpenseReceiptUrl(expense.receipt_path)
      receiptWindow.opener = null
      receiptWindow.location.href = url
    } catch (error) {
      receiptWindow.close()
      setModuleError(error instanceof Error ? error.message : 'Impossible d’ouvrir le justificatif.')
    }
  }
  const confirmRemoveRecord = async () => {
    if (!deleteCandidate || deleteConfirmation.trim() !== deleteCandidate.name) return
    setBusy(true)
    try {
      if (page === 'Clients') await deleteClient(businessId, deleteCandidate.id)
      else await deleteProduct(businessId, deleteCandidate.id)
      if (page === 'Clients') {
        const refreshed = await loadClients(businessId)
        setClientRecords(refreshed as ClientRecord[])
        setRows(refreshed.map((client) => [client.name, client.email ?? client.phone ?? '—', client.address ?? '—', '0 factures', 'Actif']))
      } else {
        const refreshed = await loadProducts(businessId)
        setProductRecords(refreshed)
        setRows(refreshed.map((product) => [product.name, product.product_type === 'product' ? 'Produit' : 'Service', `${product.price.toLocaleString('fr-FR')} FCFA`, product.product_type === 'product' ? `${product.stock_quantity}` : 'Non applicable', product.product_type === 'product' && product.stock_quantity <= product.low_stock_threshold ? 'Stock faible' : 'En stock']))
      }
      setDeleteCandidate(null)
      setDeleteConfirmation('')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible de supprimer cet élément.')
    } finally { setBusy(false) }
  }
  const confirmStockMovementDeletion = async () => {
    if (!stockDeleteCandidate || stockDeleteConfirmation.trim() !== stockDeleteCandidate) return
    setBusy(true)
    try {
      await deleteStockMovement(businessId, stockDeleteCandidate)
      await refreshStock()
      setStockDeleteCandidate('')
      setStockDeleteConfirmation('')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible de supprimer ce mouvement.')
    } finally {
      setBusy(false)
    }
  }
  const openInvoiceDetail = async (invoiceNumber: string) => {
    setInvoiceDetailBusy(true)
    try {
      setSelectedInvoice(await loadInvoiceDetail(businessId, invoiceNumber))
    } catch (error) { setModuleError(error instanceof Error ? error.message : 'Impossible de charger le détail de la facture.') }
    finally { setInvoiceDetailBusy(false) }
  }
  const openInvoiceHistory = async () => {
    if (!invoiceHistoryNumber) return
    setInvoiceHistoryBusy(true)
    setInvoiceHistoryError('')
    setSelectedInvoiceHistory(null)
    setInvoiceAuditHistory([])
    setInvoiceCommunicationHistory([])
    try {
      const detail = await loadInvoiceDetail(businessId, invoiceHistoryNumber)
      setSelectedInvoiceHistory(detail)
      const [auditHistory, communicationHistory] = await Promise.all([
        loadInvoiceAuditLogs(businessId, detail.id),
        loadInvoiceCommunications(detail.id),
      ])
      setInvoiceAuditHistory(auditHistory)
      setInvoiceCommunicationHistory(communicationHistory)
    } catch (error) {
      setInvoiceHistoryError(error instanceof Error ? error.message : 'Impossible de charger l’historique de la facture.')
    } finally {
      setInvoiceHistoryBusy(false)
    }
  }
  const requestInvoiceCancellation = (invoiceNumber: string) => {
    setCancelCandidate(invoiceNumber)
    setCancelConfirmation('')
  }
  const confirmInvoiceCancellation = async () => {
    if (!cancelCandidate || cancelConfirmation.trim() !== cancelCandidate) return
    setBusy(true)
    try {
      await cancelInvoice(businessId, cancelCandidate)
      setRows((await loadInvoices(businessId, businessProfile?.timezone)).map((invoice) => [invoice.number, invoice.customer, invoice.date, invoice.amount, invoice.status]))
      setCancelCandidate('')
      setCancelConfirmation('')
      setModuleError('')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible d’annuler la facture.')
    } finally {
      setBusy(false)
    }
  }
  const openClientHistory = async (clientId: string) => {
    setClientHistoryBusy(true)
    try { setSelectedClient(await loadClientHistory(businessId, clientId)) }
    catch (error) { setModuleError(error instanceof Error ? error.message : 'Impossible de charger l’historique du client.') }
    finally { setClientHistoryBusy(false) }
  }
  const openProductHistory = async (productId: string) => {
    setProductHistoryBusy(true)
    try { setSelectedProduct(await loadProductHistory(businessId, productId)) }
    catch (error) { setModuleError(error instanceof Error ? error.message : 'Impossible de charger l’historique du produit.') }
    finally { setProductHistoryBusy(false) }
  }
  const exportProductsPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'landscape' })
    const rows = productExportRows(filteredProductRecords)
    const columns = [['Désignation', 14], ['Type', 60], ['Référence', 82], ['Achat', 117], ['Vente', 145], ['Marge', 173], ['Marge %', 204], ['Stock', 232], ['Statut', 263]] as const
    const drawPage = (start: number) => {
      pdf.setFillColor(25, 55, 95)
      pdf.rect(0, 0, 297, 28, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(17)
      pdf.text('Catalogue produits et services', 14, 13)
      pdf.setFontSize(9)
      pdf.text(`${filteredProductRecords.length} élément(s)`, 14, 21)
      pdf.setTextColor(30, 40, 55)
      pdf.setFillColor(232, 238, 246)
      pdf.rect(10, 34, 277, 9, 'F')
      pdf.setFontSize(8)
      columns.forEach(([label, x]) => pdf.text(label, x, 40))
      let y = 51
      for (let index = start; index < rows.length && y <= 190; index += 1) {
        if ((index - start) % 2 === 0) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(10, y - 5, 277, 8, 'F')
        }
        const row = rows[index]
        const values = [row[0], row[1], row[2] || '—', `${row[6]} FCFA`, `${row[7]} FCFA`, `${row[10]} FCFA`, row[11], row[8], row[12]]
        values.forEach((value, valueIndex) => pdf.text(String(value).slice(0, valueIndex === 0 ? 28 : 16), columns[valueIndex][1], y))
        y += 8
      }
      pdf.setDrawColor(210, 218, 230)
      pdf.line(10, 194, 287, 194)
      pdf.setFontSize(7)
      pdf.setTextColor(90, 100, 115)
      pdf.text(`Exporté le ${new Date().toLocaleString('fr-FR')}`, 14, 202)
      return Math.min(rows.length, start + Math.floor((190 - 51) / 8) + 1)
    }
    let start = 0
    do {
      start = drawPage(start)
      if (start < rows.length) pdf.addPage('landscape')
    } while (start < rows.length)
    pdf.save('catalogue-produits.pdf')
  }
  const exportStockExcel = () => {
    const sheet = XLSX.utils.aoa_to_sheet([data.columns, ...allFilteredRows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Historique stock')
    XLSX.writeFile(workbook, 'historique-stock.xlsx')
  }
  const exportStockPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'landscape' })
    const columns = [['ID', 9], ['Produit', 27], ['Référence', 61], ['Type', 88], ['Quantité', 108], ['Avant', 127], ['Après', 147], ['Fournisseur', 166], ['Note', 204], ['Date et heure', 253]] as const
    const drawPage = (start: number) => {
      pdf.setFillColor(25, 55, 95)
      pdf.rect(0, 0, 297, 28, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(17)
      pdf.text('Historique des mouvements de stock', 14, 13)
      pdf.setFontSize(9)
      pdf.text(`${allFilteredRows.length} mouvement(s)`, 14, 21)
      pdf.setTextColor(30, 40, 55)
      pdf.setFillColor(232, 238, 246)
      pdf.rect(8, 34, 281, 9, 'F')
      pdf.setFontSize(7)
      columns.forEach(([label, x]) => pdf.text(label, x, 40))
      let y = 51
      for (let index = start; index < allFilteredRows.length && y <= 190; index += 1) {
        if ((index - start) % 2 === 0) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(8, y - 5, 281, 8, 'F')
        }
        const row = allFilteredRows[index]
        row.forEach((value, valueIndex) => pdf.text(String(value).slice(0, valueIndex === 8 ? 22 : valueIndex === 9 ? 14 : 13), columns[valueIndex][1], y))
        y += 8
      }
      pdf.setDrawColor(210, 218, 230)
      pdf.line(8, 194, 289, 194)
      pdf.setFontSize(7)
      pdf.setTextColor(90, 100, 115)
      pdf.text(`Exporté le ${new Date().toLocaleString('fr-FR')}`, 14, 202)
      return Math.min(allFilteredRows.length, start + Math.floor((190 - 51) / 8) + 1)
    }
    let start = 0
    do {
      start = drawPage(start)
      if (start < allFilteredRows.length) pdf.addPage('landscape')
    } while (start < allFilteredRows.length)
    pdf.save('historique-stock.pdf')
  }
  const exportExpensesExcel = () => {
    const rows = filteredExpenseRecords.map((expense) => [
      expense.label,
      getExpenseCategoryLabel(expense.category),
      expense.expense_date,
      String(expense.amount),
      expense.supplier_name ?? '',
      expensePaymentMethodLabel(expense.payment_method),
      expense.receipt_path ? 'Oui' : 'Non',
      expense.notes ?? '',
    ])
    const sheet = XLSX.utils.aoa_to_sheet([['Désignation', 'Catégorie', 'Date', `Montant (${currency})`, 'Fournisseur', 'Moyen de paiement', 'Justificatif', 'Notes'], ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Dépenses')
    XLSX.writeFile(workbook, 'depenses.xlsx')
  }
  const exportExpensesPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'landscape' })
    const profile = businessProfile ?? await loadBusinessProfile(businessId)
    const rows = filteredExpenseRecords
    pdf.setFillColor(25, 55, 95)
    pdf.rect(0, 0, 297, 34, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(16)
    pdf.text(profile.name, 14, 11)
    pdf.setFontSize(9)
    pdf.text([profile.address, profile.city, profile.phone, profile.email, profile.tax_id ? `IFU: ${profile.tax_id}` : ''].filter(Boolean).join(' · ').slice(0, 125), 14, 19)
    pdf.text('Rapport des dépenses', 14, 27)
    pdf.setTextColor(30, 40, 55)
    pdf.setFillColor(232, 238, 246)
    pdf.rect(10, 40, 277, 9, 'F')
    pdf.setFontSize(8)
    ;[['Désignation', 14], ['Catégorie', 68], ['Date', 112], ['Montant', 137], ['Fournisseur', 170], ['Paiement', 218], ['Justif.', 260] as const].forEach(([label, x]) => pdf.text(String(label), Number(x), 46))
    let y = 58
    rows.forEach((expense, index) => {
      if (y > 190) { pdf.addPage('landscape'); y = 20 }
      if (index % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(10, y - 5, 277, 8, 'F') }
      ;[
        expense.label,
        getExpenseCategoryLabel(expense.category),
        new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString('fr-FR'),
        `${expense.amount.toLocaleString('fr-FR')} ${currency}`,
        expense.supplier_name ?? '—',
        expensePaymentMethodLabel(expense.payment_method),
        expense.receipt_path ? 'Oui' : 'Non',
      ].forEach((value, valueIndex) => pdf.text(value.slice(0, [25, 16, 12, 18, 20, 14, 8][valueIndex]), [14, 68, 112, 137, 170, 218, 260][valueIndex], y))
      y += 8
    })
    pdf.setFontSize(9)
    pdf.text(`Total : ${expenseStats.total.toLocaleString('fr-FR')} ${currency} · ${rows.length} dépense(s)`, 14, Math.min(y + 8, 202))
    pdf.save('depenses.pdf')
  }
  const saveInvoiceDetail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedInvoice) return
    setInvoiceDetailBusy(true)
    try {
      const taxRate = selectedInvoice.subtotal > selectedInvoice.discount ? selectedInvoice.tax / (selectedInvoice.subtotal - selectedInvoice.discount) * 100 : 0
      await updateInvoiceDetails(businessId, selectedInvoice.invoice_number, selectedInvoice.client_id, selectedInvoice.issue_date, selectedInvoice.due_date ?? '', selectedInvoice.discount, taxRate)
      setSelectedInvoice(await loadInvoiceDetail(businessId, selectedInvoice.invoice_number))
      setRows((await loadInvoices(businessId, businessProfile?.timezone)).map((invoice) => [invoice.number, invoice.customer, invoice.date, invoice.amount, invoice.status]))
    } catch (error) { setModuleError(error instanceof Error ? error.message : 'Impossible de modifier la facture.') }
    finally { setInvoiceDetailBusy(false) }
  }
  const filteredProductRecords = productRecords.filter((product) => {
    const matchesSearch = `${product.name} ${product.reference ?? ''} ${product.category} ${product.sub_category ?? ''}`.toLocaleLowerCase('fr-FR').includes(searchQuery.toLocaleLowerCase('fr-FR'))
    const matchesType = productTypeFilter === 'Tous' || product.product_type === productTypeFilter
    const matchesCategory = productCategoryFilter === 'Toutes' || product.category === productCategoryFilter
    const matchesStatus = productStatusFilter === 'Tous' || (productStatusFilter === 'Actif' ? product.active : !product.active)
    const matchesStock = !lowStockOnly || (product.product_type === 'product' && product.stock_quantity <= product.low_stock_threshold)
    return matchesSearch && matchesType && matchesCategory && matchesStatus && matchesStock
  })
  useEffect(() => {
    setProductPage((current) => Math.min(current, Math.max(1, Math.ceil(filteredProductRecords.length / productsPerPage))))
  }, [searchQuery, productTypeFilter, productCategoryFilter, productStatusFilter, lowStockOnly, productRecords.length])
  const productPageCount = Math.max(1, Math.ceil(filteredProductRecords.length / productsPerPage))
  const pagedProductRecords = filteredProductRecords.slice((productPage - 1) * productsPerPage, productPage * productsPerPage)
  const filteredExpenseRecords = expenseRecords.filter((expense) => {
    const matchesSearch = `${expense.label} ${expense.category} ${expense.notes ?? ''} ${expense.supplier_name ?? ''} ${expensePaymentMethodLabel(expense.payment_method)}`.toLocaleLowerCase('fr-FR').includes(searchQuery.toLocaleLowerCase('fr-FR'))
    const matchesCategory = expenseCategoryFilter === 'Toutes' || (expenseCategoryFilter === 'other' ? !expenseCategoryLabels[expense.category] || expense.category === 'other' : expense.category === expenseCategoryFilter)
    const matchesFrom = !expenseFromDate || expense.expense_date >= expenseFromDate
    const matchesTo = !expenseToDate || expense.expense_date <= expenseToDate
    return matchesSearch && matchesCategory && matchesFrom && matchesTo
  })
  const expenseStats = {
    total: filteredExpenseRecords.reduce((sum, expense) => sum + expense.amount, 0),
    average: filteredExpenseRecords.length ? filteredExpenseRecords.reduce((sum, expense) => sum + expense.amount, 0) / filteredExpenseRecords.length : 0,
    largest: filteredExpenseRecords.reduce((largest, expense) => Math.max(largest, expense.amount), 0),
    categories: new Set(filteredExpenseRecords.map((expense) => expense.category)).size,
  }
  const expensePageCount = Math.max(1, Math.ceil(filteredExpenseRecords.length / productsPerPage))
  const pagedExpenseRecords = filteredExpenseRecords.slice((expensePage - 1) * productsPerPage, expensePage * productsPerPage)
  const todayKey = getBusinessDateKey(new Date(), timezone)
  const overdueRecurringRecords = recurringRecords.filter((item) => item.active && item.nextIssueDate <= todayKey)
  const recurringStats = useMemo(() => {
    const active = recurringRecords.filter((item) => item.active)
    const monthlyAmount = active.reduce((sum, item) => sum + item.amount * (item.frequency === 'weekly' ? 4.33 : item.frequency === 'quarterly' ? 1 / 3 : item.frequency === 'yearly' ? 1 / 12 : 1), 0)
    const next = active.map((item) => item.nextIssueDate).filter((date) => date > todayKey).sort()[0]
    return { active: active.length, inactive: recurringRecords.length - active.length, monthlyAmount, next, overdue: overdueRecurringRecords.length }
  }, [recurringRecords, todayKey, overdueRecurringRecords.length])
  const recurringPageCount = Math.max(1, Math.ceil(recurringRecords.length / recurringPerPage))
  useEffect(() => {
    setRecurringPage((current) => Math.min(current, Math.max(1, Math.ceil(recurringRecords.length / recurringPerPage))))
  }, [recurringRecords.length])
  const pagedRecurringRecords = recurringRecords.slice((recurringPage - 1) * recurringPerPage, recurringPage * recurringPerPage)
  const toggleRecurring = async (recurrence: RecurringInvoiceRow) => {
    setBusy(true)
    try {
      if (recurrence.failureSuspended && !recurrence.active) {
        throw new Error('Cette récurrence a été suspendue après trois échecs. Corrigez le problème puis utilisez « Relancer maintenant ».')
      }
      await toggleRecurringInvoice(businessId, recurrence.id, !recurrence.active)
      const refreshed = await loadRecurringInvoices(businessId)
      setRecurringRecords(refreshed)
      setRows(refreshed.map((item) => [item.clientName, item.productName, `${item.amount.toLocaleString('fr-FR')} ${currency}`, item.frequency === 'monthly' ? 'Mensuelle' : item.frequency === 'quarterly' ? 'Trimestrielle' : item.frequency === 'yearly' ? 'Annuelle' : 'Hebdomadaire', new Date(item.nextIssueDate).toLocaleDateString('fr-FR'), item.active ? 'Active' : 'Inactive']))
      setActionMessage(recurrence.active ? 'Récurrence désactivée.' : 'Récurrence activée.')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible de modifier la récurrence.')
    } finally { setBusy(false) }
  }
  const editRecurring = (recurrence: RecurringInvoiceRow) => {
    setEditingId(recurrence.id)
    setRecurringClient(recurrence.clientId)
    setRecurringProduct(recurrence.productId)
    setRecurringFrequency(recurrence.frequency)
    setRecurringDate(recurrence.nextIssueDate)
    setRecurringDueDays(String(recurrence.dueDays))
    setShowForm(true)
  }
  const saveRecurring = async () => {
    if (!recurringClient || !recurringProduct || !recurringDate || !recurringDueDays) throw new Error('Tous les champs de la récurrence sont obligatoires.')
    await updateRecurringInvoice(businessId, editingId, recurringClient, recurringProduct, recurringFrequency, recurringDate, Number(recurringDueDays))
    setRecurringRecords(await loadRecurringInvoices(businessId))
    setActionMessage('Récurrence modifiée.')
    setShowForm(false)
    setEditingId('')
  }
  const removeRecurring = async () => {
    if (!recurringDeleteCandidate) return
    setBusy(true)
    try {
      await deleteRecurringInvoice(businessId, recurringDeleteCandidate.id)
      setRecurringDeleteCandidate(null)
      setRecurringRecords(await loadRecurringInvoices(businessId))
      setActionMessage('Récurrence supprimée.')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible de supprimer la récurrence.')
    } finally { setBusy(false) }
  }
  const retryRecurring = async (recurrence: RecurringInvoiceRow) => {
    if (recurrence.nextIssueDate > todayKey) return
    if (!window.confirm(`Relancer l’échéance du ${new Date(`${recurrence.nextIssueDate}T00:00:00`).toLocaleDateString('fr-FR')} pour ${recurrence.clientName} ? Cette opération peut créer une facture et mettre à jour le stock.`)) return
    setBusy(true)
    setModuleError('')
    setActionMessage('')
    try {
      const issued = await retryRecurringInvoice(businessId, recurrence.id)
      const refreshed = await loadRecurringInvoices(businessId)
      setRecurringRecords(refreshed)
      setRows(refreshed.map((item) => [item.clientName, item.productName, `${item.amount.toLocaleString('fr-FR')} ${currency}`, item.frequency === 'monthly' ? 'Mensuelle' : item.frequency === 'quarterly' ? 'Trimestrielle' : item.frequency === 'yearly' ? 'Annuelle' : 'Hebdomadaire', new Date(item.nextIssueDate).toLocaleDateString('fr-FR'), item.active ? 'Active' : 'Inactive']))
      setActionMessage(issued
        ? 'Relance effectuée : la facture a été générée.'
        : 'La relance a été traitée sans générer de facture. Consultez l’historique pour connaître le résultat.')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible de relancer la facture récurrente.')
    } finally { setBusy(false) }
  }
  const allFilteredRows = page === 'Produits & Services'
    ? pagedProductRecords.map((product) => [product.name, product.product_type === 'product' ? 'Produit' : 'Service', product.reference ?? '—', productCategoryLabels[product.category] ?? 'Autre', product.active ? 'Actif' : 'Inactif', product.product_type === 'product' ? `${product.stock_quantity} / ${product.low_stock_threshold}` : 'Non applicable', `${(product.price - product.purchase_price).toLocaleString('fr-FR')} FCFA`])
    : page === 'Clients'
    ? clientRecords
        .filter((client) => {
          const summary = clientSummaryMap.get(client.id) ?? { count: 0, total: 0, remaining: 0 }
          const searchValue = `${client.name} ${client.email ?? ''} ${client.phone ?? ''} ${client.address ?? ''}`.toLocaleLowerCase('fr-FR')
          const matchesSearch = searchValue.includes(searchQuery.toLocaleLowerCase('fr-FR'))
          const matchesType = clientFilters.type === 'Tous' || (clientFilters.type === 'Entreprise' ? client.client_type === 'company' : client.client_type === 'individual')
          const matchesStatus = clientFilters.status === 'Tous' || (clientFilters.status === 'Actif' ? client.status === 'active' : client.status === 'archived')
          const matchesBalance = clientFilters.balance === 'Tous' || (clientFilters.balance === 'À payer' ? summary.remaining > 0 : summary.remaining === 0)
          return matchesSearch && matchesType && matchesStatus && matchesBalance
        })
        .map((client) => {
          const clientSummary = clientSummaryMap.get(client.id) ?? { count: 0, total: 0, remaining: 0 }
          const typeLabel = client.client_type === 'company' ? 'Entreprise' : 'Particulier'
          const statusLabel = client.status === 'archived' ? 'Archivé' : 'Actif'
          return [client.name, typeLabel, statusLabel, client.email ?? client.phone ?? '—', `${clientSummary.remaining.toLocaleString('fr-FR')} FCFA restant`]
        })
    : page === 'Dépenses'
      ? pagedExpenseRecords.map((expense) => expenseTableRow(expense, currency))
      : rows.filter((row) => {
        const matchesSearch = row.join(' ').toLocaleLowerCase('fr-FR').includes(searchQuery.toLocaleLowerCase('fr-FR'))
        const matchesStatus = page !== 'Factures' || invoiceStatusFilter === 'Toutes' || row[4] === invoiceStatusFilter
        const matchesMovementType = page !== 'Stock' || stockMovementFilter === 'Tous' || row[3] === stockMovementFilter
        return matchesSearch && matchesStatus && matchesMovementType
      })
  const invoiceAmounts = allFilteredRows
    .filter((row) => page === 'Factures' && row[3])
    .map((row) => Number(row[3].replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0)
  const invoiceStats = {
    total: invoiceAmounts.reduce((sum, amount) => sum + amount, 0),
    average: invoiceAmounts.length ? invoiceAmounts.reduce((sum, amount) => sum + amount, 0) / invoiceAmounts.length : 0,
    paid: allFilteredRows.filter((row) => row[4] === 'Payée').length,
    overdue: allFilteredRows.filter((row) => row[4] === 'En retard').length,
  }
  const stockSummary = calculateStockSummary(stockProducts)
  useEffect(() => {
    if (page !== 'Stock') return
    setStockHistoryPage((current) => Math.min(current, Math.max(1, Math.ceil(allFilteredRows.length / stockMovementsPerPage))))
  }, [page, searchQuery, stockMovementFilter, rows.length])
  useEffect(() => {
    if (page !== 'Factures') return
    setInvoicePage((current) => Math.min(current, Math.max(1, Math.ceil(allFilteredRows.length / invoicesPerPage))))
  }, [page, searchQuery, invoiceStatusFilter, rows.length])
  useEffect(() => {
    if (page !== 'Dépenses') return
    setExpensePage((current) => Math.min(current, Math.max(1, Math.ceil(filteredExpenseRecords.length / productsPerPage))))
  }, [page, searchQuery, expenseCategoryFilter, expenseFromDate, expenseToDate, expenseRecords.length])
  useEffect(() => {
    if (page !== 'Factures récurrentes') return
    setRecurringPage((current) => Math.min(current, recurringPageCount))
  }, [page, recurringRecords.length, recurringPageCount])
  const stockHistoryPageCount = Math.max(1, Math.ceil(allFilteredRows.length / stockMovementsPerPage))
  const invoicePageCount = Math.max(1, Math.ceil(allFilteredRows.length / invoicesPerPage))
  const filteredRows = page === 'Stock'
    ? allFilteredRows.slice((stockHistoryPage - 1) * stockMovementsPerPage, stockHistoryPage * stockMovementsPerPage)
    : page === 'Factures'
      ? allFilteredRows.slice((invoicePage - 1) * invoicesPerPage, invoicePage * invoicesPerPage)
    : allFilteredRows

  const clientPortfolio = useMemo(() => {
    const totalReceivable = clientRecords.reduce((sum, client) => sum + (clientSummaryMap.get(client.id)?.remaining ?? 0), 0)
    const activeClients = clientRecords.filter((client) => client.status === 'active').length
    const archivedClients = clientRecords.filter((client) => client.status === 'archived').length
    const companyClients = clientRecords.filter((client) => client.client_type === 'company').length
    const individualClients = clientRecords.filter((client) => client.client_type === 'individual').length
    const unpaidClients = clientRecords.filter((client) => (clientSummaryMap.get(client.id)?.remaining ?? 0) > 0).length
    const vipClients = clientRecords.filter((client) => {
      const summary = clientSummaryMap.get(client.id) ?? { count: 0, total: 0, remaining: 0 }
      return getClientSegment(summary.total, summary.remaining) === 'VIP'
    }).length
    const watchlistClients = clientRecords.filter((client) => {
      const summary = clientSummaryMap.get(client.id) ?? { count: 0, total: 0, remaining: 0 }
      return getClientSegment(summary.total, summary.remaining) === 'À surveiller'
    }).length
    const standardClients = clientRecords.length - vipClients - watchlistClients
    return { totalReceivable, activeClients, archivedClients, companyClients, individualClients, unpaidClients, vipClients, watchlistClients, standardClients }
  }, [clientRecords, clientSummaryMap])

  if (!data) return <section className="empty-page"><div className="empty-icon"><FileText size={28} /></div><p className="eyebrow">MODULE EN PRÉPARATION</p><h1>{page}</h1><p>Ce module sera disponible dans la prochaine version de FactureFacile.</p><button className="primary-button" onClick={onBack}>Retour au tableau de bord</button></section>
  return <section className={`module-page ${page === 'Factures récurrentes' ? 'recurring-module' : page === 'Stock' ? 'stock-module' : page === 'Produits & Services' ? 'product-module' : ''}`}>
    {(page === 'Produits & Services' || page === 'Stock') && <div className="module-heading inventory-module-heading">
      <div><p className="eyebrow">{page === 'Stock' ? 'GESTION DES INVENTAIRES' : 'CATALOGUE COMMERCIAL'}</p><h1>{data.title}</h1><p>{data.description}</p></div>
      {page === 'Produits & Services' && canEdit && <button className="primary-button" onClick={() => { setEditingId(''); setShowForm(true) }}><Plus size={18} />Ajouter un produit</button>}
    </div>}
    {(page === 'Produits & Services' || page === 'Stock') && (moduleError || actionMessage) && <div className="inventory-module-messages">
      {moduleError && <div className="data-warning" role="alert">{moduleError}</div>}
      {actionMessage && <div className="settings-message" role="status">{actionMessage}</div>}
    </div>}
    {page === 'Clients' && <ClientManagementTools businessId={businessId} clients={clientRecords} summaryMap={clientSummaryMap} currency={currency} onRefresh={refreshClients} />}
    {page === 'Produits & Services' && <ProductManagementTools businessId={businessId} products={productRecords} currency={currency} canEdit={canEdit} onRefresh={refreshProducts} />}
    {page === 'Paiements' && <PaymentManagementTools businessId={businessId} currency={currency} canEdit={canEdit} payments={paymentRecords} query={searchQuery} loading={loading} loadError={paymentLoadError} onRefresh={refreshPayments} />}
    {page === 'Stock' && <>
      <div className="stats-grid report-stats">
        <StatCard title="Références stockables" value={String(stockSummary.productCount)} change="produits suivis" trend="up" icon={<Package size={20} />} tone="blue" period={false} />
        <StatCard title="Unités en stock" value={stockSummary.unitCount.toLocaleString('fr-FR')} change="quantité théorique totale" trend="up" icon={<Activity size={20} />} tone="purple" period={false} />
        <StatCard title="Valeur au coût d’achat" value={stockSummary.purchaseValue.toLocaleString('fr-FR')} suffix={currency} change="valorisation au coût d’achat actuel" trend="up" icon={<WalletCards size={20} />} tone="green" period={false} />
        <StatCard title="Alertes de seuil" value={String(stockSummary.alertCount)} change="stock inférieur ou égal au seuil" trend="down" icon={<AlertTriangle size={20} />} tone="orange" period={false} />
      </div>
      <div className="stock-module-guidance"><strong>À savoir</strong><span>Une alerte apparaît lorsque le stock est inférieur ou égal au seuil défini; un seuil à 0 signale seulement la rupture. Les mouvements sont verrouillés par produit côté base pour éviter les pertes lors d’opérations simultanées. Le stock est actuellement géré sur un seul dépôt.</span></div>
      <StockManagementTools businessId={businessId} products={stockProducts} canEdit={canEdit} onRefresh={refreshStock} />
    </>}
    {page === 'Factures' && <section className="panel invoice-history-launch">
      <div className="panel-heading"><div><h2>Suivi et historique</h2><p>Consultez les changements de la facture, les envois et les relances enregistrés.</p></div></div>
      <div className="invoice-history-launch-actions">
        <label>Facture à consulter
          <select value={invoiceHistoryNumber} onChange={(event) => setInvoiceHistoryNumber(event.target.value)}>
            <option value="">Sélectionner une facture</option>
            {rows.map((row) => <option value={row[0]} key={row[0]}>{row[0]} · {row[1]}</option>)}
          </select>
        </label>
        <button className="outline-button" onClick={() => void openInvoiceHistory()} disabled={!invoiceHistoryNumber || invoiceHistoryBusy}>
          {invoiceHistoryBusy ? 'Chargement…' : 'Afficher le suivi'}
        </button>
      </div>
      {invoiceHistoryError && !selectedInvoiceHistory && <div className="data-warning" role="alert">{invoiceHistoryError}</div>}
    </section>}
    {page === 'Produits & Services' && <div className="toolbar-actions" style={{ margin: '0.75rem 0' }}><span className="muted-cell">{filteredProductRecords.length} produit(s) · page {productPage} / {productPageCount}</span><button className="outline-button" disabled={productPage <= 1} onClick={() => setProductPage((current) => current - 1)}>Précédent</button><button className="outline-button" disabled={productPage >= productPageCount} onClick={() => setProductPage((current) => current + 1)}>Suivant</button></div>}{page === 'Stock' && <div className="toolbar-actions" style={{ margin: '0.75rem 0', gap: '0.75rem', flexWrap: 'wrap' }}><select className="outline-button" value={stockMovementFilter} onChange={(event) => { setStockMovementFilter(event.target.value); setStockHistoryPage(1) }} aria-label="Filtrer les mouvements par type"><option value="Tous">Tous les mouvements</option><option value="Entrée">Entrées</option><option value="Sortie">Sorties</option><option value="Ajustement">Ajustements</option></select><span className="muted-cell">{allFilteredRows.length} mouvement(s) · page {stockHistoryPage} / {stockHistoryPageCount}</span><button className="outline-button" disabled={stockHistoryPage <= 1} onClick={() => setStockHistoryPage((current) => current - 1)}>Précédent</button><button className="outline-button" disabled={stockHistoryPage >= stockHistoryPageCount} onClick={() => setStockHistoryPage((current) => current + 1)}>Suivant</button></div>}
    {page === 'Factures' && <div className="toolbar-actions" style={{ margin: '0.75rem 0' }}><span className="muted-cell">{allFilteredRows.length} facture(s) · page {invoicePage} / {invoicePageCount}</span><button className="outline-button" disabled={invoicePage <= 1} onClick={() => setInvoicePage((current) => current - 1)}>Précédent</button><button className="outline-button" disabled={invoicePage >= invoicePageCount} onClick={() => setInvoicePage((current) => current + 1)}>Suivant</button></div>}{page === 'Dépenses' && <div className="toolbar-actions" style={{ margin: '0.75rem 0' }}><span className="muted-cell">{filteredExpenseRecords.length} dépense(s) · page {expensePage} / {expensePageCount}</span><button className="outline-button" disabled={expensePage <= 1} onClick={() => setExpensePage((current) => current - 1)}>Précédent</button><button className="outline-button" disabled={expensePage >= expensePageCount} onClick={() => setExpensePage((current) => current + 1)}>Suivant</button></div>}    {page === 'Factures récurrentes' && <><div className="stats-grid report-stats"><StatCard title="Montant mensuel estimé" value={recurringStats.monthlyAmount.toLocaleString('fr-FR')} suffix={currency} change="Récurrences actives" trend="up" icon={<Repeat2 size={20} />} tone="blue" /><StatCard title="Actives" value={String(recurringStats.active)} suffix="récurrence(s)" change="Programmées" trend="up" icon={<CheckCircle2 size={20} />} tone="green" /><StatCard title="Inactives" value={String(recurringStats.inactive)} suffix="récurrence(s)" change="Désactivées ou suspendues" trend="down" icon={<PauseCircle size={20} />} tone="orange" /><StatCard title="Échéance à venir" value={recurringStats.next ? new Date(`${recurringStats.next}T00:00:00`).toLocaleDateString('fr-FR') : '—'} suffix="" change={recurringStats.overdue ? `${recurringStats.overdue} en attente` : 'Parmi les actives'} trend={recurringStats.overdue ? 'down' : 'up'} icon={<CalendarDays size={20} />} tone="purple" /></div><div className="toolbar-actions" style={{ margin: '0.75rem 0' }}><span className="muted-cell">{recurringRecords.length} récurrence(s) · page {recurringPage} / {recurringPageCount}</span><button className="outline-button" disabled={recurringPage <= 1} onClick={() => setRecurringPage((current) => current - 1)}>Précédent</button><button className="outline-button" disabled={recurringPage >= recurringPageCount} onClick={() => setRecurringPage((current) => current + 1)}>Suivant</button></div>    <div className="panel" style={{ marginBottom: '1rem' }}><div className="panel-heading"><div><h2>Gestion des récurrences</h2><p>Les exécutions sont consultables dans Historique automatisation.</p></div></div><div className="table-wrap"><table><thead><tr><th>CLIENT</th><th>SERVICE</th><th>MONTANT</th><th>FRÉQUENCE</th><th>PROCHAINE DATE</th><th>STATUT</th><th>ACTION</th></tr></thead><tbody>{pagedRecurringRecords.length ? pagedRecurringRecords.map((recurrence) => <tr key={recurrence.id}><td>{recurrence.clientName}</td><td>{recurrence.productName}</td><td>{formatMoney(recurrence.amount, currency)}</td><td>{recurrence.frequency === 'monthly' ? 'Mensuelle' : recurrence.frequency === 'quarterly' ? 'Trimestrielle' : recurrence.frequency === 'yearly' ? 'Annuelle' : 'Hebdomadaire'}</td><td>{new Date(`${recurrence.nextIssueDate}T00:00:00`).toLocaleDateString('fr-FR')}</td><td><span className={`recurring-status ${recurrence.active ? 'active' : 'inactive'}`}>{recurrence.active ? 'Active' : 'Inactive'}</span></td><td><div className="recurring-row-actions">{canEdit && <><button type="button" className="outline-button" onClick={() => editRecurring(recurrence)} disabled={busy}>Modifier</button><button type="button" className="danger-button" onClick={() => setRecurringDeleteCandidate(recurrence)} disabled={busy}>Supprimer</button><button type="button" className="outline-button" onClick={() => void toggleRecurring(recurrence)} disabled={busy}>{recurrence.active ? 'Désactiver' : 'Activer'}</button></>}</div></td></tr>) : <tr><td colSpan={7} className="muted-cell">Aucune récurrence pour le moment. Créez-en une pour automatiser la facturation de vos services.</td></tr>}</tbody></table></div></div></>}
    {page === 'Factures récurrentes' && <section className="recurring-failure-policy" aria-label="Politique de gestion des échecs">
      <div><AlertTriangle size={20} /><strong>Les échecs conservent l’échéance; le traitement planifié retente une fois par jour.</strong></div>
      <p>Après 3 échecs consécutifs, la récurrence est suspendue et une alerte apparaît dans les notifications. Corrigez la cause (par exemple abonnement, stock ou configuration), puis utilisez « Relancer maintenant ». Cette automatisation quotidienne nécessite que le cron soit configuré. Une relance ne traite que les échéances arrivées; aucune facture n’est créée à l’avance.</p>
      {overdueRecurringRecords.map((recurrence) => <div className="recurring-overdue-notice" key={`overdue-${recurrence.id}`}>
        <span><strong>Échéance en attente :</strong> {recurrence.clientName} · {recurrence.productName}, prévue le {new Date(`${recurrence.nextIssueDate}T00:00:00`).toLocaleDateString('fr-FR')}. Vérifiez que le traitement planifié est configuré et actif.</span>
        {canEdit && <button type="button" className="outline-button" onClick={() => void retryRecurring(recurrence)} disabled={busy}>Relancer maintenant</button>}
      </div>)}
      {recurringRecords.some((item) => item.consecutiveFailures > 0)
        ? <div className="recurring-failure-list">{recurringRecords.filter((item) => item.consecutiveFailures > 0).map((recurrence) => <article className={`recurring-failure-item ${recurrence.failureSuspended ? 'suspended' : ''}`} key={recurrence.id}>
          <div className="recurring-failure-copy">
            <strong>{recurrence.clientName} · {recurrence.productName}</strong>
            <span>{recurrence.failureSuspended ? 'Suspendue après 3 échecs' : `Échec ${recurrence.consecutiveFailures}/3 · nouvel essai automatique prévu${recurrence.retryAt ? ` après le ${new Date(recurrence.retryAt).toLocaleString('fr-FR')}` : ''}`}</span>
            <small>{recurrence.lastError ?? 'Consultez l’historique des exécutions pour le détail.'}</small>
          </div>
          {canEdit && <button type="button" className="outline-button" onClick={() => void retryRecurring(recurrence)} disabled={busy || recurrence.nextIssueDate > todayKey}>Relancer maintenant</button>}
        </article>)}</div>
        : <p className="recurring-no-failures">Aucune exécution en échec connue pour ces récurrences.</p>}
    </section>}
    {page === 'Factures récurrentes' && recurringDeleteCandidate && <div className="modal-backdrop" onClick={() => !busy && setRecurringDeleteCandidate(null)}><div className="invoice-modal delete-modal" onClick={(event) => event.stopPropagation()}><div className="delete-modal-icon"><Trash2 size={22} /></div><div className="modal-header"><div><p className="eyebrow">CONFIRMATION REQUISE</p><h2>Supprimer cette récurrence ?</h2></div><button className="icon-button" onClick={() => setRecurringDeleteCandidate(null)} aria-label="Fermer"><X size={20} /></button></div><p className="delete-warning">La récurrence de <strong>{recurringDeleteCandidate.clientName}</strong> sera supprimée définitivement.</p><div className="delete-modal-actions"><button className="outline-button" onClick={() => setRecurringDeleteCandidate(null)} disabled={busy}>Annuler</button><button className="danger-button" onClick={() => void removeRecurring()} disabled={busy}>{busy ? 'Suppression...' : 'Supprimer définitivement'}</button></div></div></div>}
    {page === 'Clients' && <div className="panel client-segmentation-summary"><div className="panel-heading"><div><h2>Segmentation client</h2><p>Classement calculé sur le chiffre d’affaires facturé et le solde restant.</p></div></div><div className="quick-actions-grid"><div className="quick-action-button"><span>VIP</span><strong>{clientPortfolio.vipClients}</strong></div><div className="quick-action-button"><span>À surveiller</span><strong>{clientPortfolio.watchlistClients}</strong></div><div className="quick-action-button"><span>Standard</span><strong>{clientPortfolio.standardClients}</strong></div></div></div>}
    {selectedClient && <div className="modal-backdrop" onClick={() => setSelectedClient(null)}><div className="invoice-modal client-detail-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header invoice-detail-header"><div><p className="eyebrow">FICHE CLIENT</p><h2>{selectedClient.client.name}</h2><p className="invoice-detail-date">{selectedClient.client.client_type === 'company' ? 'Entreprise' : 'Particulier'} · {selectedClient.client.status === 'archived' ? 'Client archivé' : 'Client actif'}</p></div><div className="invoice-detail-header-actions"><span className={`client-active-badge ${selectedClient.client.status === 'archived' ? 'archived' : ''}`}>{selectedClient.client.status === 'archived' ? 'Archivé' : 'Actif'}</span>{canEdit && <button className="outline-button" onClick={() => void (async () => { try { const nextArchived = selectedClient.client.status !== 'archived'; await archiveClient(businessId, selectedClient.client.id, nextArchived); setSelectedClient({ ...selectedClient, client: { ...selectedClient.client, status: nextArchived ? 'archived' : 'active', archived_at: nextArchived ? new Date().toISOString() : null } }); const refreshed = await loadClientSummaries(businessId); setClientRecords(refreshed.clients as ClientRecord[]); setClientSummaryMap(refreshed.summary); setRows(refreshed.clients.map((client) => { const clientSummary = refreshed.summary.get(client.id) ?? { count: 0, total: 0, remaining: 0 }; const typeLabel = client.client_type === 'company' ? 'Entreprise' : 'Particulier'; const statusLabel = client.status === 'archived' ? 'Archivé' : 'Actif'; return [client.name, typeLabel, statusLabel, client.email ?? client.phone ?? '—', `${clientSummary.remaining.toLocaleString('fr-FR')} FCFA restant`] })); } catch (error) { setModuleError(error instanceof Error ? error.message : 'Impossible de modifier le statut du client.') } })()}>{selectedClient.client.status === 'archived' ? 'Réactiver' : 'Archiver'}</button>}<button className="icon-button" onClick={() => setSelectedClient(null)} aria-label="Fermer"><X size={20} /></button></div></div><div className="client-detail-tabs">{(['informations', 'factures', 'paiements', 'historique'] as const).map((tab) => <button key={tab} className={`outline-button ${clientDetailTab === tab ? 'active' : ''}`} onClick={() => setClientDetailTab(tab)}>{tab === 'informations' ? 'Informations' : tab === 'factures' ? 'Factures' : tab === 'paiements' ? 'Paiements' : 'Historique'}</button>)}</div>{clientDetailTab === 'informations' && <><div className="invoice-detail-parties client-contact-card"><div className="invoice-party"><span className="invoice-party-label">COORDONNÉES</span><strong>{selectedClient.client.name}</strong><span>{selectedClient.client.email ?? 'Email non renseigné'}</span><span>{selectedClient.client.phone ?? 'Téléphone non renseigné'}</span></div><div className="invoice-party"><span className="invoice-party-label">ADRESSE ET NOTES</span><strong>{selectedClient.client.address ?? 'Adresse non renseignée'}</strong><span>{selectedClient.client.client_type === 'company' ? 'Entreprise' : 'Particulier'} · {selectedClient.client.tax_id ? `N° TVA ${selectedClient.client.tax_id}` : 'Sans N° TVA'}</span><span>{selectedClient.client.notes || 'Aucune note interne.'}</span></div></div><div className="stats-grid report-stats"><StatCard title="Total facturé" value={selectedClient.totalInvoiced.toLocaleString('fr-FR')} suffix="FCFA" change={`${selectedClient.invoices.length} facture${selectedClient.invoices.length > 1 ? 's' : ''}`} trend="up" icon={<FileText size={20} />} tone="blue" /><StatCard title="Total payé" value={selectedClient.totalPaid.toLocaleString('fr-FR')} suffix="FCFA" change="encaissements enregistrés" trend="up" icon={<WalletCards size={20} />} tone="green" /><StatCard title="Reste à payer" value={selectedClient.totalRemaining.toLocaleString('fr-FR')} suffix="FCFA" change="solde en cours" trend="down" icon={<WalletCards size={20} />} tone="orange" /><StatCard title="Dernière facture" value={selectedClient.invoices.length ? new Date(selectedClient.invoices[0].issue_date).toLocaleDateString('fr-FR') : '—'} suffix={selectedClient.invoices.length ? 'facture' : ''} change={selectedClient.invoices.length ? `${selectedClient.invoices[0].total.toLocaleString('fr-FR')} FCFA` : 'Aucune facture'} trend="up" icon={<Calendar />} tone="purple" /></div><div className="invoice-detail-parties client-contact-card"><div className="invoice-party"><span className="invoice-party-label">SCORE & SEGMENTATION</span><strong>{selectedClient.totalRemaining > 0 ? 'À suivre' : 'Stable'}</strong><span>{selectedClient.client.client_type === 'company' ? 'Client entreprise' : 'Client particulier'}</span><span>{selectedClient.client.status === 'archived' ? 'Client archivé' : 'Client actif'}</span></div><div className="invoice-party"><span className="invoice-party-label">DERNIER PAIEMENT</span><strong>{selectedClient.totalPaid > 0 ? `${selectedClient.totalPaid.toLocaleString('fr-FR')} FCFA` : 'Aucun paiement'}</strong><span>{selectedClient.invoices.length ? `Dernière facture : ${new Date(selectedClient.invoices[0].issue_date).toLocaleDateString('fr-FR')}` : 'Aucune facture enregistrée'}</span><span>{selectedClient.totalRemaining > 0 ? `${selectedClient.totalRemaining.toLocaleString('fr-FR')} FCFA restant` : 'Solde régularisé'}</span></div></div></>}{clientDetailTab === 'factures' && <div className="table-wrap"><table><thead><tr><th>FACTURE</th><th>DATE</th><th>TOTAL</th><th>PAYÉ</th><th>RESTANT</th><th>STATUT</th></tr></thead><tbody>{selectedClient.invoices.length ? selectedClient.invoices.map((invoice) => <tr key={invoice.invoice_number}><td className="invoice-number">{invoice.invoice_number}</td><td>{new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</td><td>{invoice.total.toLocaleString('fr-FR')} FCFA</td><td>{invoice.paid.toLocaleString('fr-FR')} FCFA</td><td>{invoice.remaining.toLocaleString('fr-FR')} FCFA</td><td><span className={`invoice-status invoice-status-${invoice.status.toLowerCase()}`}>{invoice.status === 'PAID' ? 'Payée' : invoice.status === 'CANCELLED' ? 'Annulée' : invoice.status === 'PARTIALLY_PAID' ? 'Partiellement payée' : invoice.status === 'OVERDUE' ? 'En retard' : 'En attente'}</span></td></tr>) : <tr><td colSpan={6} className="muted-cell">Aucune facture pour ce client.</td></tr>}</tbody></table></div>}    {clientDetailTab === 'paiements' && <div className="table-wrap"><table><thead><tr><th>FACTURE</th><th>DATE</th><th>MONTANT</th><th>MÉTHODE</th><th>RÉFÉRENCE</th></tr></thead><tbody>{selectedClient.payments.length ? selectedClient.payments.map((payment, index) => <tr key={`${payment.invoice_number}-${payment.payment_date}-${index}`}><td className="invoice-number">{payment.invoice_number}</td><td>{new Date(payment.payment_date).toLocaleDateString('fr-FR')}</td>        <td>{payment.amount.toLocaleString('fr-FR')} {currency}</td><td>{payment.method}</td><td>{payment.reference ?? '—'}</td></tr>) : <tr><td colSpan={5} className="muted-cell">Aucun paiement enregistré.</td></tr>}</tbody></table></div>}{clientDetailTab === 'historique' && <div className="table-wrap"><table><thead><tr><th>DATE</th><th>ÉVÉNEMENT</th><th>DETAIL</th><th>MONTANT</th></tr></thead><tbody>{selectedClient.invoices.length ? selectedClient.invoices.map((invoice) => <tr key={`${invoice.invoice_number}-history`}><td>{new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</td><td>{invoice.status === 'PAID' ? 'Facture réglée' : invoice.status === 'OVERDUE' ? 'Facture en retard' : invoice.status === 'PARTIALLY_PAID' ? 'Paiement partiel' : 'Facture créée'}</td><td>{invoice.invoice_number}</td><td>{invoice.total.toLocaleString('fr-FR')} FCFA</td></tr>) : <tr><td colSpan={4} className="muted-cell">Aucun historique disponible pour ce client.</td></tr>}</tbody></table></div>}{clientHistoryBusy && <p className="muted-cell">Chargement de l’historique...</p>}</div></div>}
    {selectedProduct && <div className="modal-backdrop" onClick={() => setSelectedProduct(null)}><div className="invoice-modal client-detail-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header invoice-detail-header"><div><p className="eyebrow">FICHE PRODUIT</p><h2>{selectedProduct.product?.name ?? 'Produit'}</h2><p className="invoice-detail-date">{selectedProduct.product?.product_type === 'product' ? 'Produit' : 'Service'} · {selectedProduct.product?.active === false ? 'Inactif' : 'Actif'}</p></div><div className="invoice-detail-header-actions"><span className={`client-active-badge ${selectedProduct.product?.active === false ? 'archived' : ''}`}>{selectedProduct.product?.active === false ? 'Inactif' : 'Actif'}</span><button className="icon-button" onClick={() => setSelectedProduct(null)} aria-label="Fermer"><X size={20} /></button></div></div><div className="invoice-detail-parties client-contact-card"><div className="invoice-party"><span className="invoice-party-label">CARACTÉRISTIQUES</span><strong>{selectedProduct.product?.reference ?? 'Sans référence'}</strong>    <span>{productCategoryLabels[selectedProduct.product?.category ?? 'other'] ?? 'Autre'}{selectedProduct.product?.sub_category ? ` · ${selectedProduct.product.sub_category}` : ''}</span>    <span>{selectedProduct.product?.unit ?? 'unité'}</span>{selectedProduct.product?.image_url && <img src={selectedProduct.product.image_url} alt={`Image de ${selectedProduct.product.name}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10 }} />}</div><div className="invoice-party"><span className="invoice-party-label">PRIX ET STOCK</span><strong>{selectedProduct.product?.price.toLocaleString('fr-FR') ?? '0'} FCFA</strong><span>Prix d’achat : {selectedProduct.product?.purchase_price.toLocaleString('fr-FR') ?? '0'} FCFA</span>    <span>{selectedProduct.product?.product_type === 'product' ? `Stock : ${selectedProduct.product.stock_quantity} · seuil : ${selectedProduct.product.low_stock_threshold}` : 'Stock non applicable pour un service'}</span></div></div><div className="invoice-detail-section-heading client-summary-heading"><h3>Utilisation commerciale</h3><span>Historique de vente</span></div><div className="stats-grid report-stats"><StatCard title="Quantité vendue" value={selectedProduct.totalSold.toLocaleString('fr-FR')} suffix="unités" change="ventes enregistrées" trend="up" icon={<Package size={20} />} tone="blue" /><StatCard title="CA généré" value={selectedProduct.totalRevenue.toLocaleString('fr-FR')} suffix="FCFA" change="sur toutes factures" trend="up" icon={<WalletCards size={20} />} tone="green" /><StatCard     title="Stock actuel" value={selectedProduct.product?.product_type === 'product' ? selectedProduct.product.stock_quantity.toLocaleString('fr-FR') : '—'} suffix={selectedProduct.product?.product_type === 'product' ? 'unités' : ''} change={selectedProduct.product?.product_type === 'product' && selectedProduct.product.stock_quantity <= (selectedProduct.product.low_stock_threshold ?? 0) ? 'Alerte stock' : selectedProduct.product?.product_type === 'product' ? 'Correct' : 'Non applicable'} trend={selectedProduct.product?.product_type === 'product' && selectedProduct.product.stock_quantity <= (selectedProduct.product.low_stock_threshold ?? 0) ? 'down' : 'up'} icon={<Package size={20}  />} tone="orange" /></div><div className="table-wrap"><table><thead><tr><th>FACTURE</th><th>CLIENT</th><th>DATE</th><th>QTE</th><th>MONTANT</th><th>STATUT</th></tr></thead><tbody>{selectedProduct.usage.length ? selectedProduct.usage.map((entry) => <tr key={`${entry.invoice_number}-${entry.issue_date}`}><td className="invoice-number">{entry.invoice_number}</td><td>{entry.client_name}</td><td>{new Date(entry.issue_date).toLocaleDateString('fr-FR')}</td><td>{entry.quantity}</td><td>{entry.total.toLocaleString('fr-FR')} FCFA</td><td><span className={`invoice-status invoice-status-${entry.status.toLowerCase()}`}>{entry.status === 'PAID' ? 'Payée' : entry.status === 'CANCELLED' ? 'Annulée' : entry.status === 'PARTIALLY_PAID' ? 'Partiellement payée' : entry.status === 'OVERDUE' ? 'En retard' : 'En attente'}</span></td></tr>) : <tr><td colSpan={6} className="muted-cell">Aucune vente enregistrée pour ce produit.</td></tr>}</tbody></table></div>{productHistoryBusy && <p className="muted-cell">Chargement de l’historique...</p>}</div></div>}    {selectedInvoice && <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}><div className="invoice-modal invoice-detail-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header invoice-detail-header"><div><p className="eyebrow">DÉTAIL DE LA FACTURE</p><h2>{selectedInvoice.invoice_number}</h2><p className="invoice-detail-date">Émise le {new Date(selectedInvoice.issue_date).toLocaleDateString('fr-FR')}</p></div>    <div className="invoice-detail-header-actions"><div className="invoice-detail-actions"><button type="button" className="action-button" onClick={() => onPrint(selectedInvoice.invoice_number)} title="Imprimer la facture"><FileText size={14} /><span>Imprimer</span></button><button type="button" className="action-button" onClick={() => onDownload(selectedInvoice.invoice_number)} title="Télécharger le PDF"><Download size={14} /><span>PDF</span></button>{canEmail && <button type="button" className="action-button" onClick={() => void onEmail(selectedInvoice.invoice_number)} title="Envoyer la facture"><Mail size={14} /><span>Envoyer</span></button>}</div><span className={`invoice-status invoice-status-${selectedInvoice.status.toLowerCase()}`}>{selectedInvoice.status === 'PAID' ? 'Payée' : selectedInvoice.status === 'CANCELLED' ? 'Annulée' : selectedInvoice.status === 'PARTIALLY_PAID' ? 'Partiellement payée' : 'En attente'}</span><button className="icon-button" onClick={() => setSelectedInvoice(null)} aria-label="Fermer"><X size={20} /></button></div>    </div><div className="invoice-detail-parties"><div className="invoice-party"><span className="invoice-party-label">ÉMETTEUR</span><strong>FactureFacile Bénin</strong><span>Document commercial</span></div><div className="invoice-party"><span className="invoice-party-label">FACTURÉ À</span><strong>{Array.isArray(selectedInvoice.clients) ? selectedInvoice.clients[0]?.name : selectedInvoice.clients?.name ?? 'Client supprimé'}</strong><span>{Array.isArray(selectedInvoice.clients) ? selectedInvoice.clients[0]?.email ?? selectedInvoice.clients[0]?.phone ?? 'Coordonnées non renseignées' : selectedInvoice.clients?.email ?? selectedInvoice.clients?.phone ?? 'Coordonnées non renseignées'}</span></div></div><div className="invoice-detail-meta"><div><span>CLIENT</span><strong>{Array.isArray(selectedInvoice.clients) ? selectedInvoice.clients[0]?.name : selectedInvoice.clients?.name ?? 'Client supprimé'}</strong></div><div><span>TYPE DE DOCUMENT</span><strong>{invoiceDocumentTypeLabels[selectedInvoice.invoice_type] ?? invoiceDocumentTypeLabels.STANDARD}</strong></div><div><span>ÉCHÉANCE</span><strong>{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString('fr-FR') : 'Non définie'}</strong></div></div><div className="invoice-detail-section"><div className="invoice-detail-section-heading"><h3>Articles et services</h3><span>{selectedInvoice.invoice_items.length} ligne{selectedInvoice.invoice_items.length > 1 ? 's' : ''}</span></div>    <div className="invoice-detail-lines"><table className="invoice-items-table"><thead><tr><th>DÉSIGNATION</th><th>QUANTITÉ</th><th>PRIX UNITAIRE</th><th>TOTAL</th></tr></thead><tbody>{selectedInvoice.invoice_items.map((item) => <tr key={`${item.description}-${item.quantity}`}><td>{item.description}</td><td>{item.quantity}</td><td>{item.unit_price.toLocaleString('fr-FR')} FCFA</td><td>{item.total.toLocaleString('fr-FR')} FCFA</td></tr>)}</tbody></table></div></div><div className="invoice-detail-summary"><p><span>Sous-total</span><strong>{selectedInvoice.subtotal.toLocaleString('fr-FR')} FCFA</strong></p><p><span>Remise</span><strong>- {selectedInvoice.discount.toLocaleString('fr-FR')} FCFA</strong></p><p><span>Taxes</span><strong>{selectedInvoice.tax.toLocaleString('fr-FR')} FCFA</strong></p><p className="invoice-detail-total"><span>Total à payer</span><strong>{selectedInvoice.total.toLocaleString('fr-FR')} FCFA</strong></p><p className="invoice-detail-paid"><span>Déjà payé</span><strong>{selectedInvoice.payments.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString('fr-FR')} FCFA</strong></p><p className="invoice-detail-remaining"><span>Reste à payer</span><strong>{Math.max(0, selectedInvoice.total - selectedInvoice.payments.reduce((sum, payment) => sum + payment.amount, 0)).toLocaleString('fr-FR')} FCFA</strong></p></div><div className="invoice-detail-section payment-history"><div className="invoice-detail-section-heading"><h3>Historique des paiements</h3><span>{selectedInvoice.payments.length} paiement{selectedInvoice.payments.length > 1 ? 's' : ''}</span></div>{selectedInvoice.payments.length ? selectedInvoice.payments.map((payment) => <div className="payment-history-row" key={`${payment.payment_date}-${payment.amount}`}><span>{new Date(payment.payment_date).toLocaleDateString('fr-FR')}</span><span>    {payment.method === 'mobile_money' ? 'Mobile Money' : payment.method === 'bank_transfer' ? 'Virement bancaire' : payment.method === 'card' ? 'Carte bancaire' : 'Espèces'}</span><strong>{payment.amount.toLocaleString('fr-FR')} FCFA</strong></div>) : <p className="muted-cell">Aucun paiement enregistré.</p>}</div>{canEdit && !['PAID', 'PARTIALLY_PAID', 'CANCELLED'].includes(selectedInvoice.status) && <form className="invoice-detail-edit" onSubmit={saveInvoiceDetail}><div className="invoice-detail-section-heading"><h3>Modifier la facture</h3></div><div className="invoice-detail-edit-grid"><label>Date de facture<input type="date" value={selectedInvoice.issue_date} onChange={(event) => setSelectedInvoice({ ...selectedInvoice, issue_date: event.target.value })} /></label><label>Date d’échéance<input type="date" value={selectedInvoice.due_date ?? ''} onChange={(event) => setSelectedInvoice({ ...selectedInvoice, due_date: event.target.value })} /></label><label>Remise<input type="number" min="0" value={selectedInvoice.discount} onChange={(event) => setSelectedInvoice({ ...selectedInvoice, discount: Number(event.target.value) })} /></label></div><button className="primary-button" disabled={invoiceDetailBusy}>{invoiceDetailBusy ? 'Enregistrement...' : 'Enregistrer les modifications'}</button></form>}</div></div>}
    {selectedInvoiceHistory && <div className="modal-backdrop" onClick={() => setSelectedInvoiceHistory(null)}>
      <div className="invoice-modal invoice-detail-modal invoice-history-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header invoice-detail-header">
          <div><p className="eyebrow">SUIVI DE FACTURE</p><h2>{selectedInvoiceHistory.invoice_number}</h2><p className="invoice-detail-date">Échéance : {selectedInvoiceHistory.due_date ? new Date(`${selectedInvoiceHistory.due_date}T00:00:00`).toLocaleDateString('fr-FR') : 'Non définie'}</p></div>
          <button className="icon-button" onClick={() => setSelectedInvoiceHistory(null)} aria-label="Fermer"><X size={20} /></button>
        </div>
        {invoiceHistoryError && <div className="data-warning" role="alert">L’historique n’est pas disponible : {invoiceHistoryError}. Vérifiez que la migration de suivi des factures a été appliquée.</div>}
        <div className="invoice-fiscal-warning" role="note"><strong>Validation avant production</strong><span>Faites confirmer par un professionnel qualifié au Bénin les mentions obligatoires et le processus fiscal applicable. Le document généré ne constitue pas une attestation de conformité.</span></div>
        <section className="invoice-detail-section">
          <div className="invoice-detail-section-heading"><h3>Envois et relances</h3><span>{invoiceCommunicationHistory.length} événement(s)</span></div>
          {invoiceHistoryBusy ? <p className="muted-cell">Chargement de l’historique…</p> : invoiceCommunicationHistory.length ? <div className="invoice-history-list">{invoiceCommunicationHistory.map((event) => <div className="invoice-history-entry" key={event.id}>
            <div><strong>{event.event_type === 'overdue_reminder' ? 'Relance d’échéance' : 'Envoi de la facture'}</strong><span>{new Date(event.created_at).toLocaleString('fr-FR')} · {event.recipient ?? 'Destinataire non renseigné'}</span></div>
            <span className={`invoice-history-status ${event.status}`}>{event.status === 'accepted' ? 'Accepté par le service e-mail' : 'Échec'}</span>
          </div>)}</div> : <p className="muted-cell">Aucun envoi ou relance enregistré pour cette facture.</p>}
          <p className="invoice-history-footnote">« Accepté » signifie que le prestataire e-mail a accepté la demande; cela ne confirme pas la livraison ni la lecture par le destinataire.</p>
        </section>
        <section className="invoice-detail-section">
          <div className="invoice-detail-section-heading"><h3>Modifications de la facture</h3><span>{invoiceAuditHistory.length} événement(s)</span></div>
          {invoiceHistoryBusy ? <p className="muted-cell">Chargement de l’historique…</p> : invoiceAuditHistory.length ? <div className="invoice-history-list">{invoiceAuditHistory.map((event) => <div className="invoice-history-entry" key={event.id}>
            <div><strong>{event.action === 'INSERT' ? 'Facture créée' : event.action === 'UPDATE' ? 'Facture modifiée' : 'Facture supprimée'}</strong><span>{new Date(event.created_at).toLocaleString('fr-FR')}</span>{event.changed_fields?.length ? <small>Champs : {event.changed_fields.map(invoiceFieldLabel).join(', ')}</small> : null}</div>
          </div>)}</div> : <p className="muted-cell">Aucune modification enregistrée pour cette facture.</p>}
          <p className="invoice-history-footnote">Le journal conserve l’action, la date et les noms des champs modifiés, sans enregistrer les anciennes ou nouvelles valeurs.</p>
        </section>
      </div>
    </div>}
    {page !== 'Produits & Services' && page !== 'Stock' && <div className="module-heading"><div><p className="eyebrow">GESTION DE L'ACTIVITÉ</p><h1>{data.title}</h1><p>{data.description}</p></div>{canEdit && page !== 'Historique automatisation' && <button className="primary-button" onClick={page === 'Factures' ? onCreate : page === 'Dépenses' ? () => { setEditingExpenseRecord(null); setExpenseEditorOpen(true); setModuleError(''); setActionMessage('') } : () => { setEditingId(''); setShowForm(true) }}><Plus size={18} />{data.action}</button>}</div>}
    {page !== 'Produits & Services' && page !== 'Stock' && moduleError && <div className="data-warning">{moduleError}</div>}{page !== 'Produits & Services' && page !== 'Stock' && actionMessage && <div className="settings-message">{actionMessage}</div>}{page === 'Historique automatisation' && <AutomationHistoryPanel businessId={businessId} canEdit={canEdit} onOpenInvoice={(invoiceNumber) => void openInvoiceDetail(invoiceNumber)} />}    {page === 'Factures' && <div className="stats-grid report-stats">
      <StatCard title="Montant total" value={invoiceStats.total.toLocaleString('fr-FR')} suffix={currency} change={`${allFilteredRows.length} facture(s)`} trend="up" icon={<WalletCards size={20} />} tone="blue" />
      <StatCard title="Panier moyen" value={invoiceStats.average.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} suffix={currency} change="par facture" trend="up" icon={<Activity size={20} />} tone="purple" />
      <StatCard title="Factures payées" value={String(invoiceStats.paid)} change="encaissées" trend="up" icon={<TrendingUp size={20} />} tone="green" />
      <StatCard title="En retard" value={String(invoiceStats.overdue)} change="à relancer" trend="down" icon={<AlertTriangle size={20} />} tone="orange" />
      </div>}{page === 'Dépenses' && <div className="stats-grid report-stats">
      <StatCard title="Total des dépenses" value={expenseStats.total.toLocaleString('fr-FR')} suffix={currency} change={`${filteredExpenseRecords.length} opération(s)`} trend="down" icon={<TrendingUp size={20} />} tone="orange" />
      <StatCard title="Dépense moyenne" value={expenseStats.average.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} suffix={currency} change="par opération" trend="down" icon={<WalletCards size={20} />} tone="blue" />
      <StatCard title="Dépense maximale" value={expenseStats.largest.toLocaleString('fr-FR')} suffix={currency} change="opération la plus élevée" trend="down" icon={<AlertTriangle size={20} />} tone="purple" />
      <StatCard title="Catégories utilisées" value={String(expenseStats.categories)} change="sur la période filtrée" trend="up" icon={<Activity size={20} />} tone="green" />
      </div>}{page === 'Clients' && <>
      <div className="stats-grid report-stats">
      <StatCard title="Clients actifs" value={String(clientPortfolio.activeClients)} change="personnes de contact actives" trend="up" icon={<Users size={20} />} tone="blue" />
      <StatCard title="Impayés" value={String(clientPortfolio.unpaidClients)} change="clients avec solde restant" trend="down" icon={<AlertTriangle size={20} />} tone="orange" />
      <StatCard title="Total à recouvrer" value={clientPortfolio.totalReceivable.toLocaleString('fr-FR')} suffix="FCFA" change="solde restant" trend="down" icon={<WalletCards size={20} />} tone="green" />
      <StatCard title="Clients archivés" value={String(clientPortfolio.archivedClients)} change="inactifs" trend="up" icon={<ShieldCheck size={20} />} tone="purple" />
      </div>
      <div className="panel">
      <div className="panel-heading">
      <div>
      <h2>Portfolio client</h2>
      <p>Segmentation commerciale, activité et alertes.</p>
      </div>
      </div>
      <div className="quick-actions-grid">
      <div className="quick-action-button">
      <span>Particuliers</span>
      <strong>{clientPortfolio.individualClients}</strong>
      </div>
      <div className="quick-action-button">
      <span>Entreprises</span>
      <strong>{clientPortfolio.companyClients}</strong>
      </div>
      <div className="quick-action-button">
      <span>VIP</span>
      <strong>{clientPortfolio.vipClients}</strong>
      </div>
      <div className="quick-action-button">
      <span>À surveiller</span>
      <strong>{clientPortfolio.unpaidClients}</strong>
      </div>
      </div>
      </div>
      <div className="panel module-toolbar" style={{ marginTop: '1rem' }}>
      <div className="toolbar-actions">
      <select className="outline-button" value={clientFilters.type} onChange={(event) => setClientFilters((current) => ({ ...current, type: event.target.value as 'Tous' | 'Particulier' | 'Entreprise'}))}>
      <option value="Tous">Tous types</option>
      <option value="Particulier">Particulier</option>
      <option value="Entreprise">Entreprise</option>
      </select>
      <select className="outline-button" value={clientFilters.status} onChange={(event) => setClientFilters((current) => ({ ...current, status: event.target.value as 'Tous' | 'Actif' | 'Archivé'}))}>
      <option value="Tous">Tous statuts</option>
      <option value="Actif">Actifs</option>
      <option value="Archivé">Archivés</option>
      </select>
      <select className="outline-button" value={clientFilters.balance} onChange={(event) => setClientFilters((current) => ({ ...current, balance: event.target.value as 'Tous' | 'À payer' | 'Régler'}))}>
      <option value="Tous">Tous soldes</option>
      <option value="À payer">À payer</option>
      <option value="Régler">Régler</option>
      </select>
      </div>
      </div>
      </>}    {page !== 'Clients' && page !== 'Factures récurrentes' && page !== 'Paiements' && page !== 'Historique automatisation' && <div className="panel module-table">
      <div className="module-toolbar">    <label className="search-box">
      <Search size={17} />
      <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Rechercher ${page.toLowerCase()}...`} />
      </label>{page === 'Produits & Services' && <div className="toolbar-actions product-filters">
      <select className="outline-button" value={productTypeFilter} onChange={(event) => setProductTypeFilter(event.target.value)}>
      <option value="Tous">Tous types</option>
      <option value="product">Produits</option>
      <option value="service">Services</option>
      </select>
      <select className="outline-button" value={productCategoryFilter} onChange={(event) => setProductCategoryFilter(event.target.value)}>
      <option value="Toutes">Toutes catégories</option>{Object.entries(productCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select className="outline-button" value={productStatusFilter} onChange={(event) => setProductStatusFilter(event.target.value)}>
      <option value="Tous">Tous statuts</option>
      <option value="Actif">Actifs</option>
      <option value="Inactif">Inactifs</option>
      </select>
      <label className="stock-filter">
      <input type="checkbox" checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} /> Stock faible</label>    </div>}{page === 'Dépenses' && <div className="toolbar-actions expense-filters">
      <select className="outline-button" value={expenseCategoryFilter} onChange={(event) => setExpenseCategoryFilter(event.target.value)} aria-label="Filtrer les dépenses par catégorie">
      <option value="Toutes">Toutes catégories</option>    <option value="office">Bureau</option>
      <option value="rent">Loyer</option>
      <option value="supplies">Fournitures</option>
      <option value="transport">Transport</option>
      <option value="salary">Salaires</option>
      <option value="tax">Taxes</option>
      <option value="marketing">Marketing</option>
      <option value="other">Autre</option>
      </select>
      <label className="date-filter">Du <input type="date" value={expenseFromDate} onChange={(event) => setExpenseFromDate(event.target.value)} />
      </label>
      <label className="date-filter">Au <input type="date" value={expenseToDate} onChange={(event) => setExpenseToDate(event.target.value)} />
      </label>
      </div>}<div className="toolbar-actions">          <button className="outline-button" onClick={() => page === 'Produits & Services' ? downloadCsv('catalogue-produits.csv', productExportHeaders, productExportRows(filteredProductRecords)) : page === 'Dépenses' ? downloadCsv('depenses.csv', ['DÉSIGNATION', 'CATÉGORIE', 'DATE', `MONTANT (${currency})`, 'FOURNISSEUR', 'MOYEN DE PAIEMENT', 'JUSTIFICATIF'], filteredExpenseRecords.map((expense) => expenseTableRow(expense, currency))) : downloadCsv(`${page.toLowerCase().replaceAll(' ', '-')}.csv`, data.columns, filteredRows)}     disabled={page === 'Produits & Services' ? !filteredProductRecords.length || loading : page === 'Dépenses' ? !filteredExpenseRecords.length || loading : !filteredRows.length || loading || (page === 'Factures' && Boolean(moduleError))}>Exporter CSV</button>{page === 'Dépenses' && <>
      <button className="outline-button" onClick={exportExpensesExcel} disabled={!filteredExpenseRecords.length}>Exporter Excel</button>
      <button className="outline-button" onClick={() => void exportExpensesPdf()} disabled={!filteredExpenseRecords.length}>Exporter PDF</button>
      </>}{page === 'Produits & Services' && <>
      <button className="outline-button" disabled={!filteredProductRecords.length} onClick={() => { const sheet = XLSX.utils.aoa_to_sheet([productExportHeaders, ...productExportRows(filteredProductRecords)]); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Catalogue'); XLSX.writeFile(workbook, 'catalogue-produits.xlsx') }}>Exporter Excel</button>
      <button className="outline-button" disabled={!filteredProductRecords.length} onClick={() => void exportProductsPdf()}>Exporter PDF</button>
      </>    }{page === 'Factures' && <select className="outline-button" value={invoiceStatusFilter} onChange={(event) => setInvoiceStatusFilter(event.target.value)} aria-label="Filtrer les factures par statut">
      <option>Toutes</option>
      <option>Payée</option>
      <option>En attente</option>
      <option>En retard</option>
      <option>Annulée</option>
      </select>}{page === 'Stock' && <>
      <button className="outline-button" onClick={exportStockExcel} disabled={!allFilteredRows.length}>Exporter Excel</button>
      <button className="outline-button" onClick={() => void exportStockPdf()} disabled={!allFilteredRows.length}>Exporter PDF</button>
      </>}</div>
      </div>
      <div className="table-wrap">
      <table>
      <thead>
      <tr>{page === 'Produits & Services' && <th className="table-index-column">N°</th>}{data.columns.map((column) => <th key={column}>{column}</th>)}{(page === 'Factures' || page === 'Clients' || page === 'Produits & Services') && <th>ACTION</th>}</tr>
      </thead>
      <tbody>{loading ? <tr>
      <td colSpan={data.columns.length + ((page === 'Factures' || page === 'Clients' || page === 'Produits & Services') ? 1 : 0) + (page === 'Produits & Services' ? 1 : 0)}>Chargement des données...</td>
      </tr> : page === 'Factures' && moduleError ? <tr><td colSpan={data.columns.length + 1}>Les factures ne sont pas disponibles. Corrigez l’erreur affichée puis réessayez.</td></tr> : filteredRows.length ?     filteredRows.map((row, rowIndex) =>     <tr key={page === 'Produits & Services' ? pagedProductRecords[rowIndex]?.id ?? `product-row-${rowIndex}` : `${row[0]}-${rowIndex}`}>{page === 'Produits & Services' && <td className="table-index-cell">{(productPage - 1) * productsPerPage + rowIndex + 1}</td>}{(page === 'Factures récurrentes' ? row.slice(1) : row).map((cell, index) => <td className={index === 0 ? 'invoice-number' : (page === 'Factures récurrentes' ? index === row.length - 2 : index === row.length - 1) ? 'module-badge' : ''} key={page === 'Produits & Services' ? `${pagedProductRecords[rowIndex]?.id ?? rowIndex}-${index}` : `${rowIndex}-${index}`}>{page === 'Factures récurrentes' && index === row.length - 2 ? <>
      <span>{cell}</span> {canEdit && <button className="outline-button" onClick={() => void (async () => { try { setModuleError(''); await toggleRecurringInvoice(businessId, row[0], cell === 'Inactive');     setRows((await loadRecurringInvoices(businessId)).map((item) => [item.clientName, item.productName, `${item.amount.toLocaleString('fr-FR')} ${currency}`, item.frequency === 'monthly' ? 'Mensuelle' : item.frequency === 'quarterly' ? 'Trimestrielle' : item.frequency === 'yearly' ? 'Annuelle' : 'Hebdomadaire', new Date(item.nextIssueDate).toLocaleDateString('fr-FR'), item.active ? 'Active' : 'Inactive'])) } catch (error) { setModuleError(error instanceof Error ? error.message : 'Impossible de modifier la récurrence.') } })()}>{cell === 'Active' ? 'Désactiver' : 'Activer'}</button>}</> : page === 'Dépenses' && index === 6 && pagedExpenseRecords[rowIndex]?.receipt_path ? <button type="button" className="action-button" onClick={() => void openExpenseReceipt(pagedExpenseRecords[rowIndex])}>Ouvrir</button> : cell}</td>)}{page === 'Factures' &&         <td>
      <div className="row-actions">
      <button className="action-button action-button-primary" onClick={() => void openInvoiceDetail(row[0])} aria-label={`Voir ${row[0]}`} title="Voir le détail">
      <Eye size={15} />
      <span>Voir</span>
      </button>    <button type="button" className="action-button" onClick={() => onPrint(row[0])} aria-label={`Imprimer ${row[0]}`} title="Imprimer">
      <FileText size={15} />
      <span>Imprimer</span>
      </button>
      <button className="action-button" onClick={() => onDownload(row[0])} aria-label={`Télécharger ${row[0]}`} title="Télécharger en PDF">
      <Download size={15} />
      <span>PDF</span>
      </button>{canEmail &&     <button className="action-button" onClick={() => void (async () => { setActionMessage(''); try { const result = await onEmail(row[0]); setActionMessage(result.message) } catch (error) { setActionMessage(error instanceof Error ? error.message : 'La facture n’a pas pu être envoyée.') } })()} aria-label={`Envoyer ${row[0]} par email`} title="Envoyer par email">
      <Mail size={15} />
      <span>Envoyer</span>
      </button>}{canEdit &&     <button className="action-button action-button-danger" onClick={() => requestInvoiceCancellation(row[0])} aria-label={`Annuler ${row[0]}`} title="Annuler">
      <Trash2 size={15} />
      <span>Annuler</span>
      </button>}</div>
      </td>    }{(page === 'Clients' || page === 'Produits & Services') && <td>{page === 'Clients' && <button className="row-menu" onClick={() => void openClientHistory(clientRecords.find((item) => item.name === row[0])?.id ?? '')} aria-label={`Voir l’historique de ${row[0]}`} title="Voir l’historique">
      <Eye size={17} />
      </button>}{page === 'Produits & Services' &&       <button className="row-menu" onClick={() => void openProductHistory(pagedProductRecords[rowIndex]?.id ?? '')} aria-label={`Voir le détail du produit ${row[0]}`} title="Détail produit">
      <Package size={17} />
      </button>}{canEdit && <>
      <button className="outline-button" onClick={() => startEdit(page === 'Clients' ? clientRecords.find((item) => item.name === row[0])! : pagedProductRecords[rowIndex]!)}>Modifier</button>
      <button className="row-menu" onClick={() => void removeRecord(page === 'Clients' ? clientRecords.find((item) => item.name === row[0])! : pagedProductRecords[rowIndex]!)}         aria-label={`Supprimer ${row[0]}`} title="Supprimer">
      <Trash2 size={16} />
      </button>
      </>}</td>}</tr>) : <tr>
      <td colSpan={data.columns.length + ((page === 'Factures' || page === 'Clients' || page === 'Produits & Services') ? 1 : 0)}>Aucun résultat.</td>
      </tr>}</tbody>
      </table>
      </div>
      </div>}{page === 'Clients' && <div className="panel module-table">
      <div className="module-toolbar">
      <label className="search-box">
      <Search size={17} />
      <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Rechercher ${page.toLowerCase()}...`} />
      </label>
      <div className="toolbar-actions">
      <button className="outline-button" onClick={() => downloadCsv(`${page.toLowerCase().replaceAll(' ', '-')}.csv`, data.columns, filteredRows)} disabled={!filteredRows.length || loading}>Exporter CSV</button>
      </div>
      </div>
      <div className="table-wrap">
      <table>
      <thead>
      <tr>{data.columns.map((column) => <th key={column}>{column}</th>)}<th>ACTION</th>
      </tr>
      </thead>
      <tbody>{loading ? <tr>
      <td colSpan={data.columns.length + 1}>Chargement des données...</td>
      </tr> : filteredRows.length ? filteredRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td className={index === 0 ? 'invoice-number' : index === row.length - 1 ? 'module-badge' : ''} key={`${row[0]}-${cell}`}>{cell}</td>)}<td>
      <div className="row-actions">
      <button className="row-menu" onClick={() => void openClientHistory(clientRecords.find((item) => item.name === row[0])?.id ?? '')} aria-label={`Voir l’historique de ${row[0]}`} title="Voir l’historique">
      <Eye size={17} />
      </button>{canEdit && <>
      <button className="outline-button" onClick={() => startEdit(clientRecords.find((item) => item.name === row[0])!)}>Modifier</button>
      <button className="row-menu" onClick={() => void removeRecord(clientRecords.find((item) => item.name === row[0])!)} aria-label={`Supprimer ${row[0]}`} title="Supprimer">
      <Trash2 size={16} />
      </button>
      </>}</div>
      </td>
      </tr>) : <tr>
      <td colSpan={data.columns.length + 1}>Aucun résultat.</td>
      </tr>}</tbody>
      </table>
      </div>
      </div>}
    {page === 'Dépenses' && canEdit && pagedExpenseRecords.length > 0 && (
      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-heading">
          <div>
            <h2>Actions sur les dépenses</h2>
            <p>Modifiez ou supprimez une dépense enregistrée.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DÉSIGNATION</th>
                <th>CATÉGORIE</th>
                <th>MONTANT</th>
                <th>DATE</th>
                <th>FOURNISSEUR</th>
                <th>MOYEN DE PAIEMENT</th>
                <th>JUSTIFICATIF</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {pagedExpenseRecords.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.label}</td>
                  <td>{getExpenseCategoryLabel(expense.category)}</td>
                  <td>{expense.amount.toLocaleString('fr-FR')} {currency}</td>
                  <td>{new Date(expense.expense_date).toLocaleDateString('fr-FR')}</td>
                  <td>{expense.supplier_name || '—'}</td>
                  <td>{expensePaymentMethodLabel(expense.payment_method)}</td>
                  <td>{expense.receipt_path
                    ? <button type="button" className="outline-button" onClick={() => void openExpenseReceipt(expense)}>Ouvrir</button>
                    : <span className="muted-cell">Non fourni</span>}</td>
                  <td>
                    <div className="inline-actions">
                      <button className="outline-button" onClick={() => editExpense(expense)}>Modifier</button>
                      <button className="danger-button" onClick={() => void confirmDeleteExpense(expense.id)} disabled={busy}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
    {deleteCandidate && <div className="modal-backdrop" onClick={() => !busy && setDeleteCandidate(null)}><div className="invoice-modal delete-modal" onClick={(event) => event.stopPropagation()}><div className="delete-modal-icon"><Trash2 size={22} /></div><div className="modal-header"><div><p className="eyebrow">CONFIRMATION REQUISE</p><h2>Supprimer définitivement ?</h2></div><button className="icon-button" onClick={() => setDeleteCandidate(null)} aria-label="Fermer"><X size={20} /></button></div><p className="delete-warning">Cette action supprimera <strong>« {deleteCandidate.name} »</strong>. Les données supprimées ne pourront pas être récupérées.</p><label>Pour confirmer, saisissez exactement le nom<input autoFocus value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={deleteCandidate.name} /></label><div className="delete-modal-actions"><button className="outline-button" onClick={() => setDeleteCandidate(null)} disabled={busy}>Annuler</button><button className="danger-button" onClick={() => void confirmRemoveRecord()} disabled={busy || deleteConfirmation.trim() !== deleteCandidate.name}>{busy ? 'Suppression...' : 'Supprimer définitivement'}</button></div></div></div>}
    {cancelCandidate && <div className="modal-backdrop" onClick={() => !busy && setCancelCandidate('')}><div className="invoice-modal delete-modal" onClick={(event) => event.stopPropagation()}><div className="delete-modal-icon"><Trash2 size={22} /></div><div className="modal-header"><div><p className="eyebrow">ACTION IRRÉVERSIBLE</p><h2>Annuler cette facture ?</h2></div><button className="icon-button" onClick={() => setCancelCandidate('')} aria-label="Fermer"><X size={20} /></button></div><p className="delete-warning">La facture <strong>{cancelCandidate}</strong> sera marquée comme annulée et ne pourra plus recevoir de paiement.</p><label>Pour confirmer, saisissez exactement le numéro<input autoFocus value={cancelConfirmation} onChange={(event) => setCancelConfirmation(event.target.value)} placeholder={cancelCandidate} /></label><div className="delete-modal-actions"><button className="outline-button" onClick={() => setCancelCandidate('')} disabled={busy}>Garder la facture</button><button className="danger-button" onClick={() => void confirmInvoiceCancellation()} disabled={busy || cancelConfirmation.trim() !== cancelCandidate}>{busy ? 'Annulation...' : 'Annuler la facture'}</button></div></div></div>}
    {page === 'Stock' && canEdit && rows.length > 0 && <details className="panel stock-delete-details"><summary><span>Correction de l’historique</span><small>Suppression réservée au dernier mouvement d’un produit</small></summary><div className="toolbar-actions"><select className="outline-button" value={stockDeleteCandidate} onChange={(event) => { setStockDeleteCandidate(event.target.value); setStockDeleteConfirmation('') }} aria-label="Mouvement à supprimer"><option value="">Sélectionner un mouvement</option>{rows.map((row) => <option value={row[0]} key={row[0]}>{row[0].slice(0, 8).toUpperCase()} · {row[1]} · {row[3]} · {row[4]}</option>)}</select><button className="danger-button" onClick={() => setStockDeleteConfirmation(stockDeleteCandidate ? stockDeleteCandidate : '')} disabled={!stockDeleteCandidate || busy}>Supprimer</button></div></details>}
    {stockDeleteCandidate && stockDeleteConfirmation === stockDeleteCandidate && <div className="modal-backdrop" onClick={() => !busy && setStockDeleteCandidate('')}><div className="invoice-modal delete-modal" onClick={(event) => event.stopPropagation()}><div className="delete-modal-icon"><Trash2 size={22} /></div><div className="modal-header"><div><p className="eyebrow">ACTION IRRÉVERSIBLE</p><h2>Supprimer ce mouvement ?</h2></div><button className="icon-button" onClick={() => setStockDeleteCandidate('')} aria-label="Fermer"><X size={20} /></button></div><p className="delete-warning">Le stock sera recalculé et le mouvement <strong>{stockDeleteCandidate.slice(0, 8).toUpperCase()}</strong> sera supprimé.</p><label>Pour confirmer, saisissez l’identifiant complet<input autoFocus value={stockDeleteConfirmation} onChange={(event) => setStockDeleteConfirmation(event.target.value)} placeholder={stockDeleteCandidate} /></label><div className="delete-modal-actions"><button className="outline-button" onClick={() => setStockDeleteCandidate('')} disabled={busy}>Annuler</button><button className="danger-button" onClick={() => void confirmStockMovementDeletion()} disabled={busy || stockDeleteConfirmation.trim() !== stockDeleteCandidate}>{busy ? 'Suppression...' : 'Supprimer définitivement'}</button></div></div></div>}
    {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}><div className={`invoice-modal ${page === 'Produits & Services' ? 'product-modal' : ''}`} onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">{editingId ? 'MODIFIER' : 'NOUVEL ENREGISTREMENT'}</p><h2>{editingId ? `Modifier ${page === 'Clients' ? 'le client' : page === 'Dépenses' ? 'la dépense' : 'le produit'}` : data.action}</h2></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Fermer"><X size={20} /></button></div>{page === 'Factures récurrentes' ? <><label>Client<select value={recurringClient} onChange={(event) => setRecurringClient(event.target.value)}><option value="">Sélectionner un client</option>{recurringClients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label>Produit ou service<select value={recurringProduct} onChange={(event) => setRecurringProduct(event.target.value)}><option value="">Sélectionner un produit</option>{recurringProducts.map((product) => <option value={product.id} key={product.id}>{product.name} — {product.price.toLocaleString('fr-FR')} FCFA</option>)}</select></label><label>Fréquence<select value={recurringFrequency} onChange={(event) => setRecurringFrequency(event.target.value)}><option value="monthly">Mensuelle</option><option value="quarterly">Trimestrielle</option><option value="yearly">Annuelle</option></select></label><label>Prochaine émission<input type="date" value={recurringDate} onChange={(event) => setRecurringDate(event.target.value)} /></label><label>Délai de paiement (jours)<input type="number" min="0" max="365" value={recurringDueDays} onChange={(event) => setRecurringDueDays(event.target.value)} /></label></> : page === 'Stock' ? <><label>Produit<select value={stockProduct} onChange={(event) => setStockProduct(event.target.value)}><option value="">Sélectionner un produit</option>{stockProducts.map((product) => <option value={product.id} key={product.id}>{product.name} — stock actuel : {product.stock_quantity}</option>)}</select></label><label>Type de mouvement<select value={stockMovementType} onChange={(event) => setStockMovementType(event.target.value as 'in' | 'out' | 'adjustment')}><option value="in">Entrée</option><option value="out">Sortie</option><option value="adjustment">Ajustement</option></select></label><label>Quantité<input type="number" min="0.01" step="0.01" value={stockQuantityValue} onChange={(event) => setStockQuantityValue(event.target.value)} placeholder="10" /></label><label>Note<input value={stockNote} onChange={(event) => setStockNote(event.target.value)} placeholder="Réapprovisionnement, vente..." /></label></>     : page === 'Clients' ? <div className="client-form-grid"><label className="form-field"><span>Nom</span><input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Nom du client" /></label><label className="form-field"><span>Email</span><input type="email" value={formEmail} onChange={(event) => setFormEmail(event.target.value)} placeholder="email@client.com" /></label><label className="form-field"><span>Téléphone</span><input value={formPhone} onChange={(event) => setFormPhone(event.target.value)} placeholder="+229..." /></label><label className="form-field"><span>Type</span><select value={formClientType} onChange={(event) => setFormClientType(event.target.value as 'individual' | 'company')}><option value="individual">Particulier</option><option value="company">Entreprise</option></select></label><label className="form-field full-width"><span>Adresse</span><input value={formAddress} onChange={(event) => setFormAddress(event.target.value)} placeholder="Adresse ou quartier" /></label><label className="form-field"><span>Statut</span><select value={formClientStatus} onChange={(event) => setFormClientStatus(event.target.value as 'active' | 'archived')}><option value="active">Actif</option><option value="archived">Archivé</option></select></label><label className="form-field full-width"><span>Notes</span><textarea value={formClientNotes} onChange={(event) => setFormClientNotes(event.target.value)} placeholder="Informations commerciales ou notes internes..." rows={5} /></label></div> : page === 'Produits & Services' ? <><label>Nom<input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Nom du produit ou service" /></label><label>Référence interne<input value={formReference} onChange={(event) => setFormReference(event.target.value)} placeholder="REF-001" /></label><label>Description<textarea value={formDescription} onChange={(event) => setFormDescription(event.target.value)} placeholder="Description détaillée du produit ou service" /></label><label>Catégorie<select value={formCategory} onChange={(event) => setFormCategory(event.target.value)}><option value="other">Autre</option><option value="digital">Digital</option><option value="service">Service</option><option value="inventory">Stock</option><option value="material">Matériel</option></select></label>    <label>Sous-catégorie<input value={formSubCategory} onChange={(event) => setFormSubCategory(event.target.value)} placeholder="Optionnel" /></label><label>Image produit<input type="file" accept="image/*" onChange={(event) => setProductImageFile(event.target.files?.[0] ?? null)} /></label><label>Unité de mesure<input value={formUnit} onChange={(event) => setFormUnit(event.target.value)} placeholder="unité, heure, kg..." /></label><label>Prix d’achat (FCFA)<input type="number" min="0" value={formPurchasePrice} onChange={(event) => setFormPurchasePrice(event.target.value)} placeholder="25000" /></label><label>Prix de vente (FCFA)<input type="number" min="0" value={formPrice} onChange={(event) => setFormPrice(event.target.value)} placeholder="35000" /></label>    <label>Stock initial<input type="number" min="0" value={stockQuantity} disabled={formType === 'service'} onChange={(event) => setStockQuantity(event.target.value)} placeholder="0" /></label><label>Seuil d'alerte<input type="number" min="0" value={stockThreshold} disabled={formType === 'service'} onChange={(event) => setStockThreshold(event.target.value)} placeholder="5" /></label><label>Type<select value={formType} onChange={(event) => { const nextType = event.target.value as 'service' | 'product'; setFormType(nextType); if (nextType === 'service') { setStockQuantity('0'); setStockThreshold('0') } }}><option value="service">Service</option><option value="product">Produit</option></select></label><label>Statut<select value={formProductStatus} onChange={(event) => setFormProductStatus(event.target.value as 'active' | 'inactive')}><option value="active">Actif</option><option value="inactive">Inactif</option></select></label></> : page === 'Dépenses' ? <><label>Désignation<input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Loyer, fournitures..." /></label><label>Montant (FCFA)<input type="number" min="1" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="50000" /></label><label>Date<input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></label>    <label>Catégorie<select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)}>    <option value="custom">Autre</option><option value="supplies">Fournitures</option><option value="rent">Loyer</option><option value="transport">Transport</option><option value="salary">Salaires</option></select>{expenseCategory === 'custom' && <input value={expenseCustomCategory} onChange={(event) => setExpenseCustomCategory(event.target.value)} placeholder="Précisez la catégorie" required />}</label><label>Notes<input value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} placeholder="Optionnel" /></label></> : <><label>Facture<select value={paymentInvoice} onChange={(event) => setPaymentInvoice(event.target.value)}>    <option value="">Sélectionner une facture</option>{paymentInvoices.map((invoice) => <option value={invoice.id} key={invoice.id}>{invoice.number} — reste {invoice.remaining.toLocaleString('fr-FR')} FCFA (total {invoice.total.toLocaleString('fr-FR')} FCFA)</option>)}</select></label>    <label>Montant (FCFA)<input type="number" min="0.01" step="0.01" required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="50000" /></label><label>Date réelle du paiement<input type="date" max={new Date().toISOString().slice(0, 10)} required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label><label>Méthode<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Espèces</option><option value="mobile_money">Mobile Money</option><option value="bank_transfer">Virement</option><option value="card">Carte</option></select></label><label>Référence<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Optionnel" /></label></>}<button className="primary-button full-width" disabled={busy || (page === 'Paiements' && (!paymentInvoice || !paymentAmount || Number(paymentAmount) <= 0))} onClick={() => void save()}>{busy ? 'Enregistrement...' : 'Enregistrer'}</button></div></div>}
    {page === 'Dépenses' && expenseEditorOpen && <ExpenseEditorModal
      businessId={businessId}
      currency={currency}
      expense={editingExpenseRecord}
      onClose={() => { setExpenseEditorOpen(false); setEditingExpenseRecord(null) }}
      onSaved={async (message) => {
        const expenses = await loadExpenseRecords(businessId)
        setExpenseRecords(expenses)
        setRows(expenses.map((expense) => expenseTableRow(expense, currency)))
        setActionMessage(message)
        setModuleError('')
        setExpenseEditorOpen(false)
        setEditingExpenseRecord(null)
      }}
    />}
  </section>
}

function ReportPage({ businessId, currency }: { businessId: string; currency: string }) {
 const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '180d' | '365d' | 'custom'>('30d')
 const [customFrom, setCustomFrom] = useState('')
 const [customTo, setCustomTo] = useState('')
 const [report, setReport] = useState<{
   summary: { revenue: number; expenses: number; profit: number; invoiceCount: number; paidCount: number; outstanding: number; overdueCount: number; clientCount: number; tax: number; taxableBase: number; previousRevenue: number; previousExpenses: number; previousProfit: number }
   monthly: { month: string; amount: number }[]
   topClients: { name: string; amount: number }[]
   detailClients: { name: string; amount: number; count: number }[]
   topProducts: { name: string; amount: number; quantity: number }[]
   detailProducts: { name: string; amount: number; quantity: number }[]
   statusBreakdown: { status: string; count: number; amount: number }[]
   overdue: { invoice: string; client: string; remaining: number; dueDate: string }[]
   rangeLabel: string
   previousRangeLabel: string
 } | null>(null)
 const [error, setError] = useState('')
 const [loading, setLoading] = useState(true)
 const [reloadKey, setReloadKey] = useState(0)

 useEffect(() => {
   let cancelled = false

   const resolveRange = () => {
     const today = new Date()
     const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
     const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    if (period === 'custom') {
      if (!customFrom || !customTo) {
        return null
      }
      const fromDate = new Date(`${customFrom}T00:00:00`)
      const toDate = new Date(`${customTo}T00:00:00`)
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || customTo < customFrom) {
        throw new Error('La période personnalisée est invalide.')
      }
      return { from: customFrom, to: customTo, label: `${fromDate.toLocaleDateString('fr-FR')} → ${toDate.toLocaleDateString('fr-FR')}` }
    }

    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 }
    const days = daysMap[period] ?? 30
    const start = new Date(end)
    start.setDate(end.getDate() - (days - 1))
    return { from: formatDate(start), to: formatDate(end), label: `${days} jours` }
   }

   const load = async () => {
    setLoading(true)
    setError('')
    try {
      const range = resolveRange()
      if (!range) {
        if (!cancelled) {
          setReport(null)
          setLoading(false)
        }
        return
      }
      const spanDays = Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86400000) + 1
      const previousTo = new Date(`${range.from}T00:00:00Z`)
      previousTo.setUTCDate(previousTo.getUTCDate() - 1)
      const previousFrom = new Date(previousTo)
      previousFrom.setUTCDate(previousFrom.getUTCDate() - spanDays + 1)
      const previousRange = {
        from: previousFrom.toISOString().slice(0, 10),
        to: previousTo.toISOString().slice(0, 10),
        label: `${previousFrom.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} → ${previousTo.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`,
      }

      type ReportInvoice = {
        invoice_number: string
        issue_date: string
        due_date: string | null
        total: number
        subtotal: number
        discount: number
        tax: number
        status: string
        clients: { name: string } | { name: string }[] | null
        payments: { effective_amount: number }[]
        invoice_items: { quantity: number; total: number; products: { name: string } | { name: string }[] | null }[]
      }
      type ReportExpense = { amount: number; expense_date: string; category: string }
      type ReportPayment = { effective_amount: number; payment_date: string }
      const loadAllInvoices = async (dateRange: { from: string; to: string }) => {
        const all: ReportInvoice[] = []
        for (let offset = 0; ; offset += 1000) {
          const result = await supabase.from('invoices')
            .select('invoice_number, issue_date, due_date, subtotal, discount, tax, total, status, clients(name), payments(effective_amount), invoice_items(quantity, total, products(name))')
            .eq('business_id', businessId)
            .gte('issue_date', dateRange.from)
            .lte('issue_date', dateRange.to)
            .order('issue_date', { ascending: true })
            .order('invoice_number', { ascending: true })
            .range(offset, offset + 999)
          if (result.error) throw result.error
          const batch = (result.data ?? []) as ReportInvoice[]
          all.push(...batch)
          if (batch.length < 1000) return all
        }
      }
      const loadAllExpenses = async (dateRange: { from: string; to: string }) => {
        const all: ReportExpense[] = []
        for (let offset = 0; ; offset += 1000) {
          const result = await supabase.from('expenses')
            .select('id, amount, expense_date, category')
            .eq('business_id', businessId)
            .gte('expense_date', dateRange.from)
            .lte('expense_date', dateRange.to)
            .order('expense_date', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + 999)
          if (result.error) throw result.error
          const batch = (result.data ?? []) as ReportExpense[]
          all.push(...batch)
          if (batch.length < 1000) return all
        }
      }
      const loadAllPayments = async (dateRange: { from: string; to: string }) => {
        const all: ReportPayment[] = []
        for (let offset = 0; ; offset += 1000) {
          const result = await supabase.from('payments')
            .select('id, effective_amount, payment_date')
            .eq('business_id', businessId)
            .eq('status', 'reconciled')
            .gte('payment_date', dateRange.from)
            .lte('payment_date', dateRange.to)
            .order('payment_date', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + 999)
          if (result.error) throw result.error
          const batch = (result.data ?? []) as ReportPayment[]
          all.push(...batch)
          if (batch.length < 1000) return all
        }
      }
      const [invoices, expenses, payments, previousExpenses, previousPayments] = await Promise.all([
        loadAllInvoices(range),
        loadAllExpenses(range),
        loadAllPayments(range),
        loadAllExpenses(previousRange),
        loadAllPayments(previousRange),
      ])
      if (cancelled) return

      const monthly = new Map<string, number>()
      const clients = new Map<string, number>()
      const clientCounts = new Map<string, number>()
      const products = new Map<string, { amount: number; quantity: number }>()
      const statuses = new Map<string, { count: number; amount: number }>()
      const overdue: { invoice: string; client: string; remaining: number; dueDate: string }[] = []

      let outstanding = 0
      let invoiceCount = 0
      let paidCount = 0
      let overdueCount = 0
      let taxTotal = 0
      let taxableBaseTotal = 0
      const today = new Date()
      const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      invoices.forEach((invoice) => {
        const total = Number(invoice.total ?? 0)
        const paid = (invoice.payments ?? []).reduce((sum, payment) => sum + Number(payment.effective_amount ?? 0), 0)
        const clientName = Array.isArray(invoice.clients) ? (invoice.clients[0]?.name ?? 'Client supprimé') : (invoice.clients?.name ?? 'Client supprimé')
        const dueDate = invoice.due_date

        if (!['DRAFT', 'CANCELLED'].includes(invoice.status)) {
          taxTotal += Number(invoice.tax ?? 0)
          taxableBaseTotal += Math.max(0, Number(invoice.subtotal ?? 0) - Number(invoice.discount ?? 0))
          invoiceCount += 1
          clients.set(clientName, (clients.get(clientName) ?? 0) + total)
          clientCounts.set(clientName, (clientCounts.get(clientName) ?? 0) + 1)
        }

        if (invoice.status === 'PAID') {
          paidCount += 1
        } else if (!['DRAFT', 'CANCELLED'].includes(invoice.status)) {
          outstanding += Math.max(0, total - paid)
        }

        if (!['DRAFT', 'CANCELLED'].includes(invoice.status)) {
          const statusCurrent = statuses.get(invoice.status ?? 'UNKNOWN') ?? { count: 0, amount: 0 }
          statusCurrent.count += 1
          statusCurrent.amount += total
           statuses.set(invoice.status ?? 'UNKNOWN', statusCurrent)
         }

         if (!['PAID', 'CANCELLED', 'DRAFT'].includes(invoice.status) && dueDate && dueDate < todayDate && total > paid) {
           overdueCount += 1
           overdue.push({ invoice: invoice.invoice_number, client: clientName, remaining: Math.max(0, total - paid), dueDate })
         }

         if (!['DRAFT', 'CANCELLED'].includes(invoice.status)) {
           invoice.invoice_items.forEach((item) => {
             const product = Array.isArray(item.products) ? item.products[0] : item.products
             const productName = product?.name ?? 'Article supprimé'
             const current = products.get(productName) ?? { amount: 0, quantity: 0 }
             current.amount += Number(item.total ?? 0)
             current.quantity += Number(item.quantity ?? 0)
             products.set(productName, current)
           })
         }
       })

       const revenue = payments.reduce((sum, payment) => sum + Number(payment.effective_amount ?? 0), 0)
       payments.forEach((payment) => {
         const month = payment.payment_date.slice(0, 7)
         monthly.set(month, (monthly.get(month) ?? 0) + Number(payment.effective_amount ?? 0))
       })
       const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
       const previousRevenue = previousPayments.reduce((sum, payment) => sum + Number(payment.effective_amount ?? 0), 0)
       const previousExpenseTotal = previousExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
       const reportData = {
         summary: {
           revenue,
           expenses: expenseTotal,
           profit: revenue - expenseTotal,
           tax: taxTotal,
           taxableBase: taxableBaseTotal,
           previousRevenue,
           previousExpenses: previousExpenseTotal,
           previousProfit: previousRevenue - previousExpenseTotal,
           invoiceCount,
           paidCount,
           outstanding,
           overdueCount,
           clientCount: clients.size,
         },
         monthly: Array.from(monthly, ([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)).slice(-6),
         topClients: Array.from(clients, ([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5),
         detailClients: Array.from(clients, ([name, amount]) => ({ name, amount, count: clientCounts.get(name) ?? 0 })).sort((a, b) => b.amount - a.amount),
         topProducts: Array.from(products, ([name, values]) => ({ name, ...values })).sort((a, b) => b.amount - a.amount).slice(0, 5),
         detailProducts: Array.from(products, ([name, values]) => ({ name, ...values })).sort((a, b) => b.amount - a.amount),
         statusBreakdown: Array.from(statuses, ([status, values]) => ({ status, ...values })).sort((a, b) => b.amount - a.amount),
         overdue: overdue.sort((a, b) => b.remaining - a.remaining).slice(0, 6),
         rangeLabel: range.label,
         previousRangeLabel: previousRange.label,
       }

       if (!cancelled) setReport(reportData)
     } catch (reason) {
       if (!cancelled) {
         setReport(null)
         setError(reason instanceof Error ? reason.message : 'Impossible de charger le rapport.')
       }
     } finally {
       if (!cancelled) setLoading(false)
     }
   }

   void load()
   return () => { cancelled = true }
 }, [businessId, period, customFrom, customTo, reloadKey])

 const periodButtons = <div className="report-period-toolbar">{(['7d', '30d', '90d', '180d', '365d', 'custom'] as const).map((option) => <button type="button" key={option} className={`outline-button ${period === option ? 'active' : ''}`} onClick={() => setPeriod(option)}>{option === 'custom' ? 'Personnalisé' : option.toUpperCase()}</button>)}</div>
 const customDateInputs = period === 'custom' && <div className="report-custom-range"><label>Du<input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} /></label><label>Au<input type="date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} /></label></div>
 const rangeControls = <div className="toolbar-actions"><div className="report-range-controls">{periodButtons}{customDateInputs}</div></div>

 if (error) return <section className="module-page report-module"><div className="module-heading"><div><p className="eyebrow">ANALYSE FINANCIÈRE</p><h1>Rapports</h1><p>Une vue claire de la performance de votre entreprise sur la période sélectionnée.</p></div>{rangeControls}</div><div className="data-warning">{error}</div><button type="button" className="outline-button report-retry-button" onClick={() => setReloadKey((current) => current + 1)}>Réessayer</button></section>
 if (loading) return <div className="auth-loading">Chargement du rapport financier...</div>
 if (!report) return <section className="module-page report-module"><div className="module-heading"><div><p className="eyebrow">ANALYSE FINANCIÈRE</p><h1>Rapports</h1><p>Une vue claire de la performance de votre entreprise sur la période sélectionnée.</p></div>{rangeControls}</div><div className="panel report-empty-state"><h2>Choisissez votre période</h2><p>Renseignez les deux dates pour afficher les données du rapport.</p></div></section>

 const exportRows = [
   ['Indicateur', 'Valeur'],
   ['Période', report.rangeLabel],
   ['Chiffre d’affaires encaissé', formatMoney(report.summary.revenue, currency)],
   ['Montant à recouvrer', formatMoney(report.summary.outstanding, currency)],
   ['Dépenses', formatMoney(report.summary.expenses, currency)],
   ['Bénéfice net estimé (encaissements nets moins dépenses saisies)', formatMoney(report.summary.profit, currency)],
   ['Taxe facturée sur les factures émises', formatMoney(report.summary.tax, currency)],
   ['Période précédente comparable', report.previousRangeLabel],
   ['Encaissements nets de la période précédente', formatMoney(report.summary.previousRevenue, currency)],
   ['Dépenses de la période précédente', formatMoney(report.summary.previousExpenses, currency)],
   ['Bénéfice estimé de la période précédente', formatMoney(report.summary.previousProfit, currency)],
   ['Base taxable estimée (sous-total moins remise)', formatMoney(report.summary.taxableBase, currency)],
   ['Factures', `${report.summary.invoiceCount}`],
   ['Factures payées', `${report.summary.paidCount}`],
   ['Factures en retard', `${report.summary.overdueCount}`],
   ...report.monthly.map((row) => [`Encaissements ${row.month}`, formatMoney(row.amount, currency)]),
   ...report.detailClients.map((row) => [`Client : ${row.name} (${row.count} facture(s))`, formatMoney(row.amount, currency)]),
   ...report.detailProducts.map((row) => [`Produit : ${row.name} (${row.quantity} unité(s))`, formatMoney(row.amount, currency)]),
   ...report.statusBreakdown.map((row) => [`Factures ${row.status} (${row.count})`, formatMoney(row.amount, currency)]),
   ...report.overdue.map((row) => [`Impayé : ${row.invoice} · ${row.client} · ${row.dueDate}`, formatMoney(row.remaining, currency)]),
 ]

 const exportPdf = async () => {
   const { jsPDF } = await import('jspdf')
   const pdf = new jsPDF({ orientation: 'portrait' })
   const money = (value: number) => formatMoney(value, currency)
   const header = (title: string) => {
     pdf.setFillColor(25, 55, 95)
     pdf.rect(0, 0, 210, 30, 'F')
     pdf.setTextColor(255, 255, 255)
     pdf.setFontSize(18)
     pdf.text(title, 14, 14)
     pdf.setFontSize(9)
     pdf.text(report.rangeLabel, 14, 23)
     pdf.setTextColor(30, 40, 55)
   }
   header('Rapport financier')
   pdf.setFillColor(240, 245, 250)
   pdf.roundedRect(12, 38, 186, 34, 3, 3, 'F')
   pdf.setFontSize(10)
   pdf.text(`CA encaissé : ${money(report.summary.revenue)}`, 18, 49)
   pdf.text(`Dépenses : ${money(report.summary.expenses)}`, 18, 58)
   pdf.text(`Bénéfice net : ${money(report.summary.profit)}`, 105, 49)
   pdf.text(`À recouvrer : ${money(report.summary.outstanding)}`, 105, 58)
   pdf.text(`Taxe : ${money(report.summary.tax)} · base : ${money(report.summary.taxableBase)}`, 18, 67, { maxWidth: 88 })
   pdf.text(`Période précédente : ${report.previousRangeLabel}`, 105, 67, { maxWidth: 88 })
   let cursor = 91
   const drawSection = (title: string, rows: string[][], widths: number[]) => {
     pdf.setFillColor(232, 238, 246)
     pdf.rect(12, cursor, 186, 8, 'F')
     pdf.setFontSize(10)
     pdf.text(title, 16, cursor + 5.5)
     cursor += 13
     pdf.setFontSize(8)
     rows.forEach((row) => {
       if (cursor > 275) { pdf.addPage(); header('Rapport financier — suite'); cursor = 40 }
       let x = 16
       row.forEach((cell, index) => { pdf.text(cell.slice(0, 42), x, cursor); x += widths[index] })
       cursor += 6
     })
     cursor += 6
   }
   drawSection('Comparaison de périodes', [['Indicateur', 'Période courante', 'Précédente'], ['Encaissements nets', money(report.summary.revenue), money(report.summary.previousRevenue)], ['Dépenses enregistrées', money(report.summary.expenses), money(report.summary.previousExpenses)], ['Bénéfice net estimé', money(report.summary.profit), money(report.summary.previousProfit)]], [55, 65, 65])
   drawSection('Indicateurs et ventilation fiscale', [['Factures émises', String(report.summary.invoiceCount)], ['Factures payées', String(report.summary.paidCount)], ['En retard', String(report.summary.overdueCount)], ['Base taxable estimée', money(report.summary.taxableBase)], ['Taxe facturée enregistrée', money(report.summary.tax)]], [85, 100])
   drawSection('Évolution mensuelle', report.monthly.length ? report.monthly.map((row) => [row.month, money(row.amount)]) : [['Aucune donnée', `0 ${currency}`]], [60, 100])
   drawSection('Clients', report.detailClients.length ? report.detailClients.map((client) => [client.name, `${client.count} facture(s)`, money(client.amount)]) : [['Aucun client', '', '']], [75, 35, 75])
   drawSection('Produits et services', report.detailProducts.length ? report.detailProducts.map((product) => [product.name, `${product.quantity} unité(s)`, money(product.amount)]) : [['Aucun produit', '', '']], [75, 35, 75])
   drawSection('Répartition par statut', report.statusBreakdown.length ? report.statusBreakdown.map((item) => [item.status, String(item.count), money(item.amount)]) : [['Aucun statut', '', '']], [75, 35, 75])
   drawSection('Impayés à surveiller', report.overdue.length ? report.overdue.map((item) => [item.invoice, item.client, money(item.remaining)]) : [['Aucune facture en retard', '', '']], [60, 60, 65])
   pdf.setFontSize(7)
   pdf.setTextColor(90, 100, 115)
   pdf.text('Le CA correspond aux paiements rapprochés nets. Le bénéfice est une estimation de trésorerie. La taxe est celle enregistrée sur les factures émises; ce rapport ne constitue pas une déclaration fiscale.', 14, 280, { maxWidth: 180 })
   pdf.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 289)
   pdf.save('rapport-financier.pdf')
 }

 return (
   <section className="module-page report-module">
     <div className="module-heading">
       <div>
         <p className="eyebrow">ANALYSE FINANCIÈRE</p>
         <h1>Rapports</h1>
         <p>Encaissements nets par date de paiement, dépenses par date de dépense et factures par date d’émission.</p>
       </div>
       <div className="toolbar-actions">
         {periodButtons}
         {customDateInputs}
         <button className="outline-button" onClick={() => downloadCsv('rapport-financier.csv', exportRows[0], exportRows.slice(1))}>
           <FileText size={15} /> Exporter CSV
         </button>
         <button className="outline-button" onClick={() => exportPdf()}>
           <FileText size={15} /> Exporter PDF
         </button>
         <button className="outline-button" onClick={() => window.print()}>
           <FileText size={15} /> Imprimer
         </button>
       </div>
     </div>

     <div className="stats-grid report-stats">
     <StatCard title="CA encaissé net" value={formatMoney(report.summary.revenue, currency).slice(0, -(currency.length + 1))} suffix={currency} change={formatPeriodComparison(report.summary.revenue, report.summary.previousRevenue).label} trend={formatPeriodComparison(report.summary.revenue, report.summary.previousRevenue).trend} icon={<WalletCards size={20} />} tone="blue" />
     <StatCard title="Montant à recouvrer" value={formatMoney(report.summary.outstanding, currency).slice(0, -(currency.length + 1))} suffix={currency} change={`${report.summary.overdueCount} en retard`} trend="down" icon={<WalletCards size={20} />} tone="orange" />
     <StatCard title="Dépenses" value={formatMoney(report.summary.expenses, currency).slice(0, -(currency.length + 1))} suffix={currency} change={formatPeriodComparison(report.summary.expenses, report.summary.previousExpenses).label} trend={formatPeriodComparison(report.summary.expenses, report.summary.previousExpenses).trend} icon={<TrendingUp size={20} />} tone="purple" />
     <StatCard title="Bénéfice net estimé" value={formatMoney(report.summary.profit, currency).slice(0, -(currency.length + 1))} suffix={currency} change={formatPeriodComparison(report.summary.profit, report.summary.previousProfit).label} trend={report.summary.profit >= 0 ? 'up' : 'down'} icon={<TrendingUp size={20} />} tone="green" />
     <StatCard title="Taxe facturée" value={formatMoney(report.summary.tax, currency).slice(0, -(currency.length + 1))} suffix={currency} change="Taxe enregistrée sur les factures émises" trend="up" icon={<FileText size={20} />} tone="purple" />
     </div>
     <div className="panel report-methodology"><strong>Méthode de calcul · {report.rangeLabel}</strong><span>CA encaissé = paiements rapprochés nets (remboursements déduits), par date de paiement. Bénéfice net estimé = encaissements nets moins dépenses saisies, par date d’opération; ce n’est pas un résultat comptable. La taxe affichée est le montant enregistré sur les factures émises de la période, hors brouillons et annulations; elle ne vaut pas déclaration fiscale. Montant à recouvrer = solde actuel des factures émises pendant cette période.</span><small>Comparaison avec {report.previousRangeLabel}.</small></div>
     <section className="panel report-fiscal-summary"><div><span>Base taxable estimée</span><strong>{formatMoney(report.summary.taxableBase, currency)}</strong><small>Sous-total des factures émises moins les remises</small></div><div><span>Taxe facturée enregistrée</span><strong>{formatMoney(report.summary.tax, currency)}</strong><small>Les taux historiques ne sont pas stockés; ventilation par taux indisponible.</small></div></section>

     <div className="content-grid dashboard-analytics">
       <div className="panel">
         <div className="panel-heading"><div><h2>Meilleurs clients</h2><p>Montant facturé sur la période</p></div></div>
         {report.topClients.length ? report.topClients.map((client, index) => <div className="analytics-row" key={`${client.name}-${index}`}><span>{client.name}</span><strong>{formatMoney(client.amount, currency)}</strong></div>) : <p className="muted-cell">Aucun client sur cette période.</p>}
       </div>
       <div className="panel">
         <div className="panel-heading"><div><h2>Produits & services</h2><p>Top ventes</p></div></div>
         {report.topProducts.length ? report.topProducts.map((product, index) => <div className="analytics-row" key={`${product.name}-${index}`}><span>{product.name}<small>{product.quantity} vendu(s)</small></span><strong>{formatMoney(product.amount, currency)}</strong></div>) : <p className="muted-cell">Aucun produit vendu sur cette période.</p>}
       </div>
       <div className="panel">
         <div className="panel-heading"><div><h2>Répartition des factures</h2><p>Par statut</p></div></div>
         {report.statusBreakdown.length ? report.statusBreakdown.map((item) => <div className="analytics-row" key={item.status}><span>{item.status}</span><strong>{item.count} · {formatMoney(item.amount, currency)}</strong></div>) : <p className="muted-cell">Pas encore de facture dans cette période.</p>}
       </div>
       <div className="panel">
         <div className="panel-heading"><div><h2>Impayés à surveiller</h2><p>{report.rangeLabel}</p></div></div>
         {report.overdue.length ? report.overdue.map((item) => <div className="analytics-row" key={item.invoice}><span>{item.invoice}<small>{item.client} · échéance {new Date(`${item.dueDate}T00:00:00`).toLocaleDateString('fr-FR')}</small></span><strong>{formatMoney(item.remaining, currency)}</strong></div>) : <p className="muted-cell">Aucune facture en retard sur cette période.</p>}
       </div>
     </div>

     <div className="content-grid dashboard-analytics">
       <div className="panel">
         <div className="panel-heading"><div><h2>Détail par client</h2><p>Chiffre et nombre de factures</p></div></div>
         <div className="table-wrap">
           <table>
             <thead><tr><th>CLIENT</th><th>FACTURES</th><th>MONTANT FACTURÉ</th></tr></thead>
             <tbody>
               {report.detailClients.length ? report.detailClients.map((client, index) => <tr key={`${client.name}-${index}`}><td>{client.name}</td><td>{client.count}</td><td>{formatMoney(client.amount, currency)}</td></tr>) : <tr><td colSpan={3} className="muted-cell">Aucun client sur cette période.</td></tr>}
             </tbody>
           </table>
         </div>
       </div>
       <div className="panel">
         <div className="panel-heading"><div><h2>Détail par produit</h2><p>Quantité et valeur vendue</p></div></div>
         <div className="table-wrap">
           <table>
             <thead><tr><th>PRODUIT</th><th>QTÉ</th><th>MONTANT FACTURÉ</th></tr></thead>
             <tbody>
               {report.detailProducts.length ? report.detailProducts.map((product, index) => <tr key={`${product.name}-${index}`}><td>{product.name}</td><td>{product.quantity}</td><td>{formatMoney(product.amount, currency)}</td></tr>) : <tr><td colSpan={3} className="muted-cell">Aucun produit vendu sur cette période.</td></tr>}
             </tbody>
           </table>
         </div>
       </div>
     </div>

     <div className="panel report-table report-revenue-chart">
       <div className="panel-heading"><div><h2>Encaissements par mois</h2><p>Montants enregistrés selon la date de réception du paiement.</p></div></div>
       <RevenueChart monthly={report.monthly} />
     </div>

     <div className="panel report-table">
       <div className="panel-heading"><div><h2>Encaissements détaillés par mois</h2><p>{report.rangeLabel}</p></div></div>
       <table>
         <thead><tr><th>MOIS</th><th>MONTANT ENCAISSÉ</th></tr></thead>
         <tbody>
           {report.monthly.map((row) => <tr key={row.month}><td className="invoice-number">{row.month}</td><td className="amount-cell">{formatMoney(row.amount, currency)}</td></tr>)}
           {report.monthly.length === 0 && <tr><td colSpan={2} className="muted-cell">Aucune donnée de paiement pour cette période.</td></tr>}
         </tbody>
       </table>
     </div>
   </section>
 )
}

function AuthScreen() {
  const publicRoute = window.location.pathname
  const [showAuth, setShowAuth] = useState(false)
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    let result
    if (mode === 'register') {
      // A previous browser session must not remain active when confirming a new account.
      const signOutResult = await supabase.auth.signOut({ scope: 'local' })
      if (signOutResult.error) {
        setBusy(false)
        setMessage('Impossible de préparer la création du compte. Veuillez réessayer.')
        return
      }
      result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/` } })
    } else if (mode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password })
    } else {
      result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    }
    setBusy(false)
    if (result.error) {
      setMessage(result.error.message)
    } else if (mode === 'register') {
      setVerificationEmail(email)
      setMessage('')
    } else {
      setMessage(mode === 'login' ? 'Connexion réussie.' : 'Si cette adresse existe, un lien de réinitialisation vient d’être envoyé.')
    }
  }
  const resendVerification = async () => {
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: verificationEmail })
    setMessage(error ? 'Impossible de renvoyer l’e-mail pour le moment.' : 'Un nouvel e-mail de confirmation a été envoyé.')
    setBusy(false)
  }

  if (publicRoute !== '/') return <PublicPage path={publicRoute} onStart={() => { window.history.pushState({}, '', '/'); setMode('register'); setShowAuth(true) }} onLogin={() => { window.history.pushState({}, '', '/'); setMode('login'); setShowAuth(true) }} />
  if (!showAuth) return <LandingPage onStart={() => { setMode('register'); setShowAuth(true) }} onLogin={() => { setMode('login'); setShowAuth(true) }} />
  if (verificationEmail) return <div className="auth-shell"><div className="auth-brand"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></div><div className="auth-card auth-verification-card"><div className="auth-verification-icon"><Mail size={25} /></div><p className="eyebrow">ACTIVATION DU COMPTE</p><h1>Vérifiez votre adresse e-mail.</h1><p className="auth-subtitle">Un lien de confirmation a été envoyé à <strong>{verificationEmail}</strong>. Cliquez sur ce lien pour activer votre compte avant de vous connecter.</p><p className="auth-message">Pensez à vérifier vos courriers indésirables si vous ne trouvez pas l’e-mail.</p><button className="primary-button full-width" disabled={busy} onClick={() => void resendVerification()}>{busy ? 'Envoi en cours...' : 'Renvoyer l’e-mail'}</button>{message && <p className="settings-message success">{message}</p>}<button className="landing-back auth-verification-back" onClick={() => { setVerificationEmail(''); setMode('login'); setMessage('') }}>← Retour à la connexion</button></div><p className="auth-footer">Vos données sont protégées par Supabase et isolées par entreprise.</p></div>

  return (
    <div className="auth-shell">
      <button className="landing-back" onClick={() => setShowAuth(false)}>← Retour à l’accueil</button>
      <div className="auth-brand"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></div>
      <div className="auth-card">
        <p className="eyebrow">{mode === 'login' ? 'ESPACE PROFESSIONNEL' : mode === 'register' ? 'BIENVENUE' : 'SÉCURITÉ'}</p>
        <h1>{mode === 'login' ? 'Connectez-vous à votre espace.' : mode === 'register' ? 'Créez votre compte gratuitement.' : 'Réinitialisez votre mot de passe.'}</h1>
        <p className="auth-subtitle">{mode === 'login' ? 'Retrouvez vos clients, factures et revenus au même endroit.' : mode === 'register' ? 'Commencez à gérer votre activité simplement, depuis n’importe où.' : 'Recevez un lien sécurisé pour choisir un nouveau mot de passe.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <label>Nom complet<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Jean Dossou" /></label>}
          <label>Adresse email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@entreprise.com" /></label>
          {mode !== 'forgot' && <label>Mot de passe<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" /></label>}
          <button className="primary-button full-width" disabled={busy}>{busy ? 'Veuillez patienter...' : mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : 'Envoyer le lien'}</button>
        </form>
        {message && <p className="auth-message">{message}</p>}
        {mode === 'login' && <p className="auth-switch"><button onClick={() => { setMode('forgot'); setMessage('') }}>Mot de passe oublié ?</button></p>}
        <p className="auth-switch">{mode === 'login' ? 'Vous n’avez pas encore de compte ?' : 'Vous avez déjà un compte ?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>{mode === 'login' ? 'Créer un compte' : 'Se connecter'}</button></p>
      </div>
      <p className="auth-footer">Vos données sont protégées par Supabase et isolées par entreprise.</p>
    </div>
  )
}

function PasswordResetScreen() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8 || password !== confirmation) {
      setMessage(password !== confirmation ? 'Les mots de passe ne correspondent pas.' : 'Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setBusy(true); setMessage('')
    const result = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (result.error) setMessage(result.error.message)
    else { setMessage('Mot de passe mis à jour. Vous pouvez vous connecter.'); await supabase.auth.signOut(); window.history.replaceState({}, '', '/') }
  }
  return <main className="auth-shell"><div className="auth-brand"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></div><section className="auth-card"><p className="eyebrow">SÉCURITÉ</p><h1>Choisissez un nouveau mot de passe.</h1><p className="auth-subtitle">Votre nouveau mot de passe sera utilisé pour sécuriser votre compte.</p><form onSubmit={submit}><label>Nouveau mot de passe<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirmer le mot de passe<input required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="primary-button full-width" disabled={busy}>{busy ? 'Mise à jour...' : 'Réinitialiser le mot de passe'}</button></form>{message && <p className="auth-message">{message}</p>}</section></main>
}

function PublicPage({ path, onStart, onLogin }: { path: string; onStart: () => void; onLogin: () => void }) {
  const contentType = path === '/faq' ? 'faq' : path === '/articles' ? 'article' : path === '/ressources' ? 'resource' : path === '/annonces' ? 'announcement' : null
  const [managedContent, setManagedContent] = useState<Awaited<ReturnType<typeof loadPublicContent>>>([])
  const [siteConfig, setSiteConfig] = useState(defaultPublicSiteConfig)
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [contactMessage, setContactMessage] = useState('')
  const [contactBusy, setContactBusy] = useState(false)
  const [mySupportTickets, setMySupportTickets] = useState<Awaited<ReturnType<typeof loadMySupportTickets>>>([])
  const [supportViewerSignedIn, setSupportViewerSignedIn] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [trackingTicketId, setTrackingTicketId] = useState('')
  const [trackedTicket, setTrackedTicket] = useState<Awaited<ReturnType<typeof loadPublicSupportTicket>> | null>(null)
  const [trackingReply, setTrackingReply] = useState('')
  const [trackingBusy, setTrackingBusy] = useState(false)
  useEffect(() => {
    if (!contentType) return
    void loadPublicContent(contentType).then(setManagedContent).catch(() => setManagedContent([]))
  }, [contentType])
  useEffect(() => { void loadPublicSiteConfig().then((value) => { if (value) setSiteConfig({ ...defaultPublicSiteConfig, ...value }) }).catch(() => undefined) }, [])
  useEffect(() => {
    if (path !== '/contact') return
    void supabase.auth.getUser().then(({ data }) => {
      setSupportViewerSignedIn(Boolean(data.user))
      if (data.user) void loadMySupportTickets().then(setMySupportTickets).catch(() => setMySupportTickets([]))
    })
  }, [path])
  const managedBody = managedContent.length ? <div className="public-copy">{managedContent.map((item) => <article key={item.id}><h2>{item.title}</h2>{item.body.split(/\n+/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</article>)}</div> : null
  const submitContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setContactBusy(true)
    setContactMessage('')
    try {
      const result = await submitPublicSupportRequest({ name: contactForm.name, email: contactForm.email, subject: contactForm.subject, body: contactForm.message })
      setContactForm({ name: '', email: '', subject: '', message: '' })
      setTrackingTicketId(result.ticket_id)
      setTrackingCode(result.access_code)
      setContactMessage(`Votre demande a été transmise. Conservez votre code de suivi : ${result.access_code}.`)
      if (supportViewerSignedIn) void loadMySupportTickets().then(setMySupportTickets).catch(() => undefined)
    } catch {
      setContactMessage(`La demande n’a pas pu être enregistrée. Vous pouvez écrire directement à ${siteConfig.contactEmail}.`)
    } finally {
      setContactBusy(false)
    }
  }
  const followSupportRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTrackingBusy(true)
    try {
      setTrackedTicket(await loadPublicSupportTicket(trackingTicketId.trim(), trackingCode.trim()))
    } catch {
      setContactMessage('Impossible de retrouver cette demande. Vérifiez l’identifiant et le code de suivi.')
    } finally {
      setTrackingBusy(false)
    }
  }
  const sendTrackingReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTrackingBusy(true)
    try {
      await replyToPublicSupportTicket(trackingTicketId, trackingCode, trackingReply)
      setTrackingReply('')
      setTrackedTicket(await loadPublicSupportTicket(trackingTicketId, trackingCode))
    } catch {
      setContactMessage('Votre réponse n’a pas pu être enregistrée. Vérifiez votre code de suivi.')
    } finally {
      setTrackingBusy(false)
    }
  }
  const content = path === '/faq'
    ? { label: 'AIDE & FAQ', title: 'Tout savoir avant de commencer.', body: managedBody ?? <div className="faq-list"><details open><summary>FactureFacile est-il adapté aux commerces ?</summary><p>Oui. Vous pouvez gérer vos produits, votre stock, vos clients, vos ventes, vos factures et vos paiements depuis un seul espace professionnel.</p></details><details><summary>À qui s’adresse FactureFacile ?</summary><p>La plateforme s’adresse aux commerçants, indépendants, artisans, professions de services, PME et équipes qui souhaitent centraliser leur gestion quotidienne.</p></details><details><summary>Comment créer mon compte ?</summary><p>Cliquez sur « Créer mon compte », renseignez votre adresse e-mail et choisissez un mot de passe. Un e-mail de confirmation vous sera envoyé. Vous devrez cliquer sur le lien reçu avant votre première connexion.</p></details><details><summary>Puis-je créer des factures en FCFA ?</summary><p>Oui, la devise FCFA est prise en charge pour vos factures, vos paiements et votre suivi financier. Vous pouvez renseigner vos clients, vos produits, vos services, les taxes et les dates d’échéance.</p></details><details><summary>Quels types de documents puis-je gérer ?</summary><p>Selon votre espace et votre plan, vous pouvez préparer des factures standards, proforma, d’acompte, d’avoir et définitives. Vérifiez toujours les mentions et informations requises avant l’envoi à votre client.</p></details><details><summary>Puis-je suivre les paiements et les impayés ?</summary><p>Oui. Enregistrez les règlements associés à vos factures et consultez les montants payés, restants ou en retard depuis votre tableau de bord et vos rapports.</p></details><details><summary>La plateforme gère-t-elle les stocks ?</summary><p>Oui. Vous pouvez enregistrer vos produits, leurs prix, leurs unités et leurs quantités, puis surveiller les niveaux faibles afin de mieux préparer vos réapprovisionnements.</p></details><details><summary>Peut-on travailler en équipe ?</summary><p>Oui, les plans adaptés permettent d’inviter des membres et de leur attribuer un rôle. Les permissions limitent l’accès aux opérations selon les responsabilités de chacun.</p></details><details><summary>Quels sont les plans disponibles ?</summary><p>Les plans actifs, leurs types, leurs prix, leurs limites d’utilisateurs et de factures sont affichés dans la section Tarifs de l’espace public. Les fonctionnalités peuvent évoluer selon la formule choisie.</p></details><details><summary>Mes données sont-elles protégées ?</summary><p>Chaque entreprise dispose d’un espace isolé et sécurisé, avec une gestion des accès adaptée à son équipe. Ne partagez jamais vos identifiants et signalez rapidement toute activité inhabituelle.</p></details><details><summary>Comment demander de l’aide ?</summary><p>Consultez cette FAQ ou contactez notre équipe à contact@facturefacile.bj en indiquant le nom de votre entreprise, l’adresse e-mail du compte et une description précise de votre demande.</p></details></div> }
    : contentType ? { label: contentType === 'article' ? 'ARTICLES' : contentType === 'resource' ? 'RESSOURCES' : 'ANNONCES', title: contentType === 'article' ? 'Articles FactureFacile' : contentType === 'resource' ? 'Ressources utiles' : 'Annonces FactureFacile', body: managedBody ?? <div className="public-copy"><p>Aucun contenu publié pour le moment.</p></div> }
    : path === '/mentions-legales'
        ? { label: 'LÉGAL', title: 'Mentions légales', body: <div className="public-copy"><p><strong>Conformément aux lois en vigueur au Bénin · Dernière mise à jour : 08/09/2026</strong></p><h2>1. Éditeur de la plateforme</h2><p><strong>FactureFacile Bénin</strong></p><p>Forme juridique : à compléter avant la mise en production.<br />Adresse du siège : à compléter, Cotonou, Bénin.<br />Téléphone : à compléter.<br />E-mail : <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a><br />Numéro RCCM : à compléter.<br />IFU : à compléter.<br />Directeur de la publication : à compléter.</p><p>FactureFacile est une plateforme numérique de gestion destinée aux artisans, commerçants, indépendants, PME et entreprises de services.</p><h2>2. Hébergement</h2><p>La plateforme FactureFacile est déployée sur une infrastructure cloud pouvant inclure <strong>Vercel</strong> pour la diffusion de l’application et <strong>Supabase</strong> pour l’authentification, la base de données et le stockage.</p><p>Les adresses et coordonnées juridiques exactes des prestataires d’hébergement doivent être ajoutées dans cette page dès que le contrat et la région de déploiement définitifs sont arrêtés.</p><h2>3. Propriété intellectuelle</h2><p>L’ensemble des contenus présents sur FactureFacile — textes, graphismes, logo, icônes, images, interfaces et composants logiciels — appartient à FactureFacile ou à ses partenaires et est protégé par les règles applicables en matière de propriété intellectuelle. Toute reproduction, représentation, modification, publication, extraction ou adaptation totale ou partielle est interdite sans autorisation écrite préalable.</p><h2>4. Données personnelles</h2><p>FactureFacile collecte et traite des données personnelles dans le cadre de la fourniture de ses services. Ces traitements sont décrits dans notre <a href="/confidentialite">Politique de confidentialité</a>. Vous pouvez demander l’accès, la rectification, la portabilité ou la suppression de vos données en contactant <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>. Une vérification d’identité peut être demandée.</p><h2>5. Cookies et technologies nécessaires</h2><p>FactureFacile utilise les mécanismes strictement nécessaires au fonctionnement de la plateforme, notamment la session d’authentification, la sécurité et la conservation des préférences. Aucun cookie publicitaire ou dispositif de suivi tiers n’est volontairement utilisé dans l’espace public. Vous pouvez configurer votre navigateur pour limiter les cookies techniques, mais cela peut empêcher la connexion ou certaines fonctions.</p><h2>6. Limitation de responsabilité</h2><p>FactureFacile fournit des outils de gestion, de facturation et de suivi ; la plateforme ne se substitue pas à un conseil comptable, fiscal ou juridique. L’utilisateur reste responsable de l’exactitude de ses données, de ses factures, de ses obligations légales et des accès accordés à son équipe. FactureFacile ne peut être tenu responsable des erreurs de saisie, des décisions prises à partir des données affichées, des interruptions réseau ou des événements indépendants de sa volonté.</p><h2>7. Disponibilité et maintenance</h2><p>Nous mettons en œuvre des moyens raisonnables pour assurer la disponibilité, la sécurité et la continuité du service. Des interruptions peuvent toutefois survenir en raison d’une maintenance, d’une mise à jour, d’un incident technique, d’une panne d’un prestataire ou d’un événement de force majeure.</p><h2>8. Droit applicable et règlement des différends</h2><p>Les présentes mentions légales sont soumises au droit béninois. En cas de difficulté relative à leur interprétation ou à leur exécution, les parties recherchent d’abord une solution amiable. À défaut, les juridictions compétentes au Bénin pourront être saisies, sous réserve des dispositions légales impératives applicables.</p><h2>9. Contact</h2><p>Pour toute question relative aux présentes mentions légales :</p><p>📧 E-mail : <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a><br />📞 Téléphone : à compléter<br />📍 Adresse : à compléter, Cotonou, Bénin</p></div> }
    : path === '/confidentialite'
        ? { label: 'INFORMATIONS LÉGALES', title: 'Politique de confidentialité', body: <div className="public-copy"><p>{siteConfig.legalPrivacy}</p><h2>1. Données collectées</h2><p>Nous pouvons collecter les informations nécessaires à la création du compte, à l’identification de l’utilisateur, à la gestion de l’entreprise, à la facturation et au support : nom, e-mail, téléphone, informations de l’entreprise, clients, produits, factures et paiements saisis dans l’espace professionnel.</p><h2>2. Finalités</h2><p>Ces données servent à fournir les fonctionnalités demandées, sécuriser les comptes, traiter les opérations, assurer le support, améliorer le service et envoyer les communications indispensables à son fonctionnement. Elles ne sont pas vendues à des tiers.</p><h2>3. Accès et séparation des espaces</h2><p>Les données commerciales restent privées et sont isolées par entreprise. Les droits d’accès dépendent du rôle attribué à chaque membre. Chaque utilisateur doit protéger ses identifiants et signaler immédiatement toute utilisation suspecte de son compte.</p><h2>4. Prestataires techniques</h2><p>Des prestataires spécialisés peuvent traiter certaines données pour l’hébergement, l’authentification, le stockage, l’envoi d’e-mails ou le paiement. Ils sont utilisés uniquement pour les besoins du service et selon les garanties applicables.</p><h2>5. Conservation et suppression</h2><p>Les données sont conservées pendant la durée nécessaire à la fourniture du service, au respect des obligations légales et au traitement des litiges. Une demande de suppression peut entraîner la fermeture de l’espace et la perte des données qui ne doivent pas être conservées légalement.</p><h2>6. Vos droits</h2><p>Vous pouvez demander l’accès, la correction, la portabilité ou la suppression de vos données, ainsi que la limitation de certains traitements, en contactant notre équipe à <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>. Une vérification d’identité peut être demandée avant toute action.</p><h2>7. Cookies et sécurité</h2><p>Le service utilise les mécanismes nécessaires à l’authentification, à la sécurité et au maintien de la session. Nous appliquons des contrôles d’accès et des mesures techniques raisonnables, sans pouvoir garantir un risque nul sur Internet.</p></div> }
      : path === '/conditions'
          ? { label: 'LÉGAL', title: 'Conditions Générales d’Utilisation', body: <div className="public-copy"><p><strong>Dernière mise à jour : 08/09/2026 · En vigueur au Bénin 🇧🇯</strong></p><p>Les présentes Conditions Générales d’Utilisation (CGU) encadrent l’accès et l’utilisation de FactureFacile. En créant un compte ou en utilisant la plateforme, vous reconnaissez avoir lu, compris et accepté ces conditions.</p><h2>1. Présentation de FactureFacile</h2><p>FactureFacile est une plateforme numérique de gestion destinée aux artisans, commerçants, indépendants, PME et entreprises de services au Bénin. Elle permet notamment de gérer les clients, produits, services, stocks, ventes, factures, paiements, dépenses, rapports et membres d’équipe depuis un espace professionnel.</p><h2>2. Acceptation des CGU</h2><p>L’utilisation de FactureFacile implique l’acceptation pleine et entière des présentes conditions. Si vous n’acceptez pas ces conditions, vous ne devez pas utiliser la plateforme. FactureFacile peut modifier les CGU pour tenir compte de l’évolution du service, de la réglementation ou de la sécurité. Les changements importants seront signalés par un moyen approprié, notamment par e-mail ou dans l’application.</p><h2>3. Création et sécurité du compte</h2><p>L’utilisateur doit fournir des informations exactes, maintenir son adresse e-mail à jour et confirmer son compte lorsque cela est demandé. Il doit protéger ses identifiants, ne pas les partager et signaler rapidement toute connexion suspecte. Le titulaire du compte est responsable des actions réalisées depuis son espace.</p><h2>4. Utilisation du service</h2><p>FactureFacile doit être utilisé pour des besoins professionnels licites. Il est interdit de contourner les contrôles de sécurité, d’accéder aux données d’une autre entreprise, d’introduire un contenu malveillant, de perturber la plateforme ou d’utiliser le service pour une activité frauduleuse ou illégale.</p><h2>5. Données, factures et obligations de l’utilisateur</h2><p>L’utilisateur reste responsable des informations saisies, de ses clients, produits, prix, taxes, dates, paiements et documents. Il doit vérifier les calculs, la numérotation, les destinataires et la conformité de ses factures avec les règles applicables au Bénin. FactureFacile fournit un outil de gestion et ne remplace pas un conseil comptable, fiscal ou juridique.</p><h2>6. Plans, fonctionnalités et limites</h2><p>Les fonctionnalités, limites d’utilisateurs, volumes de factures et options disponibles dépendent du plan affiché dans l’espace public ou dans l’espace de l’entreprise. Les plans peuvent être de type Free, Basic, Pro ou Business selon la configuration publiée. Une évolution de plan peut modifier les limites applicables sans supprimer les obligations de l’utilisateur relatives aux données déjà créées.</p><h2>7. Tarifs et paiements</h2><p>Les prix, la devise, la périodicité et les fonctionnalités incluses sont présentés avant toute souscription. Les paiements peuvent être traités par un prestataire de paiement autorisé, selon ses propres conditions. Tout montant dû doit être réglé dans les délais indiqués. En cas d’échec ou de non-paiement, certaines fonctionnalités peuvent être limitées après information de l’utilisateur.</p><h2>8. Disponibilité, maintenance et sauvegardes</h2><p>Nous faisons notre possible pour maintenir FactureFacile disponible, fiable et sécurisé. Des interruptions peuvent survenir pour maintenance, mise à jour, incident technique, coupure réseau ou événement indépendant de notre volonté. L’utilisateur doit conserver les documents importants dans ses propres procédures et ne pas considérer la plateforme comme son unique moyen d’archivage.</p><h2>9. Propriété intellectuelle et licence</h2><p>La marque, le code, l’interface, les textes, les éléments graphiques et les fonctionnalités de FactureFacile restent protégés par les règles applicables de propriété intellectuelle. Une licence limitée, personnelle, non exclusive et non transférable est accordée pendant la durée de l’accès au service. Toute copie, extraction, revente ou adaptation non autorisée est interdite.</p><h2>10. Responsabilité</h2><p>FactureFacile ne peut être tenu responsable des erreurs provenant des données saisies par l’utilisateur, de l’usage inadapté des documents, d’une interruption du réseau ou d’un événement hors de son contrôle. L’utilisateur demeure responsable de ses obligations commerciales, comptables, fiscales et légales, ainsi que des accès accordés aux membres de son équipe.</p><h2>11. Suspension et résiliation</h2><p>L’accès peut être limité, suspendu ou résilié en cas de risque de sécurité, d’utilisation interdite, de fraude, de violation des présentes conditions ou de non-paiement. L’utilisateur peut demander la fermeture de son compte en contactant le support. La suppression d’un compte peut rendre les données et documents associés indisponibles ; l’utilisateur doit donc effectuer ses exports avant la clôture.</p><h2>12. Données personnelles</h2><p>Le traitement des données personnelles est décrit dans la <a href="/confidentialite">Politique de confidentialité</a>. Les utilisateurs doivent également s’assurer qu’ils disposent d’une base légitime pour saisir et traiter les données de leurs propres clients.</p><h2>13. Droit applicable et règlement des différends</h2><p>Les présentes CGU sont interprétées conformément aux règles applicables au Bénin. En cas de difficulté, les parties recherchent d’abord une solution amiable en contactant le support avant toute démarche contentieuse.</p><h2>14. Contact</h2><p>Pour toute question sur ces conditions, contactez <a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a> en indiquant le nom de votre entreprise et l’adresse e-mail du compte.</p></div> }
        : { label: 'AIDE', title: 'Comment pouvons-nous vous aider ?', body: <div className="public-copy contact-page-content"><p className="contact-intro">Notre équipe répond sous 24h ouvrées.</p><section className="contact-form-section tracking-section"><p className="eyebrow">SUIVRE MA RÉPONSE</p><h2>Retrouvez votre demande</h2><p>Après l’envoi, conservez l’identifiant et le code de suivi reçus. Aucun compte n’est nécessaire.</p><form className="contact-form tracking-form" onSubmit={followSupportRequest}><label>Identifiant de la demande<input required value={trackingTicketId} onChange={(event) => setTrackingTicketId(event.target.value)} /></label><label>Code de suivi<input required value={trackingCode} onChange={(event) => setTrackingCode(event.target.value.toUpperCase())} /></label><button className="primary-button" type="submit" disabled={trackingBusy}>{trackingBusy ? 'Recherche...' : 'Suivre ma réponse'}</button></form>{trackedTicket && <article className="support-conversation tracked-ticket"><strong>{trackedTicket.subject}</strong>{trackedTicket.messages.map((message) => <div className={`support-message ${message.author_role === 'support' ? 'from-support' : ''}`} key={message.id}><small>{message.author_role === 'support' ? 'Équipe FactureFacile' : 'Vous'} · {new Date(message.created_at).toLocaleString('fr-FR')}</small><p>{message.body}</p></div>)}<form className="contact-form tracking-reply-form" onSubmit={sendTrackingReply}><label>Poser une autre question<textarea required rows={4} value={trackingReply} onChange={(event) => setTrackingReply(event.target.value)} /></label><button className="primary-button" type="submit" disabled={trackingBusy}>Envoyer la réponse</button></form></article>}</section>{supportViewerSignedIn && <section className="contact-faq"><p className="eyebrow">MES DEMANDES</p><h2>Réponses de l’équipe</h2>{mySupportTickets.length ? <div className="support-conversations">{mySupportTickets.map((ticket) => <article className="support-conversation" key={ticket.id}><div><strong>{ticket.subject}</strong><span className={`support-status ${ticket.status}`}>{ticket.status === 'resolved' ? 'Résolu' : ticket.status === 'in_progress' ? 'En cours' : 'Ouvert'}</span></div>{ticket.messages.map((message) => <div className={`support-message ${message.author_role === 'support' ? 'from-support' : ''}`} key={message.id}><small>{message.author_role === 'support' ? 'Équipe FactureFacile' : 'Vous'} · {new Date(message.created_at).toLocaleString('fr-FR')}</small><p>{message.body}</p></div>)}</article>)}</div> : <p>Aucune demande enregistrée pour le moment.</p>}</section>}<div className="contact-channel-grid"><article><span className="contact-channel-icon">📧</span><h2>Email</h2><p>Pour les questions générales et les demandes de support.</p><a className="contact-link" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a><small>Réponse sous 24h ouvrées</small></article><article><span className="contact-channel-icon">💬</span><h2>WhatsApp</h2><p>Pour les urgences et les problèmes de paiement.</p><a className="contact-link" href="https://wa.me/22997000000" target="_blank" rel="noreferrer">+229 97 00 00 00</a><small>Lun–Ven, 8h–18h</small></article><article><span className="contact-channel-icon">⚖️</span><h2>Litige</h2><p>Pour signaler un problème lié à une facture ou à votre espace.</p><button className="outline-button" type="button" onClick={onLogin}>Se connecter d’abord</button><small>Traitement sous 48h ouvrées</small></article></div>        <section className="contact-form-section"><p className="eyebrow">NOUS ÉCRIRE</p><h2>Décrivez votre besoin</h2>{!supportViewerSignedIn && <p className="contact-auth-hint">Connectez-vous pour envoyer une demande et suivre la réponse des administrateurs dans « Mes demandes ».</p>}<form className="contact-form" onSubmit={submitContact}><label>Votre nom<input required value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} /></label><label>Votre e-mail<input required type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} /></label><label>Sujet<select required value={contactForm.subject} onChange={(event) => setContactForm({ ...contactForm, subject: event.target.value })}><option value="">Choisir un sujet</option><option>Question générale</option><option>Problème de connexion</option><option>Paiement ou abonnement</option><option>Question sur une facture</option><option>Signaler un problème</option><option>Autre demande</option></select></label><label>Votre message<textarea required rows={5} value={contactForm.message} onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })} /></label>        <button className="primary-button" type="submit" disabled={contactBusy}>{contactBusy ? 'Transmission...' : 'Envoyer la demande'} <Send size={15} /></button>{contactMessage && <p className="settings-message success">{contactMessage}</p>}</form></section><section className="contact-faq"><p className="eyebrow">QUESTIONS FRÉQUENTES</p><div className="faq-list"><details><summary>Quel est le délai de réponse ?</summary><p>Notre équipe répond généralement sous 24 heures ouvrées. Les demandes de litige peuvent nécessiter jusqu’à 48 heures ouvrées.</p></details><details><summary>Que dois-je indiquer dans ma demande ?</summary><p>Indiquez votre nom, l’e-mail du compte, le nom de votre entreprise et une description précise du problème. Ne transmettez jamais votre mot de passe.</p></details><details><summary>Comment signaler un paiement ou un abonnement ?</summary><p>Utilisez le formulaire avec le sujet « Paiement ou abonnement » ou contactez-nous sur WhatsApp pendant les horaires d’assistance.</p></details><details><summary>Comment demander la suppression de mes données ?</summary><p>Écrivez à notre adresse de support depuis l’e-mail associé au compte. Une vérification d’identité pourra être demandée.</p></details></div></section></div> }
  return <main className="public-page"><nav className="landing-nav"><a className="auth-brand public-brand" href="/"><img className="brand-mark" alt="FactureFacile" src={appIcon} /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></a><div className="landing-nav-actions"><button className="outline-button" onClick={onLogin}>Se connecter</button><button className="primary-button" onClick={onStart}>Créer mon compte</button></div></nav><article className="public-card"><p className="eyebrow">{content.label}</p><h1>{content.title}</h1>{content.body}</article><footer className="landing-footer public-footer"><div><strong>FactureFacile <span>BÉNIN</span></strong></div><nav className="compact-public-links"><a href="/faq">FAQ</a><a href="/contact">Contact</a><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité</a><a href="/conditions">Conditions</a></nav><small>© 2026 FactureFacile Bénin.</small></footer></main>
}

function LandingPage({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const defaultFeatures = [
    ['Vendez et facturez simplement', 'Pour les boutiques, commerces et entreprises de services, créez des factures professionnelles en quelques clics.'],
    ['Suivez votre activité', 'Visualisez vos ventes, revenus, paiements, dépenses et stocks au même endroit.'],
    ['Développez votre entreprise', 'Gagnez du temps avec une gestion claire, sécurisée et adaptée aux entreprises béninoises.'],
  ]
  const [publicFeatures, setPublicFeatures] = useState(defaultFeatures)
  const [publicPlans, setPublicPlans] = useState<Awaited<ReturnType<typeof loadPublicSubscriptionPlans>>>([])
  const [siteConfig, setSiteConfig] = useState(defaultPublicSiteConfig)
  useEffect(() => {
    void loadPublicContent('feature').then((items) => {
      if (items.length) setPublicFeatures(items.map((item) => [item.title, item.body] as [string, string]))
    }).catch(() => undefined)
    void loadPublicSubscriptionPlans().then(setPublicPlans).catch(() => undefined)
    void loadPublicSiteConfig().then((value) => { if (value) setSiteConfig({ ...defaultPublicSiteConfig, ...value }) }).catch(() => undefined)
  }, [])
  const steps = siteConfig.steps
  return <main className="landing-page">
    <nav className="landing-nav"><a className="auth-brand public-brand" href="/"><img className="brand-mark" src={appIcon} alt="FactureFacile" /><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></a><div className="landing-nav-links">{siteConfig.navLinks.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</div><div className="landing-nav-actions"><button className="outline-button" onClick={onLogin}>Se connecter</button><button className="primary-button" onClick={onStart}>Créer un compte</button></div></nav>
    <section className="landing-hero"><div className="landing-copy"><p className="eyebrow">{siteConfig.heroEyebrow}</p><div className="audience-tags">{siteConfig.audienceTags.map((tag) => <span key={tag}>{tag}</span>)}</div><h1>{siteConfig.heroTitle}<br /><span>{siteConfig.heroTitleAccent}</span></h1><p className="landing-subtitle">{siteConfig.heroSubtitle}</p><div className="landing-trust"><ShieldCheck size={17} /><span>{siteConfig.heroTrust}</span></div></div></section>
    <section className="landing-features" id="fonctionnalites">{publicFeatures.map(([title, description], index) => <article key={`${title}-${index}`}><span>0{index + 1}</span><h2>{title}</h2><p>{description}</p></article>)}</section>
    <section className="landing-solutions" id="solutions"><div className="landing-section-heading"><p className="eyebrow">UNE SOLUTION POUR CHAQUE ACTIVITÉ</p><h2>{siteConfig.solutionsTitle}</h2><p>{siteConfig.solutionsSubtitle}</p></div><div className="solution-grid">{siteConfig.solutions.map(({ title, body }) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="landing-problems"><div><p className="eyebrow">FINI LES INFORMATIONS DISPERSÉES</p><h2>Une seule plateforme pour rester organisé.</h2></div><p>Excel pour les calculs, Word pour les factures, WhatsApp pour les envoyer et un cahier pour les paiements : cette organisation fait perdre du temps et crée des erreurs. FactureFacile centralise votre activité dans un espace clair et sécurisé.</p></section>
    <section className="landing-product">
      <div className="landing-section-heading"><p className="eyebrow">UNE VUE CLAIRE DE VOTRE ACTIVITÉ</p><h2>Les outils essentiels de votre entreprise, au même endroit.</h2><p>Un aperçu de l’espace de travail que vous retrouverez après votre inscription.</p></div>
      <div className="product-showcase">
        <div className="product-sidebar"><strong>Facture<span>Facile</span></strong><span className="product-sidebar-active">Tableau de bord</span><span>Clients</span><span>Produits & services</span><span>Factures</span><span>Paiements</span><span>Rapports</span></div>
        <div className="product-screen"><div className="product-screen-top"><span>Tableau de bord</span><b>Votre activité en un coup d’œil</b></div><div className="product-screen-stats"><div><small>CA encaissé</small><strong>2 845 000 <em>FCFA</em></strong><span>+12,5% ce mois</span></div><div><small>Factures</small><strong>48</strong><span>24 payées</span></div><div><small>Clients</small><strong>36</strong><span>+4 ce mois</span></div></div><div className="product-screen-grid"><div className="product-chart"><b>Évolution du chiffre d’affaires</b><div><i /><i /><i /><i /><i /><i /></div></div><div className="product-invoices"><b>Dernières factures</b><p><span>FAC-00124</span><strong>Payée</strong></p><p><span>FAC-00123</span><strong>En attente</strong></p><p><span>FAC-00122</span><strong>Payée</strong></p></div></div></div>
      </div>
    </section>
    <section className="landing-how">
      <div className="landing-section-heading">
        <p className="eyebrow">SIMPLE DÈS LE PREMIER JOUR</p>
        <h2>Une gestion claire, en trois étapes.</h2>
        <p>Tout ce dont vous avez besoin pour gérer votre activité sans complexité inutile.</p>
      </div>
      <div className="landing-steps">{steps.map(({ number, title, body }) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
    </section>
    <section className="landing-trust-panel">
      <ShieldCheck size={25} />
      <div><strong>Une solution pensée pour votre quotidien</strong><p>Factures en FCFA, suivi des stocks et données protégées pour les commerces et entreprises du Bénin.</p></div>
    </section>
    <section className="landing-testimonial">
      <p className="eyebrow">ILS GÈRENT LEUR ACTIVITÉ AVEC SÉRÉNITÉ</p>
      <blockquote>« Je retrouve mes ventes, mes clients et mes paiements au même endroit. Je gagne du temps chaque semaine. »</blockquote>
      <div><strong>Akouavi Dossou</strong><span> — Gérante de commerce, Cotonou</span></div>
    </section>
    <section className="landing-pricing" id="tarifs">
      <div className="landing-section-heading"><p className="eyebrow">UNE TARIFICATION SIMPLE</p><h2>Commencez sans engagement.</h2><p>Accédez à l’essentiel pour organiser votre entreprise, sans surprise.</p></div>
      {publicPlans.length ? publicPlans.map((plan) => <article className="pricing-card" key={plan.id}><div><span className="pricing-label">FORMULE {plan.code.toUpperCase()}</span><h3>{plan.name}</h3><p>{plan.description}</p><div className="pricing-meta"><span>{plan.billing_period === 'yearly' ? 'Facturation annuelle' : 'Facturation mensuelle'}</span><span>{plan.limits.users ?? 1} utilisateur{(plan.limits.users ?? 1) > 1 ? 's' : ''}</span><span>{plan.limits.invoices ?? 0} factures / mois</span></div><ul>{plan.features.slice(0, 4).map((feature) => <li key={feature}>{feature}</li>)}</ul></div><strong>{plan.price === 0 ? 'Gratuit' : `${plan.price.toLocaleString('fr-FR')} ${plan.currency}`}<small>{plan.price === 0 ? ' pour commencer' : plan.billing_period === 'yearly' ? ' / an' : ' / mois'}</small></strong><button className="primary-button" onClick={onStart}>Choisir ce plan <ArrowRight size={15} /></button></article>) : <div className="pricing-card"><div><span className="pricing-label">ESSENTIEL</span><h3>Gestion professionnelle</h3><p>Tout pour démarrer et suivre votre activité.</p></div><strong>Gratuit<small> pour commencer</small></strong></div>}
    </section>
    <section className="landing-final-cta"><h2>{siteConfig.finalCtaTitle}</h2><p>{siteConfig.finalCtaBody}</p><div className="landing-actions"><button className="primary-button" onClick={onStart}>Créer mon compte gratuitement <ArrowRight size={16} /></button><button className="outline-button landing-login-button" onClick={onLogin}>J’ai déjà un compte</button></div></section>
    <footer className="landing-footer"><div><strong>FactureFacile <span>BÉNIN</span></strong></div><nav className="compact-public-links"><a href="#fonctionnalites">Fonctionnalités</a><a href="#solutions">Solutions</a><a href="#tarifs">Tarifs</a><a href="/faq">FAQ</a><a href="/contact">Contact</a><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité</a><a href="/conditions">Conditions</a></nav><small>© 2026 FactureFacile Bénin.</small></footer>
  </main>
}

function StatCard({ title, value, suffix, change, trend, icon, tone, period = true, detail, onClick, destination }: { title: string; value: string; suffix?: string; change: string; trend: 'up' | 'down'; icon: React.ReactNode; tone: string; period?: boolean; detail?: string; onClick?: () => void; destination?: string }) {
  const content = <><div className={`stat-icon ${tone}`}>{icon}</div><p>{title}</p><strong>{value} <small>{suffix}</small></strong>{detail && <small className="stat-detail">{detail}</small>}<span className={trend === 'up' ? 'positive' : 'negative'}>{trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}{period && <em>ce mois</em>}{onClick && <em> · Voir {destination}</em>}</span></>
  return onClick
    ? <button type="button" className="stat-card stat-card-link" onClick={onClick} aria-label={`${title} : ${value} ${suffix ?? ''}. Ouvrir ${destination ?? 'le détail'}.`}>{content}</button>
    : <div className="stat-card">{content}</div>
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}><span>{icon}</span><strong>{label}</strong><ChevronRight size={16} /></button>
}

function RevenueChart({ monthly }: { monthly: { month: string; amount: number }[] }) {
  const values = monthly.length ? monthly.map((item) => item.amount) : [0]
  const maximum = Math.max(...values, 1)
  const points = values.map((value, index) => `${values.length === 1 ? 350 : (index / (values.length - 1)) * 700},${170 - (value / maximum) * 145}`).join(' ')
  const labels = monthly.map((item) => new Date(`${item.month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }))
  return <div className="chart-area"><div className="chart-y-axis"><span>{maximum.toLocaleString('fr-FR')}</span><span>{Math.round(maximum * .75).toLocaleString('fr-FR')}</span><span>{Math.round(maximum * .5).toLocaleString('fr-FR')}</span><span>{Math.round(maximum * .25).toLocaleString('fr-FR')}</span><span>0</span></div><div className="chart"><div className="chart-grid"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 700 180" preserveAspectRatio="none" role="img" aria-label="Courbe réelle du chiffre d'affaires"><polyline points={points} fill="none" stroke="#3182f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx={values.length === 1 ? 350 : (values.length - 1) / Math.max(values.length - 1, 1) * 700} cy={170 - (values[values.length - 1] / maximum) * 145} r="4" fill="#3182f6" /></svg><div className="chart-x-axis">{labels.length ? labels.map((label) => <span key={label}>{label}</span>) : <span>Aucune donnée</span>}</div></div></div>
}

export default App
