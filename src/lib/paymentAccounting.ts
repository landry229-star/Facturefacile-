export type PaymentAmount = {
  amount: number
  status: 'pending' | 'reconciled' | 'cancelled'
  transaction_type: 'receipt' | 'refund'
}

export function calculatePaymentPosition(invoiceTotal: number, transactions: PaymentAmount[]) {
  const received = transactions.reduce((sum, transaction) => {
    if (transaction.status !== 'reconciled') return sum
    return sum + (transaction.transaction_type === 'refund' ? -transaction.amount : transaction.amount)
  }, 0)
  const pending = transactions.reduce((sum, transaction) =>
    transaction.status === 'pending'
      ? sum + (transaction.transaction_type === 'refund' ? -transaction.amount : transaction.amount)
      : sum, 0)
  return {
    received,
    pending,
    remaining: Math.max(0, invoiceTotal - received),
    overpayment: Math.max(0, received - invoiceTotal),
  }
}

export function getRefundableAmount(receiptAmount: number, existingRefunds: PaymentAmount[]) {
  const reserved = existingRefunds.reduce((sum, refund) =>
    refund.transaction_type === 'refund' && refund.status !== 'cancelled' ? sum + refund.amount : sum, 0)
  return Math.max(0, receiptAmount - reserved)
}
