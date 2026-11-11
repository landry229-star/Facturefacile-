import { describe, expect, it } from 'vitest'
import { calculateCashflowForecast, type CashflowForecastInputs } from './cashflowForecast'

const inputs: CashflowForecastInputs = {
  invoices: [
    { invoiceNumber: 'OVERDUE', clientName: 'Client', dueDate: '2026-10-30', total: 1000, status: 'OVERDUE', invoiceType: 'STANDARD', beninDocumentType: null, payments: [{ effectiveAmount: 250 }] },
    { invoiceNumber: 'NEXT', clientName: 'Client', dueDate: '2026-11-25', total: 1200, status: 'SENT', invoiceType: 'STANDARD', beninDocumentType: null, payments: [{ effectiveAmount: 200 }] },
    { invoiceNumber: 'LATER', clientName: 'Client', dueDate: '2027-01-15', total: 500, status: 'SENT', invoiceType: 'STANDARD', beninDocumentType: null, payments: [] },
    { invoiceNumber: 'NO-DATE', clientName: 'Client', dueDate: null, total: 750, status: 'SENT', invoiceType: 'STANDARD', beninDocumentType: null, payments: [] },
    { invoiceNumber: 'DRAFT', clientName: 'Client', dueDate: '2026-11-20', total: 900, status: 'DRAFT', invoiceType: 'STANDARD', beninDocumentType: null, payments: [] },
    { invoiceNumber: 'PROFORMA', clientName: 'Client', dueDate: '2026-11-20', total: 900, status: 'SENT', invoiceType: 'PROFORMA', beninDocumentType: null, payments: [] },
    { invoiceNumber: 'CREDIT', clientName: 'Client', dueDate: '2026-11-20', total: 900, status: 'SENT', invoiceType: 'CREDIT_NOTE', beninDocumentType: null, payments: [] },
    { invoiceNumber: 'PAID', clientName: 'Client', dueDate: '2026-11-20', total: 900, status: 'PAID', invoiceType: 'STANDARD', beninDocumentType: null, payments: [] },
    { invoiceNumber: 'BENIN-PROFORMA', clientName: 'Client', dueDate: '2026-11-20', total: 900, status: 'SENT', invoiceType: 'STANDARD', beninDocumentType: 'proforma', payments: [] },
  ],
  expenses: [
    { amount: 900, expenseDate: '2026-08-01' },
    { amount: 300, expenseDate: '2026-11-01' },
    { amount: 600, expenseDate: '2026-11-10' },
    { amount: 200, expenseDate: '2026-11-11' },
  ],
}

describe('calculateCashflowForecast', () => {
  it('projects collectible invoice balances and a labelled 90-day expense run rate', () => {
    const forecast = calculateCashflowForecast(inputs, '2026-11-10')

    expect(forecast.periods).toEqual([
      { days: 30, expectedInflows: 1750, estimatedExpenses: 300, scheduledPurchasePayments: 0, projectedNetFlow: 1450, openInvoiceCount: 2, overdueInvoiceCount: 1, openPurchaseCount: 0, overduePurchaseCount: 0 },
      { days: 60, expectedInflows: 1750, estimatedExpenses: 600, scheduledPurchasePayments: 0, projectedNetFlow: 1150, openInvoiceCount: 2, overdueInvoiceCount: 1, openPurchaseCount: 0, overduePurchaseCount: 0 },
      { days: 90, expectedInflows: 2250, estimatedExpenses: 900, scheduledPurchasePayments: 0, projectedNetFlow: 1350, openInvoiceCount: 3, overdueInvoiceCount: 1, openPurchaseCount: 0, overduePurchaseCount: 0 },
    ])
    expect(forecast.upcomingInvoices.map((invoice) => invoice.invoiceNumber)).toEqual(['OVERDUE', 'NEXT', 'LATER'])
    expect(forecast.upcomingPurchases).toEqual([])
    expect(forecast.undatedInvoiceCount).toBe(1)
    expect(forecast.undatedPurchaseCount).toBe(0)
    expect(forecast.expenseHistoryCount).toBe(2)
    expect(forecast.expenseHistoryTotal).toBe(900)
  })

  it('deducts outstanding supplier invoices by due date and excludes undated invoices', () => {
    const forecast = calculateCashflowForecast({
      invoices: [],
      expenses: [{ amount: 900, expenseDate: '2026-11-10' }],
      purchases: [
        { purchaseNumber: 'ACH-OVERDUE', supplierName: 'Fournisseur A', dueDate: '2026-11-05', total: 500, paidAmount: 100 },
        { purchaseNumber: 'ACH-NEXT', supplierName: 'Fournisseur B', dueDate: '2027-01-01', total: 250, paidAmount: 50 },
        { purchaseNumber: 'ACH-NO-DATE', supplierName: 'Fournisseur C', dueDate: null, total: 600, paidAmount: 0 },
      ],
    }, '2026-11-10')

    expect(forecast.periods.map((period) => ({
      days: period.days,
      scheduledPurchasePayments: period.scheduledPurchasePayments,
      projectedNetFlow: period.projectedNetFlow,
      openPurchaseCount: period.openPurchaseCount,
      overduePurchaseCount: period.overduePurchaseCount,
    }))).toEqual([
      { days: 30, scheduledPurchasePayments: 400, projectedNetFlow: -700, openPurchaseCount: 1, overduePurchaseCount: 1 },
      { days: 60, scheduledPurchasePayments: 600, projectedNetFlow: -1200, openPurchaseCount: 2, overduePurchaseCount: 1 },
      { days: 90, scheduledPurchasePayments: 600, projectedNetFlow: -1500, openPurchaseCount: 2, overduePurchaseCount: 1 },
    ])
    expect(forecast.upcomingPurchases.map((purchase) => purchase.purchaseNumber)).toEqual(['ACH-OVERDUE', 'ACH-NEXT'])
    expect(forecast.undatedPurchaseCount).toBe(1)
  })

  it('does not present a zero expense forecast when no recent expenses exist', () => {
    const forecast = calculateCashflowForecast({ invoices: [], expenses: [] }, '2026-11-10')

    expect(forecast.periods[0].estimatedExpenses).toBeNull()
    expect(forecast.periods[0].projectedNetFlow).toBeNull()
    expect(forecast.periods[0].scheduledPurchasePayments).toBe(0)
  })

  it('subtracts recent purchase payment reversals from historical cash outflows', () => {
    const forecast = calculateCashflowForecast({
      invoices: [],
      expenses: [
        { amount: 900, expenseDate: '2026-11-01' },
        { amount: -300, expenseDate: '2026-11-05' },
      ],
    }, '2026-11-10')

    expect(forecast.expenseHistoryCount).toBe(1)
    expect(forecast.expenseHistoryTotal).toBe(600)
    expect(forecast.periods[0].estimatedExpenses).toBe(200)
  })

  it('rejects an invalid reference date', () => {
    expect(() => calculateCashflowForecast({ invoices: [], expenses: [] }, 'invalid')).toThrow('La date de référence des prévisions est invalide.')
  })
})
