import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Action = 'assistant' | 'forecast' | 'expenses' | 'invoice'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const openAiKey = Deno.env.get('OPENAI_API_KEY')
const openAiModel = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'
const dailyRequestLimit = 20

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const number = (value: unknown) => Number(value) || 0

const monthKey = (date: string) => date.slice(0, 7)

const compact = (value: unknown, max = 240) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

function parseJson(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('Réponse structurée invalide.')
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

async function askOpenAi(system: string, prompt: string) {
  if (!openAiKey) throw new Error('OPENAI_API_KEY n’est pas configurée dans les secrets Supabase.')
  const result = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!result.ok) {
    console.error('OpenAI request failed', result.status)
    throw new Error('Le service IA est temporairement indisponible.')
  }
  const payload = await result.json()
  const content = payload.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('Le service IA n’a pas renvoyé de réponse.')
  return parseJson(content)
}

function summarizeInvoices(rows: any[]) {
  return rows.slice(0, 240).map((invoice) => {
    const payments = Array.isArray(invoice.payments) ? invoice.payments : []
    const paid = payments.reduce((sum: number, payment: any) => sum + number(payment.effective_amount), 0)
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
    return {
      number: compact(invoice.invoice_number, 50),
      date: invoice.issue_date,
      dueDate: invoice.due_date,
      status: invoice.status,
      total: number(invoice.total),
      paid,
      remaining: Math.max(0, number(invoice.total) - paid),
      client: compact(client?.name, 100),
    }
  })
}

function summarizeExpenses(rows: any[]) {
  return rows.slice(0, 240).map((expense) => ({
    label: compact(expense.label, 100),
    category: compact(expense.category, 50),
    date: expense.expense_date,
    amount: number(expense.amount),
    notes: compact(expense.notes, 120),
  }))
}

function summarizeMonthly(invoices: any[], expenses: any[]) {
  const monthly = new Map<string, { revenue: number; cashIn: number; expenses: number }>()
  invoices.forEach((invoice) => {
    const month = monthKey(invoice.issue_date)
    const current = monthly.get(month) ?? { revenue: 0, cashIn: 0, expenses: 0 }
    if (!['DRAFT', 'CANCELLED'].includes(invoice.status)) current.revenue += number(invoice.total)
    monthly.set(month, current)
    ;(invoice.payments ?? []).forEach((payment: any) => {
      if (!payment.payment_date) return
      const paymentMonth = monthKey(payment.payment_date)
      const paymentTotals = monthly.get(paymentMonth) ?? { revenue: 0, cashIn: 0, expenses: 0 }
      paymentTotals.cashIn += number(payment.effective_amount)
      monthly.set(paymentMonth, paymentTotals)
    })
  })
  expenses.forEach((expense) => {
    const month = monthKey(expense.expense_date)
    const current = monthly.get(month) ?? { revenue: 0, cashIn: 0, expenses: 0 }
    current.expenses += number(expense.amount)
    monthly.set(month, current)
  })
  return Array.from(monthly.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, values]) => ({ month, ...values }))
}

