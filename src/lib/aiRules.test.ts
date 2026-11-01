import { describe, expect, it } from 'vitest'
import { extractJsonObject, normalizeAiInvoiceDraft } from './aiRules'

describe('AI response helpers', () => {
  it('extracts JSON wrapped in a markdown code block', () => {
    expect(extractJsonObject('```json\n{"answer":"Bonjour"}\n```')).toEqual({ answer: 'Bonjour' })
  })

  it('normalizes invoice lines and ignores unsafe values', () => {
    expect(normalizeAiInvoiceDraft({
      title: 'Site web',
      lines: [
        { productId: 'product-1', description: 'Création', quantity: 2, unitPrice: 450000 },
        { description: '', quantity: 1, unitPrice: 10 },
        { description: 'Invalid', quantity: -1, unitPrice: 10 },
      ],
      notes: ['À vérifier'],
    })).toEqual({
      title: 'Site web',
      lines: [{ productId: 'product-1', description: 'Création', quantity: 2, unitPrice: 450000 }],
      notes: ['À vérifier'],
    })
  })
})
