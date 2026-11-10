import { describe, expect, it } from 'vitest'
import { evaluateDgiMockCheck } from './dgiMock'
import type { DgiMockIfuRecord } from './data'

const record: DgiMockIfuRecord = {
  ifu: '9999999990001',
  raison_sociale: 'FICTIF - Atelier Soleil (simulation)',
  regime_fiscal: 'TPS',
  adresse: 'Adresse fictive, Cotonou',
  telephone: '+229 00 00 00 01',
  created_at: '2026-11-09T00:00:00.000Z',
}

describe('evaluateDgiMockCheck', () => {
  it('requires a name, 13-digit IFU, and fiscal regime', () => {
    const result = evaluateDgiMockCheck({ name: '', taxId: '123', fiscalRegime: null }, [record])

    expect(result.status).toBe('incomplete')
    expect(result.details).toHaveLength(3)
  })

  it('returns a match only when the fictitious row agrees with the profile', () => {
    const result = evaluateDgiMockCheck({
      name: 'FICTIF Atelier Soleil simulation',
      taxId: record.ifu,
      fiscalRegime: 'TPS',
    }, [record])

    expect(result.status).toBe('match')
  })

  it('reports a simulated mismatch when the business name differs', () => {
    const result = evaluateDgiMockCheck({
      name: 'Autre entreprise fictive',
      taxId: record.ifu,
      fiscalRegime: 'TPS',
    }, [record])

    expect(result.status).toBe('mismatch')
    expect(result.details).toContain('La raison sociale diffère de la fiche fictive.')
  })

  it('reports a simulated mismatch when the fiscal regime differs', () => {
    const result = evaluateDgiMockCheck({
      name: record.raison_sociale,
      taxId: record.ifu,
      fiscalRegime: 'REEL',
    }, [record])

    expect(result.status).toBe('mismatch')
    expect(result.details).toContain('Le régime fiscal diffère de la fiche fictive.')
  })

  it('does not imply that an IFU absent from the demo registry is invalid', () => {
    const result = evaluateDgiMockCheck({
      name: 'Entreprise fictive',
      taxId: '9999999999999',
      fiscalRegime: 'TPS',
    }, [record])

    expect(result.status).toBe('no_mock_match')
    expect(result.details[0]).toContain('ne permet pas de conclure')
  })
})
