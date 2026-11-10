import type { InvoiceDocumentType } from './data'

export type BeninDocumentType = 'proforma' | 'recu_vente' | 'bon_livraison' | 'facture_interne'

export const beninDocumentTypeLabels: Record<BeninDocumentType, string> = {
  proforma: 'Facture proforma',
  recu_vente: 'Reçu de vente interne',
  bon_livraison: 'Bon de livraison',
  facture_interne: 'Facture interne',
}

export function isBeninDocumentType(value: string): value is BeninDocumentType {
  return Object.hasOwn(beninDocumentTypeLabels, value)
}

export type InvoicePdfCopy = { title: string; totalLabel: string; closing: string; payment: string }

export function getBeninDocumentPdfCopy(
  documentType: BeninDocumentType | null | undefined,
  fallback: InvoicePdfCopy,
  proforma: InvoicePdfCopy,
): InvoicePdfCopy {
  if (!documentType) return fallback
  if (documentType === 'proforma') return proforma
  if (documentType === 'recu_vente') {
    return {
      title: 'REÇU DE VENTE INTERNE',
      totalLabel: 'TOTAL DU REÇU',
      closing: 'Reçu de vente à usage de gestion interne.',
      payment: 'Ce reçu ne constitue pas une confirmation de normalisation e-MECeF.',
    }
  }
  if (documentType === 'bon_livraison') {
    return {
      title: 'BON DE LIVRAISON',
      totalLabel: 'MONTANT INDICATIF',
      closing: 'Bon de livraison à usage de gestion interne.',
      payment: 'La présente pièce ne constitue pas une facture normalisée.',
    }
  }
  return {
    title: 'FACTURE INTERNE',
    totalLabel: 'TOTAL À PAYER',
    closing: 'Facture interne de gestion.',
    payment: 'Cette pièce ne constitue pas une confirmation de normalisation e-MECeF.',
  }
}

export function getBeninTaxLabel(fiscalRegime: 'TPS' | 'REEL' | null | undefined) {
  if (fiscalRegime === 'TPS') return 'Taxe enregistrée (TPS)'
  if (fiscalRegime === 'REEL') return 'TVA enregistrée (régime réel)'
  return 'TVA / taxe enregistrée'
}

export function getDefaultBeninDocumentType(invoiceType: InvoiceDocumentType): BeninDocumentType {
  return invoiceType === 'PROFORMA' ? 'proforma' : 'facture_interne'
}

export function isDgiSimulationEligible(invoice: {
  status: string
  invoice_type: InvoiceDocumentType
  benin_document_type: BeninDocumentType | null
  is_dgi_mock?: boolean
  dgi_nim?: string | null
  dgi_counters?: string | null
  dgi_signature?: string | null
}): boolean {
  return !['DRAFT', 'CANCELLED'].includes(invoice.status)
    && invoice.invoice_type !== 'PROFORMA'
    && invoice.benin_document_type !== 'proforma'
    && (invoice.is_dgi_mock === true || ![invoice.dgi_nim, invoice.dgi_counters, invoice.dgi_signature].some(Boolean))
}
