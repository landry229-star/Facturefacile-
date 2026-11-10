export function invoiceFieldLabel(field: string) {
  const labels: Record<string, string> = {
    client_id: 'Client',
    issue_date: 'Date de facture',
    due_date: 'Échéance',
    discount: 'Remise',
    tax: 'Taxe',
    total: 'Total',
    status: 'Statut',
    invoice_type: 'Type de document',
  }
  return labels[field] ?? field.replaceAll('_', ' ')
}
