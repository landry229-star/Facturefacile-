import { describe, expect, it } from 'vitest'
import { addDateDays, formatBusinessDateKey, formatInvoiceNumberExample, getBusinessDateKey } from './businessPreferences'

describe('business preferences', () => {
  it('computes business dates in the selected timezone around UTC midnight', () => {
    expect(getBusinessDateKey(new Date('2026-10-18T23:30:00.000Z'), 'Africa/Porto-Novo')).toBe('2026-10-19')
    expect(getBusinessDateKey(new Date('2026-10-18T23:30:00.000Z'), 'UTC')).toBe('2026-10-18')
  })

  it('adds due days to calendar dates without timezone drift', () => {
    expect(addDateDays('2026-01-31', 30)).toBe('2026-03-02')
    expect(addDateDays('2026-10-19', 0)).toBe('2026-10-19')
  })

  it('formats date-only values without shifting the selected day', () => {
    expect(formatBusinessDateKey('2026-10-19', 'Africa/Porto-Novo')).toBe('19/10/2026')
  })

  it('previews yearly and continuous invoice number formats', () => {
    expect(formatInvoiceNumberExample('fac', true, 5, 2026)).toBe('FAC-2026-00001')
    expect(formatInvoiceNumberExample('INV', false, 3, 2026, 14)).toBe('INV-014')
  })
})
