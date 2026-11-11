import { describe, expect, it } from 'vitest'
import { normalizeExpenseFiscalAmounts, protectCsvFormula } from './expenseFiscal'

describe('normalizeExpenseFiscalAmounts', () => {
  it('leaves the fiscal breakdown unknown when no values were entered', () => {
    expect(normalizeExpenseFiscalAmounts(1000, '', '')).toEqual({ taxableAmount: null, vatAmount: null })
  })

  describe('protectCsvFormula', () => {
    it('prefixes formula-like text before including it in a CSV export', () => {
      expect(protectCsvFormula('=HYPERLINK("https://example.test")')).toBe('\'=HYPERLINK("https://example.test")')
      expect(protectCsvFormula('  @SUM(A1:A2)')).toBe('\'  @SUM(A1:A2)')
    })

    it('leaves normal references and numeric values unchanged', () => {
      expect(protectCsvFormula('ED0300E386')).toBe('ED0300E386')
      expect(protectCsvFormula('1000.00')).toBe('1000.00')
    })
  })

  it('derives VAT from the taxable amount and TTC total', () => {
    expect(normalizeExpenseFiscalAmounts(1000, '847', '')).toEqual({ taxableAmount: 847, vatAmount: 153 })
  })

  it('derives the taxable amount from VAT and TTC total', () => {
    expect(normalizeExpenseFiscalAmounts(1000, '', '153')).toEqual({ taxableAmount: 847, vatAmount: 153 })
  })

  it('rejects a fiscal breakdown that does not match the TTC total', () => {
    expect(() => normalizeExpenseFiscalAmounts(1000, '800', '153')).toThrow('La base HT et la TVA doivent correspondre au montant TTC.')
  })

  it('rejects negative values', () => {
    expect(() => normalizeExpenseFiscalAmounts(1000, '-1', '')).toThrow('La base HT et la TVA doivent être des montants positifs ou nuls.')
  })
})
