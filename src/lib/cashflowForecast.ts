export type CashflowInvoice = {
  invoiceNumber: string
  clientName: string
  dueDate: string | null
  total: number
  status: string
  invoiceType: string
  beninDocumentType: string | null
  payments: { effectiveAmount: number }[]
}

export type CashflowExpense = {
  amount: number
  expenseDate: string
}

export type CashflowPurchase = {
  purchaseNumber: string
  supplierName: string
  dueDate: string | null
  total: number
  paidAmount: number
}

export type CashflowForecastInputs = {
  invoices: CashflowInvoice[]
  expenses: CashflowExpense[]
  purchases?: CashflowPurchase[]
}

export type CashflowHorizon = 30 | 60 | 90

export type CashflowForecastPeriod = {
  days: CashflowHorizon
  expectedInflows: number
  estimatedExpenses: number | null
  scheduledPurchasePayments: number
  projectedNetFlow: number | null
  openInvoiceCount: number
  overdueInvoiceCount: number
  openPurchaseCount: number
  overduePurchaseCount: number
}

export type CashflowForecast = {
  periods: CashflowForecastPeriod[]
  upcomingInvoices: { invoiceNumber: string; clientName: string; dueDate: string; remaining: number; overdue: boolean }[]
  upcomingPurchases: { purchaseNumber: string; supplierName: string; dueDate: string; remaining: number; overdue: boolean }[]
  undatedInvoiceCount: number
  undatedPurchaseCount: number
  expenseHistoryCount: number
  expenseHistoryTotal: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const EXCLUDED_INVOICE_TYPES = new Set(['PROFORMA', 'CREDIT_NOTE'])
const EXCLUDED_BENIN_DOCUMENT_TYPES = new Set(['proforma'])
const EXCLUDED_INVOICE_STATUSES = new Set(['DRAFT', 'CANCELLED', 'PAID'])

function parseDateKey(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null
}

export function calculateCashflowForecast(
  inputs: CashflowForecastInputs,
  today: string,
): CashflowForecast {
  const todayTimestamp = parseDateKey(today)
  if (todayTimestamp === null) throw new Error('La date de référence des prévisions est invalide.')

  const historyStart = todayTimestamp - 89 * DAY_MS
  const horizonEnd = todayTimestamp + 90 * DAY_MS
  const historyExpenseEntries = inputs.expenses.filter((expense) => {
    const date = parseDateKey(expense.expenseDate)
    return date !== null && date >= historyStart && date <= todayTimestamp
      && Number.isFinite(expense.amount) && expense.amount !== 0
  })
  const historyExpenses = historyExpenseEntries.filter((expense) => expense.amount > 0)
  const expenseHistoryTotal = Math.max(0, historyExpenseEntries.reduce((sum, expense) => sum + expense.amount, 0))
  const expenseHistoryAvailable = historyExpenses.length > 0

  let undatedInvoiceCount = 0
  const receivables = inputs.invoices.flatMap((invoice) => {
    if (
      EXCLUDED_INVOICE_STATUSES.has(invoice.status.toUpperCase())
      || EXCLUDED_INVOICE_TYPES.has(invoice.invoiceType.toUpperCase())
      || (invoice.beninDocumentType && EXCLUDED_BENIN_DOCUMENT_TYPES.has(invoice.beninDocumentType.toLowerCase()))
    ) return []
    if (!invoice.dueDate) {
      undatedInvoiceCount += 1
      return []
    }

    const dueTimestamp = parseDateKey(invoice.dueDate)
    if (dueTimestamp === null) {
      undatedInvoiceCount += 1
      return []
    }
    const paid = invoice.payments.reduce((sum, payment) =>
      sum + (Number.isFinite(payment.effectiveAmount) ? payment.effectiveAmount : 0), 0)
    const remaining = Math.max(0, invoice.total - paid)
    return remaining > 0
      ? [{
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        dueDate: invoice.dueDate,
        dueTimestamp: Math.max(dueTimestamp, todayTimestamp),
        remaining,
        overdue: dueTimestamp < todayTimestamp,
      }]
      : []
  })
  let undatedPurchaseCount = 0
  const payables = (inputs.purchases ?? []).flatMap((purchase) => {
    const remaining = Math.max(0, purchase.total - purchase.paidAmount)
    if (remaining <= 0) return []
    if (!purchase.dueDate) {
      undatedPurchaseCount += 1
      return []
    }
    const dueTimestamp = parseDateKey(purchase.dueDate)
    if (dueTimestamp === null) {
      undatedPurchaseCount += 1
      return []
    }
    return [{
      purchaseNumber: purchase.purchaseNumber,
      supplierName: purchase.supplierName,
      dueDate: purchase.dueDate,
      dueTimestamp: Math.max(dueTimestamp, todayTimestamp),
      remaining,
      overdue: dueTimestamp < todayTimestamp,
    }]
  })

  const periods = ([30, 60, 90] as const).map((days) => {
    const endTimestamp = todayTimestamp + days * DAY_MS
    const dueReceivables = receivables.filter((invoice) => invoice.dueTimestamp <= endTimestamp)
    const duePayables = payables.filter((purchase) => purchase.dueTimestamp <= endTimestamp)
    const expectedInflows = dueReceivables.reduce((sum, invoice) => sum + invoice.remaining, 0)
    const estimatedExpenses = expenseHistoryAvailable ? expenseHistoryTotal * (days / 90) : null
    const scheduledPurchasePayments = duePayables.reduce((sum, purchase) => sum + purchase.remaining, 0)
    return {
      days,
      expectedInflows,
      estimatedExpenses,
      scheduledPurchasePayments,
      projectedNetFlow: estimatedExpenses === null ? null : expectedInflows - estimatedExpenses - scheduledPurchasePayments,
      openInvoiceCount: dueReceivables.length,
      overdueInvoiceCount: dueReceivables.filter((invoice) => invoice.overdue).length,
      openPurchaseCount: duePayables.length,
      overduePurchaseCount: duePayables.filter((purchase) => purchase.overdue).length,
    }
  })

  return {
    periods,
    upcomingInvoices: receivables
      .filter((invoice) => invoice.dueTimestamp <= horizonEnd)
      .sort((left, right) => left.dueTimestamp - right.dueTimestamp)
      .map(({ invoiceNumber, clientName, dueDate, remaining, overdue }) => ({ invoiceNumber, clientName, dueDate, remaining, overdue })),
    upcomingPurchases: payables
      .filter((purchase) => purchase.dueTimestamp <= horizonEnd)
      .sort((left, right) => left.dueTimestamp - right.dueTimestamp)
      .map(({ purchaseNumber, supplierName, dueDate, remaining, overdue }) => ({ purchaseNumber, supplierName, dueDate, remaining, overdue })),
    undatedInvoiceCount,
    undatedPurchaseCount,
    expenseHistoryCount: historyExpenses.length,
    expenseHistoryTotal,
  }
}
