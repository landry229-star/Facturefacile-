import { describe, expect, it } from 'vitest'
import { createPurchaseExportRows, purchaseExportHeaders } from './purchaseExport'
import type { PurchaseRecord } from './data'

describe('purchase export', () => {
  it('exports purchase amounts, lines, payments, and reversal status', () => {
    const purchase: PurchaseRecord = {
      id: 'purchase-id',
      supplier_id: 'supplier-id',
      supplier_name: 'Fournisseur Bénin',
      supplier_email: null,
      supplier_phone: null,
      purchase_number: 'ACH-2026-001',
      supplier_invoice_number: 'FOUR-55',
      purchase_date: '2026-11-10',
      due_date: '2026-12-10',
      subtotal: 1000,
      tax: 180,
      total: 1180,
      paid_amount: 500,
      status: 'PARTIALLY_PAID',
      voided_at: null,
      void_reason: null,
      notes: 'Commande urgente',
      items: [{
        id: 'item-id',
        product_id: null,
        description: 'Papier A4',
        quantity: 2,
        received_quantity: 2,
        returned_quantity: 0,
        unit_cost: 500,
        line_total: 1000,
        product_name: null,
      }],
      returns: [],
      payments: [{
        id: 'payment-id',
        amount: 500,
        paid_at: '2026-11-12',
        payment_method: 'mobile_money',
        reference: null,
        reversed_at: '2026-11-13T10:00:00Z',
        reversal_date: '2026-11-13',
        reversal_reason: 'Erreur',
      }],
    }

    expect(purchaseExportHeaders).toContain('Reste dû')
    expect(createPurchaseExportRows([purchase])[0]).toEqual([
      'ACH-2026-001',
      'FOUR-55',
      'Fournisseur Bénin',
      '2026-11-10',
      '2026-12-10',
      'Partiellement payée',
      '1000.00',
      '180.00',
      '1180.00',
      '500.00',
      '680.00',
      'Papier A4 (2 × 500.00)',
      '2026-11-12 · 500.00 Mobile Money · inversé',
      'Commande urgente',
    ])
  })

  it('marks voided purchases and keeps empty references blank', () => {
    const purchase = {
      id: 'purchase-id',
      supplier_id: 'supplier-id',
      supplier_name: 'Fournisseur',
      supplier_email: null,
      supplier_phone: null,
      purchase_number: 'ACH-2',
      supplier_invoice_number: null,
      purchase_date: '2026-11-10',
      due_date: null,
      subtotal: 0,
      tax: 0,
      total: 0,
      paid_amount: 0,
      status: 'UNPAID',
      voided_at: '2026-11-11T00:00:00Z',
      void_reason: 'Annulée',
      notes: null,
      items: [],
      returns: [],
      payments: [],
    } satisfies PurchaseRecord

    const row = createPurchaseExportRows([purchase])[0]
    expect(row[1]).toBe('')
    expect(row[4]).toBe('')
    expect(row[5]).toBe('Annulée')
  })
})
