import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent } from 'react'
import { Check, FilePlus2, Link2, RefreshCw, X } from 'lucide-react'
import { formatMoney } from './lib/formatting'
import { addDateDays, getBusinessDateKey } from './lib/businessPreferences'
import {
  acceptQuoteManually,
  convertQuoteToInvoice,
  createQuote,
  createQuoteShareLink,
  loadInvoiceOptions,
  loadPublicQuote,
  loadQuotes,
  respondToPublicQuote,
  type PublicQuote,
  type QuoteRecord,
} from './lib/data'

type QuoteOptions = Awaited<ReturnType<typeof loadInvoiceOptions>>

export function QuotesPage({ businessId, currency, timezone, canEdit, defaultTaxRate }: {
  businessId: string
  currency: string
  timezone: string
  canEdit: boolean
  defaultTaxRate: number
}) {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [options, setOptions] = useState<QuoteOptions>({ clients: [], products: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sharedLink, setSharedLink] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [clientId, setClientId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [lines, setLines] = useState<{ productId: string; quantity: number }[]>([])
  const [discount, setDiscount] = useState('0')
  const [taxRate, setTaxRate] = useState(String(defaultTaxRate))
  const today = getBusinessDateKey(new Date(), timezone)

  const refresh = async () => {
    setError('')
    setLoading(true)
    try {
      const [nextQuotes, nextOptions] = await Promise.all([loadQuotes(businessId), loadInvoiceOptions(businessId)])
      setQuotes(nextQuotes)
      setOptions(nextOptions)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les devis.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [businessId])

  const subtotal = useMemo(() => lines.reduce((sum, line) => {
    const product = options.products.find((item) => item.id === line.productId)
    return sum + (product?.price ?? 0) * line.quantity
  }, 0), [lines, options.products])
  const discountAmount = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const taxAmount = (subtotal - discountAmount) * Math.max(0, Math.min(Number(taxRate) || 0, 100)) / 100
  const total = subtotal - discountAmount + taxAmount

  const openForm = () => {
    setClientId('')
    setValidUntil(addDateDays(today, 30))
    setLines([])
    setSelectedProduct('')
    setQuantity('1')
    setDiscount('0')
    setTaxRate(String(defaultTaxRate))
    setError('')
    setShowForm(true)
  }

  const submitQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!clientId || !lines.length) {
      setError('Sélectionnez un client et ajoutez au moins une ligne.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    setSharedLink('')
    try {
      await createQuote(businessId, clientId, validUntil, Number(discount), Number(taxRate), lines)
      setShowForm(false)
      setMessage('Devis créé. Vous pouvez enregistrer l’acceptation ou générer un lien de partage.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de créer le devis.')
    } finally {
      setBusy(false)
    }
  }

  const addLine = () => {
    const count = Number(quantity)
    if (!selectedProduct || !Number.isFinite(count) || count <= 0) {
      setError('Choisissez un produit ou service et indiquez une quantité valide.')
      return
    }
    setLines((current) => [...current, { productId: selectedProduct, quantity: count }])
    setSelectedProduct('')
    setQuantity('1')
    setError('')
  }

  const shareQuote = async (quote: QuoteRecord) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
      await createQuoteShareLink(businessId, quote.id, token)
      const link = new URL(`/devis/${token}`, window.location.origin).toString()
      setSharedLink(link)
      try {
        await navigator.clipboard.writeText(link)
        setMessage(`Lien sécurisé du devis ${quote.quote_number} copié. Envoyez-le au client.`)
      } catch {
        setMessage(`Lien sécurisé créé pour le devis ${quote.quote_number}. Copiez-le ci-dessous et envoyez-le au client.`)
      }
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de créer ou copier le lien de partage.')
    } finally {
      setBusy(false)
    }
  }

  const markAccepted = async (quote: QuoteRecord) => {
    if (!window.confirm(`Enregistrer l’accord reçu pour le devis ${quote.quote_number} ?`)) return
    setBusy(true)
    setError('')
    try {
      await acceptQuoteManually(businessId, quote.id)
      setMessage(`L’acceptation du devis ${quote.quote_number} a été enregistrée.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer l’acceptation.')
    } finally {
      setBusy(false)
    }
  }

  const convert = async (quote: QuoteRecord) => {
    if (!window.confirm(`Convertir ${quote.quote_number} en facture ? Les prix convenus seront conservés.`)) return
    setBusy(true)
    setError('')
    try {
      const invoiceNumber = await convertQuoteToInvoice(businessId, quote.id)
      setMessage(`Devis converti en facture ${invoiceNumber}.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de convertir ce devis en facture.')
    } finally {
      setBusy(false)
    }
  }

  const clientName = (quote: QuoteRecord) => Array.isArray(quote.clients) ? quote.clients[0]?.name ?? '—' : quote.clients?.name ?? '—'
  const statusLabel = (quote: QuoteRecord) => quote.status === 'DRAFT' ? 'Brouillon' : quote.status === 'SENT' ? quote.valid_until < today ? 'Expiré' : 'Envoyé' : quote.status === 'ACCEPTED' ? 'Accepté' : quote.status === 'REJECTED' ? 'Refusé' : 'Converti'

  return <section className="module-page quotes-page">
    <div className="module-heading">
      <div><p className="eyebrow">VENTES</p><h1>Devis</h1><p>Préparez vos propositions, recueillez l’accord du client et convertissez un devis accepté en facture.</p></div>
      <div className="toolbar-actions">
        <button type="button" className="outline-button" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw size={16} /> Actualiser</button>
        {canEdit && <button type="button" className="primary-button" onClick={openForm}><FilePlus2 size={16} /> Nouveau devis</button>}
      </div>
    </div>
    <div className="quote-workflow-note"><strong>Deux façons d’enregistrer l’accord</strong><span>Marquez manuellement un accord reçu hors application, ou partagez un lien sécurisé pour que le client réponde en ligne avec son nom, son e-mail et sa signature dessinée. La signature est conservée comme preuve de réponse, sans certification électronique.</span></div>
    {error && <div className="data-warning" role="alert">{error}</div>}
    {message && <div className="settings-message" role="status">{message}</div>}
    {sharedLink && <div className="quote-share-link"><Link2 size={16} /><input aria-label="Lien de partage du devis" readOnly value={sharedLink} onFocus={(event) => event.currentTarget.select()} /><button className="outline-button" onClick={() => void navigator.clipboard.writeText(sharedLink).then(() => setMessage('Lien copié.')).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Impossible de copier le lien.'))}>Copier</button></div>}
    <div className="panel">
      <div className="panel-heading"><div><h2>Historique des devis</h2><p>{quotes.length} devis · les articles et prix restent figés après création.</p></div></div>
      {loading ? <p className="muted-cell">Chargement des devis…</p> : <div className="table-wrap"><table>
        <thead><tr><th>NUMÉRO</th><th>CLIENT</th><th>ÉMIS LE</th><th>VALABLE JUSQU’AU</th><th>MONTANT</th><th>STATUT</th><th>ACTIONS</th></tr></thead>
        <tbody>{quotes.length ? quotes.map((quote) => <tr key={quote.id}>
          <td className="invoice-number">{quote.quote_number}</td><td>{clientName(quote)}</td>
          <td>{new Date(`${quote.issue_date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</td>
          <td>{new Date(`${quote.valid_until}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</td>
          <td>{formatMoney(quote.total, currency)}</td><td><span className={`quote-status quote-status-${statusLabel(quote).toLocaleLowerCase('fr-FR')}`}>{statusLabel(quote)}</span></td>
          <td><div className="quote-actions">
            {canEdit && ['DRAFT', 'SENT'].includes(quote.status) && quote.valid_until >= today && <button className="outline-button" disabled={busy} onClick={() => void shareQuote(quote)} title="Créer un nouveau lien public"><Link2 size={15} /><span>Partager</span></button>}
            {canEdit && ['DRAFT', 'SENT'].includes(quote.status) && quote.valid_until >= today && <button className="outline-button" disabled={busy} onClick={() => void markAccepted(quote)} title="Enregistrer un accord reçu hors application"><Check size={15} /><span>Accepté manuellement</span></button>}
            {canEdit && quote.status === 'ACCEPTED' && <button className="primary-button" disabled={busy} onClick={() => void convert(quote)}><FilePlus2 size={15} /><span>Créer la facture</span></button>}
            {quote.status === 'CONVERTED' && <span className="muted-cell">Facture créée</span>}
          </div></td>
        </tr>) : <tr><td colSpan={7} className="muted-cell">Aucun devis. Créez-en un pour commencer.</td></tr>}</tbody>
      </table></div>}
    </div>
    {!canEdit && <p className="muted-cell">Votre rôle permet de consulter les devis, mais pas de les modifier.</p>}

    {showForm && <div className="modal-backdrop" onClick={() => !busy && setShowForm(false)}>
      <form className="invoice-modal quote-form" onSubmit={(event) => void submitQuote(event)} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">NOUVELLE PROPOSITION</p><h2>Créer un devis</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)} aria-label="Fermer"><X size={20} /></button></div>
        <div className="invoice-form-grid">
          <label>Client<select required value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Sélectionner un client</option>{options.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label>Valable jusqu’au<input required type="date" min={today} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
        </div>
        <div className="invoice-line-builder">
          <div className="invoice-line-builder-heading"><div><h3>Articles et services</h3><p>Les prix sont enregistrés dans le devis et conservés lors de sa conversion.</p></div><span>{lines.length} ligne(s)</span></div>
          <div className="invoice-line-fields">
            <label>Produit ou service<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}><option value="">Sélectionner</option>{options.products.map((product) => <option value={product.id} key={product.id}>{product.name} · {formatMoney(product.price, currency)}</option>)}</select></label>
            <label>Quantité<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <button type="button" className="outline-button" onClick={addLine}>Ajouter</button>
          </div>
          {lines.map((line, index) => {
            const product = options.products.find((item) => item.id === line.productId)
            return <div className="quote-line-preview" key={`${line.productId}-${index}`}><span>{product?.name ?? 'Article'} × {line.quantity}</span><strong>{formatMoney((product?.price ?? 0) * line.quantity, currency)}</strong><button type="button" className="icon-button" onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Retirer la ligne"><X size={16} /></button></div>
          })}
        </div>
        <div className="quote-total-fields">
          <label>Remise ({currency})<input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
          <label>Taux de taxe (%)<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} /></label>
          <p>Sous-total <strong>{formatMoney(subtotal, currency)}</strong></p><p>Taxe <strong>{formatMoney(taxAmount, currency)}</strong></p><p className="quote-total">Total <strong>{formatMoney(total, currency)}</strong></p>
        </div>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)} disabled={busy}>Annuler</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Création…' : 'Créer le devis'}</button></div>
      </form>
    </div>}
  </section>
}

export function PublicQuotePage({ token }: { token: string }) {
  const [quote, setQuote] = useState<PublicQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [signatureData, setSignatureData] = useState('')

  useEffect(() => {
    let active = true
    void loadPublicQuote(token).then((result) => {
      if (active) setQuote(result)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Impossible de charger ce devis.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [token])

  const respond = async (decision: 'accept' | 'decline') => {
    setError('')
    setMessage('')
    if (decision === 'accept' && !signatureData) {
      setError('Veuillez signer dans le cadre prévu avant de confirmer l’acceptation.')
      return
    }
    setBusy(true)
    try {
      await respondToPublicQuote(token, decision, fullName, email, confirmed, decision === 'accept' ? signatureData : null)
      setMessage(decision === 'accept'
        ? 'Votre acceptation du devis a été enregistrée. Vous pouvez fermer cette page.'
        : 'Votre refus du devis a été enregistré. Vous pouvez fermer cette page.')
      setQuote((current) => current ? { ...current, status: decision === 'accept' ? 'ACCEPTED' : 'REJECTED' } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Votre réponse n’a pas pu être enregistrée.')
    } finally {
      setBusy(false)
    }
  }

  const responded = quote && quote.status !== 'SENT'

  return <main className="public-quote-shell">
    <header className="public-quote-brand"><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></header>
    <article className="public-quote-card">
      {loading ? <p role="status">Chargement du devis…</p> : error && !quote
        ? <><p className="eyebrow">DEVIS PARTAGÉ</p><h1>Ce lien n’est pas disponible</h1><p>{error}</p></>
        : quote && <>
          <div className="public-quote-heading"><div><p className="eyebrow">PROPOSITION COMMERCIALE</p><h1>{quote.businessName}</h1><p>À l’attention de {quote.clientName}</p></div><strong>{quote.quoteNumber}</strong></div>
          <div className="public-quote-dates"><span>Émis le <b>{new Date(`${quote.issueDate}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</b></span><span>Valable jusqu’au <b>{new Date(`${quote.validUntil}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</b></span></div>
          <div className="table-wrap"><table><thead><tr><th>DÉSIGNATION</th><th>QUANTITÉ</th><th>PRIX UNITAIRE</th><th>MONTANT</th></tr></thead><tbody>
            {quote.items.map((item, index) => <tr key={`${item.description}-${index}`}><td>{item.description}</td><td>{item.quantity}</td><td>{formatMoney(item.unitPrice, quote.currency)}</td><td>{formatMoney(item.total, quote.currency)}</td></tr>)}
          </tbody></table></div>
          <div className="public-quote-totals"><p>Sous-total <strong>{formatMoney(quote.subtotal, quote.currency)}</strong></p>{quote.discount > 0 && <p>Remise <strong>− {formatMoney(quote.discount, quote.currency)}</strong></p>}<p>Taxes <strong>{formatMoney(quote.tax, quote.currency)}</strong></p><p className="quote-total">Total proposé <strong>{formatMoney(quote.total, quote.currency)}</strong></p></div>
          {responded
            ? <div className="quote-workflow-note" role="status"><strong>{quote.status === 'ACCEPTED' ? 'Devis accepté' : quote.status === 'REJECTED' ? 'Devis refusé' : quote.status === 'CONVERTED' ? 'Devis converti en facture' : 'Ce devis n’est plus ouvert aux réponses'}</strong><span>La réponse a déjà été enregistrée.</span></div>
            : <form className="public-quote-response" onSubmit={(event) => { event.preventDefault(); void respond('accept') }}>
              <h2>Votre réponse</h2>
              <label>Nom complet<input required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>
              <label>Adresse e-mail<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
              <label className="quote-confirmation"><input required type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Je confirme avoir pris connaissance de ce devis et de ma réponse.</span></label>
              <SignaturePad onChange={setSignatureData} />
              {error && <div className="data-warning" role="alert">{error}</div>}
              {message && <div className="settings-message" role="status">{message}</div>}
              <div className="public-quote-actions"><button type="button" className="outline-button warning-button" disabled={busy} onClick={() => void respond('decline')}>Refuser le devis</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : 'Accepter et signer'}</button></div>
              <p className="quote-signature-disclaimer">La signature dessinée et les coordonnées fournies sont enregistrées avec la date de votre réponse. Cette fonctionnalité ne constitue pas une signature électronique certifiée.</p>
            </form>}
          {error && quote && !responded && <div className="data-warning" role="alert">{error}</div>}
          {message && responded && <div className="settings-message" role="status">{message}</div>}
          <button type="button" className="outline-button public-quote-print" onClick={() => window.print()}>Imprimer le devis</button>
        </>}
    </article>
  </main>
}

function SignaturePad({ onChange }: { onChange: (signature: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
    const context = canvas.getContext('2d')
    if (context) {
      context.scale(ratio, ratio)
      context.lineWidth = 2
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.strokeStyle = '#172554'
    }
  }, [])

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const context = event.currentTarget.getContext('2d')
    const current = point(event)
    context?.beginPath()
    context?.moveTo(current.x, current.y)
    drawing.current = true
  }

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const context = event.currentTarget.getContext('2d')
    const current = point(event)
    context?.lineTo(current.x, current.y)
    context?.stroke()
    if (!hasSignature) setHasSignature(true)
  }

  const finish = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas) onChange(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    onChange('')
  }

  return <div className="signature-pad-field">
    <div><label htmlFor="quote-signature">Signature dessinée</label><button type="button" className="outline-button" onClick={clear} disabled={!hasSignature}>Effacer</button></div>
    <canvas id="quote-signature" ref={canvasRef} className="signature-pad" aria-label="Dessinez votre signature dans cette zone" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
    <small>Utilisez votre doigt, votre souris ou un stylet.</small>
  </div>
}
