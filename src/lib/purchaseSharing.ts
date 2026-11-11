import type { PurchaseRecord } from './data'

export function createPurchaseShareMessage(purchase: PurchaseRecord): string {
  const remaining = Math.max(0, purchase.total - purchase.paid_amount)
  const dueDate = purchase.due_date
    ? new Date(`${purchase.due_date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
    : 'Non renseignée'
  return [
    `Bonjour ${purchase.supplier_name},`,
    `Veuillez trouver le récapitulatif de notre facture d’achat ${purchase.purchase_number}${purchase.supplier_invoice_number ? ` (votre référence : ${purchase.supplier_invoice_number})` : ''}.`,
    `Date : ${new Date(`${purchase.purchase_date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`,
    `Échéance : ${dueDate}`,
    `Total : ${purchase.total.toLocaleString('fr-FR')} FCFA`,
    `Réglé : ${purchase.paid_amount.toLocaleString('fr-FR')} FCFA`,
    `Solde : ${remaining.toLocaleString('fr-FR')} FCFA`,
    'Cordialement.',
  ].join('\n')
}

export function createPurchaseEmailHref(purchase: PurchaseRecord): string | null {
  if (!purchase.supplier_email?.trim()) return null
  const subject = `Facture d’achat ${purchase.purchase_number}`
  return `mailto:${encodeURIComponent(purchase.supplier_email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(createPurchaseShareMessage(purchase))}`
}

export function createPurchaseWhatsAppHref(purchase: PurchaseRecord): string | null {
  const phone = purchase.supplier_phone?.replace(/\D/g, '') ?? ''
  if (!phone) return null
  const internationalPhone = phone.startsWith('00') ? phone.slice(2) : phone.startsWith('0') ? `229${phone.slice(1)}` : phone
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(createPurchaseShareMessage(purchase))}`
}
