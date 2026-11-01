import { describe, expect, it } from 'vitest'
import { calculatePaymentPosition, getRefundableAmount } from './paymentAccounting'

describe('payment accounting', () => {
  it('applies only reconciled partial receipts to an invoice balance', () => {
    const position = calculatePaymentPosition(100_000, [
      { amount: 25_000, status: 'reconciled', transaction_type: 'receipt' },
      { amount: 20_000, status: 'pending', transaction_type: 'receipt' },
    ])

    expect(position).toEqual({ received: 25_000, pending: 20_000, remaining: 75_000, overpayment: 0 })
  })

  it('tracks excess received as credit instead of allowing a negative balance', () => {
    const position = calculatePaymentPosition(100_000, [
      { amount: 125_000, status: 'reconciled', transaction_type: 'receipt' },
    ])

    expect(position).toEqual({ received: 125_000, pending: 0, remaining: 0, overpayment: 25_000 })
  })

  it('reduces the received total only after a refund is reconciled', () => {
    const position = calculatePaymentPosition(100_000, [
      { amount: 100_000, status: 'reconciled', transaction_type: 'receipt' },
      { amount: 30_000, status: 'pending', transaction_type: 'refund' },
    ])

    expect(position).toEqual({ received: 100_000, pending: -30_000, remaining: 0, overpayment: 0 })
    expect(calculatePaymentPosition(100_000, [
      { amount: 100_000, status: 'reconciled', transaction_type: 'receipt' },
      { amount: 30_000, status: 'reconciled', transaction_type: 'refund' },
    ]).received).toBe(70_000)
  })

  it('excludes cancelled refunds from the refundable amount', () => {
    expect(getRefundableAmount(80_000, [
      { amount: 20_000, status: 'reconciled', transaction_type: 'refund' },
      { amount: 10_000, status: 'pending', transaction_type: 'refund' },
      { amount: 15_000, status: 'cancelled', transaction_type: 'refund' },
    ])).toBe(50_000)
  })
})
