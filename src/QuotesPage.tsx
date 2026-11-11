import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent } from 'react'
import { Download, FilePlus2, Link2, Mail, MessageCircle, RefreshCw, X } from 'lucide-react'
import { formatMoney } from './lib/formatting'
import { addDateDays, getBusinessDateKey } from './lib/businessPreferences'
import {
  acceptQuoteManually,
  convertQuoteToInvoice,
  createQuote,
  createQuoteShareLink,
  deleteQuote,
  loadInvoiceOptions,
  loadPublicQuote,
  loadQuotes,
  respondToPublicQuote,
  sendQuoteEmail,
  updateQuote,
  type PublicQuote,
  type QuoteRecord,
  type QuoteUpdateLine,
} from './lib/data'

type QuoteOptions = Awaited<ReturnType<typeof loadInvoiceOptions>>
type QuoteAction = 'view' | 'edit' | 'email' | 'whatsapp' | 'share' | 'accept' | 'convert' | 'delete'
type QuoteConfirmationKind = 'create' | 'save' | 'share' | 'email' | 'whatsapp' | 'delete' | 'accept' | 'convert'
type QuoteConfirmation = { kind: QuoteConfirmationKind; quote: QuoteRecord | null; link?: string }

const loadQuotePageData = (businessId: string) =>
  Promise.all([loadQuotes(businessId), loadInvoiceOptions(businessId)])

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
  const [sharedQuote, setSharedQuote] = useState<{ quote: QuoteRecord; link: string } | null>(null)
  const [confirmation, setConfirmation] = useState<QuoteConfirmation | null>(null)
  const [quoteActionPicker, setQuoteActionPicker] = useState<QuoteAction | null>(null)
  const [quoteActionSearch, setQuoteActionSearch] = useState('')
  const [quoteActionPage, setQuoteActionPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editingQuote, setEditingQuote] = useState<QuoteRecord | null>(null)
  const [viewingQuote, setViewingQuote] = useState<QuoteRecord | null>(null)
  const [clientId, setClientId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [lines, setLines] = useState<QuoteUpdateLine[]>([])
  const [discount, setDiscount] = useState('0')
  const [taxRate, setTaxRate] = useState(String(defaultTaxRate))
  const today = getBusinessDateKey(new Date(), timezone)

  const refresh = async () => {
    setError('')
    setLoading(true)
    try {
      const [nextQuotes, nextOptions] = await loadQuotePageData(businessId)
      setQuotes(nextQuotes)
      setOptions(nextOptions)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les devis.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void loadQuotePageData(businessId).then(([nextQuotes, nextOptions]) => {
      if (!active) return
      setQuotes(nextQuotes)
      setOptions(nextOptions)
      setError('')
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Impossible de charger les devis.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [businessId])

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [lines])
  const discountAmount = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const taxAmount = (subtotal - discountAmount) * Math.max(0, Math.min(Number(taxRate) || 0, 100)) / 100
  const total = subtotal - discountAmount + taxAmount

  const openForm = () => {
    setEditingQuote(null)
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

  const openEditForm = (quote: QuoteRecord) => {
    setEditingQuote(quote)
    setClientId(quote.client_id)
    setValidUntil(quote.valid_until)
    setLines(quote.quote_items.map((line) => ({
      productId: line.product_id,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unit_price,
    })))
    setSelectedProduct('')
    setQuantity('1')
    setDiscount(String(quote.discount))
    const taxableBase = quote.subtotal - quote.discount
    setTaxRate(taxableBase > 0 ? String(Number((quote.tax / taxableBase * 100).toFixed(2))) : '0')
    setError('')
    setMessage('')
    setShowForm(true)
  }

  const submitQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!clientId || !lines.length) {
      setError('Sélectionnez un client et ajoutez au moins une ligne.')
      return
    }
    if (!editingQuote && lines.some((line) => !line.productId)) {
      setError('Choisissez un produit ou service pour chaque ligne du nouveau devis.')
      return
    }
    setError('')
    setConfirmation({ kind: editingQuote ? 'save' : 'create', quote: editingQuote })
  }

  const addLine = () => {
    const count = Number(quantity)
    if (!selectedProduct || !Number.isFinite(count) || count <= 0) {
      setError('Choisissez un produit ou service et indiquez une quantité valide.')
      return
    }
    const product = options.products.find((item) => item.id === selectedProduct)
    if (!product) {
      setError('Le produit ou service sélectionné est introuvable.')
      return
    }
    setLines((current) => [...current, {
      productId: product.id,
      description: product.name,
      quantity: count,
      unitPrice: product.price,
    }])
    setSelectedProduct('')
    setQuantity('1')
    setError('')
  }

  const client = (quote: QuoteRecord) => Array.isArray(quote.clients) ? quote.clients[0] ?? null : quote.clients
  const clientName = (quote: QuoteRecord) => client(quote)?.name ?? '—'
  const clientEmail = (quote: QuoteRecord) => client(quote)?.email ?? ''
  const clientPhone = (quote: QuoteRecord) => client(quote)?.phone ?? ''
  const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
  const statusLabel = (quote: QuoteRecord) => quote.status === 'DRAFT' ? 'Brouillon' : quote.status === 'SENT' ? quote.valid_until < today ? 'Expiré' : 'Envoyé' : quote.status === 'ACCEPTED' ? 'Accepté' : quote.status === 'REJECTED' ? 'Refusé' : 'Converti'
  const statusClass = (quote: QuoteRecord) => quote.status === 'SENT' && quote.valid_until < today ? 'expired' : quote.status.toLocaleLowerCase('en-US')
  const quoteActionOptions: { id: QuoteAction; label: string; enabled: boolean }[] = [
    { id: 'view', label: 'Voir', enabled: true },
    { id: 'edit', label: 'Modifier', enabled: canEdit },
    { id: 'email', label: 'E-mail', enabled: canEdit },
    { id: 'whatsapp', label: 'WhatsApp', enabled: canEdit },
    { id: 'share', label: 'Lien sécurisé', enabled: canEdit },
    { id: 'accept', label: 'Accepter manuellement', enabled: canEdit },
    { id: 'convert', label: 'Créer la facture', enabled: canEdit },
    { id: 'delete', label: 'Supprimer', enabled: canEdit },
  ]
  const normalizeQuoteSearch = (value: string) => value.trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const filteredActionQuotes = quotes.filter((quote) => normalizeQuoteSearch(`${quote.quote_number} ${clientName(quote)} ${statusLabel(quote)}`).includes(normalizeQuoteSearch(quoteActionSearch)))
  const quoteActionPageSize = 25
  const quoteActionPageCount = Math.max(1, Math.ceil(filteredActionQuotes.length / quoteActionPageSize))
  const visibleActionQuotes = filteredActionQuotes.slice((quoteActionPage - 1) * quoteActionPageSize, quoteActionPage * quoteActionPageSize)

  const getQuoteActionUnavailableReason = (action: QuoteAction, quote: QuoteRecord): string | null => {
    if (action === 'view') return null
    if (!canEdit) return 'Votre rôle ne permet pas de gérer les devis.'
    const editableStatuses = quote.status === 'DRAFT' || quote.status === 'SENT'
    if (action === 'delete') return quote.status === 'CONVERTED' ? 'Un devis converti en facture ne peut pas être supprimé.' : null
    if (action === 'convert') return quote.status === 'ACCEPTED' ? null : quote.status === 'CONVERTED' ? 'Ce devis a déjà été converti en facture.' : 'Seul un devis accepté peut être converti en facture.'
    if (action === 'edit') return editableStatuses ? null : 'Seuls les brouillons ou devis envoyés peuvent être modifiés.'
    if (action === 'email') {
      if (!editableStatuses) return 'Seuls les brouillons ou devis envoyés peuvent être partagés.'
      if (quote.valid_until < today) return 'Ce devis a expiré.'
      return clientEmail(quote) ? null : 'Adresse e-mail du client manquante.'
    }
    if (action === 'whatsapp') {
      if (!editableStatuses) return 'Seuls les brouillons ou devis envoyés peuvent être partagés.'
      if (quote.valid_until < today) return 'Ce devis a expiré.'
      return clientPhone(quote) ? null : 'Téléphone du client manquant.'
    }
    if (action === 'share' || action === 'accept') {
      if (!editableStatuses) return 'Cette action est réservée aux brouillons ou devis envoyés.'
      return quote.valid_until >= today ? null : 'Ce devis a expiré.'
    }
    return null
  }

  const selectQuoteAction = (action: QuoteAction, quote: QuoteRecord) => {
    setQuoteActionPicker(null)
    if (action === 'view') {
      setViewingQuote(quote)
    } else if (action === 'edit') {
      openEditForm(quote)
    } else {
      const kind = action === 'share' ? 'share'
        : action === 'email' ? 'email'
          : action === 'whatsapp' ? 'whatsapp'
            : action === 'accept' ? 'accept'
              : action === 'convert' ? 'convert'
                : 'delete'
      setConfirmation({ kind, quote })
    }
  }

  const confirmSensitiveAction = async () => {
    if (!confirmation) return
    const action = confirmation
    let popup: Window | null = null
    if (action.kind === 'whatsapp' && action.quote) {
      popup = window.open('about:blank', '_blank')
      if (!popup) {
        setConfirmation(null)
        setError('Autorisez les fenêtres contextuelles pour ouvrir WhatsApp.')
        return
      }
      popup.opener = null
    }
    setConfirmation(null)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (action.kind === 'create' || action.kind === 'save') {
        if (editingQuote) {
          await updateQuote(businessId, editingQuote.id, clientId, validUntil, Number(discount), Number(taxRate), lines)
          if (sharedQuote?.quote.id === editingQuote.id) setSharedQuote(null)
        } else {
          const selectedLines = lines.map((line) => {
            if (!line.productId) throw new Error('Choisissez un produit ou service pour chaque ligne du nouveau devis.')
            return { productId: line.productId, quantity: line.quantity }
          })
          await createQuote(businessId, clientId, validUntil, Number(discount), Number(taxRate), selectedLines)
        }
        setShowForm(false)
        setMessage(action.kind === 'save' && editingQuote
          ? `Devis ${editingQuote.quote_number} modifié. Son ancien lien de partage a été invalidé.`
          : 'Devis créé. Vous pouvez créer un lien sécurisé puis le partager par e-mail ou WhatsApp.')
        setEditingQuote(null)
        await refresh()
      } else if (action.kind === 'share' && action.quote) {
        const bytes = crypto.getRandomValues(new Uint8Array(32))
        const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
        await createQuoteShareLink(businessId, action.quote.id, token)
        const link = new URL(`/devis/${token}`, window.location.origin).toString()
        setSharedQuote({ quote: action.quote, link })
        try {
          await navigator.clipboard.writeText(link)
          setMessage(`Lien sécurisé du devis ${action.quote.quote_number} créé et copié. Vous pouvez l’envoyer par e-mail ou WhatsApp.`)
        } catch {
          setMessage(`Lien sécurisé du devis ${action.quote.quote_number} créé. Vous pouvez l’envoyer par e-mail ou WhatsApp.`)
        }
        await refresh()
      } else if (action.kind === 'email' && action.quote) {
        const { recipient, quoteUrl } = await sendQuoteEmail(businessId, action.quote.id)
        setSharedQuote({ quote: action.quote, link: quoteUrl })
        setMessage(`Devis ${action.quote.quote_number} envoyé par e-mail à ${recipient}.`)
        await refresh()
      } else if (action.kind === 'whatsapp' && action.quote && popup) {
        const quote = action.quote
        const link = action.link ?? await (async () => {
          const bytes = crypto.getRandomValues(new Uint8Array(32))
          const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
          await createQuoteShareLink(businessId, quote.id, token)
          return new URL(`/devis/${token}`, window.location.origin).toString()
        })()
        setSharedQuote({ quote, link })
        const text = `Bonjour ${clientName(quote)}, voici le devis ${quote.quote_number} de ${formatMoney(quote.total, quote.currency)}, valable jusqu’au ${formatDate(quote.valid_until)} : ${link}`
        const phone = clientPhone(quote).replace(/\D/g, '')
        const internationalPhone = phone.startsWith('00') ? phone.slice(2) : phone.startsWith('0') ? `229${phone.slice(1)}` : phone
        popup.location.replace(`https://wa.me/${internationalPhone}?text=${encodeURIComponent(text)}`)
        setMessage(`Devis ${quote.quote_number} prêt dans WhatsApp. Vérifiez le destinataire et confirmez l’envoi dans WhatsApp.`)
        await refresh()
      } else if (action.kind === 'delete' && action.quote) {
        await deleteQuote(businessId, action.quote.id)
        setMessage(`Devis ${action.quote.quote_number} supprimé.`)
        setViewingQuote(null)
        if (sharedQuote?.quote.id === action.quote.id) setSharedQuote(null)
        await refresh()
      } else if (action.kind === 'accept' && action.quote) {
        await acceptQuoteManually(businessId, action.quote.id)
        setMessage(`L’acceptation du devis ${action.quote.quote_number} a été enregistrée.`)
        await refresh()
      } else if (action.kind === 'convert' && action.quote) {
        const invoiceNumber = await convertQuoteToInvoice(businessId, action.quote.id)
        setMessage(`Devis converti en facture ${invoiceNumber}.`)
        await refresh()
      }
    } catch (cause) {
      popup?.close()
      setError(cause instanceof Error ? cause.message : 'L’action sur le devis a échoué.')
    } finally {
      setBusy(false)
    }
  }

  const confirmationTitle = confirmation ? ({
    create: 'Confirmer la création du devis',
    save: 'Confirmer les modifications',
    share: 'Confirmer la création du lien',
    email: 'Confirmer l’envoi par e-mail',
    whatsapp: 'Confirmer le partage WhatsApp',
    delete: 'Confirmer la suppression',
    accept: 'Confirmer l’acceptation manuelle',
    convert: 'Confirmer la conversion en facture',
  } satisfies Record<QuoteConfirmationKind, string>)[confirmation.kind] : ''
  const confirmationMessage = confirmation ? ({
    create: 'Le devis sera enregistré avec les lignes, le client et les montants affichés dans le formulaire.',
    save: 'Le devis sera mis à jour, repassera en brouillon et son ancien lien de partage sera invalidé.',
    share: 'Un nouveau lien sécurisé sera créé. Tout ancien lien public de ce devis sera remplacé.',
    email: `Le devis sera envoyé à ${confirmation.quote ? clientEmail(confirmation.quote) : ''} via le service e-mail configuré.`,
    whatsapp: `WhatsApp va s’ouvrir avec un message prérempli pour ${confirmation.quote ? clientPhone(confirmation.quote) : ''}. Vous pourrez vérifier le message et confirmer son envoi dans WhatsApp.`,
    delete: 'Cette suppression est définitive et ne peut pas être annulée.',
    accept: 'Le devis sera marqué comme accepté manuellement, sur la base de l’accord reçu hors application.',
    convert: 'Une facture sera créée à partir de ce devis et de ses prix convenus.',
  } satisfies Record<QuoteConfirmationKind, string>)[confirmation.kind] : ''
  const confirmationButtonLabel = confirmation ? ({
    create: 'Créer le devis',
    save: 'Enregistrer les modifications',
    share: 'Créer le lien sécurisé',
    email: 'Envoyer le devis',
    whatsapp: 'Continuer vers WhatsApp',
    delete: 'Supprimer définitivement',
    accept: 'Marquer comme accepté',
    convert: 'Créer la facture',
  } satisfies Record<QuoteConfirmationKind, string>)[confirmation.kind] : ''

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
    {sharedQuote && <div className="quote-share-panel">
      <div className="quote-share-heading"><div><strong>Lien sécurisé créé pour {sharedQuote.quote.quote_number}</strong><span>Choisissez un canal pour partager le devis. L’envoi reste soumis à confirmation.</span></div><Link2 size={18} /></div>
      <div className="quote-share-link"><input aria-label="Lien de partage du devis" readOnly value={sharedQuote.link} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="outline-button" onClick={() => void navigator.clipboard.writeText(sharedQuote.link).then(() => setMessage('Lien copié.')).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Impossible de copier le lien.'))}>Copier</button></div>
      <div className="quote-share-actions">
        <button type="button" className="outline-button" disabled={busy || !clientEmail(sharedQuote.quote)} onClick={() => setConfirmation({ kind: 'email', quote: sharedQuote.quote, link: sharedQuote.link })}><Mail size={15} /> Envoyer par e-mail</button>
        <button type="button" className="outline-button" disabled={busy || !clientPhone(sharedQuote.quote)} onClick={() => setConfirmation({ kind: 'whatsapp', quote: sharedQuote.quote, link: sharedQuote.link })}><MessageCircle size={15} /> Envoyer par WhatsApp</button>
        {(!clientEmail(sharedQuote.quote) || !clientPhone(sharedQuote.quote)) && <span>Ajoutez les coordonnées manquantes à la fiche client pour activer le canal correspondant.</span>}
      </div>
    </div>}
    <div className="panel">
      <div className="panel-heading"><div><h2>Historique des devis</h2><p>{quotes.length} devis · les articles et prix restent figés après création.</p></div></div>
      <div className="quote-global-actions" role="group" aria-label="Actions sur un devis">
        <strong>Actions sur un devis</strong>
        {quoteActionOptions.map((action) => <button
          key={action.id}
          type="button"
          className="outline-button"
          disabled={!action.enabled || busy}
          onClick={() => {
            setQuoteActionSearch('')
            setQuoteActionPage(1)
            setQuoteActionPicker(action.id)
          }}
        >{action.label}</button>)}
      </div>
      {loading ? <p className="muted-cell">Chargement des devis…</p> : quotes.length ? <div className="quote-card-grid">
        {quotes.map((quote) => <article className="quote-summary-card" key={quote.id}>
          <div className="quote-summary-heading">
            <strong>{quote.quote_number}</strong>
            <span className={`quote-status quote-status-${statusClass(quote)}`}>{statusLabel(quote)}</span>
          </div>
          <div className="quote-summary-client">
            <span>Client</span>
            <strong>{clientName(quote)}</strong>
          </div>
          <div className="quote-summary-total">
            <span>Montant du devis</span>
            <strong>{formatMoney(quote.total, quote.currency)}</strong>
          </div>
          <div className="quote-summary-dates">
            <p><span>Émis le</span><strong>{formatDate(quote.issue_date)}</strong></p>
            <p><span>Valable jusqu’au</span><strong>{formatDate(quote.valid_until)}</strong></p>
          </div>
        </article>)}
      </div> : <p className="muted-cell quote-empty-state">Aucun devis. Créez-en un pour commencer.</p>}
    </div>
    {!canEdit && <p className="muted-cell">Votre rôle permet de consulter les devis, mais pas de les modifier.</p>}

    {quoteActionPicker && <div className="modal-backdrop" onClick={() => !busy && setQuoteActionPicker(null)}>
      <section className="invoice-modal quote-form quote-action-picker" role="dialog" aria-modal="true" aria-labelledby="quote-action-picker-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">HISTORIQUE DES DEVIS</p><h2 id="quote-action-picker-title">Choisir un devis — {quoteActionOptions.find((action) => action.id === quoteActionPicker)?.label}</h2></div><button type="button" className="icon-button" disabled={busy} onClick={() => setQuoteActionPicker(null)} aria-label="Fermer"><X size={20} /></button></div>
        <label className="quote-action-search">Rechercher un devis ou un client<input autoFocus value={quoteActionSearch} onChange={(event) => { setQuoteActionSearch(event.target.value); setQuoteActionPage(1) }} placeholder="Numéro, nom du client ou statut…" /></label>
        {loading ? <p className="muted-cell">Chargement des devis…</p> : visibleActionQuotes.length ? <div className="quote-action-list">
          {visibleActionQuotes.map((quote) => {
            const unavailableReason = getQuoteActionUnavailableReason(quoteActionPicker, quote)
            return <div className="quote-action-item" key={quote.id}>
              <div><strong>{quote.quote_number}</strong><span>{clientName(quote)}</span><small>{formatDate(quote.issue_date)} · valable jusqu’au {formatDate(quote.valid_until)} · {formatMoney(quote.total, quote.currency)}</small></div>
              <span className={`quote-status quote-status-${statusLabel(quote).toLocaleLowerCase('fr-FR')}`}>{statusLabel(quote)}</span>
              <button type="button" className="outline-button" disabled={busy || Boolean(unavailableReason)} title={unavailableReason ?? undefined} onClick={() => selectQuoteAction(quoteActionPicker, quote)}>Sélectionner</button>
              {unavailableReason && <small className="quote-action-unavailable">{unavailableReason}</small>}
            </div>
          })}
        </div> : <p className="muted-cell">{quoteActionSearch ? 'Aucun devis ne correspond à cette recherche.' : 'Aucun devis enregistré.'}</p>}
        {!loading && filteredActionQuotes.length > 0 && <div className="quote-action-pagination"><span>{(quoteActionPage - 1) * quoteActionPageSize + 1}–{Math.min(quoteActionPage * quoteActionPageSize, filteredActionQuotes.length)} sur {filteredActionQuotes.length} devis</span><div><button type="button" className="outline-button" disabled={quoteActionPage <= 1} onClick={() => setQuoteActionPage((page) => page - 1)}>Précédent</button><span>Page {quoteActionPage} / {quoteActionPageCount}</span><button type="button" className="outline-button" disabled={quoteActionPage >= quoteActionPageCount} onClick={() => setQuoteActionPage((page) => page + 1)}>Suivant</button></div></div>}
      </section>
    </div>}

    {showForm && <div className="modal-backdrop" onClick={() => !busy && setShowForm(false)}>
      <form className="invoice-modal quote-form" onSubmit={(event) => void submitQuote(event)} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">{editingQuote ? 'MODIFICATION' : 'NOUVELLE PROPOSITION'}</p><h2>{editingQuote ? `Modifier ${editingQuote.quote_number}` : 'Créer un devis'}</h2></div><button type="button" className="icon-button" onClick={() => { setShowForm(false); setEditingQuote(null) }} aria-label="Fermer"><X size={20} /></button></div>
        <div className="invoice-form-grid">
          <label>Client<select required value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Sélectionner un client</option>{options.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label>Valable jusqu’au<input required type="date" min={today} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
        </div>
        <div className="invoice-line-builder">
          <div className="invoice-line-builder-heading"><div><h3>Articles et services</h3><p>{editingQuote ? 'Ajustez la désignation, la quantité et le prix convenu.' : 'Les prix sont enregistrés dans le devis et conservés lors de sa conversion.'}</p></div><span>{lines.length} ligne(s)</span></div>
          <div className="invoice-line-fields">
            <label>Produit ou service<select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}><option value="">Sélectionner</option>{options.products.map((product) => <option value={product.id} key={product.id}>{product.name} · {formatMoney(product.price, currency)}</option>)}</select></label>
            <label>Quantité<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <button type="button" className="outline-button" onClick={addLine}>Ajouter</button>
          </div>
          {lines.map((line, index) => <div className="quote-edit-line" key={`${line.productId ?? 'custom'}-${index}`}>
            <label>Désignation<input required maxLength={240} value={line.description} onChange={(event) => setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, description: event.target.value, productId: null } : item))} /></label>
            <label>Quantité<input required type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} /></label>
            <label>Prix unitaire ({currency})<input required type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, unitPrice: Number(event.target.value), productId: null } : item))} /></label>
            <strong>{formatMoney(line.unitPrice * line.quantity, currency)}</strong>
            <button type="button" className="icon-button" onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Retirer la ligne"><X size={16} /></button>
          </div>)}
        </div>
        <div className="quote-total-fields">
          <label>Remise ({currency})<input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
          <label>Taux de taxe (%)<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} /></label>
          <p>Sous-total <strong>{formatMoney(subtotal, currency)}</strong></p><p>Taxe <strong>{formatMoney(taxAmount, currency)}</strong></p><p className="quote-total">Total <strong>{formatMoney(total, currency)}</strong></p>
        </div>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => { setShowForm(false); setEditingQuote(null) }} disabled={busy}>Annuler</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : editingQuote ? 'Enregistrer les modifications' : 'Créer le devis'}</button></div>
      </form>
    </div>}

    {viewingQuote && <div className="modal-backdrop" onClick={() => setViewingQuote(null)}>
      <section className="invoice-modal quote-view-modal" role="dialog" aria-modal="true" aria-labelledby="quote-view-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">CONSULTATION</p><h2 id="quote-view-title">{viewingQuote.quote_number}</h2></div><button type="button" className="icon-button" onClick={() => setViewingQuote(null)} aria-label="Fermer"><X size={20} /></button></div>
        <div className="quote-view-meta"><p><span>Client</span><strong>{clientName(viewingQuote)}</strong></p><p><span>Émis le</span><strong>{formatDate(viewingQuote.issue_date)}</strong></p><p><span>Valable jusqu’au</span><strong>{formatDate(viewingQuote.valid_until)}</strong></p><p><span>Statut</span><strong>{statusLabel(viewingQuote)}</strong></p></div>
        <div className="table-wrap"><table><thead><tr><th>DÉSIGNATION</th><th>QUANTITÉ</th><th>PRIX UNITAIRE</th><th>MONTANT</th></tr></thead><tbody>
          {viewingQuote.quote_items.map((line) => <tr key={line.id}><td>{line.description}</td><td>{line.quantity}</td><td>{formatMoney(line.unit_price, viewingQuote.currency)}</td><td>{formatMoney(line.total, viewingQuote.currency)}</td></tr>)}
        </tbody></table></div>
        <div className="quote-view-totals"><p>Sous-total <strong>{formatMoney(viewingQuote.subtotal, viewingQuote.currency)}</strong></p>{viewingQuote.discount > 0 && <p>Remise <strong>− {formatMoney(viewingQuote.discount, viewingQuote.currency)}</strong></p>}<p>Taxes <strong>{formatMoney(viewingQuote.tax, viewingQuote.currency)}</strong></p><p className="quote-total">Total proposé <strong>{formatMoney(viewingQuote.total, viewingQuote.currency)}</strong></p></div>
        {error && <div className="data-warning" role="alert">{error}</div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" onClick={() => setViewingQuote(null)}>Fermer</button></div>
      </section>
    </div>}
    {confirmation && <div className="modal-backdrop quote-confirmation-backdrop" onClick={() => !busy && setConfirmation(null)}>
      <section className="invoice-modal quote-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="quote-confirmation-title" aria-describedby="quote-confirmation-message" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">ACTION SENSIBLE</p><h2 id="quote-confirmation-title">{confirmationTitle}</h2></div><button type="button" className="icon-button" disabled={busy} onClick={() => setConfirmation(null)} aria-label="Fermer"><X size={20} /></button></div>
        <p id="quote-confirmation-message" className="quote-confirmation-copy">{confirmationMessage}</p>
        {(confirmation.kind === 'create' || confirmation.kind === 'save')
          ? <div className="quote-confirmation-summary"><span>{options.clients.find((option) => option.id === clientId)?.name ?? 'Client non sélectionné'} · {lines.length} ligne(s)</span><strong>{formatMoney(total, currency)}</strong></div>
          : confirmation.quote && <div className="quote-confirmation-summary"><span>{confirmation.quote.quote_number} · {clientName(confirmation.quote)}</span><strong>{formatMoney(confirmation.quote.total, confirmation.quote.currency)}</strong></div>}
        <div className="delete-modal-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => setConfirmation(null)}>Annuler</button><button type="button" className={confirmation.kind === 'delete' ? 'primary-button warning-button' : 'primary-button'} disabled={busy} onClick={() => void confirmSensitiveAction()}>{busy ? 'Traitement…' : confirmationButtonLabel}</button></div>
      </section>
    </div>}
  </section>
}

