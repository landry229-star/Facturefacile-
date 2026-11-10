import { describe, expect, it } from 'vitest'
import { getBeninDocumentPdfCopy, getBeninTaxLabel, getDefaultBeninDocumentType, isDgiSimulationEligible } from './beninDocument'

describe('Bénin document labels', () => {
  const standardCopy = { title: 'FACTURE', totalLabel: 'TOTAL À PAYER', closing: 'Facture commerciale.', payment: 'À régler.' }
  const proformaCopy = { title: 'FACTURE PROFORMA', totalLabel: 'TOTAL ESTIMATIF', closing: 'Proforma.', payment: 'Estimation.' }

  it('uses the selected internal document type in place of the generic invoice title', () => {
    expect(getBeninDocumentPdfCopy('recu_vente', standardCopy, proformaCopy).title).toBe('REÇU DE VENTE INTERNE')
    expect(getBeninDocumentPdfCopy('bon_livraison', standardCopy, proformaCopy).totalLabel).toBe('MONTANT INDICATIF')
  })

  it('preserves the generic invoice title when no Bénin type has been saved', () => {
    expect(getBeninDocumentPdfCopy(null, proformaCopy, proformaCopy)).toBe(proformaCopy)
    expect(getBeninDocumentPdfCopy('proforma', standardCopy, proformaCopy).totalLabel).toBe('TOTAL ESTIMATIF')
  })

  it('defaults proformas to the proforma document type and other invoices to internal invoices', () => {
    expect(getDefaultBeninDocumentType('PROFORMA')).toBe('proforma')
    expect(getDefaultBeninDocumentType('STANDARD')).toBe('facture_interne')
  })

  it('only allows simulation for issued non-proforma documents', () => {
    expect(isDgiSimulationEligible({ status: 'PAID', invoice_type: 'STANDARD', benin_document_type: 'recu_vente' })).toBe(true)
    expect(isDgiSimulationEligible({ status: 'DRAFT', invoice_type: 'STANDARD', benin_document_type: 'facture_interne' })).toBe(false)
    expect(isDgiSimulationEligible({ status: 'SENT', invoice_type: 'PROFORMA', benin_document_type: 'proforma' })).toBe(false)
    expect(isDgiSimulationEligible({ status: 'PAID', invoice_type: 'STANDARD', benin_document_type: 'proforma' })).toBe(false)
    expect(isDgiSimulationEligible({ status: 'CANCELLED', invoice_type: 'STANDARD', benin_document_type: 'recu_vente' })).toBe(false)
    expect(isDgiSimulationEligible({ status: 'PAID', invoice_type: 'STANDARD', benin_document_type: 'facture_interne', dgi_nim: 'NIM-MANUEL' })).toBe(false)
    expect(isDgiSimulationEligible({ status: 'PAID', invoice_type: 'STANDARD', benin_document_type: 'facture_interne', is_dgi_mock: true, dgi_nim: 'MOCK-NIM' })).toBe(true)
  })

  it('labels the recorded tax without implying that it was independently calculated', () => {
    expect(getBeninTaxLabel('TPS')).toBe('Taxe enregistrée (TPS)')
    expect(getBeninTaxLabel('REEL')).toBe('TVA enregistrée (régime réel)')
  })
})
