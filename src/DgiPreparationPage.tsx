import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Play, Search, ShieldCheck } from 'lucide-react'
import { userFacingError } from './lib/errors'
import { evaluateDgiMockCheck } from './lib/dgiMock'
import type { DgiMockCheckResult } from './lib/dgiMock'
import {
  loadBusinessProfile,
  loadDgiSimulationInvoices,
  searchDgiMockIfuRegistry,
  saveBeninInvoiceMetadata,
  simulateDgiNormalisation,
  updateBusinessProfile,
} from './lib/data'
import type { BusinessProfile, DgiMockIfuRecord, DgiMockNormalisationResult, DgiSimulationInvoiceOption } from './lib/data'
import { beninDocumentTypeLabels, getDefaultBeninDocumentType, isBeninDocumentType, isDgiSimulationEligible } from './lib/beninDocument'
import type { BeninDocumentType } from './lib/beninDocument'

type DgiPreparationPageProps = {
  businessId: string
  onProfileChanged: (profile: BusinessProfile) => void
}

function mapFiscalRegime(value: string): BusinessProfile['fiscal_regime'] {
  const normalized = value.trim().toLocaleUpperCase('fr-FR')
  if (normalized === 'TPS') return 'TPS'
  if (normalized === 'REEL' || normalized === 'RÉEL' || normalized === 'RÉGIME RÉEL') return 'REEL'
  return null
}

