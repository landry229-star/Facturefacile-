import type { PurchaseRecord } from './data'

const paymentLabels: Record<PurchaseRecord['payments'][number]['payment_method'], string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement',
  card: 'Carte',
  check: 'Chèque',
  other: 'Autre',
}

export const purchaseExportHeaders = [
  'Référence achat',
  'Référence fournisseur',
  'Fournisseur',
  'Date achat',
  'Échéance',
  'Statut',
  'Sous-total',
  'Taxe',
  'Total',
  'Montant réglé',
  'Reste dû',
  'Articles',
  'Règlements',
  'Notes',
]

export function createPurchaseExportRows(purchases: PurchaseRecord[]): string[][] {
  return purchases.map((purchase) => [
    purchase.purchase_number,
    purchase.supplier_invoice_number ?? '',
    purchase.supplier_name,
    purchase.purchase_date,
    purchase.due_date ?? '',
    purchase.voided_at ? 'Annulée' : purchase.status === 'UNPAID' ? 'À payer' : purchase.status === 'PARTIALLY_PAID' ? 'Partiellement payée' : 'Payée',
    purchase.subtotal.toFixed(2),
    purchase.tax.toFixed(2),
    purchase.total.toFixed(2),
    purchase.paid_amount.toFixed(2),
    Math.max(0, purchase.total - purchase.paid_amount).toFixed(2),
    purchase.items.map((item) => `${item.description} (${item.quantity} × ${item.unit_cost.toFixed(2)})`).join(' | '),
    purchase.payments.map((payment) => `${payment.paid_at} · ${payment.amount.toFixed(2)} ${paymentLabels[payment.payment_method]}${payment.reversed_at ? ' · inversé' : ''}`).join(' | '),
    purchase.notes ?? '',
  ])
}
