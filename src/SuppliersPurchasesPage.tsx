import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FilePlus2, Plus, RefreshCw, Truck, WalletCards, X } from 'lucide-react'
import { formatMoney } from './lib/formatting'
import { addDateDays, getBusinessDateKey } from './lib/businessPreferences'
import {
  createPurchase,
  loadProducts,
  loadPurchases,
  loadSuppliers,
  registerPurchasePayment,
  saveSupplier,
} from './lib/data'
import type {
  ExpensePaymentMethod,
  ProductRecord,
  PurchaseLineInput,
  PurchaseRecord,
  SupplierRecord,
} from './lib/data'

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
  unitCost: string
}

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

export function SuppliersPurchasesPage({ businessId, currency, timezone, canEdit }: {
  businessId: string
  currency: string
  timezone: string
  canEdit: boolean
}) {
  const today = getBusinessDateKey(new Date(), timezone)
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
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
  const [lineCost, setLineCost] = useState('')
  const [paymentPurchase, setPaymentPurchase] = useState<PurchaseRecord | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash')
  const [paymentReference, setPaymentReference] = useState('')
  const purchaseRequestId = useRef('')
  const paymentRequestId = useRef('')

  const refresh = () => {
    setLoading(true)
    setError('')
    setRefreshKey((current) => current + 1)
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [nextSuppliers, nextPurchases, nextProducts] = await Promise.all([
          loadSuppliers(businessId),
          loadPurchases(businessId),
          loadProducts(businessId),
        ])
        if (cancelled) return
        setSuppliers(nextSuppliers)
        setPurchases(nextPurchases)
        setProducts(nextProducts.filter((product) => product.product_type === 'product' && product.active))
        setError('')
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de charger les fournisseurs et achats.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [businessId, refreshKey])

  const subtotal = useMemo(() => lines.reduce(
    (sum, line) => sum + Math.round((Number(line.quantity) || 0) * (Number(line.unitCost) || 0) * 100) / 100,
    0,
  ), [lines])
  const taxAmount = Math.round(subtotal * (Math.max(0, Math.min(Number(taxRate) || 0, 100)) / 100) * 100) / 100
  const total = subtotal + taxAmount
  const openBalance = purchases.reduce((sum, purchase) => sum + Math.max(0, purchase.total - purchase.paid_amount), 0)
  const overdueBalance = purchases.reduce((sum, purchase) => (
    purchase.due_date && purchase.due_date < today && purchase.status !== 'PAID'
      ? sum + Math.max(0, purchase.total - purchase.paid_amount)
      : sum
  ), 0)
  const activeSuppliers = suppliers.filter((supplier) => supplier.active)
  const filteredPurchases = purchases.filter((purchase) => (
    `${purchase.purchase_number} ${purchase.supplier_invoice_number ?? ''} ${purchase.supplier_name}`
      .toLocaleLowerCase('fr-FR')
      .includes(query.toLocaleLowerCase('fr-FR'))
  ))

  const openNewPurchase = () => {
    setPurchaseSupplier(activeSuppliers[0]?.id ?? '')
    setSupplierInvoiceNumber('')
    setPurchaseDate(today)
    setDueDate(addDateDays(today, 30))
    setTaxRate('0')
    setPurchaseNotes('')
    setLines([])
    setSelectedProduct('')
    setLineDescription('')
    setLineQuantity('1')
    setLineCost('')
    setError('')
    purchaseRequestId.current = crypto.randomUUID()
    setPurchaseFormOpen(true)
  }

  const addLine = () => {
    const quantity = Number(lineQuantity)
    const unitCost = Number(lineCost)
    if (!lineDescription.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      setError('Renseignez une désignation, une quantité positive et un coût unitaire valide.')
      return
    }
    setLines((current) => [...current, {
      productId: selectedProduct,
      description: lineDescription.trim(),
      quantity: String(quantity),
      unitCost: String(unitCost),
    }])
    setSelectedProduct('')
    setLineDescription('')
    setLineQuantity('1')
    setLineCost('')
    setError('')
  }

  const submitPurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!purchaseSupplier || !lines.length || total <= 0) {
      setError('Choisissez un fournisseur et ajoutez au moins une ligne avec un montant supérieur à zéro.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const purchaseLines: PurchaseLineInput[] = lines.map((line) => ({
        productId: line.productId || null,
        description: line.description,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
      }))
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
      setPurchaseFormOpen(false)
      setMessage(`Facture d’achat enregistrée. Le stock des produits liés a été augmenté.`)
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer la facture d’achat.')
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
      setMessage('Règlement fournisseur enregistré.')
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer le règlement.')
    } finally {
      setBusy(false)
    }
  }

  const formatDate = (date: string | null) => date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
    : 'Non renseignée'

  return <section className="module-page purchase-page">
    <div className="module-heading purchase-heading">
      <div><p className="eyebrow">ACHATS ET APPROVISIONNEMENT</p><h1>Fournisseurs et achats</h1><p>Centralisez les factures fournisseurs, les règlements et les entrées de stock.</p></div>
      <div className="toolbar-actions">
        <button type="button" className="outline-button" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw size={16} /> Actualiser</button>
        {canEdit && <button type="button" className="outline-button" onClick={() => { setSupplierForm({ ...emptySupplier }); setError('') }}><Plus size={16} /> Fournisseur</button>}
        {canEdit && <button type="button" className="primary-button" onClick={openNewPurchase}><FilePlus2 size={16} /> Nouvelle facture d’achat</button>}
      </div>
    </div>

    {error && <div className="data-warning" role="alert">{error}</div>}
    {message && <div className="settings-message" role="status">{message}</div>}

    <div className="purchase-summary-grid">
      <article className="panel purchase-summary-card"><span><Truck size={18} /> Fournisseurs actifs</span><strong>{activeSuppliers.length}</strong><small>sur {suppliers.length} enregistrés</small></article>
      <article className="panel purchase-summary-card"><span><WalletCards size={18} /> Solde fournisseurs</span><strong>{formatMoney(openBalance, currency)}</strong><small>reste à régler</small></article>
      <article className="panel purchase-summary-card"><span><FilePlus2 size={18} /> Échéances dépassées</span><strong>{formatMoney(overdueBalance, currency)}</strong><small>factures non soldées en retard</small></article>
    </div>

    <section className="panel purchase-panel">
      <div className="panel-heading"><div><h2>Factures d’achat</h2><p>{purchases.length} facture(s) enregistrée(s) · les paiements sont suivis séparément des charges libres.</p></div></div>
      <div className="module-toolbar purchase-toolbar">
        <label className="search-box"><input aria-label="Rechercher une facture d'achat" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher fournisseur ou référence..." /></label>
      </div>
      {loading ? <p className="muted-cell purchase-empty">Chargement des achats…</p> : filteredPurchases.length
        ? <div className="table-wrap"><table>
          <thead><tr><th>FACTURE ACHAT</th><th>FOURNISSEUR</th><th>DATE</th><th>ÉCHÉANCE</th><th>TOTAL</th><th>RESTANT</th><th>STATUT</th><th>ACTION</th></tr></thead>
          <tbody>{filteredPurchases.map((purchase) => {
            const remaining = Math.max(0, purchase.total - purchase.paid_amount)
            const overdue = purchase.due_date !== null && purchase.due_date < today && remaining > 0
            return <tr key={purchase.id}>
              <td><strong className="invoice-number">{purchase.purchase_number}</strong>{purchase.supplier_invoice_number && <small className="purchase-secondary">Réf. fournisseur : {purchase.supplier_invoice_number}</small>}</td>
              <td>{purchase.supplier_name}</td>
              <td>{formatDate(purchase.purchase_date)}</td>
              <td><span className={overdue ? 'purchase-overdue' : ''}>{formatDate(purchase.due_date)}</span></td>
              <td>{formatMoney(purchase.total, currency)}</td>
              <td>{formatMoney(remaining, currency)}</td>
              <td><span className={`purchase-status ${overdue ? 'overdue' : purchase.status.toLowerCase()}`}>{overdue ? 'En retard' : statusLabels[purchase.status]}</span></td>
              <td><div className="purchase-row-actions">
                {canEdit && remaining > 0 && <button type="button" className="outline-button" onClick={() => {
                  paymentRequestId.current = crypto.randomUUID()
                  setPaymentPurchase(purchase)
                  setPaymentAmount(String(remaining))
                  setPaymentDate(today)
                  setPaymentMethod('cash')
                  setPaymentReference('')
                  setError('')
                }}>Enregistrer un paiement</button>}
                <details className="purchase-details"><summary>Détails</summary><div>
                  <strong>Lignes d’achat</strong>
                  <ul>{purchase.items.map((item) => <li key={item.id}>{item.description} · {item.quantity} × {formatMoney(item.unit_cost, currency)} = {formatMoney(item.line_total, currency)}{item.product_id && <small> · entrée de stock pour {item.product_name ?? 'produit'}</small>}</li>)}</ul>
                  {purchase.payments.length > 0 && <><strong>Règlements enregistrés</strong><ul>{purchase.payments.map((payment) => <li key={payment.id}>{formatDate(payment.paid_at)} · {formatMoney(payment.amount, currency)} · {paymentLabels[payment.payment_method]}{payment.reference ? ` · ${payment.reference}` : ''}</li>)}</ul></>}
                  {purchase.notes && <p>{purchase.notes}</p>}
                </div></details>
              </div></td>
            </tr>
          })}</tbody>
        </table></div>
        : <p className="purchase-empty">{query ? 'Aucune facture d’achat ne correspond à la recherche.' : 'Aucune facture fournisseur pour le moment. Enregistrez un achat pour suivre son échéance et les produits reçus.'}</p>}
      {!canEdit && <p className="purchase-readonly-note">Votre rôle permet de consulter les factures et règlements, mais pas de les modifier.</p>}
    </section>

    <section className="panel purchase-panel suppliers-panel">
      <div className="panel-heading"><div><h2>Répertoire fournisseurs</h2><p>Les fournisseurs archivés restent rattachés à l’historique de leurs achats.</p></div></div>
      {loading ? <p className="muted-cell purchase-empty">Chargement des fournisseurs…</p> : suppliers.length
        ? <div className="table-wrap"><table>
          <thead><tr><th>FOURNISSEUR</th><th>CONTACT</th><th>IFU</th><th>STATUT</th>{canEdit && <th>ACTION</th>}</tr></thead>
          <tbody>{suppliers.map((supplier) => <tr key={supplier.id}>
            <td><strong>{supplier.name}</strong>{supplier.address && <small className="purchase-secondary">{supplier.address}</small>}</td>
            <td>{[supplier.email, supplier.phone].filter(Boolean).join(' · ') || '—'}</td>
            <td>{supplier.tax_id || '—'}</td>
            <td><span className={`purchase-status ${supplier.active ? 'paid' : 'unpaid'}`}>{supplier.active ? 'Actif' : 'Archivé'}</span></td>
            {canEdit && <td><div className="purchase-row-actions">
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
        : <p className="purchase-empty">Aucun fournisseur enregistré.</p>}
    </section>

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
        <div className="modal-header"><div><p className="eyebrow">APPROVISIONNEMENT</p><h2>Nouvelle facture d’achat</h2></div><button type="button" className="icon-button" onClick={() => setPurchaseFormOpen(false)} aria-label="Fermer"><X size={20} /></button></div>
        {!activeSuppliers.length && <div className="data-warning">Ajoutez d’abord un fournisseur actif pour enregistrer son achat.</div>}
        <div className="invoice-form-grid">
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
            <label>Quantité<input type="number" min="0.01" step="0.01" value={lineQuantity} onChange={(event) => setLineQuantity(event.target.value)} /></label>
            <label>Coût unitaire ({currency})<input type="number" min="0" step="0.01" value={lineCost} onChange={(event) => setLineCost(event.target.value)} /></label>
            <button type="button" className="outline-button" onClick={addLine}>Ajouter la ligne</button>
          </div>
          {lines.map((line, index) => <div className="purchase-line-preview" key={`${line.productId}-${index}`}>
            <span>{line.description} · {line.quantity} × {formatMoney(Number(line.unitCost), currency)}{line.productId ? ' · entrée stock' : ''}</span>
            <strong>{formatMoney(Number(line.quantity) * Number(line.unitCost), currency)}</strong>
            <button type="button" className="icon-button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} aria-label="Retirer la ligne"><X size={16} /></button>
          </div>)}
        </div>
        <div className="invoice-form-grid purchase-totals">
          <label>Taux de taxe (%)<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} /></label>
          <label>Notes<textarea rows={2} value={purchaseNotes} onChange={(event) => setPurchaseNotes(event.target.value)} /></label>
          <div className="purchase-total-summary"><span>Sous-total <strong>{formatMoney(subtotal, currency)}</strong></span><span>Taxe <strong>{formatMoney(taxAmount, currency)}</strong></span><span>Total à payer <strong>{formatMoney(total, currency)}</strong></span></div>
        </div>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => setPurchaseFormOpen(false)} disabled={busy}>Annuler</button><button type="submit" className="primary-button" disabled={busy || !activeSuppliers.length}>{busy ? 'Enregistrement…' : 'Enregistrer l’achat'}</button></div>
      </form>
    </div>}

    {paymentPurchase && <div className="modal-backdrop" onClick={() => !busy && setPaymentPurchase(null)}>
      <form className="invoice-modal purchase-payment-modal" onSubmit={(event) => void submitPayment(event)} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">RÈGLEMENT FOURNISSEUR</p><h2>Enregistrer un paiement</h2></div><button type="button" className="icon-button" onClick={() => setPaymentPurchase(null)} aria-label="Fermer"><X size={20} /></button></div>
        <p className="muted-cell">{paymentPurchase.purchase_number} · {paymentPurchase.supplier_name} · solde {formatMoney(paymentPurchase.total - paymentPurchase.paid_amount, currency)}</p>
        <label>Montant ({currency})<input required type="number" min="0.01" max={paymentPurchase.total - paymentPurchase.paid_amount} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
        <label>Date du paiement<input required type="date" max={today} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
        <label>Mode de paiement<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as ExpensePaymentMethod)}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Référence (facultatif)<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></label>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => setPaymentPurchase(null)} disabled={busy}>Annuler</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : 'Confirmer le paiement'}</button></div>
      </form>
    </div>}
  </section>
}
