import { describe, expect, it } from 'vitest'
import { calculateInvoiceBalance, canEditInvoice, canRecordPayment, isInvoiceOverdue } from './businessRules'

describe('invoice business rules', () => {
  it('calculates paid and remaining amounts without allowing negative balances', () => {
    expect(calculateInvoiceBalance(100000, [25000, 10000])).toEqual({ paid: 35000, remaining: 65000 })
    expect(calculateInvoiceBalance(100000, [120000])).toEqual({ paid: 120000, remaining: 0 })
  })

  it('allows editing only unpaid editable statuses', () => {
    expect(canEditInvoice('DRAFT', 0)).toBe(true)
    expect(canEditInvoice('SENT', 0)).toBe(true)
    expect(canEditInvoice('PAID', 0)).toBe(false)
    expect(canEditInvoice('SENT', 1)).toBe(false)
    expect(canEditInvoice('CANCELLED', 0)).toBe(false)
  })

  it('rejects invalid or excessive payments', () => {
    expect(canRecordPayment('SENT', 100000, 50000, 50000)).toBe(true)
    expect(canRecordPayment('SENT', 100000, 50000, 50001)).toBe(false)
    expect(canRecordPayment('DRAFT', 100000, 0, 100)).toBe(false)
    expect(canRecordPayment('PAID', 100000, 100000, 1)).toBe(false)
  })

  it('detects overdue invoices while excluding final states', () => {
    expect(isInvoiceOverdue('SENT', '2026-09-01', '2026-09-06')).toBe(true)
    expect(isInvoiceOverdue('PAID', '2026-09-01', '2026-09-06')).toBe(false)
    expect(isInvoiceOverdue('SENT', null, '2026-09-06')).toBe(false)
  })
})
