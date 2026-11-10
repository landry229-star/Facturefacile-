import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, AlertTriangle, Clock3, Download, Upload, Eye, FileText, Calendar, Package, Plus, Search, ShieldCheck, TrendingUp, Users, WalletCards, Mail, RefreshCw, Trash2, X, Repeat2, CheckCircle2, PauseCircle, CalendarDays } from 'lucide-react';
import { StatCard } from './components/StatCard';
import { getClientSegment, cancelInvoice, createExpense, createExpenseReceiptUrl, createClient, createPayment, createProduct, createRecurringInvoice, deleteClient, deleteExpense, deleteProduct, deleteStockMovement, deleteRecurringInvoice, loadInvoiceAuditLogs, loadInvoiceCommunications, loadBusinessProfile, loadClients, loadClientHistory, loadClientSummaries, loadExpenseRecords, loadInvoiceDetail, loadInvoices, loadPaymentInvoices, loadPayments, reconcilePayment, correctPayment, cancelPayment, refundPayment, loadProducts, loadProductHistory, loadRecurringInvoiceRuns, loadRecurringInvoices, loadRecurringOptions, loadStockMovements, toggleRecurringInvoice, updateRecurringInvoice, updateClient, archiveClient, updateExpense, uploadExpenseReceipt, updateInvoiceDetails, updateProduct, updateStock, uploadProductImage, retryRecurringInvoice, invoiceDocumentTypeLabels } from './lib/data';
import type { MissedRecurringInvoice, RecurringInvoiceRun, BusinessProfile, PaymentInvoiceOption, ClientHistory, ClientOption, ClientRecord, ExpenseRecord, InvoiceDetail, PaymentRecord, ProductOption, ProductRecord, RecurringInvoiceRow } from './lib/data';
import { getBusinessDateKey } from './lib/businessPreferences';
import { findClientDuplicates, parseClientImportRows } from './lib/clientTools';
import type { ImportedClient } from './lib/clientTools';
import { parseProductImportRows } from './lib/productTools';
import type { ProductImportRow } from './lib/productTools';
import { calculateStockDifference, calculateStockSummary, isValidStockMovementQuantity } from './lib/stockTools';
import { formatMoney, downloadCsv } from './lib/formatting';
import { invoiceFieldLabel } from './lib/invoiceLabels';
import { paymentMethodLabel, paymentStatusLabel } from './lib/paymentPresentation';
import { expensePaymentMethodLabel, getExpenseCategoryLabel, isExpensePaymentMethod, expenseTableRow } from './lib/expensePresentation';
import { diagnosticErrorMessage } from './lib/errors';

