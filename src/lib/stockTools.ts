import type { ProductRecord } from './data'

export function calculateStockSummary(products: ProductRecord[]) {
  return products.reduce((summary, product) => ({
    productCount: summary.productCount + 1,
    unitCount: summary.unitCount + product.stock_quantity,
    purchaseValue: summary.purchaseValue + product.stock_quantity * product.purchase_price,
    alertCount: summary.alertCount + Number(product.stock_quantity <= product.low_stock_threshold),
  }), { productCount: 0, unitCount: 0, purchaseValue: 0, alertCount: 0 })
}

export function calculateStockDifference(theoreticalQuantity: number, actualQuantity: number) {
  return actualQuantity - theoreticalQuantity
}

export function isValidStockMovementQuantity(quantity: number, movementType: 'in' | 'out' | 'adjustment') {
  return Number.isFinite(quantity)
    && quantity >= 0
    && (movementType === 'adjustment' || quantity > 0)
}
