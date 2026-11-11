import { describe, expect, it } from 'vitest'
import { createPurchaseEmailHref, createPurchaseShareMessage, createPurchaseWhatsAppHref } from './purchaseSharing'
import type { PurchaseRecord } from './data'

const purchase: PurchaseRecord = {
  id: 'purchase-id',
  supplier_id: 'supplier-id',
  supplier_name: 'Fournisseur Bénin',
  supplier_email: 'achats@example.bj',
  supplier_phone: '+229 97 00 00 00',
  purchase_number: 'ACH-2026-001',
  supplier_invoice_number: 'F-12',
  purchase_date: '2026-11-10',
  due_date: '2026-12-10',
  subtotal: 1000,
  tax: 0,
  total: 1000,
  paid_amount: 250,
  status: 'PARTIALLY_PAID',
  voided_at: null,
  void_reason: null,
  notes: null,
  items: [],
  returns: [],
  payments: [],
}

describe('purchase sharing', () => {
  it('creates a prefilled email draft addressed to the supplier', () => {
    const href = createPurchaseEmailHref(purchase)
    expect(href).toContain('mailto:achats%40example.bj')
    expect(decodeURIComponent(href ?? '')).toContain('Facture d’achat ACH-2026-001')
    expect(decodeURIComponent(href ?? '')).toContain('Solde : 750 FCFA')
  })

  it('creates a WhatsApp draft with a Benin international phone number', () => {
    const href = createPurchaseWhatsAppHref(purchase)
    expect(href).toContain('https://wa.me/22997000000?text=')
    expect(decodeURIComponent(href ?? '')).toContain('Fournisseur Bénin')
  })

  it('does not create share links when the supplier contact is unavailable', () => {
    const withoutContacts = { ...purchase, supplier_email: null, supplier_phone: null }
    expect(createPurchaseEmailHref(withoutContacts)).toBeNull()
    expect(createPurchaseWhatsAppHref(withoutContacts)).toBeNull()
    expect(createPurchaseShareMessage(purchase)).toContain('Échéance')
  })
})