export function DgiPreparationPage({ businessId, onProfileChanged }: DgiPreparationPageProps) {
  const mockLookupEnabled = import.meta.env.VITE_DGI_MOCK_IFU_LOOKUP_ENABLED === 'true'
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DgiMockIfuRecord[]>([])
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<DgiMockCheckResult | null>(null)
  const [simulationInvoices, setSimulationInvoices] = useState<DgiSimulationInvoiceOption[]>([])
  const [invoiceLoadError, setInvoiceLoadError] = useState('')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [simulationLoading, setSimulationLoading] = useState(false)
  const [simulationError, setSimulationError] = useState('')
  const [simulationResult, setSimulationResult] = useState<DgiMockNormalisationResult | null>(null)
  const [manualInvoiceId, setManualInvoiceId] = useState('')
  const [manualFiscalRegime, setManualFiscalRegime] = useState<'TPS' | 'REEL' | ''>('')
  const [manualDocumentType, setManualDocumentType] = useState<BeninDocumentType>('facture_interne')
  const [manualReferences, setManualReferences] = useState({ nim: '', counters: '', signature: '' })
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMessage, setManualMessage] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void loadBusinessProfile(businessId)
      .then((loadedProfile) => {
        if (!cancelled) {
          setProfile(loadedProfile)
          setLoadError('')
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(userFacingError(error, 'Impossible de charger les informations de l’entreprise.'))
      })
    return () => { cancelled = true }
  }, [businessId])

  useEffect(() => {
    let cancelled = false
    void loadDgiSimulationInvoices(businessId)
      .then((invoices) => {
        if (cancelled) return
        setSimulationInvoices(invoices)
        setSelectedInvoiceId((current) => current && invoices.some((invoice) => invoice.id === current && isDgiSimulationEligible(invoice)) ? current : '')
        setInvoiceLoadError('')
      })
      .catch((error: unknown) => {
        if (!cancelled) setInvoiceLoadError(userFacingError(error, 'Impossible de charger les factures pour la saisie fiscale.'))
      })
    return () => { cancelled = true }
  }, [businessId])

  const ifuIsFormatted = /^\d{13}$/.test(profile?.tax_id?.trim() ?? '')
  const dossierComplete = Boolean(profile?.name.trim() && ifuIsFormatted && profile?.fiscal_regime)
  const simulationEligibleCount = simulationInvoices.filter(isDgiSimulationEligible).length
  const selectedSimulationInvoice = simulationInvoices.find((invoice) => invoice.id === selectedInvoiceId)
  const dossierStatus = useMemo(() => {
    if (!profile) return ''
    if (dossierComplete) return 'Informations saisies — vérification manuelle requise'
    if (profile.tax_id?.trim() && !ifuIsFormatted) return 'Format de l’IFU à vérifier'
    return 'Informations à compléter'
  }, [dossierComplete, ifuIsFormatted, profile])

  const updateProfile = (field: keyof BusinessProfile, value: string) => {
    setProfile((current) => current ? { ...current, [field]: value } : current)
    setMessage('')
    setCheckResult(null)
  }

  const selectManualInvoice = (invoiceId: string) => {
    const invoice = simulationInvoices.find((item) => item.id === invoiceId)
    setManualInvoiceId(invoiceId)
    setManualFiscalRegime(invoice?.reg_fiscal_emetteur ?? profile?.fiscal_regime ?? '')
    setManualDocumentType(invoice?.benin_document_type ?? (invoice ? getDefaultBeninDocumentType(invoice.invoice_type) : 'facture_interne'))
    setManualReferences({
      nim: invoice?.is_dgi_mock ? '' : invoice?.dgi_nim ?? '',
      counters: invoice?.is_dgi_mock ? '' : invoice?.dgi_counters ?? '',
      signature: invoice?.is_dgi_mock ? '' : invoice?.dgi_signature ?? '',
    })
    setManualMessage('')
  }

  const saveInvoiceMetadata = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const invoice = simulationInvoices.find((item) => item.id === manualInvoiceId)
    if (!invoice) {
      setManualMessage('Sélectionnez une facture émise.')
      return
    }

    const references = {
      nim: manualReferences.nim.trim(),
      counters: manualReferences.counters.trim(),
      signature: manualReferences.signature.trim(),
    }
    const referenceCount = Object.values(references).filter(Boolean).length
    if (referenceCount !== 0 && referenceCount !== 3) {
      setManualMessage('Renseignez le NIM, le compteur et la signature ensemble, ou laissez les trois champs vides.')
      return
    }
    if (referenceCount === 3 && manualDocumentType === 'proforma') {
      setManualMessage('Une proforma ne peut pas recevoir de références e-MECeF dans ce module.')
      return
    }
    setManualSaving(true)
    setManualMessage('')
    try {
      await saveBeninInvoiceMetadata(
        businessId,
        invoice.id,
        manualFiscalRegime || null,
        manualDocumentType,
        {
          nim: references.nim || null,
          counters: references.counters || null,
          signature: references.signature || null,
        },
      )
      setSimulationInvoices((current) => current.map((item) => item.id === invoice.id ? {
        ...item,
        reg_fiscal_emetteur: manualFiscalRegime || null,
        benin_document_type: manualDocumentType,
        dgi_nim: references.nim || null,
        dgi_counters: references.counters || null,
        dgi_signature: references.signature || null,
        is_dgi_mock: false,
      } : item))
      if (selectedInvoiceId === invoice.id) setSimulationResult(null)
      setSimulationError('')
      setManualMessage(referenceCount === 3
        ? 'Références enregistrées. Leur authenticité n’a pas été vérifiée par FactureFacile.'
        : 'Régime fiscal et type de document enregistrés sur la facture.')
    } catch (error) {
      setManualMessage(userFacingError(error, 'Impossible d’enregistrer les informations fiscales de la facture.'))
    } finally {
      setManualSaving(false)
    }
  }

  const simulateVerification = async () => {
    if (!profile) return
    setChecking(true)
    setSearchError('')
    setCheckResult(null)
    try {
      const input = {
        name: profile.name,
        taxId: profile.tax_id,
        fiscalRegime: profile.fiscal_regime,
      }
      const preliminary = evaluateDgiMockCheck(input, [])
      if (preliminary.status === 'incomplete') {
        setCheckResult(preliminary)
        return
      }
      const records = await searchDgiMockIfuRegistry(profile.tax_id ?? '')
      setCheckResult(evaluateDgiMockCheck(input, records))
    } catch (error) {
      setSearchError(userFacingError(error, 'La simulation de vérification a échoué.'))
    } finally {
      setChecking(false)
    }
  }

  const simulateInvoiceNormalisation = async () => {
    if (!selectedInvoiceId) return
    setSimulationLoading(true)
    setSimulationError('')
    setSimulationResult(null)
    try {
      const result = await simulateDgiNormalisation(selectedInvoiceId)
      setSimulationResult(result)
      setSimulationInvoices((current) => current.map((invoice) => invoice.id === selectedInvoiceId ? {
        ...invoice,
        dgi_nim: result.nim ?? null,
        dgi_counters: result.counters ?? null,
        dgi_signature: result.signature ?? null,
        is_dgi_mock: true,
      } : invoice))
    } catch (error) {
      setSimulationError(userFacingError(error, 'La normalisation simulée a échoué.'))
    } finally {
      setSimulationLoading(false)
    }
  }

  const searchRegistry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearching(true)
    setSearchError('')
    setResults([])
    setCheckResult(null)
    try {
      const records = await searchDgiMockIfuRegistry(query)
      setResults(records)
      if (records.length === 0) setSearchError('Aucun résultat dans le registre de démonstration. Ce registre est indépendant de la DGI.')
    } catch (error) {
      setSearchError(userFacingError(error, 'La recherche dans le registre de test a échoué.'))
    } finally {
      setSearching(false)
    }
  }

  const applyRegistryRecord = (record: DgiMockIfuRecord) => {
    setProfile((current) => current ? {
      ...current,
      name: record.raison_sociale,
      tax_id: record.ifu.trim(),
      fiscal_regime: mapFiscalRegime(record.regime_fiscal),
      address: record.adresse,
      phone: record.telephone,
    } : current)
    setMessage('Informations copiées depuis le registre de démonstration. Vérifiez-les avant de les enregistrer.')
    setCheckResult(null)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile) return
    if (!profile.name.trim()) {
      setMessage('Le nom de l’entreprise est obligatoire.')
      return
    }
    if ((profile.tax_id?.trim().length ?? 0) > 50) {
      setMessage('L’IFU ne peut pas dépasser 50 caractères.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const nextProfile = { ...profile, name: profile.name.trim(), tax_id: profile.tax_id?.trim() || null }
      const regimeTaxRate = nextProfile.fiscal_regime === 'TPS' ? 0 : nextProfile.fiscal_regime === 'REEL' ? 18 : nextProfile.default_tax_rate
      nextProfile.default_tax_rate = regimeTaxRate
      await updateBusinessProfile(businessId, {
        name: nextProfile.name,
        phone: nextProfile.phone,
        email: nextProfile.email,
        address: nextProfile.address,
        city: nextProfile.city,
        country: nextProfile.country,
        tax_id: nextProfile.tax_id,
        fiscal_regime: nextProfile.fiscal_regime,
        logo_url: nextProfile.logo_url,
        payment_instructions: nextProfile.payment_instructions,
        invoice_legal_notice: nextProfile.invoice_legal_notice,
        default_due_days: nextProfile.default_due_days,
        default_tax_rate: nextProfile.default_tax_rate,
        currency: nextProfile.currency,
        timezone: nextProfile.timezone,
        invoice_number_prefix: nextProfile.invoice_number_prefix,
        invoice_number_include_year: nextProfile.invoice_number_include_year,
        invoice_number_sequence_width: nextProfile.invoice_number_sequence_width,
      })
      setProfile(nextProfile)
      onProfileChanged(nextProfile)
      setMessage('Informations de préparation enregistrées.')
    } catch (error) {
      setMessage(userFacingError(error, 'Impossible d’enregistrer les informations.'))
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return <section className="module-page"><div className="settings-message" role="alert">{loadError}</div></section>
  }
  if (!profile) return <div className="auth-loading">Chargement de la préparation DGI...</div>

  return (
    <section className="module-page">
      <div className="module-heading">
        <div>
          <h1>Préparation IFU / DGI</h1>
          <p>Rassemblez les informations de l’entreprise avant toute vérification auprès des services officiels.</p>
        </div>
      </div>

      <div className="dgi-notice" role="note">
        <ShieldCheck size={20} />
        <div>
          <strong>Mode de préparation uniquement — aucune connexion à la DGI</strong>
          <p>La recherche ci-dessous consulte uniquement le registre synthétique temporaire. Elle ne confirme pas un IFU officiel et n’envoie aucune facture à e-MECeF.</p>
        </div>
      </div>

      <div className="dgi-preparation-grid">
        <section className="panel dgi-status-card" aria-live="polite">
          <div className="panel-heading">
            <div><h2>État du dossier</h2><p>Indicateur interne basé sur les champs saisis, pas un statut fiscal officiel.</p></div>
            <span className={`dgi-status-pill ${dossierComplete ? 'complete' : 'incomplete'}`}>{dossierStatus}</span>
          </div>
          <ul className="dgi-checklist">
            <li className={profile.name.trim() ? 'done' : ''}>Nom de l’entreprise</li>
            <li className={ifuIsFormatted ? 'done' : ''}>IFU au format de 13 chiffres</li>
            <li className={profile.fiscal_regime ? 'done' : ''}>Régime fiscal renseigné</li>
          </ul>
          <p className="field-hint">Même si tous les éléments sont renseignés, vérifiez l’IFU et le régime sur les documents officiels avant usage.</p>
          <button type="button" className="outline-button dgi-simulate-button" onClick={() => void simulateVerification()} disabled={!mockLookupEnabled || checking}>
            {checking ? 'Simulation...' : 'Simuler une vérification'}
          </button>
          {!mockLookupEnabled && <p className="field-hint">La simulation est disponible uniquement dans une instance privée où le registre fictif est activé.</p>}
          {checkResult && <div className={`dgi-check-result ${checkResult.status}`} role="status">
            <strong>SIMULATION FICTIVE — {checkResult.title}</strong>
            <ul>{checkResult.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
            <small>Aucune vérification officielle n’a été effectuée auprès de la DGI.</small>
          </div>}
        </section>

        <section className="panel dgi-lookup-card">
          <div className="panel-heading"><div><h2>Recherche de démonstration</h2><p>Recherche dans le registre temporaire de démonstration, s’il est installé et contient des données synthétiques.</p></div></div>
          {mockLookupEnabled ? <>
            <form className="dgi-search-form" onSubmit={(event) => void searchRegistry(event)}>
              <label htmlFor="dgi-ifu-search">IFU ou raison sociale</label>
              <div>
                <input id="dgi-ifu-search" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. 1234567890123 ou entreprise" />
                <button type="submit" className="primary-button" disabled={searching || !query.trim()}><Search size={16} />{searching ? 'Recherche...' : 'Rechercher'}</button>
              </div>
            </form>
            {searchError && <p className="dgi-feedback" role="status">{searchError}</p>}
            {results.length > 0 && <div className="dgi-result-list" aria-label="Résultats de démonstration">
              {results.map((record) => <article key={record.ifu}>
                <div><strong>{record.raison_sociale}</strong><span>SIMULATION FICTIVE · IFU : {record.ifu.trim()} · Régime : {record.regime_fiscal}</span><small>{[record.adresse, record.telephone].filter(Boolean).join(' · ') || 'Coordonnées non renseignées'}</small></div>
                <button type="button" className="outline-button" onClick={() => applyRegistryRecord(record)}>Utiliser ces informations</button>
              </article>)}
            </div>}
          </> : <p className="dgi-feedback" role="status">Recherche désactivée. Activez <code>VITE_DGI_MOCK_IFU_LOOKUP_ENABLED=true</code> uniquement dans une instance privée de pré-lancement, jamais dans l’application publique.</p>}
        </section>

        <section className="panel dgi-normalisation-card">
          <div className="panel-heading"><div><h2>Simulation de normalisation de facture</h2><p>Appelle la RPC PostgreSQL de simulation. Aucun statut de paiement n’est modifié.</p></div></div>
          {mockLookupEnabled ? <>
            <label className="dgi-invoice-select" htmlFor="dgi-simulation-invoice">Facture émise</label>
            <select id="dgi-simulation-invoice" value={selectedInvoiceId} onChange={(event) => { setSelectedInvoiceId(event.target.value); setSimulationResult(null); setSimulationError('') }}>
              <option value="">Choisir une facture</option>
              {simulationInvoices.map((invoice) => {
                const eligible = isDgiSimulationEligible(invoice)
                const mockLabel = invoice.is_dgi_mock ? ' · déjà simulée' : ''
                const documentLabel = invoice.benin_document_type ? ` · ${beninDocumentTypeLabels[invoice.benin_document_type]}` : ''
                return <option key={invoice.id} value={invoice.id} disabled={!eligible}>
                  {invoice.invoice_number} · {invoice.status}{documentLabel}{mockLabel}{eligible ? '' : ' · non éligible'}
                </option>
              })}
            </select>
            {simulationEligibleCount === 0 && <p className="field-hint">{simulationInvoices.length === 0 ? 'Aucune facture disponible. Créez et émettez une facture avant de lancer une simulation.' : 'Aucune facture disponible pour la simulation. Les brouillons, factures annulées, proformas et factures avec références e-MECeF manuelles sont exclus.'}</p>}
            <button type="button" className="outline-button" disabled={!selectedInvoiceId || simulationLoading} onClick={() => void simulateInvoiceNormalisation()}>
              <Play size={15} />{simulationLoading ? 'Simulation...' : 'Simuler e-MECeF'}
            </button>
            {simulationError && selectedSimulationInvoice && isDgiSimulationEligible(selectedSimulationInvoice) && <p className="dgi-feedback" role="alert">{simulationError}</p>}
            {simulationResult && <div className="dgi-check-result match" role="status">
              <strong>SIMULATION FICTIVE — résultat enregistré, non officiel</strong>
              <ul>
                <li>NIM fictif : {simulationResult.nim}</li>
                <li>Signature fictive : {simulationResult.signature}</li>
                <li>Compteur fictif : {simulationResult.counters}</li>
                <li>Horodatage : {simulationResult.normalized_at ? new Date(simulationResult.normalized_at).toLocaleString('fr-FR') : '—'}</li>
              </ul>
              <small>{simulationResult.notice ?? 'Aucune vérification ni transmission DGI/e-MECeF.'}</small>
            </div>}
          </> : <p className="dgi-feedback" role="status">Simulation désactivée. Activez le mode de démonstration uniquement dans une instance privée de pré-lancement.</p>}
        </section>

        <form className="panel dgi-manual-form" onSubmit={(event) => void save(event)}>
          <div className="panel-heading"><div><h2>Informations à vérifier</h2><p>La saisie manuelle reste disponible, même sans registre de test.</p></div></div>
          <div className="settings-fields">
            <label><span>Raison sociale / nom</span><input required maxLength={255} value={profile.name} onChange={(event) => updateProfile('name', event.target.value)} /></label>
            <label><span>IFU <small>non vérifié</small></span><input maxLength={50} value={profile.tax_id ?? ''} onChange={(event) => updateProfile('tax_id', event.target.value)} placeholder="13 chiffres, à confirmer sur document officiel" /></label>
            <label><span>Régime fiscal</span><select value={profile.fiscal_regime ?? ''} onChange={(event) => {
              const fiscalRegime = event.target.value === 'TPS' || event.target.value === 'REEL' ? event.target.value : null
              setProfile({ ...profile, fiscal_regime: fiscalRegime, default_tax_rate: fiscalRegime === 'TPS' ? 0 : fiscalRegime === 'REEL' ? 18 : profile.default_tax_rate })
              setCheckResult(null)
            }}><option value="">À renseigner</option><option value="TPS">TPS — taux par défaut 0 %</option><option value="REEL">Régime réel — taux par défaut 18 %</option></select></label>
            <label><span>Adresse</span><input maxLength={255} value={profile.address ?? ''} onChange={(event) => updateProfile('address', event.target.value)} /></label>
            <label><span>Téléphone</span><input maxLength={50} value={profile.phone ?? ''} onChange={(event) => updateProfile('phone', event.target.value)} /></label>
          </div>
          {message && <div className={`settings-message ${message === 'Informations de préparation enregistrées.' ? 'success' : ''}`} role="status">{message}</div>}
          <div className="settings-actions"><span>Ces informations alimentent le profil de l’entreprise et ses prochaines factures. Le choix TPS/réel fixe le taux de taxe par défaut à 0 %/18 % ; vérifiez les règles applicables à votre activité.</span><button className="primary-button" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer les informations'}</button></div>
        </form>

        <form className="panel dgi-invoice-form" onSubmit={(event) => void saveInvoiceMetadata(event)}>
          <div className="panel-heading">
            <div><h2>Rattacher les informations à une facture</h2><p>Après la saisie séparée sur le portail DGI, enregistrez les références reçues et le type de pièce correspondant.</p></div>
          </div>
          {invoiceLoadError && <p className="dgi-feedback" role="alert">{invoiceLoadError}</p>}
          {!invoiceLoadError && simulationInvoices.length === 0 && <p className="field-hint">Aucune facture disponible. Créez une facture émise avant d’enregistrer ses références.</p>}
          <div className="settings-fields">
            <label className="dgi-invoice-select" htmlFor="dgi-manual-invoice">Facture émise</label>
            <select id="dgi-manual-invoice" value={manualInvoiceId} onChange={(event) => selectManualInvoice(event.target.value)} disabled={!!invoiceLoadError}>
              <option value="">Choisir une facture</option>
              {simulationInvoices.map((invoice) => {
                const eligible = !['DRAFT', 'CANCELLED'].includes(invoice.status) && invoice.invoice_type !== 'PROFORMA'
                const documentLabel = invoice.benin_document_type ? ` · ${beninDocumentTypeLabels[invoice.benin_document_type]}` : ''
                return <option key={invoice.id} value={invoice.id} disabled={!eligible}>
                  {invoice.invoice_number} · {invoice.status}{documentLabel}{invoice.is_dgi_mock ? ' · métadonnées de simulation' : ''}{eligible ? '' : ' · non éligible'}
                </option>
              })}
            </select>
            <label><span>Régime fiscal de cette facture</span><select value={manualFiscalRegime} onChange={(event) => setManualFiscalRegime(event.target.value === 'TPS' || event.target.value === 'REEL' ? event.target.value : '')}><option value="">Non renseigné</option><option value="TPS">TPS — taxe par défaut 0 %</option><option value="REEL">Régime réel — taxe par défaut 18 %</option></select></label>
            <label><span>Type de document</span><select value={manualDocumentType} onChange={(event) => { if (isBeninDocumentType(event.target.value)) setManualDocumentType(event.target.value) }}><option value="recu_vente">{beninDocumentTypeLabels.recu_vente}</option><option value="proforma">{beninDocumentTypeLabels.proforma}</option><option value="bon_livraison">{beninDocumentTypeLabels.bon_livraison}</option><option value="facture_interne">{beninDocumentTypeLabels.facture_interne}</option></select></label>
            <label><span>NIM <small>recopié depuis le portail DGI</small></span><input maxLength={50} value={manualReferences.nim} onChange={(event) => setManualReferences((current) => ({ ...current, nim: event.target.value }))} /></label>
            <label><span>Compteur e-MECeF</span><input maxLength={50} value={manualReferences.counters} onChange={(event) => setManualReferences((current) => ({ ...current, counters: event.target.value }))} /></label>
            <label><span>Signature e-MECeF</span><input maxLength={100} value={manualReferences.signature} onChange={(event) => setManualReferences((current) => ({ ...current, signature: event.target.value }))} /></label>
          </div>
          <p className="field-hint">Le régime fiscal choisi pour une facture existante ne recalcule pas ses montants. Le choix du régime de l’entreprise règle le taux par défaut des nouvelles factures.</p>
          <div className="dgi-notice dgi-manual-reference-notice" role="note">
            <ShieldCheck size={18} />
            <p>FactureFacile enregistre les valeurs saisies mais ne vérifie ni leur authenticité ni la normalisation DGI. Pour effacer les références, videz les trois champs.</p>
          </div>
          {manualInvoiceId && simulationInvoices.find((invoice) => invoice.id === manualInvoiceId)?.is_dgi_mock && <p className="dgi-feedback" role="status">Cette facture contient actuellement des métadonnées fictives. L’enregistrement remplacera ces données et retirera le marqueur de simulation.</p>}
          {manualMessage && <div className={`settings-message ${manualMessage.startsWith('Références enregistrées') || manualMessage.startsWith('Régime fiscal') ? 'success' : ''}`} role={manualMessage.startsWith('Impossible') ? 'alert' : 'status'}>{manualMessage}</div>}
          <div className="settings-actions">
            <span>Les trois références sont facultatives pour enregistrer seulement le régime et le type de document, mais doivent être saisies ensemble si l’une est fournie.</span>
            <button type="submit" className="primary-button" disabled={manualSaving || !manualInvoiceId || !!invoiceLoadError}>{manualSaving ? 'Enregistrement...' : 'Enregistrer sur la facture'}</button>
          </div>
        </form>
      </div>
    </section>
  )
}
