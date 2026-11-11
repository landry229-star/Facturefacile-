import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { FilePlus2, Plus, RefreshCw, Trash2, Truck, WalletCards, X } from 'lucide-react'
import { downloadCsv, formatMoney } from './lib/formatting'
import { diagnosticErrorMessage } from './lib/errors'
import { addDateDays, getBusinessDateKey } from './lib/businessPreferences'
import { createPurchaseDocumentUrl, loadPurchaseDocuments, uploadPurchaseDocument } from './lib/data'
import type { PurchaseDocumentEntity, PurchaseDocumentRecord } from './lib/data'
import {
  createPurchase,
  cancelPurchase,
  countActiveSuppliers,
  deletePurchaseActivity,
  loadPurchaseActivity,
  loadProducts,
  loadPurchaseSummary,
  loadPurchaseStatusCounts,
  loadPurchasesPage,
  loadSupplierOptions,
  loadSuppliersPage,
  receivePurchaseItems,
  returnPurchaseItems,
  registerPurchasePayment,
  reversePurchasePayment,
  saveSupplier,
  updateUnpostedPurchase,
} from './lib/data'
import type {
  ExpensePaymentMethod,
  ProductRecord,
  PurchaseActivity,
  PurchaseLineInput,
  PurchaseRecord,
  SupplierRecord,
} from './lib/data'
import { createPurchaseExportRows, purchaseExportHeaders } from './lib/purchaseExport'
import { createPurchaseEmailHref, createPurchaseWhatsAppHref } from './lib/purchaseSharing'

type SupplierForm = {
  id?: string
  name: string
  email: string
  phone: string
  address: string
  taxId: string
  notes: string
  active: boolean
}

type PurchaseLineForm = {
  productId: string
  description: string
  quantity: string
  receivedQuantity: string
  unitCost: string
}

type PurchaseAction = 'edit' | 'email' | 'whatsapp' | 'payment' | 'receipt' | 'return' | 'cancel' | 'details'

const emptySupplier: SupplierForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  taxId: '',
  notes: '',
  active: true,
}

const paymentLabels: Record<ExpensePaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement',
  card: 'Carte',
  check: 'Chèque',
  other: 'Autre',
}

const statusLabels = {
  UNPAID: 'À payer',
  PARTIALLY_PAID: 'Partiellement payée',
  PAID: 'Payée',
} as const

const teamRoleLabels: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
  viewer: 'Lecteur',
}

