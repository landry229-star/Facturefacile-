import type { ProductRecord } from './data'

export type ImportedProduct = {
  name: string
  description: string
  unit: string
  purchasePrice: number
  salePrice: number
  productType: 'product' | 'service'
  stockQuantity: number
  lowStockThreshold: number
  reference: string
  category: string
  subCategory: string
  active: boolean
  imageUrl: string
}

export type ProductImportRow = {
  product: ImportedProduct
  errors: string[]
}

const normalizeHeader = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr-FR')
  .replace(/[^a-z0-9]/g, '')

const aliases = {
  name: ['Nom', 'Désignation', 'Produit', 'Name'],
  type: ['Type', 'Type de produit', 'Product type'],
  description: ['Description'],
  unit: ['Unité', 'Unit'],
  purchasePrice: ['Prix achat', 'Prix d’achat', 'Prix achat FCFA', 'Purchase price', 'purchase_price'],
  salePrice: ['Prix vente', 'Prix de vente', 'Prix vente FCFA', 'Sale price', 'Price', 'price'],
  stock: ['Stock', 'Quantité', 'Quantite', 'Stock quantity', 'stock_quantity'],
  threshold: ['Seuil alerte', 'Seuil de stock', 'Stock minimum', 'Low stock threshold', 'low_stock_threshold'],
  reference: ['Référence', 'Reference', 'SKU'],
  category: ['Catégorie', 'Categorie', 'Category'],
  subCategory: ['Sous-catégorie', 'Sous categorie', 'Subcategory', 'sub_category'],
  status: ['Statut', 'Status', 'Actif'],
  image: ['Image', 'Image URL', 'URL image', 'image_url'],
} satisfies Record<string, string[]>

const categoryByName: Record<string, string> = {
  autre: 'other',
  other: 'other',
  digital: 'digital',
  service: 'service',
  stock: 'inventory',
  inventory: 'inventory',
  materiel: 'material',
  material: 'material',
}

const normalizeValue = (value: unknown) => String(value ?? '').trim()

const readField = (row: Record<string, unknown>, fieldAliases: string[]) => {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]))
  for (const alias of fieldAliases) {
    const value = values.get(normalizeHeader(alias))
    if (value !== null && value !== undefined && normalizeValue(value)) return normalizeValue(value)
  }
  return ''
}

const parseAmount = (value: string) => {
  const cleaned = value.replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d,.-]/g, '')
  if (!cleaned) return null
  const decimal = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? ',' : '.'
  const normalized = decimal === ','
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

const duplicateProduct = (candidate: ImportedProduct, products: ProductRecord[]) => {
  const reference = candidate.reference.trim().toLocaleLowerCase('fr-FR')
  const name = candidate.name.trim().toLocaleLowerCase('fr-FR')
  return products.find((product) => reference
    ? product.reference?.trim().toLocaleLowerCase('fr-FR') === reference
    : product.name.trim().toLocaleLowerCase('fr-FR') === name && product.product_type === candidate.productType)
}

export function parseProductImportRows(
  rows: Record<string, unknown>[],
  existingProducts: ProductRecord[],
): ProductImportRow[] {
  const seen: ProductRecord[] = [...existingProducts]
  return rows.map((row) => {
    const typeValue = readField(row, aliases.type).toLocaleLowerCase('fr-FR')
    const productType = ['service', 'services'].includes(typeValue) ? 'service' : 'product'
    const categoryValue = readField(row, aliases.category) || 'other'
    const categoryKey = normalizeHeader(categoryValue)
    const category = categoryByName[categoryKey] ?? categoryValue.toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g, '_')
    const saleValue = readField(row, aliases.salePrice)
    const purchaseValue = readField(row, aliases.purchasePrice)
    const stockValue = readField(row, aliases.stock) || '0'
    const thresholdValue = readField(row, aliases.threshold) || '0'
    const salePrice = parseAmount(saleValue)
    const purchasePrice = purchaseValue ? parseAmount(purchaseValue) : 0
    const stockQuantity = parseAmount(stockValue)
    const lowStockThreshold = parseAmount(thresholdValue)
    const rawStatus = readField(row, aliases.status).toLocaleLowerCase('fr-FR')
    const imageUrl = readField(row, aliases.image)
    const product: ImportedProduct = {
      name: readField(row, aliases.name),
      description: readField(row, aliases.description),
      unit: readField(row, aliases.unit) || 'unité',
      purchasePrice: purchasePrice ?? 0,
      salePrice: salePrice ?? 0,
      productType,
      stockQuantity: stockQuantity ?? 0,
      lowStockThreshold: lowStockThreshold ?? 0,
      reference: readField(row, aliases.reference),
      category,
      subCategory: readField(row, aliases.subCategory),
      active: !['inactif', 'inactive', 'non', 'false', '0'].includes(rawStatus),
      imageUrl,
    }
    const errors: string[] = []
    if (!product.name) errors.push('Nom obligatoire.')
    if (!saleValue || salePrice === null) errors.push('Prix de vente manquant ou invalide.')
    if (purchaseValue && purchasePrice === null) errors.push('Prix d’achat invalide.')
    if (purchasePrice !== null && purchasePrice < 0 || salePrice !== null && salePrice < 0) errors.push('Les prix ne peuvent pas être négatifs.')
    if (stockQuantity === null || stockQuantity < 0) errors.push('Stock invalide ou négatif.')
    if (lowStockThreshold === null || lowStockThreshold < 0) errors.push('Seuil de stock invalide ou négatif.')
    if (typeValue && !['service', 'services', 'produit', 'produits', 'product', 'products'].includes(typeValue)) errors.push('Type inconnu : indiquez Produit ou Service.')
    if (rawStatus && !['actif', 'active', 'oui', 'true', '1', 'inactif', 'inactive', 'non', 'false', '0'].includes(rawStatus)) errors.push(`Statut inconnu : ${readField(row, aliases.status)}.`)
    if (productType === 'service' && (stockQuantity ?? 0) > 0) errors.push('Un service ne peut pas avoir de stock initial.')
    if (!categoryByName[categoryKey] && !Object.values(categoryByName).includes(category)) errors.push(`Catégorie inconnue : ${categoryValue}.`)
    if (imageUrl) {
      try {
        const parsedUrl = new URL(imageUrl)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) errors.push('L’image doit utiliser une URL HTTP ou HTTPS.')
      } catch {
        errors.push('URL d’image invalide.')
      }
    }
    const duplicate = duplicateProduct(product, seen)
    if (duplicate) errors.push(`Doublon avec « ${duplicate.name} »${duplicate.reference ? ` (référence ${duplicate.reference})` : ''}.`)
    if (!errors.length) {
      seen.push({
        id: `import-${seen.length}`,
        name: product.name,
        price: product.salePrice,
        product_type: product.productType,
        description: product.description || null,
        unit: product.unit,
        purchase_price: product.purchasePrice,
        stock_quantity: product.stockQuantity,
        low_stock_threshold: product.lowStockThreshold,
        reference: product.reference || null,
        category: product.category,
        sub_category: product.subCategory || null,
        active: product.active,
        image_url: product.imageUrl || null,
      })
    }
    return { product, errors }
  })
}
