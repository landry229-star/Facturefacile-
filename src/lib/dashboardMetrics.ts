export type ComparisonPeriods = {
  current: { from: string; to: string; label: string }
  previous: { from: string; to: string; label: string }
}

export type DashboardInvoiceStatus = 'Brouillon' | 'Payée' | 'En attente' | 'En retard' | 'Annulée'

export function getDashboardInvoiceStatus(status: string, dueDate: string | null, today: string): DashboardInvoiceStatus {
  if (status === 'DRAFT') return 'Brouillon'
  if (status === 'PAID') return 'Payée'
  if (status === 'CANCELLED') return 'Annulée'
  if (status === 'OVERDUE' || (dueDate !== null && dueDate < today)) return 'En retard'
  return 'En attente'
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatRangeLabel = (start: Date, end: Date) => {
  const formatDayMonth = (date: Date) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date)
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()
  const yearSuffix = startYear === endYear ? ` ${endYear}` : ` ${startYear}–${endYear}`
  return `${formatDayMonth(start)}–${formatDayMonth(end)}${yearSuffix}`
}

export function getMonthToDateComparisonPeriods(now = new Date()): ComparisonPeriods {
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  const previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), previousMonthDays) + 1)
  const currentInclusiveEnd = new Date(currentEnd)
  currentInclusiveEnd.setDate(currentInclusiveEnd.getDate() - 1)
  const previousInclusiveEnd = new Date(previousEnd)
  previousInclusiveEnd.setDate(previousInclusiveEnd.getDate() - 1)

  return {
    current: {
      from: toDateKey(currentStart),
      to: toDateKey(currentEnd),
      label: formatRangeLabel(currentStart, currentInclusiveEnd),
    },
    previous: {
      from: toDateKey(previousStart),
      to: toDateKey(previousEnd),
      label: formatRangeLabel(previousStart, previousInclusiveEnd),
    },
  }
}

export function formatPeriodComparison(current: number, previous: number): { label: string; trend: 'up' | 'down' } {
  const difference = current - previous
  const trend = difference >= 0 ? 'up' : 'down'
  if (previous === 0) {
    return {
      label: current === 0 ? 'Stable (0)' : `Nouveau · +${current.toLocaleString('fr-FR')}`,
      trend,
    }
  }

  const percent = Math.round((difference / previous) * 100)
  return {
    label: `${percent > 0 ? '+' : ''}${percent}% vs période précédente`,
    trend,
  }
}
