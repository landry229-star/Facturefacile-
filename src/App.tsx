import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, Bell, ChevronDown, ChevronRight, CircleHelp, Clock3, Download, FileText, LayoutDashboard, ArrowRight, Menu, Package, Plus, Search, Settings, ShieldCheck, ShoppingBag, ShoppingCart, TrendingUp, Truck, UserRound, Users, WalletCards, Mail, LogOut, Send, RefreshCw, Sparkles, X, LockKeyhole } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigError } from './lib/supabase';
import { userFacingError, diagnosticErrorMessage } from './lib/errors';
import { formatMoney } from './lib/formatting';
import { invoiceFieldLabel } from './lib/invoiceLabels';
import { getBeninDocumentPdfCopy, getBeninTaxLabel } from './lib/beninDocument';
import { appIcon } from './lib/branding';
import { StatCard } from './components/StatCard';
import { AuthScreen, ConfigurationError, PasswordResetScreen } from './PublicPages';
import { DgiPreparationPage } from './DgiPreparationPage';
import { PublicQuotePage, QuotesPage } from './QuotesPage';
import { SuppliersPurchasesPage } from './SuppliersPurchasesPage';
import { OverdueRemindersPage } from './OverdueRemindersPage';
import { CashRegisterPage } from './CashRegisterPage';
const PlatformAdminShell = lazy(() => import('./PlatformAdmin').then((module) => ({ default: module.PlatformAdminShell })))
const PlatformAdminPage = lazy(() => import('./PlatformAdmin').then((module) => ({ default: module.PlatformAdminPage })))
const ModulePage = lazy(() => import('./BusinessModules').then((module) => ({ default: module.ModulePage })))

import type { AiDataSummary, AiExpenseAnalysis, AiForecast, AiUsage } from './lib/ai';
import type { AiInvoiceDraft } from './lib/aiRules';
const ReportPage = lazy(() => import('./ReportPage'))
const CashflowPage = lazy(() => import('./CashflowPage').then((module) => ({ default: module.CashflowPage })))
import { loadMySupportTickets, loadPublicSupportTicket, replyToPublicSupportTicket, submitPublicSupportRequest } from './lib/data';

import { exportBusinessData } from './lib/data';
import { replyToMySupportTicket } from './lib/data';
import { updateAccountProfile } from './lib/data';
import { uploadAccountProfilePhoto } from './lib/data';
import { acceptBusinessInvitation, cancelTeamInvitation, createInvoice, createSubscriptionCheckout, deleteAuditLog, ensureBusiness, createTeamAccount, loadAuditLogs, loadBusinessNotifications, markBusinessNotificationRead, loadBusinessProfile, loadBusinessRole, loadBusinessSubscription, loadSubscriptionPayments, verifySubscriptionPayment, loadDashboardAnalytics, loadFinancialReport, loadFinancialSummary, loadInvoiceOptions, loadInvoices, loadInvoicePdfData, loadPlatformAdminOverview, loadPublicSubscriptionPlans, loadRecurringInvoices, loadTeamInvitations, loadTeamMembers, removeTeamMember, updateTeamMemberRole, validateTeamInvitation, sendInvoiceEmail, updateBusinessProfile, updateBusinessSubscription, updateAccountPassword, uploadBusinessLogo } from './lib/data';

import type { AuditLog } from './lib/data';
import type { BusinessProfile } from './lib/data';

import type { BusinessNotification } from './lib/data';
import type { FinancialSummary } from './lib/data';

import type { SubscriptionCheckout } from './lib/data';
import { loadKkiapaySdk } from './lib/kkiapay';
import type { KkiapayWidgetResult } from './lib/kkiapay';
import { invoiceDocumentTypeLabels } from './lib/data';
import type { BusinessRole, ClientOption, DashboardAnalytics, InvoiceDocumentType, InvoiceLine, ProductOption, RecurringInvoiceRow } from './lib/data';
import { formatPeriodComparison } from './lib/dashboardMetrics';
import { addDateDays, businessTimeZones, formatBusinessDateKey, formatInvoiceNumberExample, getBusinessDateKey } from './lib/businessPreferences';





import { hasFeatureForUser, isDemoOwnerOverride, resolveEffectiveSubscriptionState } from './lib/subscription';
import { setNoIndexMetadata } from './lib/seo';
import './App.css'

type InvoiceStatus = 'Brouillon' | 'Payée' | 'En attente' | 'En retard' | 'Annulée'

