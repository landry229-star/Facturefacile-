import type { ExpenseRecord } from './data'

const expenseCategoryLabels: Record<string, string> = {
  office: 'Bureau',
  rent: 'Loyer',
  supplies: 'Fournitures',
  transport: 'Transport',
  salary: 'Salaires',
  tax: 'Taxes',
  marketing: 'Marketing',
  other: 'Autre',
}

export const getExpenseCategoryLabel = (category: string) => expenseCategoryLabels[category] ?? category

export function expensePaymentMethodLabel(method: string) {
  return ({ cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement bancaire', card: 'Carte', check: 'Chèque', other: 'Autre' } as Record<string, string>)[method] ?? method
}

const validExpensePaymentMethods = new Set(['cash', 'mobile_money', 'bank_transfer', 'card', 'check', 'other'])
export function isExpensePaymentMethod(method: string): method is ExpenseRecord['payment_method'] {
  return validExpensePaymentMethods.has(method)
}

export function expenseTableRow(expense: ExpenseRecord, currency: string) {
  return [
    expense.label,
    getExpenseCategoryLabel(expense.category),
    new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString('fr-FR'),
    `${expense.amount.toLocaleString('fr-FR')} ${currency}`,
    expense.taxable_amount === null ? '—' : `${expense.taxable_amount.toLocaleString('fr-FR')} ${currency}`,
    expense.vat_amount === null ? '—' : `${expense.vat_amount.toLocaleString('fr-FR')} ${currency}`,
    expense.supplier_name ?? '—',
    expense.supplier_tax_id ?? '—',
    expense.supplier_invoice_number ?? '—',
    expensePaymentMethodLabel(expense.payment_method),
    expense.qr_code_data ? 'Scanné' : '—',
    expense.receipt_path ? 'Disponible' : '—',
  ]
}
