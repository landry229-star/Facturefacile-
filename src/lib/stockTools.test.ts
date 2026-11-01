import { describe, expect, it } from 'vitest'
import type { ProductRecord } from './data'
import { calculateStockDifference, calculateStockSummary, isValidStockMovementQuantity } from './stockTools'

const product = (overrides: Partial<ProductRecord> = {}): ProductRecord => ({
  id: 'product-1',
  name: 'Riz local',
  price: 2500,
  product_type: 'product',
  description: null,
  unit: 'sac',
  purchase_price: 1800,
  stock_quantity: 5,
  low_stock_threshold: 2,
  reference: null,
  category: 'inventory',
  sub_category: null,
  active: true,
  image_url: null,
  ...overrides,
})

describe('stock management tools', () => {
  it('calculates current units, purchase valuation and threshold alerts', () => {
    expect(calculateStockSummary([
      product(),
      product({ id: 'product-2', stock_quantity: 2, purchase_price: 1000, low_stock_threshold: 2 }),
    ])).toEqual({ productCount: 2, unitCount: 7, purchaseValue: 11000, alertCount: 1 })
  })

  it('calculates physical inventory variance against theoretical quantity', () => {
    expect(calculateStockDifference(8, 5)).toBe(-3)
    expect(calculateStockDifference(4, 4)).toBe(0)
  })

  it('accepts zero only for physical stock adjustments', () => {
    expect(isValidStockMovementQuantity(0, 'adjustment')).toBe(true)
    expect(isValidStockMovementQuantity(0, 'in')).toBe(false)
    expect(isValidStockMovementQuantity(0, 'out')).toBe(false)
    expect(isValidStockMovementQuantity(-1, 'adjustment')).toBe(false)
    expect(isValidStockMovementQuantity(Number.NaN, 'adjustment')).toBe(false)
  })
})
