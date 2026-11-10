export function userFacingError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  return !message || /sql|postgres|postgrest|supabase|rpc|relation|constraint|column|database/i.test(message) ? fallback : message
}

export function diagnosticErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    const fields: string[] = []
    for (const key of ['message', 'code', 'details', 'hint']) {
      const value = Reflect.get(error, key)
      if (typeof value === 'string' && value) fields.push(`${key}: ${value}`)
    }
    if (fields.length) return fields.join(' · ')
  }
  return 'Erreur non détaillée; consultez la console du navigateur.'
}
