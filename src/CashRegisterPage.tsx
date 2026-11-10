import { useEffect, useMemo, useState } from 'react'
import { Check, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { getBusinessDateKey } from './lib/businessPreferences'
import { formatMoney } from './lib/formatting'
import { loadCashRegisterOptions, recordCashRegisterSale } from './lib/data'
import type { ClientOption, ProductOption } from './lib/data'

type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'bank_transfer'
type CartLine = { product: ProductOption; quantity: number }
type CompletedSale = { invoiceNumber: string; total: number; paymentMethod: PaymentMethod }

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte bancaire',
  bank_transfer: 'Virement',
}

export function CashRegisterPage({
  businessId,
  currency,
  timezone,
  fiscalRegime,
  defaultTaxRate,
  onPrintReceipt,
  onSaleComplete,
}: {
  businessId: string
  currency: string
  timezone: string
  fiscalRegime: 'TPS' | 'REEL' | null | undefined
  defaultTaxRate: number
  onPrintReceipt: (invoiceNumber: string) => void
  onSaleComplete: () => void
}) {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadOptions = async () => {
      setLoading(true)
      setError('')
      try {
        const options = await loadCashRegisterOptions(businessId)
        if (cancelled) return
        setClients(options.clients)
        setProducts(options.products)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de charger le catalogue de la caisse.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadOptions()
    return () => { cancelled = true }
  }, [businessId])

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr-FR')
    return products.filter((product) => !term || product.name.toLocaleLowerCase('fr-FR').includes(term))
  }, [products, query])
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0)
  const taxRate = fiscalRegime === 'TPS' ? 0 : fiscalRegime === 'REEL' ? 18 : defaultTaxRate
  const tax = subtotal * taxRate / 100
  const total = subtotal + tax

  const addProduct = (product: ProductOption) => {
    setCompletedSale(null)
    setError('')
    const existing = cart.find((line) => line.product.id === product.id)
    const nextQuantity = (existing?.quantity ?? 0) + 1
    if (product.product_type === 'product' && nextQuantity > (product.stock_quantity ?? 0)) {
      setError(`Stock insuffisant pour ${product.name}.`)
      return
    }
    setCart(existing
      ? cart.map((line) => line.product.id === product.id ? { ...line, quantity: nextQuantity } : line)
      : [...cart, { product, quantity: 1 }])
    setRequestId(crypto.randomUUID())
  }

  const changeQuantity = (productId: string, delta: number) => {
    const line = cart.find((item) => item.product.id === productId)
    if (!line) return
    const quantity = line.quantity + delta
    if (delta > 0 && line.product.product_type === 'product' && quantity > (line.product.stock_quantity ?? 0)) {
      setError(`Stock insuffisant pour ${line.product.name}.`)
      return
    }
    setError('')
    setCart(cart.flatMap((item) => {
      if (item.product.id !== productId) return [item]
      if (quantity <= 0) return []
      return [{ ...item, quantity }]
    }))
    setRequestId(crypto.randomUUID())
  }

  const checkout = async () => {
    if (!cart.length) {
      setError('Ajoutez au moins un article au panier.')
      return
    }
    if (total <= 0) {
      setError('Le total de la vente doit être supérieur à zéro.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const sale = await recordCashRegisterSale(
        businessId,
        requestId,
        selectedClient || null,
        paymentMethod,
        cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      )
      setCompletedSale({ invoiceNumber: sale.invoiceNumber, total: sale.total, paymentMethod })
      setCart([])
      setSelectedClient('')
      setPaymentMethod('cash')
      setRequestId(crypto.randomUUID())
      onSaleComplete()
      try {
        const options = await loadCashRegisterOptions(businessId)
        setClients(options.clients)
        setProducts(options.products)
      } catch (cause) {
        const detail = cause instanceof Error ? ` ${cause.message}` : ''
        setError(`La vente est encaissée, mais le catalogue n’a pas pu être actualisé. Rechargez la page avant la prochaine vente.${detail}`)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La vente n’a pas pu être encaissée.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="module-page cash-register-page">
    <div className="module-heading cash-register-heading">
      <div>
        <p className="eyebrow">POINT DE VENTE</p>
        <h1>Caisse et ventes rapides</h1>
        <p>Ajoutez les articles, encaissez la vente et imprimez le reçu-facture.</p>
      </div>
      <span className="cash-register-day">{new Date(`${getBusinessDateKey(new Date(), timezone)}T00:00:00`).toLocaleDateString('fr-FR', { dateStyle: 'full' })}</span>
    </div>

    {error && <div className="data-warning" role="alert">{error}</div>}
    {completedSale && <section className="cash-register-success" role="status">
      <div className="cash-register-success-icon"><Check size={20} /></div>
      <div className="cash-register-success-copy">
        <strong>Vente encaissée</strong>
        <span>Facture {completedSale.invoiceNumber} · {paymentLabels[completedSale.paymentMethod]} · {formatMoney(completedSale.total, currency)}</span>
      </div>
      <button type="button" className="primary-button" onClick={() => onPrintReceipt(completedSale.invoiceNumber)}><Printer size={16} /> Imprimer le reçu-facture</button>
      <button type="button" className="outline-button" onClick={() => setCompletedSale(null)}>Nouvelle vente</button>
    </section>}

    <div className="cash-register-layout">
      <section className="panel cash-register-catalog">
        <div className="cash-register-search">
          <label className="search-box">
            <Search size={17} />
            <input aria-label="Rechercher un article" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un produit ou service…" />
          </label>
          <span>{loading ? 'Chargement…' : `${filteredProducts.length} article(s)`}</span>
        </div>
        {loading ? <p className="cash-register-empty">Chargement du catalogue…</p> : filteredProducts.length
          ? <div className="cash-register-product-grid">
            {filteredProducts.map((product) => {
              const inCart = cart.find((line) => line.product.id === product.id)?.quantity ?? 0
              const stockLimited = product.product_type === 'product'
              const outOfStock = stockLimited && (product.stock_quantity ?? 0) <= 0
              const maxedOut = stockLimited && inCart >= (product.stock_quantity ?? 0)
              return <button
                type="button"
                className="cash-register-product"
                key={product.id}
                onClick={() => addProduct(product)}
                disabled={busy || outOfStock || maxedOut}
              >
                <span className="cash-register-product-type">{product.product_type === 'product' ? 'PRODUIT' : 'SERVICE'}</span>
                <strong>{product.name}</strong>
                <span className="cash-register-product-price">{formatMoney(product.price, currency)}</span>
                {stockLimited && <small>{outOfStock ? 'Rupture de stock' : `${product.stock_quantity} en stock`}</small>}
                {inCart > 0 && <span className="cash-register-product-quantity">{inCart} au panier</span>}
              </button>
            })}
          </div>
          : <p className="cash-register-empty">{products.length ? 'Aucun article ne correspond à la recherche.' : 'Aucun article actif. Ajoutez vos produits ou services dans le catalogue.'}</p>}
      </section>

      <aside className="panel cash-register-cart">
        <div className="cash-register-cart-heading">
          <div><h2><ShoppingCart size={18} /> Panier</h2><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} article(s)</span></div>
          {cart.length > 0 && <button type="button" className="cash-register-clear" onClick={() => { setCart([]); setError(''); setRequestId(crypto.randomUUID()) }} disabled={busy}>Vider</button>}
        </div>

        {cart.length
          ? <div className="cash-register-cart-lines">{cart.map((line) => <div className="cash-register-cart-line" key={line.product.id}>
            <div className="cash-register-cart-line-copy">
              <strong>{line.product.name}</strong>
              <span>{formatMoney(line.product.price, currency)} / {line.product.unit ?? 'unité'}</span>
            </div>
            <div className="cash-register-quantity">
              <button type="button" aria-label={`Retirer une unité de ${line.product.name}`} onClick={() => changeQuantity(line.product.id, -1)} disabled={busy}><Minus size={13} /></button>
              <span>{line.quantity}</span>
              <button type="button" aria-label={`Ajouter une unité de ${line.product.name}`} onClick={() => changeQuantity(line.product.id, 1)} disabled={busy || (line.product.product_type === 'product' && line.quantity >= (line.product.stock_quantity ?? 0))}><Plus size={13} /></button>
            </div>
            <strong className="cash-register-line-total">{formatMoney(line.product.price * line.quantity, currency)}</strong>
            <button type="button" className="cash-register-remove" aria-label={`Supprimer ${line.product.name} du panier`} onClick={() => { setCart(cart.filter((item) => item.product.id !== line.product.id)); setRequestId(crypto.randomUUID()) }} disabled={busy}><Trash2 size={15} /></button>
          </div>)}</div>
          : <div className="cash-register-cart-empty"><ShoppingCart size={23} /><span>Le panier est vide.</span><small>Sélectionnez des articles dans le catalogue.</small></div>}

        <div className="cash-register-totals">
          <div><span>Sous-total</span><strong>{formatMoney(subtotal, currency)}</strong></div>
          <div><span>Taxe {taxRate}%</span><strong>{formatMoney(tax, currency)}</strong></div>
          <div className="cash-register-grand-total"><span>Total à encaisser</span><strong>{formatMoney(total, currency)}</strong></div>
        </div>

        <label className="cash-register-select">Client
          <select value={selectedClient} onChange={(event) => { setSelectedClient(event.target.value); setRequestId(crypto.randomUUID()) }} disabled={busy}>
            <option value="">Client comptoir (sans coordonnées)</option>
            {clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label className="cash-register-select">Mode de paiement
          <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value as PaymentMethod); setRequestId(crypto.randomUUID()) }} disabled={busy}>
            {(Object.entries(paymentLabels) as [PaymentMethod, string][]).map(([method, label]) => <option value={method} key={method}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="primary-button cash-register-checkout" onClick={() => void checkout()} disabled={busy || loading || cart.length === 0}>
          <Check size={17} /> {busy ? 'Enregistrement de la vente…' : 'Encaisser et terminer'}
        </button>
        <p className="cash-register-note">Le paiement est enregistré comme reçu et rapproché. Le stock, la facture et l’encaissement sont traités ensemble.</p>
      </aside>
    </div>
  </section>
}