const productExportHeaders = ['Nom', 'Type', 'Référence', 'Catégorie', 'Sous-catégorie', 'Unité', 'Prix achat', 'Prix vente', 'Stock', 'Seuil alerte', 'Marge', 'Marge %', 'Statut', 'Image']
const productExportRows = (products: ProductRecord[]) => products.map((product) => {
  const margin = product.price - product.purchase_price
  return [product.name, product.product_type === 'product' ? 'Produit' : 'Service', product.reference ?? '', product.category, product.sub_category ?? '', product.unit, String(product.purchase_price), String(product.price), String(product.stock_quantity), String(product.low_stock_threshold), String(margin), product.purchase_price > 0 ? `${((margin / product.purchase_price) * 100).toFixed(2)}%` : '—', product.active ? 'Actif' : 'Inactif', product.image_url ?? '']
})

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
      const XLSX = await import('xlsx')
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
      const XLSX = await import('xlsx')
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

  const exportSelected = async (format: 'csv' | 'xlsx') => {
    const rows = productExportRows(selectedProducts)
    if (format === 'csv') {
      downloadCsv('catalogue-selection.csv', productExportHeaders, rows)
      return
    }
    setError('')
    try {
      const XLSX = await import('xlsx')
      const sheet = XLSX.utils.aoa_to_sheet([productExportHeaders, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Sélection')
      XLSX.writeFile(workbook, 'catalogue-selection.xlsx')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de créer le fichier Excel.')
    }
  }

  return <section className="panel product-management-tools">
    <div className="product-tools-heading"><div><span className="eyebrow">CATALOGUE</span><h2>Import et actions groupées</h2><p>Contrôlez vos imports avant validation et gérez plusieurs références à la fois.</p></div><span className="product-selection-count">{selectedProducts.length} sélectionné(s)</span></div>
    {error && <div className="data-warning product-tools-feedback" role="alert">{error}</div>}
    {summary && <div className="settings-message success product-tools-feedback" role="status">{summary}</div>}
    <div className="product-tools-actions">
      <div className="product-import-action"><div><strong>Importer le catalogue</strong><span>CSV ou Excel · aperçu et contrôle des erreurs inclus</span></div><button type="button" className="outline-button" disabled={!canEdit || busy} onClick={() => fileRef.current?.click()}><Upload size={15} />Choisir un fichier</button><input ref={fileRef} hidden type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void previewFile(file); event.currentTarget.value = '' }} /></div>
      <div className="product-bulk-actions"><div><strong>Actions groupées</strong><span>{selectedProducts.length ? `${selectedProducts.length} élément(s) sélectionné(s)` : 'Sélectionnez des lignes du tableau'}</span></div><button type="button" className="outline-button" disabled={!canEdit || busy || !selectedProducts.some((product) => product.active)} onClick={() => void setSelectedStatus(false)}>Désactiver</button><button type="button" className="outline-button" disabled={!canEdit || busy || !selectedProducts.some((product) => !product.active)} onClick={() => void setSelectedStatus(true)}>Réactiver</button><button type="button" className="outline-button" disabled={!selectedProducts.length} onClick={() => exportSelected('csv')}><Download size={14} />CSV</button><button type="button" className="outline-button" disabled={!selectedProducts.length} onClick={() => void exportSelected('xlsx')}><Download size={14} />Excel</button></div>
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
      const isCancelled = payment.status === 'cancelled'
      const isRefund = payment.transaction_type === 'refund'
      const accent = isRefund ? [165, 99, 56] : [22, 116, 72]
      const softBg = isRefund ? [255, 245, 239] : [236, 248, 242]
      const statusLabel = isPending ? 'EN ATTENTE DE RAPPROCHEMENT' : isCancelled ? 'ANNULÉ' : isRefund ? 'REMBOURSEMENT' : 'ENCAISSEMENT CONFIRMÉ'
      const statusColor = isPending ? [178, 95, 13] : isCancelled ? [166, 38, 38] : [19, 121, 89]
      const formattedAmount = formatMoney(payment.amount, currency)
      pdf.setFillColor(17, 78, 54)
      pdf.rect(0, 0, 210, 42, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text(isRefund ? 'AVIS DE REMBOURSEMENT' : 'REÇU DE PAIEMENT', 18, 21)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(`Émis le ${new Date().toLocaleString('fr-FR')}`, 18, 30)
      pdf.setTextColor(255, 255, 255)
      if (profile.logo_url) {
        try {
          const logoResponse = await fetch(profile.logo_url)
          if (logoResponse.ok) {
            const logoBlob = await logoResponse.blob()
            const bitmap = await createImageBitmap(logoBlob)
            try {
              const canvas = document.createElement('canvas')
              canvas.width = bitmap.width
              canvas.height = bitmap.height
              const context = canvas.getContext('2d')
              if (context) {
                context.drawImage(bitmap, 0, 0)
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 18, 9, 18, 18)
              }
            } finally {
              bitmap.close()
            }
          }
        } catch {
          // Le logo est facultatif : le reçu reste fonctionnel si son chargement échoue.
        }
      }
      pdf.text(profile.name || 'Entreprise', profile.logo_url ? 45 : 18, 18)

      pdf.setTextColor(35, 48, 65)
      pdf.setDrawColor(219, 228, 236)
      pdf.setFillColor(softBg[0], softBg[1], softBg[2])
      pdf.roundedRect(14, 52, 182, 28, 3, 3, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('Opération', 22, 63)
      pdf.setFont('helvetica', 'normal')
      pdf.text(statusLabel, 88, 63)
      pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2])
      pdf.text(formattedAmount, 190, 63, { align: 'right' })
      pdf.setTextColor(35, 48, 65)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(`Client : ${payment.client_name}`, 22, 74)
      pdf.text(`Facture : ${payment.invoice_number}`, 22, 80)
      pdf.text(`Date : ${new Date(`${payment.payment_date}T00:00:00`).toLocaleDateString('fr-FR')}`, 22, 86)

      pdf.setFillColor(242, 247, 251)
      pdf.roundedRect(14, 100, 182, 86, 3, 3, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(35, 48, 65)
      pdf.text('Détail', 22, 111)
      pdf.setFont('helvetica', 'normal')
      const detailRows = [
        [`Type`, isRefund ? 'Remboursement' : 'Encaissement'],
        [`Mode`, paymentMethodLabel(payment.method)],
        [`Référence`, payment.reference ?? 'Non renseignée'],
        [`Rapprochement`, payment.reconciliation_reference ?? (isPending ? 'En attente' : 'Confirmé')],
        [`Solde facture`, `${Math.max(0, payment.invoice_total - payment.invoice_paid).toLocaleString('fr-FR')} ${currency}`],
      ]
      let detailY = 121
      detailRows.forEach(([label, text]) => {
        const value = String(text).length > 32 ? `${String(text).slice(0, 32)}…` : String(text)
        pdf.text(`${label} : ${value}`, 22, detailY)
        detailY += 12
      })

      pdf.setDrawColor(219, 228, 236)
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(14, 194, 182, 36, 3, 3, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(accent[0], accent[1], accent[2])
      pdf.text(isRefund ? 'MONTANT REMBOURSÉ' : 'MONTANT REÇU', 22, 209)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(20)
      pdf.text(formattedAmount, 22, 224)
      pdf.setTextColor(35, 48, 65)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      const note = isPending
        ? 'Ce document est en attente de rapprochement. Le montant n’est pas encore validé comme encaissement définitif.'
        : isCancelled
          ? 'Cette opération a été annulée. Ce document ne vaut pas comme reçu de paiement.'
          : 'Merci de conserver ce reçu pour votre comptabilité et votre suivi client.'
      pdf.text(pdf.splitTextToSize(note, 160)[0], 22, 244)

      pdf.setTextColor(100, 116, 139)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text('Document généré par FactureFacile Bénin', 18, 280)
      pdf.text(`Entreprise : ${profile.name} · ${profile.phone || 'Contact non renseigné'}`, 18, 286)
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
  const stockIdempotencyKeyRef = useRef<string>('')
  const stockRequestFingerprintRef = useRef('')
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
        const requestFingerprint = JSON.stringify([
          businessId,
          product.id,
          Number(stockQuantityValue),
          stockMovementType,
          movementNote,
          stockSupplierName.trim(),
        ])
        if (stockRequestFingerprintRef.current !== requestFingerprint) {
          stockIdempotencyKeyRef.current = crypto.randomUUID()
          stockRequestFingerprintRef.current = requestFingerprint
        }
        await updateStock(
          businessId,
          product.id,
          Number(stockQuantityValue),
          stockMovementType,
          movementNote,
          stockSupplierName,
          stockIdempotencyKeyRef.current,
        )
        stockIdempotencyKeyRef.current = ''
        stockRequestFingerprintRef.current = ''
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
  const exportProductsExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const sheet = XLSX.utils.aoa_to_sheet([productExportHeaders, ...productExportRows(filteredProductRecords)])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Catalogue')
      XLSX.writeFile(workbook, 'catalogue-produits.xlsx')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible de créer le fichier Excel.')
    }
  }
  const exportStockExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const sheet = XLSX.utils.aoa_to_sheet([data.columns, ...allFilteredRows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Historique stock')
      XLSX.writeFile(workbook, 'historique-stock.xlsx')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible de créer le fichier Excel.')
    }
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
  const exportExpensesExcel = async () => {
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
    try {
      const XLSX = await import('xlsx')
      const sheet = XLSX.utils.aoa_to_sheet([['Désignation', 'Catégorie', 'Date', `Montant (${currency})`, 'Fournisseur', 'Moyen de paiement', 'Justificatif', 'Notes'], ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Dépenses')
      XLSX.writeFile(workbook, 'depenses.xlsx')
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : 'Impossible de créer le fichier Excel.')
    }
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
      <button className="outline-button" disabled={!filteredProductRecords.length} onClick={() => void exportProductsExcel()}>Exporter Excel</button>
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

export { ModulePage }
