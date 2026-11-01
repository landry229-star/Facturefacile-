import { supabase } from './supabase'
import type { AiInvoiceDraft } from './aiRules'

export type AiAction = 'assistant' | 'forecast' | 'expenses' | 'invoice'

export type AiForecast = {
  summary: string
  confidence: 'low' | 'medium' | 'high'
  months: { month: string; revenue: number; cashIn: number; expenses: number; netCashFlow: number }[]
  assumptions: string[]
}

export type AiExpenseAnalysis = {
  summary: string
  categories: { category: string; amount: number; share: number }[]
  recommendations: { title: string; detail: string; priority: 'high' | 'medium' | 'low' }[]
}

export type AiUsage = {
  used: number
  limit: number
  remaining: number
  resetsAt: string
}

export type AiDataSummary = {
  invoices: number
  expenses: number
  products: number
  months: number
  truncated: boolean
}

export type AiResponse = {
  action: AiAction
  answer?: string
  forecast?: AiForecast
  analysis?: AiExpenseAnalysis
  invoice?: AiInvoiceDraft
  usage: AiUsage
  dataSummary: AiDataSummary
}

export async function runAiAction(
  action: AiAction,
  businessId: string,
  options: { question?: string; description?: string } = {},
): Promise<AiResponse> {
  const result = await supabase.functions.invoke('ai-assistant', {
    body: { action, businessId, ...options },
  })
  if (result.error) {
    const context = result.error.context
    if (context instanceof Response) {
      const body = await context.text()
      try {
        const parsed = JSON.parse(body) as { error?: string }
        throw new Error(parsed.error || result.error.message)
      } catch (error) {
        if (error instanceof Error && error.message !== body) throw error
        throw new Error(body || result.error.message)
      }
    }
    throw result.error
  }
  if (!result.data || typeof result.data !== 'object') throw new Error('La réponse de l’assistant IA est vide.')
  const data = result.data as Partial<AiResponse>
  if (
    !data.usage ||
    !Number.isInteger(data.usage.used) ||
    !Number.isInteger(data.usage.limit) ||
    !Number.isInteger(data.usage.remaining) ||
    typeof data.usage.resetsAt !== 'string' ||
    !Number.isFinite(Date.parse(data.usage.resetsAt)) ||
    !data.dataSummary ||
    !Number.isInteger(data.dataSummary.invoices) ||
    !Number.isInteger(data.dataSummary.expenses) ||
    !Number.isInteger(data.dataSummary.products) ||
    !Number.isInteger(data.dataSummary.months) ||
    typeof data.dataSummary.truncated !== 'boolean'
  ) {
    throw new Error('La réponse IA ne contient pas ses informations de quota et de données. Redéployez la fonction Edge ai-assistant.')
  }
  return data as AiResponse
}
