import { describe, expect, it } from 'vitest'
import type { ProductRecord } from './data'
import { parseProductImportRows } from './productTools'

const existingProduct: ProductRecord = {
  id: 'product-1',
  name: 'Café Kora',
  price: 2500,
  product_type: 'product',
  description: null,
  unit: 'sac',
  purchase_price: 1800,
  stock_quantity: 12,
  low_stock_threshold: 3,
  reference: 'CAF-01',
  category: 'inventory',
  sub_category: null,
  active: true,
  image_url: null,
}

describe('product import tools', () => {
  it('parses French headers, accented names, localized prices and product metadata', () => {
    const [row] = parseProductImportRows([{
      Nom: 'Thé Baobab',
      Type: 'Produit',
      'Prix achat': '1 250,50',
      'Prix vente': '2 000,75',
      Stock: '8',
      'Seuil alerte': '2',
      Référence: 'THE-02',
      Catégorie: 'Stock',
      'Sous-catégorie': 'Boissons',
      Unité: 'boîte',
      Statut: 'Actif',
      Image: 'https://example.com/tea.png',
    }], [existingProduct])

    expect(row.errors).toEqual([])
    expect(row.product).toMatchObject({
      name: 'Thé Baobab',
      productType: 'product',
      purchasePrice: 1250.5,
      salePrice: 2000.75,
      stockQuantity: 8,
      lowStockThreshold: 2,
      reference: 'THE-02',
      category: 'inventory',
      subCategory: 'Boissons',
      unit: 'boîte',
      active: true,
      imageUrl: 'https://example.com/tea.png',
    })
  })

  it('reports missing or invalid values, unsupported types, categories and image URLs', () => {
    const [row] = parseProductImportRows([{
      Nom: '',
      Type: 'Location',
      'Prix vente': 'inconnu',
      Stock: '-2',
      'Seuil alerte': 'x',
      Catégorie: 'Alimentaire',
      Image: 'javascript:alert(1)',
    }], [])

    expect(row.errors).toEqual(expect.arrayContaining([
      'Nom obligatoire.',
      'Prix de vente manquant ou invalide.',
      'Stock invalide ou négatif.',
      'Seuil de stock invalide ou négatif.',
      'Type inconnu : indiquez Produit ou Service.',
      'Catégorie inconnue : Alimentaire.',
      'L’image doit utiliser une URL HTTP ou HTTPS.',
    ]))
  })

  it('detects duplicate references and duplicate names within the same file', () => {
    const rows = parseProductImportRows([
      { Nom: 'Café Kora', Type: 'Produit', 'Prix vente': '2500', Référence: 'caf-01' },
      { Nom: 'Jus local', Type: 'Produit', 'Prix vente': '800', Référence: 'JUS-01' },
      { Nom: 'Jus frais', Type: 'Produit', 'Prix vente': '900', Référence: 'JUS-01' },
      { Nom: 'Jus local', Type: 'Produit', 'Prix vente': '900' },
    ], [existingProduct])

    expect(rows[0].errors[0]).toContain('Doublon')
    expect(rows[1].errors).toEqual([])
    expect(rows[2].errors[0]).toContain('Doublon')
    expect(rows[3].errors[0]).toContain('Doublon')
  })

  it('rejects stock on services and negative prices', () => {
    const [row] = parseProductImportRows([{
      Nom: 'Installation',
      Type: 'Service',
      'Prix achat': '-1',
      'Prix vente': '15000',
      Stock: '1',
    }], [])

    expect(row.errors).toEqual(expect.arrayContaining([
      'Les prix ne peuvent pas être négatifs.',
      'Un service ne peut pas avoir de stock initial.',
    ]))
  })
})
