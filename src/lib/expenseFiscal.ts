export function normalizeExpenseFiscalAmounts(
  totalAmount: number,
  taxableAmountText: string,
  vatAmountText: string,
): { taxableAmount: number | null; vatAmount: number | null } {
  const taxableText = taxableAmountText.trim()
  const vatText = vatAmountText.trim()
  if (!taxableText && !vatText) return { taxableAmount: null, vatAmount: null }

  const enteredTaxableAmount = taxableText ? Number(taxableText) : null
  const enteredVatAmount = vatText ? Number(vatText) : null
  if (
    (enteredTaxableAmount !== null && (!Number.isFinite(enteredTaxableAmount) || enteredTaxableAmount < 0))
    || (enteredVatAmount !== null && (!Number.isFinite(enteredVatAmount) || enteredVatAmount < 0))
  ) {
    throw new Error('La base HT et la TVA doivent être des montants positifs ou nuls.')
  }

  const taxableAmount = enteredTaxableAmount ?? totalAmount - (enteredVatAmount ?? 0)
  const vatAmount = enteredVatAmount ?? totalAmount - taxableAmount
  if (taxableAmount < 0 || vatAmount < 0 || Math.abs(taxableAmount + vatAmount - totalAmount) > 0.02) {
    throw new Error('La base HT et la TVA doivent correspondre au montant TTC.')
  }

  return {
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
  }
}

export function protectCsvFormula(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value
}
