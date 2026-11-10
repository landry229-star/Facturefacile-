export type AccountingPayment = {
  amount: number | string
  effective_amount: number | string | null
  payment_date: string
  method: string
  reference: string | null
  status: string
  transaction_type: string
  momo_reconciliations?: { provider: string; transaction_id: string | null; status: string }[] | null
}

export type AccountingInvoice = {
  invoice_number: string
  issue_date: string
  invoice_type: string
  subtotal: number | string
  discount: number | string
  tax: number | string
  total: number | string
  status: string
  reg_fiscal_emetteur: string | null
  benin_document_type: string | null
  dgi_nim: string | null
  dgi_signature: string | null
  is_dgi_mock: boolean
  clients: { name: string; tax_id: string | null } | { name: string; tax_id: string | null }[] | null
  payments: AccountingPayment[] | null
}

export function getAccountingExportHeaders(currency = 'FCFA') {
  return [
    'DATE_PIECE',
    'REF_INTERNE',
    'TYPE_PIECE',
    'REGIME_FISCAL',
    'CLIENT_RAISON_SOCIALE',
    'CLIENT_IFU',
    `MONTANT_HT_${currency}`,
    `TVA_ENREGISTREE_${currency}`,
    `TOTAL_DOCUMENT_${currency}`,
    'MODE_REGLEMENT',
    'REF_REGLEMENT',
    'DATES_REGLEMENT',
    `ENCAISSEMENTS_NETS_${currency}`,
    'STATUT_REGLEMENT',
    'E_MECEF_NIM',
    'E_MECEF_SIGNATURE',
    'MENTION_LEGALE',
    'STATUT_DOCUMENT',
  ]
}

const invoiceTypeLabels: Record<string, string> = {
  STANDARD: 'FACTURE_STANDARD',
  PROFORMA: 'PROFORMA',
  DEPOSIT: 'ACOMPTE',
  CREDIT_NOTE: 'AVOIR',
  FINAL: 'FACTURE_DEFINITIVE',
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
  card: 'Carte',
  check: 'Chèque',
  other: 'Autre',
}

const paymentStatusLabels: Record<string, string> = {
  pending: 'En attente',
  reconciled: 'Rapproché',
  cancelled: 'Annulé',
}

const invoiceStatusLabels: Record<string, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  PARTIALLY_PAID: 'Partiellement payée',
  PAID: 'Payée',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulée',
}

function formatAccountingDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

function formatAmount(value: number | string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) throw new Error('Une facture contient un montant invalide.')
  return amount.toFixed(2)
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

const beninDocumentTypeLabels: Record<string, string> = {
  proforma: 'PROFORMA',
  recu_vente: 'RECU_VENTE',
  bon_livraison: 'BON_LIVRAISON',
  facture_interne: 'FACTURE_INTERNE',
}

const momoProviderLabels: Record<string, string> = {
  mtn: 'MTN Mobile Money',
  moov: 'Moov Money',
  wave: 'Wave',
}

export function createAccountingExportRows(
  invoices: AccountingInvoice[],
  legalNotice?: string | null,
  businessFiscalRegime?: 'TPS' | 'REEL' | null,
) {
  return invoices.map((invoice) => {
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
    const payments = invoice.payments ?? []
    const methods = unique(payments
      .filter((payment) => payment.status !== 'cancelled')
      .map((payment) => {
        const provider = payment.momo_reconciliations?.find((row) => row.provider)?.provider
        return provider ? momoProviderLabels[provider] ?? provider : paymentMethodLabels[payment.method] ?? payment.method
      }))
    const references = unique(payments.flatMap((payment) => [
      payment.reference?.trim() ?? '',
      ...(payment.momo_reconciliations ?? []).map((row) => row.transaction_id?.trim() ?? ''),
    ]))
    const paymentDates = unique(payments.map((payment) => formatAccountingDate(payment.payment_date)))
    const paymentStatuses = unique(payments.map((payment) => paymentStatusLabels[payment.status] ?? payment.status))
    const reconciledNet = payments
      .filter((payment) => payment.status === 'reconciled')
      .reduce((sum, payment) => {
        if (payment.effective_amount === null) throw new Error('Un paiement rapproché ne contient pas son montant net.')
        const effectiveAmount = Number(payment.effective_amount)
        if (!Number.isFinite(effectiveAmount)) throw new Error('Un paiement rapproché contient un montant invalide.')
        return sum + effectiveAmount
      }, 0)
    const taxableBase = Math.max(0, Number(invoice.subtotal) - Number(invoice.discount))
    if (!Number.isFinite(taxableBase)) throw new Error('Une facture contient une base taxable invalide.')

    return [
      formatAccountingDate(invoice.issue_date),
      invoice.invoice_number,
      (invoice.benin_document_type && beninDocumentTypeLabels[invoice.benin_document_type]) || invoiceTypeLabels[invoice.invoice_type] || invoice.invoice_type,
      invoice.reg_fiscal_emetteur ?? businessFiscalRegime ?? 'NON_RENSEIGNE',
      client?.name ?? '',
      client?.tax_id ?? '',
      formatAmount(taxableBase),
      formatAmount(invoice.tax),
      formatAmount(invoice.total),
      methods.join(' | '),
      references.join(' | '),
      paymentDates.join(' | '),
      formatAmount(reconciledNet),
      paymentStatuses.join(' | '),
      invoice.dgi_nim ?? '',
      invoice.dgi_signature ? `${invoice.is_dgi_mock ? 'SIMULATION · ' : ''}${invoice.dgi_signature}` : '',
      legalNotice?.trim() || 'Aucune mention légale configurée',
      invoiceStatusLabels[invoice.status] ?? invoice.status,
    ]
  })
}

export function serializeAccountingCsv(rows: string[][], currency = 'FCFA') {
  const numericColumns = new Set([6, 7, 8, 12])
  const escapeCell = (value: string, isNumeric: boolean) => {
    const safeValue = !isNumeric && /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return `"${safeValue.replaceAll('"', '""')}"`
  }
  const csvRows = [getAccountingExportHeaders(currency), ...rows]
  return `\uFEFF${csvRows.map((row) => row.map((value, index) => escapeCell(value, numericColumns.has(index))).join(';')).join('\r\n')}`
}
