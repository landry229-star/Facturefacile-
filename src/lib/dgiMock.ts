import type { DgiMockIfuRecord } from './data'

export type DgiMockCheckStatus = 'incomplete' | 'no_mock_match' | 'match' | 'mismatch'

export type DgiMockCheckResult = {
  status: DgiMockCheckStatus
  title: string
  details: string[]
}

export type DgiMockCheckInput = {
  name: string
  taxId: string | null
  fiscalRegime: string | null
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function evaluateDgiMockCheck(
  input: DgiMockCheckInput,
  records: DgiMockIfuRecord[],
): DgiMockCheckResult {
  const missing: string[] = []
  const name = input.name.trim()
  const taxId = input.taxId?.trim() ?? ''

  if (!name) missing.push('Raison sociale absente.')
  if (!/^\d{13}$/.test(taxId)) missing.push('IFU incomplet ou au mauvais format.')
  if (!input.fiscalRegime) missing.push('Régime fiscal non renseigné.')

  if (missing.length) {
    return {
      status: 'incomplete',
      title: 'Dossier incomplet (simulation)',
      details: missing,
    }
  }

  const record = records.find((item) => item.ifu.trim() === taxId)
  if (!record) {
    return {
      status: 'no_mock_match',
      title: 'Aucune fiche correspondante dans le registre fictif',
      details: ['Ce résultat ne permet pas de conclure sur l’existence ou la validité de l’IFU auprès de la DGI.'],
    }
  }

  const differences: string[] = []
  if (normalizeText(record.raison_sociale) !== normalizeText(name)) {
    differences.push('La raison sociale diffère de la fiche fictive.')
  }
  if (normalizeText(record.regime_fiscal) !== normalizeText(input.fiscalRegime ?? '')) {
    differences.push('Le régime fiscal diffère de la fiche fictive.')
  }

  if (differences.length) {
    return {
      status: 'mismatch',
      title: 'Écart détecté dans les données fictives',
      details: differences,
    }
  }

  return {
    status: 'match',
    title: 'Correspondance trouvée dans le registre fictif',
    details: ['Les champs comparés correspondent à une fiche synthétique de démonstration.'],
  }
}
