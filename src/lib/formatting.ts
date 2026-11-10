export const formatMoney = (amount: number, currency = 'FCFA') =>
  `${new Intl.NumberFormat('fr-FR', { useGrouping: true, maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0).replace(/[\u202f\u00a0/]/g, ' ')} ${currency}`

export const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  const csv = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
