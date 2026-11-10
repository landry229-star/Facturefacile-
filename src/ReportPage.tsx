import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, FileText, TrendingUp, WalletCards } from 'lucide-react'
import { formatPeriodComparison } from './lib/dashboardMetrics'
import { supabase } from './lib/supabase'
import { createAccountingExportRows, serializeAccountingCsv, type AccountingInvoice } from './lib/accountingExport'

const formatMoney = (amount: number, currency = 'FCFA') =>
  `${new Intl.NumberFormat('fr-FR', { useGrouping: true, maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0).replace(/[\u202f\u00a0/]/g, ' ')} ${currency}`

const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  const csv = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function StatCard({ title, value, suffix, change, trend, icon, tone, period = true }: {
  title: string
  value: string
  suffix?: string
  change: string
  trend: 'up' | 'down'
  icon: ReactNode
  tone: string
  period?: boolean
}) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><p>{title}</p><strong>{value} <small>{suffix}</small></strong><span className={trend === 'up' ? 'positive' : 'negative'}>{trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}{period && <em>ce mois</em>}</span></div>
}

function RevenueChart({ monthly }: { monthly: { month: string; amount: number }[] }) {
  const values = monthly.length ? monthly.map((item) => item.amount) : [0]
  const maximum = Math.max(...values, 1)
  const points = values.map((value, index) => `${values.length === 1 ? 350 : (index / (values.length - 1)) * 700},${170 - (value / maximum) * 145}`).join(' ')
  const labels = monthly.map((item) => new Date(`${item.month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }))
  return <div className="chart-area"><div className="chart-y-axis"><span>{maximum.toLocaleString('fr-FR')}</span><span>{Math.round(maximum * .75).toLocaleString('fr-FR')}</span><span>{Math.round(maximum * .5).toLocaleString('fr-FR')}</span><span>{Math.round(maximum * .25).toLocaleString('fr-FR')}</span><span>0</span></div><div className="chart"><div className="chart-grid"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 700 180" preserveAspectRatio="none" role="img" aria-label="Courbe réelle du chiffre d'affaires"><polyline points={points} fill="none" stroke="#3182f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx={values.length === 1 ? 350 : (values.length - 1) / Math.max(values.length - 1, 1) * 700} cy={170 - (values[values.length - 1] / maximum) * 145} r="4" fill="#3182f6" /></svg><div className="chart-x-axis">{labels.length ? labels.map((label) => <span key={label}>{label}</span>) : <span>Aucune donnée</span>}</div></div></div>
}

function ReportPage({ businessId, currency, legalNotice, fiscalRegime }: {
  businessId: string
  currency: string
  legalNotice?: string | null
  fiscalRegime?: 'TPS' | 'REEL' | null
}) {
 const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '180d' | '365d' | 'custom'>('30d')
 const [customFrom, setCustomFrom] = useState('')
 const [customTo, setCustomTo] = useState('')
 const [accountingExportBusy, setAccountingExportBusy] = useState(false)
 const [accountingExportError, setAccountingExportError] = useState('')
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
   dateRange: { from: string; to: string }
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
         dateRange: { from: range.from, to: range.to },
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

 const exportAccountingCsv = async () => {
   setAccountingExportBusy(true)
   setAccountingExportError('')
   try {
     if (!report) throw new Error('Le rapport doit être chargé avant de générer l’export.')
     const currentReport = report
     const invoices: AccountingInvoice[] = []
     for (let offset = 0; ; offset += 1000) {
       const result = await supabase.from('invoices')
         .select('invoice_number, issue_date, invoice_type, subtotal, discount, tax, total, status, reg_fiscal_emetteur, benin_document_type, dgi_nim, dgi_signature, is_dgi_mock, clients(name, tax_id), payments(amount, effective_amount, payment_date, method, reference, status, transaction_type, momo_reconciliations(provider, transaction_id, status))')
         .eq('business_id', businessId)
         .gte('issue_date', currentReport.dateRange.from)
         .lte('issue_date', currentReport.dateRange.to)
         .order('issue_date', { ascending: true })
         .order('invoice_number', { ascending: true })
         .range(offset, offset + 999)
       if (result.error) throw result.error
       const batch = (result.data ?? []) as AccountingInvoice[]
       invoices.push(...batch)
       if (batch.length < 1000) break
     }

     const rows = createAccountingExportRows(invoices, legalNotice, fiscalRegime)
     const csv = serializeAccountingCsv(rows, currency)
     const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
     const url = URL.createObjectURL(blob)
     const link = document.createElement('a')
     link.href = url
     link.download = `export-comptable-benin-${currentReport.dateRange.from}-${currentReport.dateRange.to}.csv`
     link.click()
     URL.revokeObjectURL(url)
   } catch (reason) {
     setAccountingExportError(reason instanceof Error ? reason.message : 'Impossible de générer l’export comptable.')
   } finally {
     setAccountingExportBusy(false)
   }
 }

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
         <button className="outline-button" type="button" onClick={() => void exportAccountingCsv()} disabled={accountingExportBusy}>
           <FileText size={15} /> {accountingExportBusy ? 'Préparation...' : 'Export comptable Bénin'}
         </button>
         <button className="outline-button" onClick={() => exportPdf()}>
           <FileText size={15} /> Exporter PDF
         </button>
         <button className="outline-button" onClick={() => window.print()}>
           <FileText size={15} /> Imprimer
         </button>
       </div>
     </div>
     {accountingExportError && <p className="data-warning" role="alert">{accountingExportError}</p>}
     <p className="muted-cell">La période filtre les dates des factures; leurs règlements associés incluent leurs propres dates et statuts. Le régime fiscal et les métadonnées e-MECeF enregistrés sur les factures sont repris dans l’export ; la signature est marquée comme simulation si elle est fictive. Les références Mobile Money sont exportées lorsqu’elles sont enregistrées.</p>

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

export default ReportPage
