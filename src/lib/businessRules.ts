export type InvoiceBusinessStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'

export function calculateInvoiceBalance(total: number, payments: number[]) {
  const safeTotal = Math.max(0, total)
  const paid = payments.reduce((sum, amount) => sum + Math.max(0, amount), 0)
  return { paid, remaining: Math.max(0, safeTotal - paid) }
}

export function canEditInvoice(status: InvoiceBusinessStatus, paid: number) {
  return paid <= 0 && (status === 'DRAFT' || status === 'SENT' || status === 'OVERDUE')
}

export function canRecordPayment(status: InvoiceBusinessStatus, total: number, paid: number, amount: number) {
  return !['DRAFT', 'PAID', 'CANCELLED'].includes(status) &&
    amount > 0 &&
    paid + amount <= total
}

export function isInvoiceOverdue(status: InvoiceBusinessStatus, dueDate: string | null, today: string) {
  return !['PAID', 'CANCELLED'].includes(status) && Boolean(dueDate && dueDate < today)
}
