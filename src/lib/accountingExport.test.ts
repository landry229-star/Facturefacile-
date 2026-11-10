import { describe, expect, it } from 'vitest'
import { createAccountingExportRows, serializeAccountingCsv } from './accountingExport'

describe('accounting export', () => {
  it('maps stored fiscal metadata and reconciled payment data without inventing official references', () => {
    const rows = createAccountingExportRows([{
      invoice_number: 'FAC-2026-00001',
      issue_date: '2026-11-03',
      invoice_type: 'STANDARD',
      subtotal: 500_000,
      discount: 10_000,
      tax: 88_200,
      total: 578_200,
      status: 'PARTIALLY_PAID',
      reg_fiscal_emetteur: 'REEL',
      benin_document_type: 'facture_interne',
      dgi_nim: 'NIM-TEST-001',
      dgi_signature: 'SIG-TEST-001',
      is_dgi_mock: true,
      clients: { name: 'Société Bénin', tax_id: '3202687654321' },
      payments: [
        { amount: 100_000, effective_amount: 100_000, payment_date: '2026-11-04', method: 'mobile_money', reference: 'MTN-TX-54', status: 'reconciled', transaction_type: 'receipt', momo_reconciliations: [{ provider: 'mtn', transaction_id: 'MTN-TX-54', status: 'reconciled' }] },
        { amount: 20_000, effective_amount: 0, payment_date: '2026-11-05', method: 'cash', reference: null, status: 'pending', transaction_type: 'receipt' },
        { amount: 10_000, effective_amount: -10_000, payment_date: '2026-11-06', method: 'mobile_money', reference: 'MTN-REF-55', status: 'reconciled', transaction_type: 'refund', momo_reconciliations: [{ provider: 'mtn', transaction_id: 'MTN-REF-55', status: 'reconciled' }] },
      ],
    }], 'Mention configurée par l’entreprise')

    expect(rows[0]).toEqual([
      '03/11/2026',
      'FAC-2026-00001',
      'FACTURE_INTERNE',
      'REEL',
      'Société Bénin',
      '3202687654321',
      '490000.00',
      '88200.00',
      '578200.00',
      'MTN Mobile Money | Espèces',
      'MTN-TX-54 | MTN-REF-55',
      '04/11/2026 | 05/11/2026 | 06/11/2026',
      '90000.00',
      'Rapproché | En attente',
      'NIM-TEST-001',
      'SIMULATION · SIG-TEST-001',
      'Mention configurée par l’entreprise',
      'Partiellement payée',
    ])
  })

  it('uses the business regime when the invoice has no fiscal snapshot', () => {
    const [row] = createAccountingExportRows([{
      invoice_number: 'FAC-2026-00002',
      issue_date: '2026-11-03',
      invoice_type: 'STANDARD',
      subtotal: 100,
      discount: 0,
      tax: 0,
      total: 100,
      status: 'SENT',
      reg_fiscal_emetteur: null,
      benin_document_type: null,
      dgi_nim: null,
      dgi_signature: null,
      is_dgi_mock: false,
      clients: null,
      payments: [],
    }], null, 'TPS')

    expect(row[3]).toBe('TPS')
    expect(row[14]).toBe('')
    expect(row[15]).toBe('')
  })

  it('serializes semicolon-delimited UTF-8 BOM CSV with quoting and formula-safe text', () => {
    const row = Array.from({ length: 18 }, () => '')
    row[0] = '01/11/2026'
    row[1] = '=HYPERLINK("https://example.test","client")'
    const csv = serializeAccountingCsv([row])

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"DATE_PIECE";"REF_INTERNE";"TYPE_PIECE"')
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"",""client"")"`)
    expect(csv).toContain('\r\n')
  })
})
