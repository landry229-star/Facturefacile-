import { useEffect, useState } from 'react'
import { CalendarClock, RefreshCw, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import { formatMoney } from './lib/formatting'
import { calculateCashflowForecast, type CashflowForecast } from './lib/cashflowForecast'
import { loadCashflowForecastInputs } from './lib/data'
import { getBusinessDateKey } from './lib/businessPreferences'

export function CashflowPage({ businessId, currency, timezone }: {
  businessId: string
  currency: string
  timezone: string
}) {
  const today = getBusinessDateKey(new Date(), timezone)
  const [result, setResult] = useState<{ key: number; forecast: CashflowForecast } | { key: number; error: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const loading = result?.key !== reloadKey
  const forecast = result && 'forecast' in result ? result.forecast : null
  const error = result && 'error' in result ? result.error : ''

  useEffect(() => {
    let cancelled = false
    void loadCashflowForecastInputs(businessId, today)
      .then((inputs) => {
        if (!cancelled) setResult({ key: reloadKey, forecast: calculateCashflowForecast(inputs, today) })
      })
      .catch((cause: unknown) => {
        if (!cancelled) setResult({ key: reloadKey, error: cause instanceof Error ? cause.message : 'Impossible de charger les données de trésorerie.' })
      })
    return () => { cancelled = true }
  }, [businessId, reloadKey, today])

  const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })

  return <section className="module-page cashflow-page">
    <div className="module-heading">
      <div>
        <p className="eyebrow">PILOTAGE FINANCIER</p>
        <h1>Trésorerie et prévisions</h1>
        <p>Anticipez les encaissements dus et estimez les sorties de trésorerie.</p>
      </div>
      <button type="button" className="outline-button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>
        <RefreshCw size={16} /> {loading ? 'Actualisation…' : 'Actualiser'}
      </button>
    </div>

    <div className="cashflow-notice" role="note">
      <WalletCards size={18} />
      <p><strong>Projection indicative, pas un solde bancaire.</strong> Le solde d’ouverture et les mouvements bancaires ne sont pas suivis. La variation nette combine les factures clients ouvertes, les dettes fournisseurs échues dans la période et une estimation des dépenses payées sur les 90 derniers jours.</p>
    </div>

    {error && <div className="data-warning" role="alert">Le calcul des prévisions a échoué : {error}</div>}
    {loading && <p className="muted-cell" role="status">Chargement des factures et dépenses…</p>}

    {!loading && !error && forecast && <>
      <div className="cashflow-period-grid" aria-label="Prévisions cumulées">
        {forecast.periods.map((period) => <article className="panel cashflow-period-card" key={period.days}>
          <div className="cashflow-period-heading"><CalendarClock size={18} /><span>À {period.days} jours</span></div>
          <span className="cashflow-metric-label">Factures à encaisser</span>
          <strong>{formatMoney(period.expectedInflows, currency)}</strong>
          <span className="cashflow-subtext">{period.openInvoiceCount} facture(s) · dont {period.overdueInvoiceCount} en retard</span>
          <div className="cashflow-period-divider" />
          <span className="cashflow-metric-label">Dépenses estimées</span>
          <strong>{period.estimatedExpenses === null ? 'Non estimables' : formatMoney(period.estimatedExpenses, currency)}</strong>
          <div className="cashflow-period-divider" />
          <span className="cashflow-metric-label">Échéances fournisseurs connues</span>
          <strong>{formatMoney(period.scheduledPurchasePayments, currency)}</strong>
          <span className="cashflow-subtext">{period.openPurchaseCount} facture(s) · dont {period.overduePurchaseCount} en retard</span>
          <div className={`cashflow-net ${period.projectedNetFlow === null ? 'unavailable' : period.projectedNetFlow >= 0 ? 'positive' : 'negative'}`}>
            {period.projectedNetFlow === null ? <span aria-hidden="true">—</span> : period.projectedNetFlow >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>Variation nette estimée</span>
            <b>{period.projectedNetFlow === null ? '—' : formatMoney(period.projectedNetFlow, currency)}</b>
          </div>
        </article>)}
      </div>

      <section className="panel cashflow-invoices">
        <div className="panel-heading">
          <div><h2>Factures attendues sur 90 jours</h2><p>Les factures en retard sont comptées comme à encaisser dès maintenant.</p></div>
          <span className="cashflow-count">{forecast.upcomingInvoices.length} facture(s)</span>
        </div>
        {forecast.upcomingInvoices.length
          ? <div className="table-wrap"><table><thead><tr><th>ÉCHÉANCE</th><th>CLIENT</th><th>FACTURE</th><th>RESTANT À ENCAISSER</th><th>ÉTAT</th></tr></thead><tbody>
            {forecast.upcomingInvoices.map((invoice) => <tr key={invoice.invoiceNumber}>
              <td>{formatDate(invoice.dueDate)}</td>
              <td>{invoice.clientName}</td>
              <td>{invoice.invoiceNumber}</td>
              <td>{formatMoney(invoice.remaining, currency)}</td>
              <td><span className={`cashflow-status ${invoice.overdue ? 'overdue' : ''}`}>{invoice.overdue ? 'En retard' : 'À venir'}</span></td>
            </tr>)}
          </tbody></table></div>
          : <p className="cashflow-empty">Aucune facture ouverte avec une échéance dans les 90 prochains jours.</p>}
      </section>

      <section className="panel cashflow-invoices cashflow-purchases">
        <div className="panel-heading">
          <div><h2>Factures fournisseurs à régler sur 90 jours</h2><p>Le solde restant des factures échues est compté comme une sortie à régler dès maintenant.</p></div>
          <span className="cashflow-count">{forecast.upcomingPurchases.length} facture(s)</span>
        </div>
        {forecast.upcomingPurchases.length
          ? <div className="table-wrap"><table><thead><tr><th>ÉCHÉANCE</th><th>FOURNISSEUR</th><th>FACTURE ACHAT</th><th>RESTANT À RÉGLER</th><th>ÉTAT</th></tr></thead><tbody>
            {forecast.upcomingPurchases.map((purchase) => <tr key={purchase.purchaseNumber}>
              <td>{formatDate(purchase.dueDate)}</td>
              <td>{purchase.supplierName}</td>
              <td>{purchase.purchaseNumber}</td>
              <td>{formatMoney(purchase.remaining, currency)}</td>
              <td><span className={`cashflow-status ${purchase.overdue ? 'overdue' : ''}`}>{purchase.overdue ? 'En retard' : 'À venir'}</span></td>
            </tr>)}
          </tbody></table></div>
          : <p className="cashflow-empty">Aucune facture fournisseur ouverte avec une échéance dans les 90 prochains jours.</p>}
      </section>

      <div className="cashflow-method">
        <strong>Comment lire ces estimations</strong>
        <p>Les encaissements incluent le reste dû des factures émises, après déduction des paiements rapprochés. Les brouillons, factures payées, annulées, proformas et avoirs sont exclus. Les dépenses payées (y compris les paiements fournisseurs) sont extrapolées depuis les 90 derniers jours; les soldes des factures fournisseurs connues sont ajoutés selon leur échéance.</p>
        {!forecast.expenseHistoryCount && <p className="cashflow-data-note">Aucune dépense des 90 derniers jours : les dépenses et la variation nette ne peuvent pas encore être estimées.</p>}
        {forecast.undatedInvoiceCount > 0 && <p className="cashflow-data-note">{forecast.undatedInvoiceCount} facture(s) ouverte(s) sans échéance sont exclues des encaissements prévus ; renseignez leurs dates d’échéance pour les inclure.</p>}
        {forecast.undatedPurchaseCount > 0 && <p className="cashflow-data-note">{forecast.undatedPurchaseCount} facture(s) fournisseur(s) ouverte(s) sans échéance sont exclues des règlements prévus ; renseignez leurs dates d’échéance pour les inclure.</p>}
        <small>Ces montants sont des projections de flux, sans prise en compte des nouvelles ventes, des achats futurs non enregistrés ni d’un solde bancaire initial.</small>
      </div>
    </>}
  </section>
}