export function SuppliersPurchasesPage({ businessId, currency, timezone, canCreatePurchase, canRegisterPayment, canManageSuppliers, canCorrectPurchases }: {
  businessId: string
  currency: string
  timezone: string
  canCreatePurchase: boolean
  canRegisterPayment: boolean
  canManageSuppliers: boolean
  canCorrectPurchases: boolean
}) {
  const today = getBusinessDateKey(new Date(), timezone)
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [supplierCount, setSupplierCount] = useState(0)
  const [activeSupplierCount, setActiveSupplierCount] = useState(0)
  const [supplierPage, setSupplierPage] = useState(1)
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierLoading, setSupplierLoading] = useState(true)
  const [supplierOptions, setSupplierOptions] = useState<Pick<SupplierRecord, 'id' | 'name' | 'active'>[]>([])
  const [purchaseSupplierOptions, setPurchaseSupplierOptions] = useState<Pick<SupplierRecord, 'id' | 'name' | 'active'>[]>([])
  const [supplierFilterQuery, setSupplierFilterQuery] = useState('')
  const [purchaseSupplierQuery, setPurchaseSupplierQuery] = useState('')
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [supplierForm, setSupplierForm] = useState<SupplierForm | null>(null)
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false)
  const [purchaseReview, setPurchaseReview] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null)
  const [purchaseCount, setPurchaseCount] = useState(0)
  const [purchaseStatusCounts, setPurchaseStatusCounts] = useState<Record<'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED', number>>({
    ALL: 0,
    UNPAID: 0,
    PARTIALLY_PAID: 0,
    PAID: 0,
    VOIDED: 0,
  })
  const [exporting, setExporting] = useState(false)
  const [purchaseSummary, setPurchaseSummary] = useState({ openBalance: 0, overdueBalance: 0 })
  const [activity, setActivity] = useState<PurchaseActivity[]>([])
  const [purchaseActionPicker, setPurchaseActionPicker] = useState<PurchaseAction | null>(null)
  const [purchaseActionSearch, setPurchaseActionSearch] = useState('')
  const [purchaseActionPage, setPurchaseActionPage] = useState(1)
  const [purchaseActionPurchases, setPurchaseActionPurchases] = useState<PurchaseRecord[]>([])
  const [purchaseActionCount, setPurchaseActionCount] = useState(0)
  const [purchaseActionLoading, setPurchaseActionLoading] = useState(false)
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseRecord | null>(null)
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([])
  const [confirmActivityDeletion, setConfirmActivityDeletion] = useState(false)
  const [purchasePage, setPurchasePage] = useState(1)
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED'>('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [purchaseSupplier, setPurchaseSupplier] = useState('')
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(today)
  const [dueDate, setDueDate] = useState(addDateDays(today, 30))
  const [taxRate, setTaxRate] = useState('0')
  const [purchaseNotes, setPurchaseNotes] = useState('')
  const [lines, setLines] = useState<PurchaseLineForm[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [lineDescription, setLineDescription] = useState('')
  const [lineQuantity, setLineQuantity] = useState('1')
  const [lineReceivedQuantity, setLineReceivedQuantity] = useState('1')
  const [lineCost, setLineCost] = useState('')
  const [paymentPurchase, setPaymentPurchase] = useState<PurchaseRecord | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentReview, setPaymentReview] = useState(false)
  const [purchaseToCancel, setPurchaseToCancel] = useState<PurchaseRecord | null>(null)
  const [purchaseCancelReason, setPurchaseCancelReason] = useState('')
  const [paymentToReverse, setPaymentToReverse] = useState<{ purchase: PurchaseRecord; payment: PurchaseRecord['payments'][number] } | null>(null)
  const [paymentReversalReason, setPaymentReversalReason] = useState('')
  const [paymentReversalDate, setPaymentReversalDate] = useState(today)
  const [receivePurchase, setReceivePurchase] = useState<PurchaseRecord | null>(null)
  const [receiveDate, setReceiveDate] = useState(today)
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({})
  const [returnPurchase, setReturnPurchase] = useState<PurchaseRecord | null>(null)
  const [returnDate, setReturnDate] = useState(today)
  const [returnReason, setReturnReason] = useState('')
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({})
  const [returnReview, setReturnReview] = useState(false)
  const purchaseRequestId = useRef('')
  const paymentRequestId = useRef('')
  const receiptRequestId = useRef('')
  const returnRequestId = useRef('')

  const refresh = () => {
    setLoading(true)
    setError('')
    setRefreshKey((current) => current + 1)
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const nextProducts = await loadProducts(businessId)
        if (cancelled) return
        setProducts(nextProducts.filter((product) => product.product_type === 'product' && product.active))
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de charger les produits.')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [businessId, refreshKey])

  useEffect(() => {
    let cancelled = false
    const loadPage = async () => {
      setSupplierLoading(true)
      try {
        const [pageResult, activeCount] = await Promise.all([
          loadSuppliersPage(businessId, supplierPage, 25, supplierQuery),
          countActiveSuppliers(businessId),
        ])
        if (cancelled) return
        setSuppliers(pageResult.suppliers)
        setSupplierCount(pageResult.count)
        setActiveSupplierCount(activeCount)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de charger les fournisseurs.')
      } finally {
        if (!cancelled) setSupplierLoading(false)
      }
    }
    void loadPage()
    return () => { cancelled = true }
  }, [businessId, supplierPage, supplierQuery, refreshKey])

  useEffect(() => {
    let cancelled = false
    void loadSupplierOptions(businessId, supplierFilterQuery)
      .then((options) => { if (!cancelled) setSupplierOptions(options) })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de rechercher les fournisseurs.') })
    return () => { cancelled = true }
  }, [businessId, supplierFilterQuery, refreshKey])

  useEffect(() => {
    let cancelled = false
    void loadSupplierOptions(businessId, purchaseSupplierQuery, true)
      .then((options) => { if (!cancelled) setPurchaseSupplierOptions(options) })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de rechercher les fournisseurs actifs.') })
    return () => { cancelled = true }
  }, [businessId, purchaseSupplierQuery, refreshKey])

  useEffect(() => {
    let cancelled = false
    const loadPage = async () => {
      setLoading(true)
      setError('')
      try {
        const [pageResult, summary, activityResult, statusCounts] = await Promise.all([
          loadPurchasesPage(businessId, {
            page: purchasePage,
            pageSize: 25,
            query,
            supplierId: supplierFilter,
            status: statusFilter,
            fromDate,
            toDate,
          }),
          loadPurchaseSummary(businessId),
          loadPurchaseActivity(businessId),
          loadPurchaseStatusCounts(businessId, { query, supplierId: supplierFilter, fromDate, toDate }),
        ])
        if (cancelled) return
        setPurchases(pageResult.purchases)
        setPurchaseCount(pageResult.count)
        setPurchaseSummary({ openBalance: summary.openBalance, overdueBalance: summary.overdueBalance })
        setActivity(activityResult)
        setPurchaseStatusCounts(statusCounts)
        setSelectedActivityIds((current) => current.filter((id) => activityResult.some((entry) => entry.id === id)))
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de charger les factures d’achat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadPage()
    return () => { cancelled = true }
  }, [businessId, purchasePage, query, supplierFilter, statusFilter, fromDate, toDate, refreshKey])

  useEffect(() => {
    if (!purchaseActionPicker) return
    let cancelled = false
    const loadPickerPage = async () => {
      setPurchaseActionLoading(true)
      setError('')
      try {
        const result = await loadPurchasesPage(businessId, {
          page: purchaseActionPage,
          pageSize: 25,
          query: purchaseActionSearch,
          supplierId: '',
          status: 'ALL',
          fromDate: '',
          toDate: '',
        })
        if (cancelled) return
        setPurchaseActionPurchases(result.purchases)
        setPurchaseActionCount(result.count)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de charger la liste des factures.')
      } finally {
        if (!cancelled) setPurchaseActionLoading(false)
      }
    }
    void loadPickerPage()
    return () => { cancelled = true }
  }, [businessId, purchaseActionPicker, purchaseActionPage, purchaseActionSearch, refreshKey])

  const subtotal = useMemo(() => lines.reduce(
    (sum, line) => sum + Math.round((Number(line.quantity) || 0) * (Number(line.unitCost) || 0) * 100) / 100,
    0,
  ), [lines])
  const purchaseReviewLines = useMemo(() => {
    const projectedStock = new Map<string, number>()
    return lines.map((line) => {
      const product = products.find((item) => item.id === line.productId)
      const previousStock = product
        ? projectedStock.get(product.id) ?? product.stock_quantity
        : null
      const nextStock = product && previousStock !== null
        ? previousStock + Number(line.receivedQuantity)
        : null
      if (product && nextStock !== null) projectedStock.set(product.id, nextStock)
      return { line, product, previousStock, nextStock }
    })
  }, [lines, products])
  const taxAmount = Math.round(subtotal * (Math.max(0, Math.min(Number(taxRate) || 0, 100)) / 100) * 100) / 100
  const total = subtotal + taxAmount
  const activeSuppliers = purchaseSupplierOptions
  const purchasePageCount = Math.max(1, Math.ceil(purchaseCount / 25))
  const supplierPageCount = Math.max(1, Math.ceil(supplierCount / 25))
  const purchaseActionOptions: { id: PurchaseAction; label: string; enabled: boolean }[] = [
    { id: 'edit', label: 'Modifier', enabled: canCreatePurchase },
    { id: 'email', label: 'E-mail', enabled: true },
    { id: 'whatsapp', label: 'WhatsApp', enabled: true },
    { id: 'payment', label: 'Paiement', enabled: canRegisterPayment },
    { id: 'receipt', label: 'Réception', enabled: canCreatePurchase },
    { id: 'return', label: 'Retour fournisseur', enabled: canCreatePurchase },
    { id: 'cancel', label: 'Annuler', enabled: canCorrectPurchases },
    { id: 'details', label: 'Détails', enabled: true },
  ]
  const purchaseActionPickerPageCount = Math.max(1, Math.ceil(purchaseActionCount / 25))

  const exportFilteredPurchases = async () => {
    if (fromDate && toDate && fromDate > toDate) return
    setExporting(true)
    setError('')
    try {
      const allPurchases: PurchaseRecord[] = []
      let page = 1
      let count = 0
      do {
        const result = await loadPurchasesPage(businessId, {
          page,
          pageSize: 100,
          query,
          supplierId: supplierFilter,
          status: statusFilter,
          fromDate,
          toDate,
        })
        count = result.count
        if (!result.purchases.length) break
        allPurchases.push(...result.purchases)
        page += 1
      } while (allPurchases.length < count)
      if (allPurchases.length < count) throw new Error('Les résultats ont changé pendant l’export. Actualisez la liste puis réessayez.')
      downloadCsv('factures-achats.csv', purchaseExportHeaders, createPurchaseExportRows(allPurchases))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’exporter les factures d’achat.')
    } finally {
      setExporting(false)
    }
  }

  const confirmDeleteActivity = async () => {
    if (!selectedActivityIds.length) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const deletedCount = await deletePurchaseActivity(businessId, selectedActivityIds)
      setSelectedActivityIds([])
      setConfirmActivityDeletion(false)
      setMessage(`${deletedCount} action(s) supprimée(s) définitivement de l’historique. Les factures, règlements et mouvements de stock ne sont pas affectés.`)
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de supprimer les actions sélectionnées.')
    } finally {
      setBusy(false)
    }
  }

  const openNewPurchase = () => {
    setEditingPurchase(null)
    setPurchaseSupplier('')
    setPurchaseSupplierQuery('')
    setSupplierInvoiceNumber('')
    setPurchaseDate(today)
    setDueDate(addDateDays(today, 30))
    setTaxRate('0')
    setPurchaseNotes('')
    setLines([])
    setSelectedProduct('')
    setLineDescription('')
    setLineQuantity('1')
    setLineReceivedQuantity('1')
    setLineCost('')
    setError('')
    purchaseRequestId.current = crypto.randomUUID()
    setPurchaseReview(false)
    setPurchaseFormOpen(true)
  }

  const openEditPurchase = (purchase: PurchaseRecord) => {
    setEditingPurchase(purchase)
    setPurchaseSupplier(purchase.supplier_id)
    setPurchaseSupplierQuery(purchase.supplier_name)
    setSupplierInvoiceNumber(purchase.supplier_invoice_number ?? '')
    setPurchaseDate(purchase.purchase_date)
    setDueDate(purchase.due_date ?? '')
    setTaxRate(purchase.subtotal > 0 ? String(Math.round((purchase.tax / purchase.subtotal) * 10000) / 100) : '0')
    setPurchaseNotes(purchase.notes ?? '')
    setLines(purchase.items.map((item) => ({
      productId: item.product_id ?? '',
      description: item.description,
      quantity: String(item.quantity),
      receivedQuantity: '0',
      unitCost: String(item.unit_cost),
    })))
    setSelectedProduct('')
    setLineDescription('')
    setLineQuantity('1')
    setLineReceivedQuantity('0')
    setLineCost('')
    setPurchaseReview(false)
    setError('')
    setPurchaseFormOpen(true)
  }

  const openPayment = (purchase: PurchaseRecord, remaining: number) => {
    paymentRequestId.current = crypto.randomUUID()
    setPaymentPurchase(purchase)
    setPaymentReview(false)
    setPaymentAmount(String(remaining))
    setPaymentDate(today)
    setPaymentMethod('cash')
    setPaymentReference('')
    setError('')
  }

  const selectPurchaseAction = (action: PurchaseAction, purchase: PurchaseRecord) => {
    setPurchaseActionPicker(null)
    if (action === 'details') {
      setPurchaseDetails(purchase)
      return
    }
    if (action === 'edit') {
      openEditPurchase(purchase)
      return
    }
    if (action === 'email') {
      const emailHref = createPurchaseEmailHref(purchase)
      if (emailHref && window.confirm(`Ouvrir un brouillon d’e-mail destiné à ${purchase.supplier_email} ? Le récapitulatif sera inclus, mais aucun justificatif ne sera joint automatiquement.`)) window.location.assign(emailHref)
      return
    }
    if (action === 'whatsapp') {
      const whatsappHref = createPurchaseWhatsAppHref(purchase)
      if (whatsappHref && window.confirm(`Ouvrir WhatsApp avec le récapitulatif de ${purchase.purchase_number} ? Vérifiez le destinataire et confirmez vous-même l’envoi.`)) window.open(whatsappHref, '_blank', 'noopener,noreferrer')
      return
    }
    if (action === 'payment') {
      openPayment(purchase, Math.max(0, purchase.total - purchase.paid_amount))
      return
    }
    if (action === 'receipt') {
      openReceipt(purchase)
      return
    }
    if (action === 'return') {
      openSupplierReturn(purchase)
      return
    }
    setPurchaseToCancel(purchase)
    setPurchaseCancelReason('')
    setError('')
  }

  const getPurchaseActionUnavailableReason = (action: PurchaseAction, purchase: PurchaseRecord): string | null => {
    const remaining = Math.max(0, purchase.total - purchase.paid_amount)
    const canEdit = canCreatePurchase && !purchase.voided_at
      && purchase.payments.length === 0
      && purchase.returns.length === 0
      && purchase.items.every((item) => item.received_quantity === 0 && item.returned_quantity === 0)
    if (action === 'edit') return canEdit ? null : !canCreatePurchase ? 'Votre rôle ne permet pas de modifier les achats.' : 'Modification verrouillée après un paiement, une réception, un retour ou une annulation.'
    if (action === 'email') return createPurchaseEmailHref(purchase) ? null : 'Adresse e-mail du fournisseur manquante.'
    if (action === 'whatsapp') return createPurchaseWhatsAppHref(purchase) ? null : 'Téléphone du fournisseur manquant.'
    if (action === 'payment') return !canRegisterPayment ? 'Votre rôle ne permet pas d’enregistrer un paiement.' : purchase.voided_at ? 'Cette facture est annulée.' : remaining <= 0 ? 'Cette facture ne présente aucun solde à régler.' : null
    if (action === 'receipt') return !canCreatePurchase ? 'Votre rôle ne permet pas d’enregistrer une réception.' : purchase.voided_at ? 'Cette facture est annulée.' : purchase.items.every((item) => item.quantity <= item.received_quantity) ? 'Toutes les quantités facturées sont déjà reçues.' : null
    if (action === 'return') return !canCreatePurchase ? 'Votre rôle ne permet pas d’enregistrer un retour.' : purchase.voided_at ? 'Cette facture est annulée.' : purchase.items.every((item) => !item.product_id || item.received_quantity <= item.returned_quantity) ? 'Aucune quantité stockée n’est disponible pour un retour.' : null
    if (action === 'cancel') return !canCorrectPurchases ? 'Votre rôle ne permet pas d’annuler les achats.' : purchase.voided_at ? 'Cette facture est déjà annulée.' : null
    return null
  }

  const addLine = () => {
    const quantity = Number(lineQuantity)
    const receivedQuantity = Number(lineReceivedQuantity)
    const unitCost = Number(lineCost)
    if (!lineDescription.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(receivedQuantity) || receivedQuantity < 0 || receivedQuantity > quantity || !Number.isFinite(unitCost) || unitCost < 0) {
      setError('Renseignez une désignation, une quantité facturée positive, une quantité reçue comprise entre zéro et la quantité facturée, et un coût unitaire valide.')
      return
    }
    setLines((current) => [...current, {
      productId: selectedProduct,
      description: lineDescription.trim(),
      quantity: String(quantity),
      receivedQuantity: String(receivedQuantity),
      unitCost: String(unitCost),
    }])
    setSelectedProduct('')
    setLineDescription('')
    setLineQuantity('1')
    setLineReceivedQuantity('1')
    setLineCost('')
    setError('')
  }

  const submitPurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!purchaseSupplier || !lines.length || total <= 0) {
      setError('Choisissez un fournisseur et ajoutez au moins une ligne avec un montant supérieur à zéro.')
      return
    }
    if (!purchaseDate || (dueDate && dueDate < purchaseDate)) {
      setError('Vérifiez la date d’achat et son échéance.')
      return
    }
    setError('')
    setPurchaseReview(true)
  }

  const confirmPurchase = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const purchaseLines: PurchaseLineInput[] = lines.map((line) => ({
        productId: line.productId || null,
        description: line.description,
        quantity: Number(line.quantity),
        receivedQuantity: Number(line.receivedQuantity),
        unitCost: Number(line.unitCost),
      }))
      if (editingPurchase) {
        await updateUnpostedPurchase(
          businessId,
          editingPurchase.id,
          purchaseSupplier,
          supplierInvoiceNumber,
          purchaseDate,
          dueDate,
          Number(taxRate),
          purchaseNotes,
          purchaseLines,
        )
      } else {
        await createPurchase(
          businessId,
          purchaseSupplier,
          supplierInvoiceNumber,
          purchaseDate,
          dueDate,
          Number(taxRate),
          purchaseNotes,
          purchaseLines,
          purchaseRequestId.current || crypto.randomUUID(),
        )
        purchaseRequestId.current = ''
      }
      setPurchaseFormOpen(false)
      setPurchaseReview(false)
      setEditingPurchase(null)
      setMessage(editingPurchase
        ? `Facture d’achat ${editingPurchase.purchase_number} modifiée. Aucun paiement ni mouvement de stock n’a été changé.`
        : 'Facture d’achat enregistrée. Le stock a été actualisé selon les quantités reçues.')
      refresh()
    } catch (cause) {
      setError(diagnosticErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const submitSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supplierForm) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await saveSupplier(businessId, {
        id: supplierForm.id,
        name: supplierForm.name,
        email: supplierForm.email,
        phone: supplierForm.phone,
        address: supplierForm.address,
        tax_id: supplierForm.taxId,
        notes: supplierForm.notes,
        active: supplierForm.active,
      })
      setSupplierForm(null)
      setMessage(supplierForm.id ? 'Fournisseur mis à jour.' : 'Fournisseur ajouté au répertoire.')
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer le fournisseur.')
    } finally {
      setBusy(false)
    }
  }

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!paymentPurchase || paymentPurchase.voided_at) return
    const amount = Number(paymentAmount)
    const remaining = Math.max(0, paymentPurchase.total - paymentPurchase.paid_amount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining || !paymentDate) {
      setError('Vérifiez le montant et la date du règlement.')
      return
    }
    setError('')
    setPaymentReview(true)
  }

  const confirmPayment = async () => {
    if (!paymentPurchase) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await registerPurchasePayment(
        businessId,
        paymentPurchase.id,
        Number(paymentAmount),
        paymentDate,
        paymentMethod,
        paymentReference,
        paymentRequestId.current || crypto.randomUUID(),
      )
      paymentRequestId.current = ''
      setPaymentPurchase(null)
      setPaymentReview(false)
      setMessage('Règlement fournisseur enregistré.')
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer le règlement.')
    } finally {
      setBusy(false)
    }
  }

  const confirmPaymentReversal = async () => {
    if (!paymentToReverse || !paymentReversalReason.trim() || !paymentReversalDate) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await reversePurchasePayment(
        businessId,
        paymentToReverse.payment.id,
        paymentReversalDate,
        paymentReversalReason,
      )
      setPaymentToReverse(null)
      setPaymentReversalReason('')
      setMessage(`Règlement de ${paymentToReverse.purchase.purchase_number} inversé et conservé dans l’historique.`)
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’inverser le règlement fournisseur.')
    } finally {
      setBusy(false)
    }
  }

  const confirmPurchaseCancellation = async () => {
    if (!purchaseToCancel || !purchaseCancelReason.trim()) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await cancelPurchase(businessId, purchaseToCancel.id, purchaseCancelReason)
      setPurchaseToCancel(null)
      setPurchaseCancelReason('')
      setMessage(`Achat ${purchaseToCancel.purchase_number} annulé. Les mouvements de stock ont été contrepassés et l’historique est conservé.`)
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’annuler la facture d’achat.')
    } finally {
      setBusy(false)
    }
  }

  const openReceipt = (purchase: PurchaseRecord) => {
    setReceivePurchase(purchase)
    setReceiveDate(today)
    setReceiveQuantities(Object.fromEntries(purchase.items.map((item) => [
      item.id,
      String(Math.max(0, item.quantity - item.received_quantity)),
    ])))
    receiptRequestId.current = crypto.randomUUID()
    setError('')
  }

  const confirmReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!receivePurchase || !receiveDate) return
    const receiptLines = receivePurchase.items.flatMap((item) => {
      const quantity = Number(receiveQuantities[item.id] || 0)
      return quantity > 0 ? [{ purchaseItemId: item.id, quantity }] : []
    })
    if (!receiptLines.length) {
      setError('Saisissez au moins une quantité reçue.')
      return
    }
    if (receiptLines.some(({ purchaseItemId, quantity }) => {
      const item = receivePurchase.items.find((candidate) => candidate.id === purchaseItemId)
      return !item || quantity > item.quantity - item.received_quantity
    })) {
      setError('Une quantité dépasse le reliquat de réception.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await receivePurchaseItems(
        businessId,
        receivePurchase.id,
        receiveDate,
        receiptLines,
        receiptRequestId.current || crypto.randomUUID(),
      )
      setReceivePurchase(null)
      setMessage(`Réception enregistrée pour ${receivePurchase.purchase_number}. Le stock a été augmenté uniquement pour les quantités reçues.`)
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer la réception.')
    } finally {
      setBusy(false)
    }
  }

  const openSupplierReturn = (purchase: PurchaseRecord) => {
    setReturnPurchase(purchase)
    setReturnDate(today)
    setReturnReason('')
    setReturnReview(false)
    setReturnQuantities(Object.fromEntries(purchase.items
      .filter((item) => item.product_id)
      .map((item) => [item.id, '0'])))
    returnRequestId.current = crypto.randomUUID()
    setError('')
  }

  const submitSupplierReturn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!returnPurchase || !returnDate || !returnReason.trim()) return
    const returnLines = returnPurchase.items.flatMap((item) => {
      const quantity = Number(returnQuantities[item.id] || 0)
      return item.product_id && quantity > 0 ? [{ purchaseItemId: item.id, quantity }] : []
    })
    if (!returnLines.length) {
      setError('Saisissez au moins une quantité à retourner.')
      return
    }
    if (returnLines.some(({ purchaseItemId, quantity }) => {
      const item = returnPurchase.items.find((candidate) => candidate.id === purchaseItemId)
      return !item || quantity > item.received_quantity - item.returned_quantity
    })) {
      setError('Une quantité dépasse la quantité reçue encore disponible.')
      return
    }
    setError('')
    setReturnReview(true)
  }

  const confirmSupplierReturn = async () => {
    if (!returnPurchase || !returnDate || !returnReason.trim()) return
    const returnLines = returnPurchase.items.flatMap((item) => {
      const quantity = Number(returnQuantities[item.id] || 0)
      return item.product_id && quantity > 0 ? [{ purchaseItemId: item.id, quantity }] : []
    })
    if (!returnLines.length) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await returnPurchaseItems(
        businessId,
        returnPurchase.id,
        returnDate,
        returnReason,
        returnLines,
        returnRequestId.current || crypto.randomUUID(),
      )
      setReturnPurchase(null)
      setReturnReview(false)
      setReturnReason('')
      setMessage(`Retour enregistré pour ${returnPurchase.purchase_number}. Le stock a été diminué et le mouvement est conservé dans l’historique.`)
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer le retour fournisseur.')
    } finally {
      setBusy(false)
    }
  }

  const formatDate = (date: string | null) => date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
    : 'Non renseignée'

  return <section className="module-page purchase-page">
    <div className="module-heading purchase-heading">
      <div><p className="eyebrow">ACHATS ET APPROVISIONNEMENT</p><h1>Fournisseurs et achats</h1><p>Centralisez les factures fournisseurs, les règlements, les réceptions et les retours de stock.</p></div>
      <div className="toolbar-actions">
        <button type="button" className="outline-button" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw size={16} /> Actualiser</button>
        {canManageSuppliers && <button type="button" className="outline-button" onClick={() => { setSupplierForm({ ...emptySupplier }); setError('') }}><Plus size={16} /> Fournisseur</button>}
        {canCreatePurchase && <button type="button" className="primary-button" onClick={openNewPurchase}><FilePlus2 size={16} /> Nouvelle facture d’achat</button>}
      </div>
    </div>

    {error && <div className="data-warning" role="alert">{error}</div>}
    {message && <div className="settings-message" role="status">{message}</div>}

    <div className="purchase-summary-grid">
      <article className="panel purchase-summary-card"><span><Truck size={18} /> Fournisseurs actifs</span><strong>{activeSupplierCount}</strong><small>{supplierCount} fournisseurs au total</small></article>
      <article className="panel purchase-summary-card"><span><WalletCards size={18} /> Solde fournisseurs</span><strong>{formatMoney(purchaseSummary.openBalance, currency)}</strong><small>reste à régler, calculé côté serveur</small></article>
      <article className="panel purchase-summary-card"><span><FilePlus2 size={18} /> Échéances dépassées</span><strong>{formatMoney(purchaseSummary.overdueBalance, currency)}</strong><small>factures non soldées en retard · calcul serveur</small></article>
    </div>
    <p className="purchase-permission-note">Droits actifs : {canCreatePurchase ? 'créer des achats et gérer les réceptions/retours' : 'consultation seule'}{canRegisterPayment ? ' · enregistrer et inverser les paiements' : ''}{canManageSuppliers ? ' · gérer les fournisseurs' : ''}{canCorrectPurchases ? ' · annuler les achats' : ''}.</p>

    <section className="panel purchase-panel">
      <div className="panel-heading"><div><h2>Factures d’achat</h2><p>{purchaseCount} facture(s) correspondante(s) · résultats paginés · les paiements sont suivis séparément des charges libres.</p></div><button type="button" className="outline-button" onClick={() => void exportFilteredPurchases()} disabled={loading || exporting || purchaseCount === 0 || Boolean(fromDate && toDate && fromDate > toDate)}>{exporting ? 'Préparation…' : 'Exporter les résultats filtrés en CSV'}</button></div>
      <div className="module-toolbar purchase-toolbar">
        <label className="search-box"><input aria-label="Rechercher une facture d'achat" value={query} onChange={(event) => { setQuery(event.target.value); setPurchasePage(1) }} placeholder="Rechercher fournisseur ou référence..." /></label>
        <div className="purchase-status-counts" role="group" aria-label="Filtrer les factures par statut">
          {([
            ['ALL', 'Toutes'],
            ['UNPAID', 'À payer'],
            ['PARTIALLY_PAID', 'Partiellement payées'],
            ['PAID', 'Payées'],
            ['VOIDED', 'Annulées'],
          ] as const).map(([status, label]) => (
            <button
              key={status}
              type="button"
              className={`purchase-status-count${statusFilter === status ? ' is-active' : ''}`}
              aria-pressed={statusFilter === status}
              disabled={loading}
              onClick={() => { setStatusFilter(status); setPurchasePage(1) }}
            >
              <span>{label}</span>
              <strong>{purchaseStatusCounts[status]}</strong>
            </button>
          ))}
        </div>
        <div className="purchase-filter-row">
          <label>Rechercher un fournisseur<input value={supplierFilterQuery} onChange={(event) => { setSupplierFilterQuery(event.target.value); setSupplierFilter(''); setPurchasePage(1) }} placeholder="Nom du fournisseur" /></label>
          <label>Fournisseur<select value={supplierFilter} onChange={(event) => { setSupplierFilter(event.target.value); setSupplierFilterQuery(supplierOptions.find((supplier) => supplier.id === event.target.value)?.name ?? ''); setPurchasePage(1) }}><option value="">Tous les fournisseurs</option>{supplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.active ? '' : ' (archivé)'}</option>)}</select></label>
          <label>Statut<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPurchasePage(1) }}><option value="ALL">Toutes les factures</option><option value="UNPAID">À payer</option><option value="PARTIALLY_PAID">Partiellement payées</option><option value="PAID">Payées</option><option value="VOIDED">Annulées</option></select></label>
          <label>Du<input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPurchasePage(1) }} /></label>
          <label>Au<input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPurchasePage(1) }} /></label>
        </div>
      </div>
      {fromDate && toDate && fromDate > toDate && <div className="data-warning">La date « Du » doit précéder la date « Au ».</div>}
      <div className="purchase-global-actions" role="group" aria-label="Actions sur une facture d’achat">
        <strong>Actions sur une facture</strong>
        {purchaseActionOptions.map((action) => <button
          key={action.id}
          type="button"
          className="outline-button"
          disabled={!action.enabled || busy}
          onClick={() => {
            setPurchaseActionSearch('')
            setPurchaseActionPage(1)
            setPurchaseActionPicker(action.id)
          }}
        >{action.label}</button>)}
      </div>
      {loading ? <p className="muted-cell purchase-empty">Chargement des achats…</p> : purchases.length
        ? <div className="table-wrap"><table>
          <thead><tr><th>FACTURE ACHAT</th><th>FOURNISSEUR</th><th>DATE</th><th>ÉCHÉANCE</th><th>TOTAL</th><th>RESTANT</th><th>STATUT</th></tr></thead>
          <tbody>{purchases.map((purchase) => {
            const remaining = purchase.voided_at ? 0 : Math.max(0, purchase.total - purchase.paid_amount)
            const overdue = !purchase.voided_at && purchase.due_date !== null && purchase.due_date < today && remaining > 0
            return <tr key={purchase.id}>
              <td><strong className="invoice-number">{purchase.purchase_number}</strong>{purchase.supplier_invoice_number && <small className="purchase-secondary">Réf. fournisseur : {purchase.supplier_invoice_number}</small>}</td>
              <td>{purchase.supplier_name}</td>
              <td>{formatDate(purchase.purchase_date)}</td>
              <td><span className={overdue ? 'purchase-overdue' : ''}>{formatDate(purchase.due_date)}</span></td>
              <td>{formatMoney(purchase.total, currency)}</td>
              <td>{formatMoney(remaining, currency)}</td>
              <td><span className={`purchase-status ${purchase.voided_at ? 'voided' : overdue ? 'overdue' : purchase.status.toLowerCase()}`}>{purchase.voided_at ? 'Annulée' : overdue ? 'En retard' : statusLabels[purchase.status]}</span></td>
            </tr>
          })}</tbody>
        </table></div>
        : <p className="purchase-empty">{query || supplierFilter || statusFilter !== 'ALL' || fromDate || toDate ? 'Aucune facture d’achat ne correspond aux filtres.' : 'Aucune facture fournisseur pour le moment. Enregistrez un achat pour suivre son échéance et les produits reçus.'}</p>}
      {!loading && purchaseCount > 0 && <div className="purchase-pagination"><span>{(purchasePage - 1) * 25 + 1}–{Math.min(purchasePage * 25, purchaseCount)} sur {purchaseCount} factures</span><div><button type="button" className="outline-button" disabled={purchasePage <= 1} onClick={() => setPurchasePage((page) => page - 1)}>Précédent</button><span>Page {purchasePage} / {purchasePageCount}</span><button type="button" className="outline-button" disabled={purchasePage >= purchasePageCount} onClick={() => setPurchasePage((page) => page + 1)}>Suivant</button></div></div>}
      {!canCreatePurchase && !canRegisterPayment && !canManageSuppliers && <p className="purchase-readonly-note">Votre rôle permet uniquement de consulter les factures, règlements et fournisseurs.</p>}
    </section>

    {purchaseActionPicker && <div className="modal-backdrop" onClick={() => !busy && setPurchaseActionPicker(null)}>
      <div className="invoice-modal purchase-modal purchase-action-picker" role="dialog" aria-modal="true" aria-labelledby="purchase-action-picker-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">FACTURES D’ACHAT</p><h2 id="purchase-action-picker-title">Choisir une facture — {purchaseActionOptions.find((option) => option.id === purchaseActionPicker)?.label}</h2></div><button type="button" className="icon-button" onClick={() => setPurchaseActionPicker(null)} aria-label="Fermer"><X size={20} /></button></div>
        <label className="purchase-action-picker-search">Rechercher une facture ou un fournisseur<input autoFocus value={purchaseActionSearch} onChange={(event) => { setPurchaseActionSearch(event.target.value); setPurchaseActionPage(1) }} placeholder="Nom du fournisseur ou référence…" /></label>
        {purchaseActionLoading ? <p className="purchase-empty">Chargement des factures…</p> : purchaseActionPurchases.length ? <div className="purchase-action-picker-list">
          {purchaseActionPurchases.map((purchase) => {
            const unavailableReason = getPurchaseActionUnavailableReason(purchaseActionPicker, purchase)
            const remaining = purchase.voided_at ? 0 : Math.max(0, purchase.total - purchase.paid_amount)
            return <div className="purchase-action-picker-item" key={purchase.id}>
              <div><strong>{purchase.purchase_number}</strong><span>{purchase.supplier_name}{purchase.supplier_invoice_number ? ` · Réf. ${purchase.supplier_invoice_number}` : ''}</span><small>{formatDate(purchase.purchase_date)} · {formatMoney(purchase.total, currency)} · restant {formatMoney(remaining, currency)}</small></div>
              <span className={`purchase-status ${purchase.voided_at ? 'voided' : purchase.status.toLowerCase()}`}>{purchase.voided_at ? 'Annulée' : statusLabels[purchase.status]}</span>
              <button type="button" className="outline-button" disabled={busy || Boolean(unavailableReason)} title={unavailableReason ?? undefined} onClick={() => selectPurchaseAction(purchaseActionPicker, purchase)}>Sélectionner</button>
              {unavailableReason && <small className="purchase-action-unavailable">{unavailableReason}</small>}
            </div>
          })}
        </div> : <p className="purchase-empty">{purchaseActionSearch ? 'Aucune facture ne correspond à cette recherche.' : 'Aucune facture d’achat enregistrée.'}</p>}
        {!purchaseActionLoading && purchaseActionCount > 0 && <div className="purchase-pagination"><span>{(purchaseActionPage - 1) * 25 + 1}–{Math.min(purchaseActionPage * 25, purchaseActionCount)} sur {purchaseActionCount} factures</span><div><button type="button" className="outline-button" disabled={purchaseActionPage <= 1} onClick={() => setPurchaseActionPage((page) => page - 1)}>Précédent</button><span>Page {purchaseActionPage} / {purchaseActionPickerPageCount}</span><button type="button" className="outline-button" disabled={purchaseActionPage >= purchaseActionPickerPageCount} onClick={() => setPurchaseActionPage((page) => page + 1)}>Suivant</button></div></div>}
      </div>
    </div>}

    {purchaseDetails && <div className="modal-backdrop" onClick={() => setPurchaseDetails(null)}>
      <div className="invoice-modal purchase-modal purchase-details-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-details-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">DÉTAILS DE L’ACHAT</p><h2 id="purchase-details-title">{purchaseDetails.purchase_number} · {purchaseDetails.supplier_name}</h2></div><button type="button" className="icon-button" onClick={() => setPurchaseDetails(null)} aria-label="Fermer"><X size={20} /></button></div>
        <div className="purchase-detail-summary"><span>Date : {formatDate(purchaseDetails.purchase_date)}</span><span>Échéance : {formatDate(purchaseDetails.due_date)}</span><span>Total : {formatMoney(purchaseDetails.total, currency)}</span><span>Payé : {formatMoney(purchaseDetails.paid_amount, currency)}</span></div>
        <strong>Lignes d’achat</strong>
        <ul>{purchaseDetails.items.map((item) => <li key={item.id}>{item.description} · {item.quantity} facturée · {item.received_quantity} reçue · {item.returned_quantity} retournée · {formatMoney(item.unit_cost, currency)} / unité = {formatMoney(item.line_total, currency)}{item.product_id && <small> · {Math.max(0, item.received_quantity - item.returned_quantity)} unité(s) restante(s) de cette réception pour {item.product_name ?? 'produit'}</small>}</li>)}</ul>
        {purchaseDetails.returns.length > 0 && <><strong>Retours fournisseur enregistrés</strong><ul>{purchaseDetails.returns.map((purchaseReturn) => (
          <li key={purchaseReturn.id}>{formatDate(purchaseReturn.returned_on)} · {purchaseReturn.items.map((returnedItem) => {
            const item = purchaseDetails.items.find((candidate) => candidate.id === returnedItem.purchase_item_id)
            return `${returnedItem.quantity} × ${item?.description ?? 'ligne archivée'}`
          }).join(' ; ')}<small className="purchase-reversal-note">Motif : {purchaseReturn.reason}</small></li>
        ))}</ul></>}
        {purchaseDetails.payments.length > 0 && <><strong>Règlements enregistrés</strong><ul>{purchaseDetails.payments.map((payment) => <li key={payment.id}>
          {formatDate(payment.paid_at)} · {formatMoney(payment.amount, currency)} · {paymentLabels[payment.payment_method]}{payment.reference ? ` · ${payment.reference}` : ''}
          {payment.reversed_at && <small className="purchase-reversal-note">Inversé le {formatDate(payment.reversal_date)} · {payment.reversal_reason}</small>}
          {!payment.reversed_at && canRegisterPayment && !purchaseDetails.voided_at && <button type="button" className="purchase-inline-action" onClick={() => {
            setPaymentToReverse({ purchase: purchaseDetails, payment })
            setPaymentReversalDate(today)
            setPaymentReversalReason('')
            setError('')
          }}>Inverser ce règlement</button>}
        </li>)}</ul></>}
        {purchaseDetails.notes && <p>{purchaseDetails.notes}</p>}
        {purchaseDetails.voided_at && <p className="purchase-reversal-note">Annulée le {formatDate(purchaseDetails.voided_at.slice(0, 10))} · {purchaseDetails.void_reason}</p>}
        <PurchaseDocumentManager businessId={businessId} entityType="purchase" entityId={purchaseDetails.id} canUpload={canCreatePurchase} />
      </div>
    </div>}

    <section className="panel purchase-panel suppliers-panel">
      <div className="panel-heading"><div><h2>Répertoire fournisseurs</h2><p>{supplierCount} fournisseur(s) · résultats paginés · les fournisseurs archivés restent rattachés à l’historique de leurs achats.</p></div><label className="search-box"><input aria-label="Rechercher un fournisseur" value={supplierQuery} onChange={(event) => { setSupplierQuery(event.target.value); setSupplierPage(1) }} placeholder="Rechercher par nom..." /></label></div>
      {supplierLoading ? <p className="muted-cell purchase-empty">Chargement des fournisseurs…</p> : suppliers.length
        ? <div className="table-wrap"><table>
          <thead><tr><th>FOURNISSEUR</th><th>CONTACT</th><th>IFU</th><th>STATUT</th><th>PIÈCES JOINTES</th>{canManageSuppliers && <th>ACTION</th>}</tr></thead>
          <tbody>{suppliers.map((supplier) => <tr key={supplier.id}>
            <td><strong>{supplier.name}</strong>{supplier.address && <small className="purchase-secondary">{supplier.address}</small>}</td>
            <td>{[supplier.email, supplier.phone].filter(Boolean).join(' · ') || '—'}</td>
            <td>{supplier.tax_id || '—'}</td>
            <td><span className={`purchase-status ${supplier.active ? 'paid' : 'unpaid'}`}>{supplier.active ? 'Actif' : 'Archivé'}</span></td>
            <td><PurchaseDocumentManager businessId={businessId} entityType="supplier" entityId={supplier.id} canUpload={canManageSuppliers} /></td>
            {canManageSuppliers && <td><div className="purchase-row-actions">
              <button type="button" className="outline-button" onClick={() => {
                setSupplierForm({ id: supplier.id, name: supplier.name, email: supplier.email ?? '', phone: supplier.phone ?? '', address: supplier.address ?? '', taxId: supplier.tax_id ?? '', notes: supplier.notes ?? '', active: supplier.active })
                setError('')
              }}>Modifier</button>
              <button type="button" className="outline-button" onClick={() => void (async () => {
                try {
                  await saveSupplier(businessId, { ...supplier, active: !supplier.active })
                  setMessage(supplier.active ? 'Fournisseur archivé.' : 'Fournisseur réactivé.')
                  refresh()
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Impossible de modifier le statut du fournisseur.')
                }

              })()} disabled={busy}>{supplier.active ? 'Archiver' : 'Réactiver'}</button>
            </div></td>}
          </tr>)}</tbody>
        </table></div>
        : <p className="purchase-empty">{supplierQuery ? 'Aucun fournisseur ne correspond à cette recherche.' : 'Aucun fournisseur enregistré.'}</p>}
      {!supplierLoading && supplierCount > 0 && <div className="purchase-pagination"><span>{(supplierPage - 1) * 25 + 1}–{Math.min(supplierPage * 25, supplierCount)} sur {supplierCount} fournisseurs</span><div><button type="button" className="outline-button" disabled={supplierPage <= 1} onClick={() => setSupplierPage((page) => page - 1)}>Précédent</button><span>Page {supplierPage} / {supplierPageCount}</span><button type="button" className="outline-button" disabled={supplierPage >= supplierPageCount} onClick={() => setSupplierPage((page) => page + 1)}>Suivant</button></div></div>}
    </section>

    <section className="panel purchase-panel">
      <div className="panel-heading">
        <div><h2>Historique des actions</h2><p>50 dernières opérations sur les achats, les fournisseurs et les rôles de l’équipe.</p></div>
        {canManageSuppliers && !loading && activity.length > 0 && <div className="toolbar-actions">
          <button type="button" className="outline-button" disabled={busy} onClick={() => setSelectedActivityIds((current) => current.length === activity.length ? [] : activity.map((entry) => entry.id))}>
            {selectedActivityIds.length === activity.length ? 'Tout désélectionner' : 'Sélectionner les actions affichées'}
          </button>
          <button type="button" className="danger-button" disabled={busy || selectedActivityIds.length === 0} onClick={() => setConfirmActivityDeletion(true)}>
            <Trash2 size={15} /> Supprimer{selectedActivityIds.length ? ` (${selectedActivityIds.length})` : ''}
          </button>
        </div>}
      </div>
      {loading ? <p className="muted-cell purchase-empty">Chargement de l’historique…</p> : activity.length
        ? <div className="purchase-activity-list">{activity.map((entry) => (
          <article key={entry.id}>
            <div className="purchase-activity-row">
              {canManageSuppliers && <label className="purchase-activity-select">
                <input
                  type="checkbox"
                  checked={selectedActivityIds.includes(entry.id)}
                  disabled={busy}
                  aria-label={`Sélectionner l’action : ${entry.summary}`}
                  onChange={(event) => setSelectedActivityIds((current) => event.target.checked
                    ? [...current, entry.id]
                    : current.filter((id) => id !== entry.id))}
                />
              </label>}
              <div><strong>{entry.summary}</strong><span>{entry.actor_name}</span></div>
            </div>
            <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('fr-FR')}</time>
            {typeof entry.details.reason === 'string' && <small>Motif : {entry.details.reason}</small>}
            {typeof entry.details.member === 'string' && <small>Membre : {entry.details.member}</small>}
            {(typeof entry.details.old_role === 'string' || typeof entry.details.new_role === 'string') && <small>Rôle : {teamRoleLabels[String(entry.details.old_role)] ?? '—'} → {teamRoleLabels[String(entry.details.new_role)] ?? 'membre retiré'}</small>}
            {typeof entry.details.purchase_number === 'string' && <small>Référence : {entry.details.purchase_number}</small>}
            {entry.details.amount !== undefined && <small>Montant : {formatMoney(Number(entry.details.amount), currency)}</small>}
            {entry.details.quantity !== undefined && <small>Quantité : {String(entry.details.quantity)}</small>}
          </article>
        ))}</div>
        : <p className="purchase-empty">Aucune action enregistrée pour le moment.</p>}
    </section>

    {confirmActivityDeletion && <div className="modal-backdrop" onClick={() => !busy && setConfirmActivityDeletion(false)}>
      <div className="invoice-modal purchase-payment-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-activity-delete-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">SUPPRESSION DÉFINITIVE</p><h2 id="purchase-activity-delete-title">Supprimer les actions sélectionnées ?</h2></div><button type="button" className="icon-button" onClick={() => setConfirmActivityDeletion(false)} aria-label="Fermer" disabled={busy}><X size={20} /></button></div>
        <p className="muted-cell">{selectedActivityIds.length} action(s) sélectionnée(s).</p>
        <div className="purchase-correction-warning">Cette suppression est irréversible. Elle ne supprime ni les factures d’achat, ni les règlements, ni les réceptions, ni les mouvements de stock. Une trace technique minimale conservera la date et le nombre d’actions purgées.</div>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions">
          <button type="button" className="outline-button" onClick={() => setConfirmActivityDeletion(false)} disabled={busy}>Garder l’historique</button>
          <button type="button" className="danger-button" onClick={() => void confirmDeleteActivity()} disabled={busy || selectedActivityIds.length === 0}>{busy ? 'Suppression…' : 'Confirmer la suppression définitive'}</button>
        </div>
      </div>
    </div>}

    {supplierForm && <div className="modal-backdrop" onClick={() => !busy && setSupplierForm(null)}>
      <form className="invoice-modal purchase-modal" onSubmit={(event) => void submitSupplier(event)} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">RÉPERTOIRE</p><h2>{supplierForm.id ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}</h2></div><button type="button" className="icon-button" onClick={() => setSupplierForm(null)} aria-label="Fermer"><X size={20} /></button></div>
        <div className="invoice-form-grid">
          <label>Nom du fournisseur<input required value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} /></label>
          <label>Adresse e-mail<input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} /></label>
          <label>Téléphone<input value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></label>
          <label>IFU (facultatif)<input value={supplierForm.taxId} onChange={(event) => setSupplierForm({ ...supplierForm, taxId: event.target.value })} /></label>
          <label className="full-width">Adresse<input value={supplierForm.address} onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })} /></label>
          <label className="full-width">Notes<textarea rows={3} value={supplierForm.notes} onChange={(event) => setSupplierForm({ ...supplierForm, notes: event.target.value })} /></label>
        </div>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => setSupplierForm(null)} disabled={busy}>Annuler</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div>
      </form>
    </div>}

    {purchaseFormOpen && <div className="modal-backdrop" onClick={() => !busy && setPurchaseFormOpen(false)}>
      <form className="invoice-modal purchase-modal" onSubmit={(event) => void submitPurchase(event)} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">{purchaseReview ? 'VÉRIFICATION AVANT ENREGISTREMENT' : 'APPROVISIONNEMENT'}</p><h2>{purchaseReview ? `Récapitulatif ${editingPurchase ? 'de la modification' : 'de l’achat'}` : editingPurchase ? `Modifier ${editingPurchase.purchase_number}` : 'Nouvelle facture d’achat'}</h2></div><button type="button" className="icon-button" onClick={() => { setPurchaseFormOpen(false); setEditingPurchase(null) }} aria-label="Fermer"><X size={20} /></button></div>
        {purchaseReview ? <>
          <div className="purchase-review-summary">
            <div><span>Fournisseur</span><strong>{activeSuppliers.find((supplier) => supplier.id === purchaseSupplier)?.name ?? 'Fournisseur indisponible'}</strong></div>
            <div><span>Facture fournisseur</span><strong>{supplierInvoiceNumber.trim() || 'Sans référence'}</strong></div>
            <div><span>Date d’achat / échéance</span><strong>{formatDate(purchaseDate)} / {formatDate(dueDate || null)}</strong></div>
            <div><span>Taxe</span><strong>{formatMoney(taxAmount, currency)} ({Number(taxRate) || 0} %)</strong></div>
          </div>
          <div className="purchase-review-lines">
            <strong>Articles et impact de stock</strong>
            {purchaseReviewLines.map(({ line, product, previousStock, nextStock }, index) => {
              return <div key={`${line.productId}-${index}`}>
                <span>{line.description} · {line.quantity} facturée, {line.receivedQuantity} reçue{product ? ` · stock ${previousStock} → ${nextStock}` : ' · sans impact stock'}</span>
                <b>{formatMoney(Number(line.quantity) * Number(line.unitCost), currency)}</b>
              </div>
            })}
          </div>
          <div className="purchase-review-total"><span>{editingPurchase ? 'Nouveau total de la facture' : 'Nouveau solde fournisseur'}</span><strong>{formatMoney(total, currency)}</strong></div>
          <p className="purchase-review-note">{editingPurchase
            ? 'La modification est réservée aux factures sans réception, retour ou paiement. Elle ne modifie aucun stock ni règlement.'
            : 'Après confirmation, la facture et les entrées de stock liées seront enregistrées ensemble. Vérifiez le fournisseur, les quantités reçues et l’échéance.'}</p>
        </> : <>
          {!activeSupplierCount && <div className="data-warning">Ajoutez d’abord un fournisseur actif pour enregistrer son achat.</div>}
          <div className="invoice-form-grid">
            <label>Rechercher un fournisseur<input value={purchaseSupplierQuery} onChange={(event) => { setPurchaseSupplierQuery(event.target.value); setPurchaseSupplier('') }} placeholder="Nom du fournisseur actif" /></label>
            <label>Fournisseur<select required value={purchaseSupplier} onChange={(event) => setPurchaseSupplier(event.target.value)}><option value="">Sélectionner un fournisseur</option>{activeSuppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
            <label>N° de facture fournisseur<input value={supplierInvoiceNumber} onChange={(event) => setSupplierInvoiceNumber(event.target.value)} placeholder="Facultatif" /></label>
            <label>Date d’achat<input required type="date" max={today} value={purchaseDate} onChange={(event) => { setPurchaseDate(event.target.value); if (dueDate && dueDate < event.target.value) setDueDate(event.target.value) }} /></label>
            <label>Date d’échéance<input type="date" min={purchaseDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          </div>
          <div className="purchase-line-builder">
            <div className="purchase-line-heading"><div><h3>Lignes de la facture</h3><p>Choisissez un produit pour ajouter automatiquement sa quantité au stock. Une ligne libre n’ajuste pas l’inventaire.</p></div></div>
            <div className="purchase-line-fields">
              <label>Produit stocké (facultatif)<select value={selectedProduct} onChange={(event) => {
                const product = products.find((item) => item.id === event.target.value)
                setSelectedProduct(event.target.value)
                if (product) {
                  setLineDescription(product.name)
                  setLineCost(String(product.purchase_price))
                }
              }}><option value="">Aucune liaison stock</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · coût actuel {formatMoney(product.purchase_price, currency)}</option>)}</select></label>
              <label>Désignation<input value={lineDescription} onChange={(event) => setLineDescription(event.target.value)} placeholder="Produit ou charge" /></label>
              <label>Qté facturée<input type="number" min="0.01" step="0.01" value={lineQuantity} onChange={(event) => { setLineQuantity(event.target.value); if (Number(lineReceivedQuantity) > Number(event.target.value)) setLineReceivedQuantity(event.target.value) }} /></label>
              {!editingPurchase && <label>Qté reçue<input type="number" min="0" max={lineQuantity} step="0.01" value={lineReceivedQuantity} onChange={(event) => setLineReceivedQuantity(event.target.value)} /></label>}
              <label>Coût unitaire ({currency})<input type="number" min="0" step="0.01" value={lineCost} onChange={(event) => setLineCost(event.target.value)} /></label>
              <button type="button" className="outline-button" onClick={addLine}>Ajouter la ligne</button>
            </div>
            {lines.map((line, index) => <div className="purchase-line-preview" key={`${line.productId}-${index}`}>
              <span>{line.description} · {line.quantity} facturée / {line.receivedQuantity} reçue × {formatMoney(Number(line.unitCost), currency)}{line.productId ? ` · stock +${line.receivedQuantity}` : ''}</span>
              <strong>{formatMoney(Number(line.quantity) * Number(line.unitCost), currency)}</strong>
              <button type="button" className="icon-button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} aria-label="Retirer la ligne"><X size={16} /></button>
            </div>)}
          </div>
          <div className="invoice-form-grid purchase-totals">
            <label>Taux de taxe (%)<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} /></label>
            <label>Notes<textarea rows={2} value={purchaseNotes} onChange={(event) => setPurchaseNotes(event.target.value)} /></label>
            <div className="purchase-total-summary"><span>Sous-total <strong>{formatMoney(subtotal, currency)}</strong></span><span>Taxe <strong>{formatMoney(taxAmount, currency)}</strong></span><span>Total à payer <strong>{formatMoney(total, currency)}</strong></span></div>
          </div>
        </>}
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions">
          <button type="button" className="outline-button" onClick={() => purchaseReview ? setPurchaseReview(false) : (setPurchaseFormOpen(false), setEditingPurchase(null))} disabled={busy}>{purchaseReview ? 'Modifier le formulaire' : 'Annuler'}</button>
          {purchaseReview
            ? <button type="button" className="primary-button" onClick={() => void confirmPurchase()} disabled={busy}>{busy ? 'Enregistrement…' : editingPurchase ? 'Confirmer la modification' : 'Confirmer l’enregistrement'}</button>
            : <button type="submit" className="primary-button" disabled={busy || !activeSupplierCount}>Vérifier le récapitulatif</button>}
        </div>
      </form>
    </div>}

    {paymentPurchase && <div className="modal-backdrop" onClick={() => !busy && setPaymentPurchase(null)}>
      <form className="invoice-modal purchase-payment-modal" onSubmit={(event) => void submitPayment(event)} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">{paymentReview ? 'VÉRIFICATION AVANT ENREGISTREMENT' : 'RÈGLEMENT FOURNISSEUR'}</p><h2>{paymentReview ? 'Récapitulatif du règlement' : 'Enregistrer un paiement'}</h2></div><button type="button" className="icon-button" onClick={() => setPaymentPurchase(null)} aria-label="Fermer"><X size={20} /></button></div>
        {paymentReview
          ? <div className="purchase-review-summary">
            <div><span>Facture / fournisseur</span><strong>{paymentPurchase.purchase_number} · {paymentPurchase.supplier_name}</strong></div>
            <div><span>Montant réglé</span><strong>{formatMoney(Number(paymentAmount), currency)}</strong></div>
            <div><span>Mode / référence</span><strong>{paymentLabels[paymentMethod]} · {paymentReference.trim() || 'Sans référence'}</strong></div>
            <div><span>Solde avant → après</span><strong>{formatMoney(paymentPurchase.total - paymentPurchase.paid_amount, currency)} → {formatMoney(paymentPurchase.total - paymentPurchase.paid_amount - Number(paymentAmount), currency)}</strong></div>
            <div><span>Date du paiement</span><strong>{formatDate(paymentDate)}</strong></div>
            <p className="purchase-review-note">Cette écriture réduira le solde fournisseur. Vérifiez le paiement réellement effectué avant de confirmer.</p>
          </div>
          : <>
            <p className="muted-cell">{paymentPurchase.purchase_number} · {paymentPurchase.supplier_name} · solde {formatMoney(paymentPurchase.total - paymentPurchase.paid_amount, currency)}</p>
            <label>Montant ({currency})<input required type="number" min="0.01" max={paymentPurchase.total - paymentPurchase.paid_amount} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
            <label>Date du paiement<input required type="date" max={today} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
            <label>Mode de paiement<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as ExpensePaymentMethod)}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Référence (facultatif)<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></label>
          </>}
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions">
          <button type="button" className="outline-button" onClick={() => paymentReview ? setPaymentReview(false) : setPaymentPurchase(null)} disabled={busy}>{paymentReview ? 'Modifier le règlement' : 'Annuler'}</button>
          {paymentReview
            ? <button type="button" className="primary-button" onClick={() => void confirmPayment()} disabled={busy}>{busy ? 'Enregistrement…' : 'Confirmer ce règlement'}</button>
            : <button type="submit" className="primary-button" disabled={busy}>Vérifier le récapitulatif</button>}
        </div>
      </form>
    </div>}

    {paymentToReverse && <div className="modal-backdrop" onClick={() => !busy && setPaymentToReverse(null)}>
      <form className="invoice-modal purchase-payment-modal" onSubmit={(event) => { event.preventDefault(); void confirmPaymentReversal() }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">CORRECTION TRAÇABLE</p><h2>Inverser ce règlement ?</h2></div><button type="button" className="icon-button" onClick={() => setPaymentToReverse(null)} aria-label="Fermer"><X size={20} /></button></div>
        <p className="muted-cell">{paymentToReverse.purchase.purchase_number} · {paymentToReverse.purchase.supplier_name} · {formatMoney(paymentToReverse.payment.amount, currency)}</p>
        <div className="purchase-correction-warning">L’inversion réduit le montant réglé dans le solde de l’achat, mais ne déclenche aucun virement. Vérifiez qu’un remboursement fournisseur a réellement eu lieu ou que l’écriture initiale était erronée.</div>
        <label>Date de l’inversion<input required type="date" max={today} value={paymentReversalDate} onChange={(event) => setPaymentReversalDate(event.target.value)} /></label>
        <label>Motif obligatoire<textarea required rows={3} value={paymentReversalReason} onChange={(event) => setPaymentReversalReason(event.target.value)} /></label>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => setPaymentToReverse(null)} disabled={busy}>Conserver le règlement</button><button type="submit" className="danger-button" disabled={busy || !paymentReversalReason.trim()}>{busy ? 'Inversion…' : 'Confirmer l’inversion'}</button></div>
      </form>
    </div>}

    {purchaseToCancel && <div className="modal-backdrop" onClick={() => !busy && setPurchaseToCancel(null)}>
      <form className="invoice-modal purchase-payment-modal" onSubmit={(event) => { event.preventDefault(); void confirmPurchaseCancellation() }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">CORRECTION TRAÇABLE</p><h2>Annuler cette facture d’achat ?</h2></div><button type="button" className="icon-button" onClick={() => setPurchaseToCancel(null)} aria-label="Fermer"><X size={20} /></button></div>
        <p className="muted-cell">{purchaseToCancel.purchase_number} · {purchaseToCancel.supplier_name} · total {formatMoney(purchaseToCancel.total, currency)}</p>
        <div className="purchase-review-lines"><strong>Impact prévu</strong>{purchaseToCancel.items.map((item) => <div key={item.id}><span>{item.description}{item.product_id ? ` · sortie de stock : ${item.received_quantity} ${item.product_name ? `(${item.product_name})` : ''}` : ' · sans impact stock'}</span><b>{formatMoney(item.line_total, currency)}</b></div>)}</div>
        <div className="purchase-correction-warning">Les règlements actifs doivent d’abord être inversés un par un. L’annulation est bloquée si le stock a changé depuis cet achat ou si les quantités ne peuvent pas être restaurées sans rendre le stock négatif. L’historique de la facture reste conservé.</div>
        <label>Motif obligatoire<textarea required rows={3} value={purchaseCancelReason} onChange={(event) => setPurchaseCancelReason(event.target.value)} /></label>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => setPurchaseToCancel(null)} disabled={busy}>Garder la facture</button><button type="submit" className="danger-button" disabled={busy || !purchaseCancelReason.trim()}>{busy ? 'Annulation…' : 'Confirmer l’annulation'}</button></div>
      </form>
    </div>}

    {receivePurchase && <div className="modal-backdrop" onClick={() => !busy && setReceivePurchase(null)}>
      <form className="invoice-modal purchase-payment-modal" onSubmit={(event) => void confirmReceipt(event)} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">RÉCEPTION DE MARCHANDISES</p><h2>Enregistrer une réception</h2></div><button type="button" className="icon-button" onClick={() => setReceivePurchase(null)} aria-label="Fermer"><X size={20} /></button></div>
        <p className="muted-cell">{receivePurchase.purchase_number} · {receivePurchase.supplier_name}</p>
        <label>Date de réception<input required type="date" max={today} value={receiveDate} onChange={(event) => setReceiveDate(event.target.value)} /></label>
        <div className="purchase-receipt-lines">
          {receivePurchase.items.map((item) => {
            const remaining = Math.max(0, item.quantity - item.received_quantity)
            return <label key={item.id}>
              <span>{item.description}<small>{item.received_quantity} reçue(s) sur {item.quantity} facturée(s) · reliquat {remaining}{item.product_id ? ' · entrée de stock' : ' · ligne non stockée'}</small></span>
              <input aria-label={`Quantité reçue pour ${item.description}`} type="number" min="0" max={remaining} step="0.01" value={receiveQuantities[item.id] ?? '0'} onChange={(event) => setReceiveQuantities((current) => ({ ...current, [item.id]: event.target.value }))} />
            </label>
          })}
        </div>
        <p className="purchase-review-note">Seules les quantités reçues seront ajoutées au stock. Une réception partielle peut être complétée ultérieurement.</p>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => setReceivePurchase(null)} disabled={busy}>Annuler</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : 'Confirmer la réception'}</button></div>
      </form>
    </div>}

    {returnPurchase && <div className="modal-backdrop" onClick={() => !busy && setReturnPurchase(null)}>
      <form className="invoice-modal purchase-payment-modal" onSubmit={submitSupplierReturn} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">RETOUR FOURNISSEUR</p><h2>{returnReview ? 'Vérifier le retour' : 'Enregistrer un retour'}</h2></div><button type="button" className="icon-button" onClick={() => setReturnPurchase(null)} aria-label="Fermer"><X size={20} /></button></div>
        <p className="muted-cell">{returnPurchase.purchase_number} · {returnPurchase.supplier_name}</p>
        {!returnReview ? <>
          <label>Date du retour<input required type="date" max={today} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} /></label>
          <label>Motif obligatoire<textarea required rows={3} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} /></label>
          <div className="purchase-receipt-lines">
            {returnPurchase.items.filter((item) => item.product_id).map((item) => {
              const remaining = Math.max(0, item.received_quantity - item.returned_quantity)
              return <label key={item.id}>
                <span>{item.description}<small>{item.received_quantity} reçue(s) · {item.returned_quantity} déjà retournée(s) · disponible au retour : {remaining}</small></span>
                <input aria-label={`Quantité retournée pour ${item.description}`} type="number" min="0" max={remaining} step="0.01" value={returnQuantities[item.id] ?? '0'} onChange={(event) => setReturnQuantities((current) => ({ ...current, [item.id]: event.target.value }))} />
              </label>
            })}
          </div>
          <div className="purchase-correction-warning">Le retour diminue le stock et conserve son motif dans l’historique. Il ne modifie pas le solde de la facture et ne constate pas automatiquement un avoir ou un remboursement fournisseur.</div>
        </> : <>
          <p className="muted-cell">{formatDate(returnDate)} · Motif : {returnReason.trim()}</p>
          <div className="purchase-review-lines"><strong>Sortie de stock prévue</strong>{returnPurchase.items.filter((item) => Number(returnQuantities[item.id] || 0) > 0).map((item) => (
            <div key={item.id}><span>{item.description} · {returnQuantities[item.id]} unité(s){item.product_name ? ` (${item.product_name})` : ''}</span><b>−{returnQuantities[item.id]}</b></div>
          ))}</div>
          <div className="purchase-correction-warning">Confirmez uniquement après vérification des marchandises renvoyées. Cette opération est définitive et ne crée pas d’avoir comptable.</div>
        </>}
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions">
          <button type="button" className="outline-button" onClick={() => returnReview ? setReturnReview(false) : setReturnPurchase(null)} disabled={busy}>{returnReview ? 'Modifier le retour' : 'Annuler'}</button>
          {returnReview
            ? <button type="button" className="danger-button" onClick={() => void confirmSupplierReturn()} disabled={busy}>{busy ? 'Enregistrement…' : 'Confirmer le retour'}</button>
            : <button type="submit" className="primary-button" disabled={busy}>Vérifier le retour</button>}
        </div>
      </form>
    </div>}
  </section>
}

