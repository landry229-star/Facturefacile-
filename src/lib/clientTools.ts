import type { ClientRecord } from './data'

export type ImportedClient = {
  name: string
  email: string
  phone: string
  address: string
  clientType: 'individual' | 'company'
  notes: string
}

export type ClientDuplicateMatch = {
  client: ClientRecord
  fields: ('email' | 'phone')[]
}

const normalizeHeader = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

const readField = (row: Record<string, unknown>, aliases: string[]) => {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]))
  for (const alias of aliases) {
    const value = normalized.get(normalizeHeader(alias))
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim()
  }
  return ''
}

const normalizePhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, '') ?? ''
  if (digits.startsWith('00229') && digits.length > 8) return digits.slice(5)
  if (digits.startsWith('229') && digits.length > 8) return digits.slice(3)
  return digits
}

export function parseClientImportRows(rows: Record<string, unknown>[]): ImportedClient[] {
  return rows.map((row) => {
    const type = readField(row, ['Type', 'Type client', 'client_type']).toLowerCase()
    const clientType: ImportedClient['clientType'] = /entreprise|company|professionnel/.test(type) ? 'company' : 'individual'
    return {
      name: readField(row, ['Nom', 'Nom du client', 'Raison sociale', 'name']),
      email: readField(row, ['Email', 'E-mail', 'Adresse email', 'Courriel']),
      phone: readField(row, ['Téléphone', 'Telephone', 'Phone', 'Mobile']),
      address: readField(row, ['Adresse', 'Address']),
      clientType,
      notes: readField(row, ['Notes', 'Note', 'Commentaires']),
    }
  }).filter((client) => client.name.length > 0)
}

export function findClientDuplicates(
  candidate: Pick<ImportedClient, 'email' | 'phone'>,
  clients: ClientRecord[],
  excludeClientId?: string,
): ClientDuplicateMatch[] {
  const email = candidate.email.trim().toLocaleLowerCase('fr-FR')
  const phone = normalizePhone(candidate.phone)
  if (!email && !phone) return []

  return clients
    .filter((client) => client.id !== excludeClientId)
    .map((client) => {
      const fields: ClientDuplicateMatch['fields'] = []
      if (email && client.email?.trim().toLocaleLowerCase('fr-FR') === email) fields.push('email')
      const existingPhone = normalizePhone(client.phone)
      if (phone && existingPhone && existingPhone === phone) fields.push('phone')
      return { client, fields }
    })
    .filter((match) => match.fields.length > 0)
}
