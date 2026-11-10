import type { PaymentRecord } from './data'

export function paymentMethodLabel(method: string) {
  return ({ cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement bancaire', card: 'Carte', check: 'Chèque' } as Record<string, string>)[method] ?? method
}

export function paymentStatusLabel(status: PaymentRecord['status']) {
  return status === 'reconciled' ? 'Rapproché' : status === 'cancelled' ? 'Annulé' : 'À rapprocher'
}