export function PublicQuotePage({ token }: { token: string }) {
  const [quote, setQuote] = useState<PublicQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfError, setPdfError] = useState('')
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
  const businessDetails = quote ? [
    quote.businessAddress,
    quote.businessCity,
    quote.businessCountry,
    quote.businessPhone ? `Tél. ${quote.businessPhone}` : null,
    quote.businessEmail,
    quote.businessTaxId ? `IFU ${quote.businessTaxId}` : null,
  ].filter((value): value is string => Boolean(value?.trim())) : []

  const exportPdf = async () => {
    if (!quote) return
    setPdfError('')
    setExportingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = 210
      const margin = 14
      const detailsText = businessDetails.join(' · ') || 'Coordonnées de l’entreprise non renseignées'

      pdf.setFillColor(25, 55, 95)
      pdf.rect(0, 0, pageWidth, 38, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text(quote.businessName, margin, 16, { maxWidth: 122 })
      pdf.setFontSize(8)
      pdf.text('DEVIS', margin, 29)
      pdf.setFontSize(10)
      pdf.text(quote.quoteNumber, pageWidth - margin, 16, { align: 'right' })

      pdf.setTextColor(100, 116, 139)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      pdf.text('CLIENT', margin, 48)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(30, 41, 59)
      pdf.setFontSize(10)
      const clientLines = pdf.splitTextToSize(quote.clientName, 82)
      clientLines.forEach((line: string, index: number) => pdf.text(line, margin, 54 + index * 4))
      pdf.setFontSize(8)
      pdf.setTextColor(71, 85, 105)
      const issueDate = new Date(`${quote.issueDate}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
      const validUntil = new Date(`${quote.validUntil}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
      pdf.text(`Émis le : ${issueDate}`, margin, 67)
      pdf.text(`Valable jusqu’au : ${validUntil}`, margin, 72)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(100, 116, 139)
      pdf.text('INFORMATIONS DE L’ENTREPRISE', 112, 48)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(51, 65, 85)
      const companyLines = pdf.splitTextToSize(detailsText, 82)
      companyLines.forEach((line: string, index: number) => pdf.text(line, 112, 54 + index * 3.8))

      const tableTop = Math.max(82, 56 + companyLines.length * 3.8)
      const firstRowY = tableTop + 10
      const descriptionWidth = 82
      pdf.setFillColor(240, 245, 250)
      pdf.rect(margin, tableTop, pageWidth - margin * 2, 8, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)
      pdf.text('DÉSIGNATION', margin + 2, tableTop + 5.2)
      pdf.text('QTÉ', 105, tableTop + 5.2, { align: 'right' })
      pdf.text('PRIX UNIT.', 151, tableTop + 5.2, { align: 'right' })
      pdf.text('MONTANT', pageWidth - margin - 2, tableTop + 5.2, { align: 'right' })

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      const rows = quote.items.map((item) => {
        const descriptionLines = pdf.splitTextToSize(item.description, descriptionWidth)
        const height = Math.max(5.5, descriptionLines.length * 4.2 + 1.5)
        return { item, descriptionLines, height }
      })
      const availableHeight = Math.max(8, 246 - firstRowY)
      const originalHeight = rows.reduce((total, row) => total + row.height, 0)
      const verticalScale = Math.min(1, availableHeight / Math.max(originalHeight, 1))
      const fontSize = 8.5 * verticalScale
      const lineHeight = 4.2 * verticalScale
      let rowY = firstRowY
      rows.forEach(({ item, descriptionLines, height }) => {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(fontSize)
        pdf.setTextColor(51, 65, 85)
        descriptionLines.forEach((line: string, index: number) => {
          pdf.text(line, margin + 2, rowY + 3.5 * verticalScale + index * lineHeight)
        })
        const baseline = rowY + Math.min(height * verticalScale - 1, 3.5 * verticalScale)
        pdf.text(String(item.quantity), 105, baseline, { align: 'right' })
        pdf.text(formatMoney(item.unitPrice, quote.currency), 151, baseline, { align: 'right' })
        pdf.text(formatMoney(item.total, quote.currency), pageWidth - margin - 2, baseline, { align: 'right' })
        rowY += height * verticalScale
        pdf.setDrawColor(226, 232, 240)
        pdf.setLineWidth(0.2)
        pdf.line(margin, rowY, pageWidth - margin, rowY)
      })

      let totalY = 255
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(71, 85, 105)
      pdf.text('Sous-total', 148, totalY, { align: 'right' })
      pdf.text(formatMoney(quote.subtotal, quote.currency), pageWidth - margin, totalY, { align: 'right' })
      totalY += 5
      if (quote.discount > 0) {
        pdf.text('Remise', 148, totalY, { align: 'right' })
        pdf.text(`− ${formatMoney(quote.discount, quote.currency)}`, pageWidth - margin, totalY, { align: 'right' })
        totalY += 5
      }
      pdf.text('Taxes', 148, totalY, { align: 'right' })
      pdf.text(formatMoney(quote.tax, quote.currency), pageWidth - margin, totalY, { align: 'right' })
      totalY += 7
      pdf.setDrawColor(203, 213, 225)
      pdf.line(125, totalY - 4, pageWidth - margin, totalY - 4)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(15, 23, 42)
      pdf.text('TOTAL', 148, totalY, { align: 'right' })
      pdf.text(formatMoney(quote.total, quote.currency), pageWidth - margin, totalY, { align: 'right' })

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(100, 116, 139)
      pdf.text(`Document établi par ${quote.businessName}`, margin, 287, { maxWidth: pageWidth - margin * 2 })
      const fileName = quote.quoteNumber.replace(/[^a-zA-Z0-9_-]+/g, '-') || 'devis'
      pdf.save(`${fileName}.pdf`)
    } catch (cause) {
      setPdfError(cause instanceof Error ? `Le PDF n’a pas pu être créé : ${cause.message}` : 'Le PDF n’a pas pu être créé.')
    } finally {
      setExportingPdf(false)
    }
  }

  return <main className="public-quote-shell">
    <header className="public-quote-brand"><strong>Facture<span>Facile</span></strong><small>BÉNIN</small></header>
    <article className="public-quote-card">
      {loading ? <p role="status">Chargement du devis…</p> : error && !quote
        ? <><p className="eyebrow">DEVIS PARTAGÉ</p><h1>Ce lien n’est pas disponible</h1><p>{error}</p></>
        : !quote
          ? <><p className="eyebrow">DEVIS PARTAGÉ</p><h1>Ce lien n’est pas disponible</h1><p>Le lien est invalide, expiré ou le devis n’est plus accessible.</p></>
        : quote && <>
          <div className="public-quote-heading"><div><h1>{quote.businessName}</h1><p>À l’attention de {quote.clientName}</p>{businessDetails.length > 0 && <p className="public-quote-business-details">{businessDetails.join(' · ')}</p>}</div><strong>{quote.quoteNumber}</strong></div>
          <div className="public-quote-dates"><span>Émis le <b>{new Date(`${quote.issueDate}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</b></span><span>Valable jusqu’au <b>{new Date(`${quote.validUntil}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</b></span></div>
          <div className="table-wrap"><table><thead><tr><th>DÉSIGNATION</th><th>QUANTITÉ</th><th>PRIX UNITAIRE</th><th>MONTANT</th></tr></thead><tbody>
            {quote.items.map((item, index) => <tr key={`${item.description}-${index}`}><td data-label="Désignation">{item.description}</td><td data-label="Quantité">{item.quantity}</td><td data-label="Prix unitaire">{formatMoney(item.unitPrice, quote.currency)}</td><td data-label="Montant">{formatMoney(item.total, quote.currency)}</td></tr>)}
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
          <button type="button" className="outline-button public-quote-print" disabled={exportingPdf || busy} onClick={() => void exportPdf()}><Download size={15} />{exportingPdf ? 'Préparation du PDF…' : 'Télécharger le PDF'}</button>
          {pdfError && <div className="data-warning" role="alert">{pdfError}</div>}
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