type Invoice = {
  number: string
  customer: string
  date: string
  amount: string
  status: InvoiceStatus
  initials: string
  tone: string
}

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const navItems = [
  { label: 'Tableau de bord', icon: LayoutDashboard },
  { label: 'Clients', icon: Users },
  { label: 'Produits & Services', icon: Package },
  { label: 'Stock', icon: Package },
  { label: 'Factures', icon: FileText },
  { label: 'Caisse et ventes rapides', icon: ShoppingCart },
  { label: 'Devis', icon: FileText },
  { label: 'Relances et recouvrement', icon: Bell },
  { label: 'Paiements', icon: WalletCards },
  { label: 'Dépenses', icon: TrendingUp },
  { label: 'Fournisseurs et achats', icon: Truck },
  { label: 'Trésorerie et prévisions', icon: WalletCards },
  { label: 'Factures récurrentes', icon: FileText },
  { label: 'Historique automatisation', icon: Clock3 },
  { label: 'Journal d’audit', icon: Clock3 },
  { label: 'Équipe', icon: Users },
  { label: 'Abonnement', icon: WalletCards },
  { label: 'Assistant IA', icon: Sparkles },
]

const invoicePdfCopies: Record<string, { title: string; totalLabel: string; closing: string; payment: string }> = {
  STANDARD: { title: 'FACTURE', totalLabel: 'TOTAL À PAYER', closing: 'Facture commerciale établie au Bénin.', payment: 'Conditions de règlement : paiement à la date d’échéance indiquée ci-dessus.' },
  PROFORMA: { title: 'FACTURE PROFORMA', totalLabel: 'TOTAL ESTIMATIF', closing: 'Document proforma non définitif et non exigible comme facture finale.', payment: 'Cette proforma constitue une estimation soumise à validation du client.' },
  DEPOSIT: { title: "FACTURE D'ACOMPTE", totalLabel: "MONTANT DE L'ACOMPTE", closing: 'Acompte à valoir sur la facture définitive.', payment: 'Le solde sera régularisé lors de l’émission de la facture définitive.' },
  CREDIT_NOTE: { title: "FACTURE D'AVOIR", totalLabel: 'TOTAL À CRÉDITER', closing: 'Avoir venant corriger ou annuler une facturation antérieure.', payment: 'Le montant sera déduit d’une prochaine échéance ou remboursé selon accord.' },
  FINAL: { title: 'FACTURE DÉFINITIVE', totalLabel: 'TOTAL À PAYER', closing: 'Facture définitive établie au Bénin.', payment: 'Conditions de règlement : paiement à la date d’échéance indiquée ci-dessus.' },
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
  const [summary, setSummary] = useState<FinancialSummary>({ revenue: 0, expenses: 0, profit: 0, invoiceCount: 0, outstanding: 0, openInvoiceCount: 0, clientCount: 0, paidCount: 0, overdueCount: 0, periodLabel: '', previousPeriodLabel: '', previousRevenue: 0, previousExpenses: 0, previousProfit: 0, previousInvoiceCount: 0 })

  useEffect(() => {
    const path = window.location.pathname
    if (session || path === '/reset-password' || path.startsWith('/devis/')) {
      setNoIndexMetadata()
    }
  }, [session])
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
  const canCreatePurchase = canEdit
  const canRegisterPurchasePayment = canEdit
  const canManageSuppliers = businessRole === 'owner' || businessRole === 'admin'
  const canCorrectPurchases = businessRole === 'owner' || businessRole === 'admin'
  const demoOwnerAccess = businessRole === 'owner'
    && isDemoOwnerOverride(session?.user?.email)
    && !subscriptionExpired
  const accessiblePages = useMemo(() => {
    const pages = new Set<string>(businessRole && businessRole !== 'none'
      ? ['Tableau de bord', 'Clients', 'Produits & Services', 'Factures', 'Caisse et ventes rapides', 'Relances et recouvrement', 'Paiements', 'Dépenses', 'Fournisseurs et achats', 'Besoin d’aide', 'Mon compte']
      : [])
    if (businessRole && businessRole !== 'none') pages.add('Assistant IA')
    if (businessRole && businessRole !== 'none' && (demoOwnerAccess || hasFeatureForUser(subscriptionPlan, 'stock', session?.user?.email))) pages.add('Stock')
    if (businessRole && businessRole !== 'none' && (demoOwnerAccess || hasFeatureForUser(subscriptionPlan, 'reports', session?.user?.email))) {
      pages.add('Rapports')
      pages.add('Trésorerie et prévisions')
    }
    if (businessRole && businessRole !== 'none') {
      pages.add('Devis')
    }
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
      pages.add('Préparation DGI')
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
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setDataMessage('La fenêtre d’impression a été bloquée. Autorisez les fenêtres pop-up pour ce site puis réessayez.')
      return
    }
    printWindow.opener = null

    try {
      const invoice = await loadInvoicePdfData(businessId, invoiceNumber)
      const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
      const business = Array.isArray(invoice.businesses) ? invoice.businesses[0] : invoice.businesses
      const profile = businessProfile ?? await loadBusinessProfile(businessId)
      const items = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : []
      const currency = invoice.currency === 'EUR' || invoice.currency === 'USD' ? invoice.currency : 'FCFA'
      const basePdfCopy = invoicePdfCopies[invoice.invoice_type] ?? invoicePdfCopies.STANDARD
      const pdfCopy = getBeninDocumentPdfCopy(invoice.benin_document_type, basePdfCopy, invoicePdfCopies.PROFORMA)
      const formatCurrency = (amount: number) => `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\u202f/g, ' ')} ${currency}`
      const formatDate = (value: string | null) => value ? formatBusinessDateKey(value, profile.timezone) : '—'
      const fiscalRegimeLabel = invoice.reg_fiscal_emetteur === 'TPS' ? 'TPS' : invoice.reg_fiscal_emetteur === 'REEL' ? 'Régime réel' : 'Non renseigné'
      const taxLabel = getBeninTaxLabel(invoice.reg_fiscal_emetteur)
      const hasDgiReferences = Boolean(invoice.dgi_nim && invoice.dgi_counters && invoice.dgi_signature)
      const dgiReferenceBlock = hasDgiReferences
        ? `<div class="dgi-meta"><strong>${invoice.is_dgi_mock ? 'SIMULATION FICTIVE — NON OFFICIELLE' : 'Références saisies manuellement — authenticité non vérifiée'}</strong><p>NIM : ${escapeHtml(invoice.dgi_nim)}<br>Compteur : ${escapeHtml(invoice.dgi_counters)}<br>Signature : ${escapeHtml(invoice.dgi_signature)}</p></div>`
        : '<p class="internal-notice">Document de gestion interne — aucune référence e-MECeF n’est enregistrée dans FactureFacile.</p>'
      const rows = items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${formatCurrency(Number(item.unit_price))}</td><td>${formatCurrency(Number(item.total))}</td></tr>`).join('')
      const logo = profile.logo_url ? `<img class="invoice-logo" src="${escapeHtml(profile.logo_url)}" alt="Logo" />` : ''
      const businessName = business?.name ?? profile.name
      const legalNotice = profile.invoice_legal_notice?.trim()
      const paymentInstructions = profile.payment_instructions?.trim()
      printWindow.document.write(`<html><head><title>${escapeHtml(invoice.invoice_number)}</title><style>body{font-family:Arial;color:#192b45;padding:40px;max-width:900px;margin:auto}header{display:flex;justify-content:space-between;border-bottom:2px solid #2475e8;padding-bottom:20px}.invoice-logo{width:72px;height:72px;object-fit:contain;display:block;margin-bottom:8px}h1{color:#2475e8;margin:0 0 8px}.meta{color:#586b82;font-size:12px;line-height:1.6}.box{border:1px solid #dbe4ee;border-radius:5px;padding:14px;margin-top:24px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}th{background:#f1f6fc;text-transform:uppercase;font-size:10px}.summary{text-align:right;margin:25px 0 0 auto;width:320px}.summary p{display:flex;justify-content:space-between;margin:8px 0}.total{font-size:20px;font-weight:bold;border-top:2px solid #2475e8;padding-top:12px}.legal{margin-top:35px;padding-top:12px;border-top:1px solid #dbe4ee;color:#66778c;font-size:10px;text-align:center;white-space:pre-wrap}.legal p{margin:5px 0}.dgi-meta{margin:12px 0;padding:10px;border:1px solid #dbe4ee;border-radius:5px;font-size:10px}.dgi-meta p{line-height:1.5;overflow-wrap:anywhere}.internal-notice{font-weight:bold;color:#854d0e}@media print{body{padding:0}}</style></head><body><header><div>${logo}<h1>${escapeHtml(pdfCopy.title)}</h1><strong>${escapeHtml(businessName ?? 'Entreprise')}</strong><p class="meta">${escapeHtml(business?.address ?? profile.address ?? '')}<br>${escapeHtml(business?.city ?? profile.city ?? '')} ${escapeHtml(business?.country ?? profile.country ?? 'Bénin')}<br>${escapeHtml(business?.email ?? profile.email ?? '')} · ${escapeHtml(business?.phone ?? profile.phone ?? '')}<br>${profile.tax_id ? `IFU : ${escapeHtml(profile.tax_id)}` : ''}</p></div><div><h2>${escapeHtml(invoice.invoice_number)}</h2><p class="meta">Date d’émission : ${formatDate(invoice.issue_date)}<br>Date d’échéance : ${formatDate(invoice.due_date)}<br>Devise : ${currency}<br>Régime fiscal : ${fiscalRegimeLabel}</p></div></header><div class="box"><strong>FACTURÉ À</strong><p class="meta">${escapeHtml(client?.name ?? '')}<br>${escapeHtml(client?.email ?? '')}<br>${escapeHtml(client?.phone ?? '')}</p></div><table><thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><p><span>Sous-total</span><strong>${formatCurrency(Number(invoice.subtotal))}</strong></p><p><span>Réduction</span><strong>- ${formatCurrency(Number(invoice.discount))}</strong></p><p><span>${escapeHtml(taxLabel)}</span><strong>${formatCurrency(Number(invoice.tax))}</strong></p><p class="total"><span>${escapeHtml(pdfCopy.totalLabel)}</span><strong>${formatCurrency(Number(invoice.total))}</strong></p></div><div class="legal"><p>${escapeHtml(pdfCopy.closing)} ${escapeHtml(pdfCopy.payment)}</p>${paymentInstructions ? `<p>Modalités de règlement : ${escapeHtml(paymentInstructions)}</p>` : ''}${legalNotice ? `<p>${escapeHtml(legalNotice)}</p>` : ''}${dgiReferenceBlock}<p>Document établi au Bénin - conserver cette pièce pour votre comptabilité.</p></div><script>window.onload=()=>window.print()</script></body></html>`)
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
        const basePdfCopy = invoicePdfCopies[invoice.invoice_type] ?? invoicePdfCopies.STANDARD
        const pdfCopy = getBeninDocumentPdfCopy(invoice.benin_document_type, basePdfCopy, invoicePdfCopies.PROFORMA)
        const amount = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\u202f/g, ' ')} ${currency}`
        const formatDate = (value: string | null) => value ? formatBusinessDateKey(value, profile.timezone) : '—'
        const fiscalRegimeLabel = invoice.reg_fiscal_emetteur === 'TPS' ? 'TPS' : invoice.reg_fiscal_emetteur === 'REEL' ? 'Régime réel' : 'Non renseigné'
        const taxLabel = getBeninTaxLabel(invoice.reg_fiscal_emetteur)
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
        pdf.text(`Régime fiscal : ${fiscalRegimeLabel}`, 145, y + 29)
        y += 49
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
        pdf.text(`${taxLabel} : ${amount(Number(invoice.tax))}`, 120, y)
        y += 10
        pdf.setFontSize(13)
        pdf.text(`${pdfCopy.totalLabel} : ${amount(Number(invoice.total))}`, 120, y)
        y += 14
        pdf.setFontSize(9)
        pdf.setTextColor(85, 102, 125)
        pdf.text(`${pdfCopy.closing} Montant : ${amount(Number(invoice.total))}`, 20, y)
        y += 9
        const hasDgiReferences = Boolean(invoice.dgi_nim && invoice.dgi_counters && invoice.dgi_signature)
        const dgiNotice = hasDgiReferences
          ? `${invoice.is_dgi_mock ? 'SIMULATION FICTIVE — NON OFFICIELLE' : 'Références saisies manuellement — authenticité non vérifiée'}\nNIM : ${invoice.dgi_nim}\nCompteur : ${invoice.dgi_counters}\nSignature : ${invoice.dgi_signature}`
          : 'Document de gestion interne — aucune référence e-MECeF n’est enregistrée dans FactureFacile.'
        const legalLines = pdf.splitTextToSize(`${profile.invoice_legal_notice?.trim() ? `${profile.invoice_legal_notice.trim()}\n` : ''}${dgiNotice}\nDocument établi au Bénin - conserver cette pièce pour votre comptabilité.`, 170)
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
    const taxRate = businessProfile?.fiscal_regime === 'TPS' ? 0 : businessProfile?.fiscal_regime === 'REEL' ? 18 : Number(invoiceTaxRate)
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
  const refreshAfterCashRegisterSale = () => {
    setInvoiceRefreshKey((current) => current + 1)
    void Promise.all([
      loadInvoices(businessId, businessProfile?.timezone),
      loadFinancialSummary(businessId),
      loadFinancialReport(businessId),
      loadDashboardAnalytics(businessId),
    ]).then(([invoices, financialSummary, financialReport, analytics]) => {
      setDashboardInvoices(invoices)
      setSummary(financialSummary)
      setMonthlyRevenue(financialReport.monthly.slice(-6))
      setDashboardAnalytics(analytics)
      setDataMessage('')
    }).catch((cause) => {
      setDataMessage(cause instanceof Error
        ? `Vente encaissée, mais les indicateurs du tableau de bord n’ont pas pu être actualisés : ${cause.message}`
        : 'Vente encaissée, mais les indicateurs du tableau de bord n’ont pas pu être actualisés.')
    })
  }
  const invoiceSubtotal = invoiceLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0)
  const invoiceDiscountAmount = Math.min(Math.max(Number(invoiceDiscount) || 0, 0), invoiceSubtotal)
  const invoiceTaxable = Math.max(invoiceSubtotal - invoiceDiscountAmount, 0)
  const invoiceEffectiveTaxRate = businessProfile?.fiscal_regime === 'TPS' ? 0 : businessProfile?.fiscal_regime === 'REEL' ? 18 : Number(invoiceTaxRate)
  const invoiceTaxAmount = invoiceTaxable * (Math.max(invoiceEffectiveTaxRate || 0, 0) / 100)
  const invoiceTaxLabel = businessProfile?.fiscal_regime === 'TPS' ? 'Taxe (TPS — 0 %)' : businessProfile?.fiscal_regime === 'REEL' ? 'TVA (régime réel — 18 %)' : 'TVA / taxe'
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
  if (window.location.pathname.startsWith('/devis/')) {
    const token = window.location.pathname.slice('/devis/'.length).split('/')[0]
    if (token) return <PublicQuotePage token={token} />
  }
  if (!session) return <AuthScreen />
  if (mfaGate === 'checking') return <div className="auth-loading">Vérification de la sécurité du compte...</div>
  if (mfaGate === 'required') return <MfaChallengeScreen onVerified={(verifiedSession) => { setSession(verifiedSession); setMfaGate('verified') }} />
  if (mfaGate === 'error') return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SÉCURITÉ DU COMPTE</p><h1>Vérification impossible</h1><p className="auth-message">{mfaGateError || 'La vérification MFA a échoué. Réessayez ou reconnectez-vous.'}</p><button className="primary-button full-width" onClick={() => { setMfaGate('checking'); setMfaCheckKey((current) => current + 1) }}>Réessayer</button><button className="outline-button full-width" onClick={() => void supabase.auth.signOut()}>Se déconnecter</button></section></main>
  if (businessRole === null) return <div className="auth-loading">Chargement de votre espace professionnel...</div>
  if (businessRole === 'none' && !platformAdminOverview) return <div className="auth-loading"><h1>Accès refusé</h1><p>Votre compte n’est associé à aucune entreprise.</p><button className="outline-button" onClick={() => void supabase.auth.signOut()}>Se déconnecter</button></div>
  if (platformAdminOverview) return <Suspense fallback={<div className="auth-loading">Chargement de l’administration...</div>}><PlatformAdminShell overview={platformAdminOverview} session={session} /></Suspense>

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
          {accessiblePages.has('Préparation DGI') && <button className={`nav-item ${activePage === 'Préparation DGI' ? 'active' : ''}`} onClick={() => navigate('Préparation DGI')}>
            <ShieldCheck size={19} />
            <span>Préparation DGI</span>
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
                  {dataMessage && <p className="data-warning">{dataMessage}</p>}
                </div>
                {canEdit && <button className="primary-button" onClick={openInvoiceModal}>
                  <Plus size={18} />
                  Nouvelle facture
                </button>}
              </section>

              <section className="stats-grid" aria-label="Indicateurs clés">
                <StatCard title="Encaissements reçus" value={summary.revenue.toLocaleString('fr-FR')} suffix={displayCurrency} detail={`Paiements reçus du ${summary.periodLabel}`} change={formatPeriodComparison(summary.revenue, summary.previousRevenue).label} trend={formatPeriodComparison(summary.revenue, summary.previousRevenue).trend} icon={<WalletCards size={20} />} tone="blue" period={false} onClick={() => navigate('Paiements')} destination="Paiements" />
                <StatCard title="Factures émises" value={String(summary.invoiceCount)} detail={`${summary.paidCount} soldée(s) · du ${summary.periodLabel} · hors brouillons et annulées`} change={formatPeriodComparison(summary.invoiceCount, summary.previousInvoiceCount).label} trend={formatPeriodComparison(summary.invoiceCount, summary.previousInvoiceCount).trend} icon={<FileText size={20} />} tone="purple" period={false} onClick={() => navigate('Factures')} destination="Factures" />
                <StatCard title="Solde à recouvrer" value={summary.outstanding.toLocaleString('fr-FR')} suffix={displayCurrency} detail={summary.openInvoiceCount ? `${summary.openInvoiceCount} facture(s) non soldée(s) · solde actuel` : 'Aucune facture envoyée ou partiellement payée'} change={`${summary.overdueCount} en retard`} trend={summary.overdueCount ? 'down' : 'up'} icon={<WalletCards size={20} />} tone="orange" period={false} onClick={() => navigate('Factures')} destination="Factures" />
                <StatCard title="Solde net estimé" value={summary.profit.toLocaleString('fr-FR')} suffix={displayCurrency} detail={`Encaissements moins dépenses du ${summary.periodLabel}`} change={formatPeriodComparison(summary.profit, summary.previousProfit).label} trend={formatPeriodComparison(summary.profit, summary.previousProfit).trend} icon={<TrendingUp size={20} />} tone="green" period={false} onClick={() => navigate('Dépenses')} destination="Dépenses" />
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
          ) : activePage === 'Caisse et ventes rapides' ? <CashRegisterPage
            businessId={businessId}
            currency={displayCurrency}
            timezone={businessProfile?.timezone ?? 'Africa/Porto-Novo'}
            fiscalRegime={businessProfile?.fiscal_regime}
            defaultTaxRate={Number(businessProfile?.default_tax_rate ?? 0)}
            onPrintReceipt={(invoiceNumber) => void printInvoice(invoiceNumber)}
            onSaleComplete={refreshAfterCashRegisterSale}
          /> : (
            activePage === 'Administration' ? <Suspense fallback={<div className="auth-loading">Chargement de l’administration...</div>}><PlatformAdminPage overview={platformAdminOverview} /></Suspense> : activePage === 'Rapports' ? <Suspense fallback={<div className="auth-loading">Chargement des rapports...</div>}><ReportPage businessId={businessId} currency={businessProfile?.currency ?? 'FCFA'} legalNotice={businessProfile?.invoice_legal_notice} fiscalRegime={businessProfile?.fiscal_regime} /></Suspense> : activePage === 'Trésorerie et prévisions' ? <Suspense fallback={<div className="auth-loading">Chargement de la trésorerie...</div>}><CashflowPage businessId={businessId} currency={displayCurrency} timezone={businessProfile?.timezone ?? 'Africa/Porto-Novo'} /></Suspense> : activePage === 'Devis' ? <Suspense fallback={<div className="auth-loading">Chargement des devis...</div>}><QuotesPage businessId={businessId} currency={displayCurrency} timezone={businessProfile?.timezone ?? 'Africa/Porto-Novo'} canEdit={canEdit} defaultTaxRate={Number(businessProfile?.default_tax_rate ?? 18)} /></Suspense> : activePage === 'Relances et recouvrement' ? <Suspense fallback={<div className="auth-loading">Chargement du recouvrement...</div>}><OverdueRemindersPage businessId={businessId} currency={displayCurrency} timezone={businessProfile?.timezone ?? 'Africa/Porto-Novo'} canEdit={canEdit} canManageAutomation={businessRole === 'owner' || businessRole === 'admin'} /></Suspense> : activePage === 'Fournisseurs et achats' ? <Suspense fallback={<div className="auth-loading">Chargement des achats...</div>}><SuppliersPurchasesPage businessId={businessId} currency={displayCurrency} timezone={businessProfile?.timezone ?? 'Africa/Porto-Novo'} canCreatePurchase={canCreatePurchase} canRegisterPayment={canRegisterPurchasePayment} canManageSuppliers={canManageSuppliers} canCorrectPurchases={canCorrectPurchases} /></Suspense> : activePage === 'Assistant IA' ? <AiAssistantPage businessId={businessId} onUseInvoice={(draft) => {
              const usableLines = draft.lines.flatMap((line) => {
                const product = products.find((item) => item.id === line.productId)
                return product ? [{ product, quantity: line.quantity }] : []
              })
              setInvoiceLines(usableLines)
              setSelectedClient('')
              openInvoiceModal()
              setDataMessage(usableLines.length < draft.lines.length ? 'Certaines lignes n’existent pas dans votre catalogue et doivent être ajoutées manuellement.' : '')
            }} /> : activePage === 'Mon entreprise' ? <BusinessPage businessId={businessId} /> : activePage === 'Paramètres' ? <SettingsPage businessId={businessId} onProfileChanged={(profile) => setBusinessProfile(profile)} /> : activePage === 'Préparation DGI' ? <DgiPreparationPage businessId={businessId} onProfileChanged={(profile) => setBusinessProfile(profile)} /> : activePage === 'Mon compte' ? <AccountSecurityPage email={session.user.email ?? ''} businessId={businessId} fullName={typeof session.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name : ''} phone={typeof session.user.user_metadata?.phone === 'string' ? session.user.user_metadata.phone : ''} avatarUrl={typeof session.user.user_metadata?.avatar_url === 'string' ? session.user.user_metadata.avatar_url : ''} onAvatarChanged={(url) => setSession((current) => current ? { ...current, user: { ...current.user, user_metadata: { ...current.user.user_metadata, avatar_url: url } } } : current)} /> : activePage === 'Journal d’audit' ? <AuditPage businessId={businessId} /> : activePage === 'Équipe' ? <TeamPage businessId={businessId} userId={session?.user?.id ?? ''} /> : activePage === 'Abonnement' ? <SubscriptionPage businessId={businessId} demoAccess={demoOwnerAccess} onSubscriptionChange={handleSubscriptionChange} /> : activePage === 'Besoin d’aide' ? <HelpPage businessId={businessId} email={session.user.email ?? ''} fullName={typeof session.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name : ''} accessiblePages={accessiblePages} onNavigate={navigate} />             : <Suspense fallback={<div className="auth-loading">Chargement du module...</div>}><ModulePage page={activePage} businessId={businessId} currency={displayCurrency} timezone={businessProfile?.timezone ?? 'Africa/Porto-Novo'} canEdit={canEdit} canEmail={canEdit} invoiceRefreshKey={invoiceRefreshKey} onBack={() => navigate('Tableau de bord')} onCreate={() => activePage === 'Factures' ? openInvoiceModal() : undefined} onPrint={printInvoice} onDownload={downloadInvoicePdf} onEmail={emailInvoice} /></Suspense>
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
            <div className="invoice-adjustments"><label>Réduction ({invoiceCurrency})<input type="number" min="0" max={invoiceSubtotal} step="0.01" value={invoiceDiscount} onChange={(event) => setInvoiceDiscount(event.target.value)} /></label><label>{businessProfile?.fiscal_regime ? `${invoiceTaxLabel}` : 'Taux de taxe (%)'}<input type="number" min="0" max="100" step="0.01" value={invoiceEffectiveTaxRate} onChange={(event) => setInvoiceTaxRate(event.target.value)} disabled={!!businessProfile?.fiscal_regime} /><small>{businessProfile?.fiscal_regime ? 'Taux verrouillé selon le régime fiscal de l’entreprise.' : 'Aucun régime fiscal n’est défini ; vérifiez le taux applicable.'}</small></label></div>
            <div className="invoice-summary"><div><span>Sous-total</span><strong>{formatInvoiceAmount(invoiceSubtotal)}</strong></div><div><span>Réduction</span><strong>- {formatInvoiceAmount(invoiceDiscountAmount)}</strong></div><div><span>{invoiceTaxLabel}</span><strong>{formatInvoiceAmount(invoiceTaxAmount)}</strong></div><div className="invoice-summary-total"><span>Total estimé</span><strong>{formatInvoiceAmount(invoiceTotal)}</strong></div></div>
            {dataMessage && <div className="settings-message">{dataMessage}</div>}
            <button className="primary-button full-width" disabled={invoiceBusy}>{invoiceBusy ? 'Enregistrement...' : 'Créer la facture'}</button>
          </form>
        </div>
      )}
    </div>
  )
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
      const [{ runAiAction }, { normalizeAiInvoiceDraft }] = await Promise.all([
        import('./lib/ai'),
        import('./lib/aiRules'),
      ])
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
    { title: 'Relances et recouvrement', page: 'Relances et recouvrement', body: 'Repérez les factures échues, préparez un texte de rappel et envoyez-le vous-même par le canal de votre choix. Le statut envoyé n’est enregistré qu’après votre confirmation.' },
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
      await updateBusinessProfile(businessId, { name, phone: nextProfile.phone, email: nextProfile.email, address: nextProfile.address, city: nextProfile.city, country: nextProfile.country, tax_id: nextProfile.tax_id, fiscal_regime: nextProfile.fiscal_regime, logo_url: nextProfile.logo_url, payment_instructions: nextProfile.payment_instructions?.trim() || null, invoice_legal_notice: nextProfile.invoice_legal_notice?.trim() || null, default_due_days: nextProfile.default_due_days, default_tax_rate: nextProfile.default_tax_rate, currency: nextProfile.currency, timezone: nextProfile.timezone, invoice_number_prefix: nextProfile.invoice_number_prefix, invoice_number_include_year: nextProfile.invoice_number_include_year, invoice_number_sequence_width: nextProfile.invoice_number_sequence_width })
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
  const taxRate = String(profile.fiscal_regime === 'TPS' ? 0 : profile.fiscal_regime === 'REEL' ? 18 : profile.default_tax_rate)
  const currentBusinessYear = Number(getBusinessDateKey(new Date(), profile.timezone).slice(0, 4))
  const invoiceNumberExample = formatInvoiceNumberExample(profile.invoice_number_prefix, profile.invoice_number_include_year, profile.invoice_number_sequence_width, currentBusinessYear)
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextDueDays = Number(dueDays)
    const nextTaxRate = profile.fiscal_regime === 'TPS' ? 0 : profile.fiscal_regime === 'REEL' ? 18 : Number(taxRate)
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
        country: nextProfile.country, tax_id: nextProfile.tax_id, fiscal_regime: nextProfile.fiscal_regime, logo_url: nextProfile.logo_url, payment_instructions: nextProfile.payment_instructions,
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
            <div><h2>Valeurs par défaut</h2><p>Ces préférences s’appliquent aux nouvelles factures ; le régime fiscal fixe le taux de taxe.</p></div>
          </div>
          <div className="settings-fields">
            <label>
              <span>Délai d’échéance par défaut <small>en jours</small></span>
              <input type="number" min="0" max="365" step="1" value={dueDays} onChange={(event) => setProfile({ ...profile, default_due_days: Number(event.target.value) })} />
              <small className="field-hint">Exemple : 30 jours après la date de facture.</small>
            </label>
            <label>
              <span>Régime fiscal de l’entreprise</span>
              <select value={profile.fiscal_regime ?? ''} onChange={(event) => {
                const fiscalRegime = event.target.value === 'TPS' || event.target.value === 'REEL' ? event.target.value : null
                setProfile({ ...profile, fiscal_regime: fiscalRegime, default_tax_rate: fiscalRegime === 'TPS' ? 0 : fiscalRegime === 'REEL' ? 18 : profile.default_tax_rate })
              }}>
                <option value="">À renseigner</option>
                <option value="TPS">TPS — taux par défaut 0 %</option>
                <option value="REEL">Régime réel — taux par défaut 18 %</option>
              </select>
              <small className="field-hint">Cette valeur est enregistrée sur les nouvelles factures. Le régime fixe le taux par défaut à 0 % (TPS) ou 18 % (réel) ; vérifiez les règles applicables à votre activité.</small>
            </label>
            <label>
              <span>Taux de taxe par défaut <small>en %</small></span>
              <input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setProfile({ ...profile, default_tax_rate: Number(event.target.value) })} disabled={!!profile.fiscal_regime} />
              <small className="field-hint">{profile.fiscal_regime ? `Valeur verrouillée par le régime ${profile.fiscal_regime === 'TPS' ? 'TPS (0 %)' : 'réel (18 %)'} .` : 'Sans régime renseigné, vérifiez le taux à appliquer.'}</small>
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