function PurchaseDocumentManager({ businessId, entityType, entityId, canUpload }: {
  businessId: string
  entityType: PurchaseDocumentEntity
  entityId: string
  canUpload: boolean
}) {
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState<PurchaseDocumentRecord[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [openDocument, setOpenDocument] = useState<{ id: string; url: string } | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void loadPurchaseDocuments(businessId, entityType, entityId)
      .then((result) => { if (!cancelled) setDocuments(result) })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de charger les pièces jointes.') })
      .finally(() => { if (!cancelled) setLoadingDocuments(false) })
    return () => { cancelled = true }
  }, [businessId, entityType, entityId, open])

  const attachDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const document = await uploadPurchaseDocument(businessId, entityType, entityId, file)
      setDocuments((current) => [document, ...current])
      setOpenDocument(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de joindre ce fichier.')
    } finally {
      setBusy(false)
    }
  }

  const showDocument = async (document: PurchaseDocumentRecord) => {
    setBusy(true)
    setError('')
    try {
      const url = await createPurchaseDocumentUrl(document.storage_path)
      setOpenDocument({ id: document.id, url })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de générer un lien privé pour ce document.')
    } finally {
      setBusy(false)
    }
  }

  return <details className="purchase-details" onToggle={(event) => {
    const isOpen = event.currentTarget.open
    setOpen(isOpen)
    if (isOpen) {
      setLoadingDocuments(true)
      setError('')
    }
  }}>
    <summary>Pièces jointes{open ? ` (${documents.length})` : ''}</summary>
    {open && <div className="purchase-document-list">
      {canUpload && <label>Ajouter un PDF ou une image (10 Mo max.)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void attachDocument(event)} /></label>}
      {loadingDocuments ? <small>Chargement des pièces jointes…</small> : documents.length
        ? <ul>{documents.map((document) => <li key={document.id}>
          <span>{document.file_name} · {Math.max(1, Math.round(document.file_size / 1024))} Ko</span>
          {openDocument?.id === document.id
            ? <a href={openDocument.url} target="_blank" rel="noreferrer">Ouvrir le document privé</a>
            : <button type="button" className="purchase-inline-action" disabled={busy} onClick={() => void showDocument(document)}>Générer le lien sécurisé</button>}
        </li>)}</ul>
        : !loadingDocuments && <small>Aucune pièce jointe pour le moment.</small>}
      {error && <small className="data-warning" role="alert">{error}</small>}
    </div>}
  </details>
}
