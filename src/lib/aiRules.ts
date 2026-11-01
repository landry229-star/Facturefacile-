export type AiInvoiceLine = {
  productId: string | null
  description: string
  quantity: number
  unitPrice: number
}

export type AiInvoiceDraft = {
  title: string
  lines: AiInvoiceLine[]
  notes: string[]
}

export function extractJsonObject(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('La réponse IA n’est pas un JSON valide.')
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

export function normalizeAiInvoiceDraft(value: unknown): AiInvoiceDraft {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const rawLines = Array.isArray(input.lines) ? input.lines : []
  const lines = rawLines.map((line): AiInvoiceLine | null => {
    if (!line || typeof line !== 'object') return null
    const item = line as Record<string, unknown>
    const description = typeof item.description === 'string' ? item.description.trim() : ''
    const quantity = Number(item.quantity)
    const unitPrice = Number(item.unitPrice)
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return null
    return {
      productId: typeof item.productId === 'string' && item.productId ? item.productId : null,
      description,
      quantity: Math.min(quantity, 100000),
      unitPrice: Math.min(unitPrice, 1_000_000_000),
    }
  }).filter((line): line is AiInvoiceLine => line !== null).slice(0, 30)

  return {
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'Facture générée',
    lines,
    notes: Array.isArray(input.notes)
      ? input.notes.filter((note): note is string => typeof note === 'string').map((note) => note.trim()).filter(Boolean).slice(0, 5)
      : [],
  }
}
