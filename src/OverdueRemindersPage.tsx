import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Bell, Check, Copy, Mail, MessageCircle, RefreshCw, Save } from 'lucide-react'
import { formatMoney } from './lib/formatting'
import { getBusinessDateKey } from './lib/businessPreferences'
import {
  loadOverdueInvoiceReminders,
  loadOverdueRemindersEnabled,
  markManualInvoiceReminderSent,
  prepareOverdueInvoiceReminder,
  setOverdueRemindersEnabled,
  updateManualInvoiceReminderMessage,
} from './lib/data'
import type {
  InvoiceReminderHistoryEntry,
  ManualInvoiceReminder,
  OverdueInvoiceReminderTarget,
  PreparedInvoiceReminder,
} from './lib/data'

type Channel = NonNullable<ManualInvoiceReminder['sent_via']>

const channelLabels: Record<Channel, string> = {
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  phone: 'Téléphone',
  other: 'Autre',
}

export function OverdueRemindersPage({ businessId, currency, timezone, canEdit, canManageAutomation }: {
  businessId: string
  currency: string
  timezone: string
  canEdit: boolean
  canManageAutomation: boolean
}) {
  const today = getBusinessDateKey(new Date(), timezone)
  const [invoices, setInvoices] = useState<OverdueInvoiceReminderTarget[]>([])
  const [reminders, setReminders] = useState<InvoiceReminderHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<PreparedInvoiceReminder | null>(null)
  const [editableMessage, setEditableMessage] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [selectedReminder, setSelectedReminder] = useState<ManualInvoiceReminder | null>(null)
  const [sendChannel, setSendChannel] = useState<Channel>('email')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'prepared' | 'sent' | 'failed'>('all')
  const [automationEnabled, setAutomationEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [result, enabled] = await Promise.all([
          loadOverdueInvoiceReminders(businessId, today),
          loadOverdueRemindersEnabled(businessId),
        ])
        if (cancelled) return
        setInvoices(result.invoices)
        setReminders(result.reminders)
        setAutomationEnabled(enabled)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de charger les factures en retard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [businessId, refreshKey, today])

  const openBalance = invoices.reduce((sum, invoice) => sum + invoice.remaining, 0)
  const filteredReminders = useMemo(() => reminders.filter((reminder) => {
    const text = `${reminder.invoice_number} ${reminder.client_name} ${reminder.message}`.toLocaleLowerCase('fr-FR')
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'sent' && (reminder.status === 'sent' || reminder.status === 'accepted'))
      || reminder.status === statusFilter
    return (!query || text.includes(query.toLocaleLowerCase('fr-FR')))
      && matchesStatus
  }), [reminders, query, statusFilter])

  const prepare = async (invoice: OverdueInvoiceReminderTarget) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const draft = await prepareOverdueInvoiceReminder(businessId, invoice.id, crypto.randomUUID())
      setSelected(draft)
      setEditableMessage(draft.message)
      setSavedMessage(draft.message)
      setSelectedReminder(null)
      setRefreshKey((current) => current + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de préparer cette relance.')
    } finally {
      setBusy(false)
    }
  }

  const saveMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !editableMessage.trim()) {
      setError('Le texte de la relance ne peut pas être vide.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateManualInvoiceReminderMessage(businessId, selected.reminder_id, editableMessage.trim())
      setSavedMessage(editableMessage.trim())
      setMessage('Texte de la relance enregistré.')
      setRefreshKey((current) => current + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer le texte de la relance.')
    } finally {
      setBusy(false)
    }
  }

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Texte copié. Vous pouvez le coller dans votre canal de communication.')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de copier le texte. Sélectionnez-le puis copiez-le manuellement.')
    }
  }

  const markSent = async (reminder: ManualInvoiceReminder, channel: Channel) => {
    if (!window.confirm(`Confirmer que la relance de ${reminder.invoice_number} a bien été envoyée par ${channelLabels[channel]} ?`)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await markManualInvoiceReminderSent(businessId, reminder.id, channel)
      setSelectedReminder(null)
      setSelected(null)
      setMessage(`Relance de ${reminder.invoice_number} marquée comme envoyée par ${channelLabels[channel]}.`)
      setRefreshKey((current) => current + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de mettre à jour le statut de la relance.')
    } finally {
      setBusy(false)
    }
  }

  const changeAutomation = async () => {
    const nextEnabled = !automationEnabled
    if (nextEnabled && !window.confirm(
      'Activer les e-mails de relance automatiques quotidiens pour cette entreprise ? Les factures échues avec un solde et une adresse e-mail client valide pourront être envoyées automatiquement par Resend. Cette option peut être désactivée ici à tout moment.',
    )) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await setOverdueRemindersEnabled(businessId, nextEnabled)
      setAutomationEnabled(nextEnabled)
      setMessage(nextEnabled
        ? 'Relances e-mail automatiques activées pour cette entreprise. Elles nécessitent une fonction et un cron configurés côté Supabase.'
        : 'Relances e-mail automatiques désactivées. Les relances manuelles restent disponibles.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de modifier l’option des relances automatiques.')
    } finally {
      setBusy(false)
    }
  }

  const openComposer = (channel: 'email' | 'whatsapp') => {
    if (!selected || editableMessage.trim() !== savedMessage) {
      setError('Enregistrez le texte modifié avant d’ouvrir votre application de communication.')
      return
    }
    const subject = encodeURIComponent(`Rappel de paiement · facture ${selected.invoice_number}`)
    const body = encodeURIComponent(editableMessage)
    const url = channel === 'email'
      ? `mailto:${encodeURIComponent(selected.client_email ?? '')}?subject=${subject}&body=${body}`
      : `https://wa.me/?text=${body}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })

  return <section className="module-page collection-page">
    <div className="module-heading collection-heading">
      <div><p className="eyebrow">SUIVI CLIENTS</p><h1>Relances et recouvrement</h1><p>Préparez vos rappels manuels, suivez les envois et gérez l’activation facultative de l’automatisation.</p></div>
      <button type="button" className="outline-button" disabled={loading || busy} onClick={() => setRefreshKey((current) => current + 1)}><RefreshCw size={16} /> Actualiser</button>
    </div>
    <div className={`collection-manual-note ${automationEnabled ? 'automation-enabled' : ''}`} role="note"><Bell size={18} /><p><strong>{automationEnabled ? 'Les relances e-mail automatiques sont activées pour cette entreprise.' : 'Les relances automatiques sont désactivées par défaut.'}</strong> Les brouillons manuels restent toujours disponibles. Une activation explicite autorise le cron Supabase à envoyer les relances e-mail des factures admissibles; l’option peut être coupée à tout moment.</p></div>
    <section className="panel collection-automation-setting">
      <div><h2>Relances e-mail automatiques</h2><p>{automationEnabled
        ? 'Le prochain passage du cron peut envoyer un rappel aux clients concernés. La désactivation bloque les passages suivants.'
        : 'Aucun e-mail automatique ne partira tant qu’un propriétaire ou administrateur n’aura pas activé cette option.'}</p></div>
      {canManageAutomation
        ? <button type="button" className={automationEnabled ? 'danger-button' : 'primary-button'} onClick={() => void changeAutomation()} disabled={busy || loading}>
          {automationEnabled ? 'Désactiver les envois automatiques' : 'Activer les envois automatiques'}
        </button>
        : <span className={`collection-status ${automationEnabled ? 'sent' : ''}`}>{automationEnabled ? 'Activées' : 'Désactivées'}</span>}
    </section>
    {error && <div className="data-warning" role="alert">{error}</div>}
    {message && <div className="settings-message" role="status">{message}</div>}

    <div className="collection-summary-grid">
      <article className="panel collection-summary-card"><span>Factures en retard</span><strong>{loading ? '…' : invoices.length}</strong><small>avec un solde restant</small></article>
      <article className="panel collection-summary-card"><span>Solde à recouvrer</span><strong>{formatMoney(openBalance, currency)}</strong><small>après paiements enregistrés</small></article>
      <article className="panel collection-summary-card"><span>Relances suivies</span><strong>{reminders.length}</strong><small>{reminders.filter((reminder) => reminder.status === 'sent' || reminder.status === 'accepted').length} envoyée(s) / acceptée(s) · {reminders.filter((reminder) => reminder.status === 'prepared').length} préparée(s) · {reminders.filter((reminder) => reminder.status === 'failed').length} échec(s)</small></article>
    </div>

    <section className="panel collection-panel">
      <div className="panel-heading"><div><h2>Factures à relancer</h2><p>Factures échues avec solde restant, hors brouillons, annulations, avoirs et proformas.</p></div></div>
      {loading ? <p className="collection-empty">Chargement des factures en retard…</p> : invoices.length
        ? <div className="table-wrap"><table>
          <thead><tr><th>ÉCHÉANCE</th><th>FACTURE</th><th>CLIENT</th><th>CONTACT</th><th>RETARD</th><th>RESTANT</th><th>ACTION</th></tr></thead>
          <tbody>{invoices.map((invoice) => {
            const daysLate = Math.max(1, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${invoice.due_date}T00:00:00Z`)) / 86400000))
            return <tr key={invoice.id}>
              <td>{formatDate(invoice.due_date)}</td>
              <td><strong className="invoice-number">{invoice.invoice_number}</strong></td>
              <td>{invoice.client_name}</td>
              <td>{invoice.client_email || 'E-mail non renseigné'}</td>
              <td>{daysLate} j</td>
              <td>{formatMoney(invoice.remaining, invoice.currency)}</td>
              <td><button type="button" className="primary-button" disabled={!canEdit || busy} onClick={() => void prepare(invoice)}><Bell size={15} /> Préparer une relance</button></td>
            </tr>
          })}</tbody>
        </table></div>
        : <p className="collection-empty">{loading ? '' : 'Aucune facture échue avec un solde restant.'}</p>}
      {!canEdit && <p className="collection-empty">Votre rôle permet de consulter les factures en retard, mais pas de créer une relance.</p>}
    </section>

    <section className="panel collection-panel">
      <div className="panel-heading"><div><h2>Historique des relances</h2><p>La source et le résultat distinguent les envois manuels confirmés des e-mails automatiques acceptés ou refusés par le prestataire.</p></div></div>
      <div className="module-toolbar collection-history-toolbar">
        <input aria-label="Rechercher une relance" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher facture ou client..." />
        <select aria-label="Filtrer les relances par statut" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
          <option value="all">Tous les statuts</option><option value="prepared">Préparées</option><option value="sent">Envoyées / acceptées</option><option value="failed">Échec automatique</option>
        </select>
      </div>
      {loading ? <p className="collection-empty">Chargement de l’historique…</p> : filteredReminders.length
        ? <div className="table-wrap"><table>
          <thead><tr><th>DATE</th><th>FACTURE</th><th>CLIENT</th><th>SOURCE</th><th>STATUT</th><th>CANAL</th><th>ACTION</th></tr></thead>
          <tbody>{filteredReminders.map((reminder) => <tr key={reminder.id}>
            <td>{formatDate(reminder.reminder_date)}</td><td>{reminder.invoice_number}</td><td>{reminder.client_name}</td>
            <td>{reminder.source === 'automatic' ? 'Automatique' : 'Manuelle'}</td>
            <td><span className={`collection-status ${reminder.status === 'failed' ? 'failed' : reminder.status === 'accepted' ? 'accepted' : reminder.status}`}>
              {reminder.status === 'prepared' ? 'Préparée' : reminder.status === 'sent' ? 'Envoyée (confirmée)' : reminder.status === 'accepted' ? 'Acceptée par Resend' : 'Échec Resend'}
            </span></td>
            <td>{reminder.sent_via ? `${channelLabels[reminder.sent_via]}${reminder.source === 'automatic' ? ' automatique' : ''}` : '—'}</td>
            <td><div className="collection-row-actions">
              {reminder.source === 'manual' && <>
                <button type="button" className="outline-button" onClick={() => { setSelectedReminder(reminder); setSelected(null); setError(''); setMessage('') }}>Voir le texte</button>
                {canEdit && reminder.status === 'prepared' && <button type="button" className="primary-button" disabled={busy} onClick={() => { setSelectedReminder(reminder); setSelected(null); setSendChannel('email'); setError(''); setMessage('') }}><Check size={14} /> Marquer envoyé</button>}
              </>}
              {reminder.source === 'automatic' && <span className="muted-cell">Aucune action requise</span>}
            </div></td>
          </tr>)}</tbody>
        </table></div>
        : <p className="collection-empty">{reminders.length ? 'Aucune relance ne correspond aux filtres.' : 'Aucune relance préparée pour le moment.'}</p>}
    </section>

    {selected && <div className="modal-backdrop" onClick={() => !busy && setSelected(null)}>
      <form className="invoice-modal collection-modal" onSubmit={(event) => void saveMessage(event)} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">BROUILLON DE RELANCE</p><h2>{selected.invoice_number}</h2></div><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Fermer"><span aria-hidden="true">×</span></button></div>
        <p className="muted-cell">{selected.client_name} · échéance du {formatDate(selected.due_date)} · reste dû {formatMoney(selected.remaining_amount, selected.currency)}</p>
        <label>Texte à vérifier et personnaliser<textarea rows={10} value={editableMessage} onChange={(event) => setEditableMessage(event.target.value)} /></label>
        <div className="collection-modal-actions">
          <button type="button" className="outline-button" onClick={() => void copyMessage(editableMessage)} disabled={busy}><Copy size={15} /> Copier le texte</button>
          <button type="button" className="outline-button" onClick={() => openComposer('email')} disabled={busy}><Mail size={15} /> Ouvrir e-mail</button>
          <button type="button" className="outline-button" onClick={() => openComposer('whatsapp')} disabled={busy}><MessageCircle size={15} /> Ouvrir WhatsApp</button>
          <button type="submit" className="primary-button" disabled={busy || editableMessage.trim() === savedMessage}><Save size={15} /> Enregistrer le texte</button>
        </div>
        <p className="collection-disclaimer">L’application n’envoie pas le message. L’ouverture d’e-mail ou WhatsApp nécessite votre action; confirmez ensuite l’envoi dans l’historique.</p>
      </form>
    </div>}

    {selectedReminder && <div className="modal-backdrop" onClick={() => !busy && setSelectedReminder(null)}>
      <div className="invoice-modal collection-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">{selectedReminder.status === 'sent' ? 'RELANCE ENVOYÉE' : 'RELANCE PRÉPARÉE'}</p><h2>{selectedReminder.invoice_number}</h2></div><button type="button" className="icon-button" onClick={() => setSelectedReminder(null)} aria-label="Fermer">×</button></div>
        <p className="muted-cell">{selectedReminder.client_name} · préparée le {formatDate(selectedReminder.reminder_date)}</p>
        <textarea className="collection-message-preview" readOnly rows={9} value={selectedReminder.message} />
        <div className="collection-modal-actions">
          <button type="button" className="outline-button" onClick={() => void copyMessage(selectedReminder.message)}><Copy size={15} /> Copier le texte</button>
          {selectedReminder.status === 'prepared' && canEdit && <>
            <label className="collection-channel-select">Canal d’envoi confirmé
              <select value={sendChannel} onChange={(event) => setSendChannel(event.target.value as Channel)}>
                {Object.entries(channelLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <button type="button" className="primary-button" disabled={busy} onClick={() => void markSent(selectedReminder, sendChannel)}><Check size={15} /> Confirmer comme envoyé</button>
          </>}
          {selectedReminder.status === 'sent' && <span className="collection-disclaimer">Confirmée par {selectedReminder.sent_via ? channelLabels[selectedReminder.sent_via] : 'un utilisateur'} le {selectedReminder.sent_at ? new Date(selectedReminder.sent_at).toLocaleString('fr-FR') : '—'}.</span>}
        </div>
      </div>
    </div>}
  </section>
}
