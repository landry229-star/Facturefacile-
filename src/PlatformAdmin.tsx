import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Bell, ChevronRight, CircleHelp, Clock3, Eye, FileText, Lightbulb, LayoutDashboard, LockKeyhole, LogOut, Menu, Plug, RefreshCw, Search, Server, Settings, ShieldCheck, ShoppingBag, TrendingUp, UserCog, UserRound, Users, WalletCards, X } from 'lucide-react'
import { userFacingError } from './lib/errors'
import { appIcon } from './lib/branding'
import { StatCard } from './components/StatCard'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { addPlatformTicketMessage, loadPlatformAnalytics, assignPlatformTicket, createPlatformAdminAccount, managePlatformAdminAccount, deletePlatformUser, deletePlatformAuditLogs, createPlatformIncident, loadPlatformAdminAccounts, loadPlatformAdminOverview, loadPlatformAdminRole, loadPlatformUsersDetailed, loadPlatformUserDetail, loadPlatformBusinessesDetailed, loadPlatformBusinessDetail, loadPlatformAdminSubscriptions, loadPlatformSubscriptionDetail, loadPlatformSubscriptionPlans, loadPlatformSubscriptionPayments, loadPlatformSupportTickets, loadPlatformSupportTicketDetail, loadPlatformNotifications, loadPlatformNotificationPreferences, loadPublicSiteConfig, updatePublicSiteConfig, markAllPlatformNotificationsRead, archivePlatformNotification, loadPlatformAuditLogs, loadPlatformSecurityEvents, loadPlatformIncidents, loadPlatformIntegrations, loadPlatformHealth, loadPlatformOperationalSummary, loadPlatformActivity, loadPlatformContent, loadPlatformSettings, markPlatformNotificationRead, markPlatformNotificationUnread, searchPlatformGlobal, setPlatformBusinessStatus, setPlatformUserStatus, updatePlatformAdminPassword, updatePlatformAdminProfile, updatePlatformAdminEmail, updatePlatformAdminPreferences, updatePlatformAdminRole, updatePlatformIncidentStatus, updatePlatformIncidentReport, updatePlatformTicketPriority, updatePlatformTicketStatus, updatePlatformSetting, setPlatformNotificationPreference, upsertPlatformContent, uploadPlatformAdminAvatar, loadPlatformAdminProfile } from './lib/data'
import type { PlatformAnalyticsFilters, PlatformAdminAccount, PublicSiteConfig } from './lib/data'
import { resolveEffectiveSubscriptionState, subscriptionPlanLabels } from './lib/subscription'
import { defaultPublicSiteConfig } from './lib/publicSiteDefaults'

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

export function PlatformAdminShell({ overview, session }: { overview: NonNullable<Awaited<ReturnType<typeof loadPlatformAdminOverview>>>; session: Session }) {
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

export function PlatformAdminPage({ overview, role = null, loading = false, error = '', operationalSummary = null, activity = [], onRetry = () => undefined, onOpenSupport = () => undefined, onOpenHealth = () => undefined, onOpenSecurity = () => undefined, onOpenSection = () => undefined, onRefresh = () => undefined }: { overview: NonNullable<Awaited<ReturnType<typeof loadPlatformAdminOverview>>> | null; role?: string | null; loading?: boolean; error?: string; operationalSummary?: Awaited<ReturnType<typeof loadPlatformOperationalSummary>> | null; activity?: Awaited<ReturnType<typeof loadPlatformActivity>>; onRetry?: () => void; onOpenSupport?: () => void; onOpenHealth?: () => void; onOpenSecurity?: () => void; onOpenSection?: (section: PlatformAdminSection) => void; onRefresh?: () => void }) {
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
