export const businessTimeZones = [
  { value: 'Africa/Porto-Novo', label: 'Bénin (Africa/Porto-Novo)' },
  { value: 'Africa/Abidjan', label: 'Côte d’Ivoire (Africa/Abidjan)' },
  { value: 'Africa/Lagos', label: 'Nigeria (Africa/Lagos)' },
  { value: 'UTC', label: 'UTC' },
] as const

export function getBusinessDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function addDateDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function formatBusinessDateKey(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function formatInvoiceNumberExample(prefix: string, includeYear: boolean, width: number, year: number, sequence = 1) {
  const parts = [prefix.trim().toUpperCase()]
  if (includeYear) parts.push(String(year))
  parts.push(String(sequence).padStart(width, '0'))
  return parts.join('-')
}