function normalizeInvoice(value: any, products: any[]) {
  const lines = Array.isArray(value?.lines) ? value.lines : []
  const normalized = lines.map((line: any) => {
    const byId = products.find((product) => product.id === line?.productId)
    const description = compact(line?.description, 180)
    const byName = products.find((product) => product.name.toLowerCase() === description.toLowerCase())
    const product = byId ?? byName
    const quantity = Math.min(Math.max(number(line?.quantity), 0.01), 100000)
    const unitPrice = product ? number(product.price) : Math.min(Math.max(number(line?.unitPrice), 0), 1_000_000_000)
    return {
      productId: product?.id ?? null,
      description: compact(product?.name ?? description, 180),
      quantity,
      unitPrice,
    }
  }).filter((line: any) => line.description && line.unitPrice >= 0)
  return {
    title: compact(value?.title, 120) || 'Facture générée',
    lines: normalized.slice(0, 30),
    notes: Array.isArray(value?.notes) ? value.notes.map((note: unknown) => compact(note, 180)).filter(Boolean).slice(0, 5) : [],
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Méthode non autorisée.' }, 405)
  if (!supabaseUrl || !supabaseAnonKey) return response({ error: 'Configuration Supabase incomplète.' }, 500)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return response({ error: 'Session requise.' }, 401)

  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return response({ error: 'Session invalide.' }, 401)

  let body: { action?: Action; businessId?: string; question?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return response({ error: 'Requête JSON invalide.' }, 400)
  }
  if (!body.businessId || !body.action || !['assistant', 'forecast', 'expenses', 'invoice'].includes(body.action)) {
    return response({ error: 'Requête IA incomplète.' }, 400)
  }
  if (body.action === 'assistant' && !compact(body.question, 2000)) return response({ error: 'Saisissez une question.' }, 400)
  if (body.action === 'invoice' && !compact(body.description, 4000)) return response({ error: 'Décrivez les éléments à facturer.' }, 400)
  if (body.question && body.question.length > 2000) return response({ error: 'Question trop longue.' }, 400)
  if (body.description && body.description.length > 4000) return response({ error: 'Description trop longue.' }, 400)

  const { data: role, error: roleError } = await userClient.rpc('get_business_role', { p_business_id: body.businessId })
  if (roleError || !['owner', 'admin', 'member', 'viewer'].includes(role)) return response({ error: 'Accès refusé.' }, 403)

  if (!openAiKey) return response({ error: 'Le service IA n’est pas configuré.' }, 503)
  if (!supabaseServiceRoleKey) return response({ error: 'La limite d’utilisation IA n’est pas configurée.' }, 503)
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
  const { data: quotaRows, error: quotaError } = await adminClient.rpc('consume_ai_assistant_quota', {
    p_user_id: userData.user.id,
    p_daily_limit: dailyRequestLimit,
  })
  if (quotaError) {
    console.error('Unable to check AI request quota.', quotaError.message)
    return response({ error: 'Impossible de vérifier la limite quotidienne de l’assistant IA.' }, 503)
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows
  if (!quota || typeof quota.used !== 'number' || typeof quota.allowed !== 'boolean') {
    return response({ error: 'La limite quotidienne de l’assistant IA a retourné une réponse invalide.' }, 503)
  }
  const resetsAt = new Date()
  resetsAt.setUTCHours(24, 0, 0, 0)
  const usage = {
    used: quota.used,
    limit: quota.daily_limit,
    remaining: Math.max(0, quota.daily_limit - quota.used),
    resetsAt: resetsAt.toISOString(),
  }
  if (!quota.allowed) {
    return response({
      error: `La limite de ${quota.daily_limit} requêtes IA par jour et par compte est atteinte. Réessayez après le ${resetsAt.toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC.`,
      usage,
    }, 429)
  }

  let invoices: any[] = []
  let expenses: any[] = []
  let products: any[] = []
  let invoiceTruncated = false
  let expenseTruncated = false
  let productTruncated = false
  if (body.action === 'assistant' || body.action === 'forecast') {
    const invoiceResult = await userClient.from('invoices')
      .select('invoice_number, issue_date, due_date, total, status, clients(name), payments(effective_amount, payment_date)')
      .eq('business_id', body.businessId).order('issue_date', { ascending: false }).limit(241)
    if (invoiceResult.error) return response({ error: 'Impossible de charger les factures de votre entreprise.' }, 500)
    invoiceTruncated = (invoiceResult.data ?? []).length > 240
    invoices = (invoiceResult.data ?? []).slice(0, 240)
  }
  if (body.action === 'assistant' || body.action === 'forecast' || body.action === 'expenses') {
    const expenseResult = await userClient.from('expenses')
      .select('label, amount, expense_date, category, notes')
      .eq('business_id', body.businessId).order('expense_date', { ascending: false }).limit(241)
    if (expenseResult.error) return response({ error: 'Impossible de charger les dépenses de votre entreprise.' }, 500)
    expenseTruncated = (expenseResult.data ?? []).length > 240
    expenses = (expenseResult.data ?? []).slice(0, 240)
  }
  if (body.action === 'invoice') {
    const productResult = await userClient.from('products')
      .select('id, name, price, product_type')
      .eq('business_id', body.businessId).order('name').limit(241)
    if (productResult.error) return response({ error: 'Impossible de charger le catalogue de votre entreprise.' }, 500)
    productTruncated = (productResult.data ?? []).length > 240
    products = (productResult.data ?? []).slice(0, 240)
  }
  const invoiceSummary = summarizeInvoices(invoices)
  const expenseSummary = summarizeExpenses(expenses)
  const monthly = summarizeMonthly(invoices, expenses)
  const dataSummary = {
    invoices: invoiceSummary.length,
    expenses: expenseSummary.length,
    products: products.length,
    months: monthly.length,
    truncated: invoiceTruncated || expenseTruncated || productTruncated,
  }

  try {
    if (body.action === 'assistant') {
      const result = await askOpenAi(
        'Tu es un assistant financier prudent pour une PME béninoise. Réponds en français, clairement et sans inventer de chiffres. Donne des conseils, pas une décision comptable. Retourne uniquement un JSON {"answer":"..."} avec une réponse courte et des montants en FCFA.',
        `Question de l’utilisateur : ${compact(body.question, 2000)}\nDonnées de factures : ${JSON.stringify(invoiceSummary)}\nDonnées de dépenses : ${JSON.stringify(expenseSummary)}`,
      )
      return response({ action: body.action, answer: compact(result?.answer, 5000) || 'Je n’ai pas assez de données pour répondre.', usage, dataSummary })
    }

    if (body.action === 'forecast') {
      const result = await askOpenAi(
        'Tu es un analyste financier prudent. À partir des séries historiques, produis une prévision simple sur les 3 prochains mois. revenue est le total des factures émises hors brouillons et annulations, classées par date d’émission. cashIn est le montant net des paiements rapprochés, classés par date de paiement. expenses correspond aux dépenses enregistrées, classées par date de dépense. netCashFlow doit être égal à cashIn moins expenses. N’assimile jamais le chiffre facturé aux encaissements. Retourne uniquement un JSON avec summary (string), confidence (low|medium|high), months (array de {month,revenue,cashIn,expenses,netCashFlow}), assumptions (array de strings). Les nombres sont en FCFA. Ne fabrique pas de solde de trésorerie initial : netCashFlow est le flux mensuel et cashIn les encaissements attendus.',
        `Historique mensuel (12 derniers mois) : ${JSON.stringify(monthly)}\nFactures récentes : ${JSON.stringify(invoiceSummary.slice(0, 100))}`,
      )
      return response({
        action: body.action,
        usage,
        dataSummary,
        forecast: {
          summary: compact(result?.summary, 1200) || 'Prévision indicative basée sur l’historique disponible.',
          confidence: ['low', 'medium', 'high'].includes(result?.confidence) ? result.confidence : 'low',
          months: Array.isArray(result?.months) ? result.months.slice(0, 3).map((item: any) => {
            const cashIn = Math.max(0, number(item?.cashIn))
            const expenses = Math.max(0, number(item?.expenses))
            return {
              month: compact(item?.month, 30),
              revenue: Math.max(0, number(item?.revenue)),
              cashIn,
              expenses,
              netCashFlow: cashIn - expenses,
            }
          }).filter((item: any) => item.month) : [],
          assumptions: Array.isArray(result?.assumptions) ? result.assumptions.map((item: unknown) => compact(item, 300)).filter(Boolean).slice(0, 6) : [],
        },
      })
    }

    if (body.action === 'expenses') {
      const result = await askOpenAi(
        'Tu es un conseiller de gestion pour une PME béninoise. Analyse uniquement les dépenses réellement fournies, sans inventer de catégorie ni de montant. Retourne uniquement un JSON avec summary (string), categories (array de {category,amount,share}), recommendations (array de {title,detail,priority} avec priority high|medium|low). Les montants sont en FCFA.',
        `Dépenses : ${JSON.stringify(expenseSummary)}`,
      )
      return response({
        action: body.action,
        usage,
        dataSummary,
        analysis: {
          summary: compact(result?.summary, 1500) || 'Analyse basée sur les dépenses enregistrées.',
          categories: Array.isArray(result?.categories) ? result.categories.slice(0, 12).map((item: any) => ({ category: compact(item?.category, 80), amount: Math.max(0, number(item?.amount)), share: Math.min(100, Math.max(0, number(item?.share))) })).filter((item: any) => item.category) : [],
          recommendations: Array.isArray(result?.recommendations) ? result.recommendations.slice(0, 8).map((item: any) => ({ title: compact(item?.title, 120), detail: compact(item?.detail, 500), priority: ['high', 'medium', 'low'].includes(item?.priority) ? item.priority : 'medium' })).filter((item: any) => item.title && item.detail) : [],
        },
      })
    }

    const result = await askOpenAi(
      'Tu aides à préparer une facture, sans jamais la créer ni l’envoyer. À partir de la description et du catalogue, retourne uniquement un JSON avec title (string), lines (array de {productId,description,quantity,unitPrice}) et notes (array de strings). Utilise les productId et prix du catalogue quand un produit correspond. Pour un élément absent du catalogue, productId doit être null et propose un prix à vérifier. Les quantités et montants doivent être positifs.',
      `Description de la facture : ${compact(body.description, 4000)}\nCatalogue : ${JSON.stringify(products.map((product) => ({ productId: product.id, name: product.name, price: number(product.price), type: product.product_type })))}`,
    )
    return response({ action: body.action, invoice: normalizeInvoice(result, products), usage, dataSummary })
  } catch (error) {
    console.error('AI action failed', body.action, error instanceof Error ? error.message : error)
    return response({ error: error instanceof Error ? error.message : 'Le service IA a rencontré une erreur.' }, 502)
  }
})
