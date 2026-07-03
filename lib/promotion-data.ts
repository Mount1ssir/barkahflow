import { dbExecute, dbSelect } from '@/src/lib/db'

export interface Promotion {
  id: string
  code: string
  type: 'PERCENT' | 'FIXED'
  value: number
  startDate: string
  endDate: string | null
  minPurchase: number
  maxUsage: number | null
  usedCount: number
  isActive: boolean
  productIds: string[] // IDs des produits concernés (vide = tous)
  categoryIds: string[] // IDs des catégories concernées
  createdAt: string
}

export async function getActivePromotions(): Promise<Promotion[]> {
  const now = new Date().toISOString()
  const rows = await dbSelect<any>(
    `SELECT * FROM promotions
     WHERE is_active = 1
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY created_at DESC`,
    [now, now]
  )
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    startDate: row.start_date,
    endDate: row.end_date,
    minPurchase: row.min_purchase || 0,
    maxUsage: row.max_usage,
    usedCount: row.used_count || 0,
    isActive: row.is_active === 1,
    productIds: row.product_ids ? JSON.parse(row.product_ids) : [],
    categoryIds: row.category_ids ? JSON.parse(row.category_ids) : [],
    createdAt: row.created_at,
  }))
}

export async function calculateDiscount(
  cart: { productId: string; quantity: number; unitPrice: number }[],
  promotionCode?: string
): Promise<{ discount: number; appliedPromotion?: Promotion }> {
  if (!promotionCode) return { discount: 0 }

  const promotions = await getActivePromotions()
  const promo = promotions.find((p) => p.code.toUpperCase() === promotionCode.toUpperCase())
  if (!promo) return { discount: 0 }

  // Vérifier si le panier éligible
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  if (subtotal < promo.minPurchase) return { discount: 0 }

  // Vérifier si les produits sont éligibles
  const eligibleProductIds = promo.productIds.length > 0 ? promo.productIds : null
  let discount = 0
  if (eligibleProductIds) {
    // Réduire uniquement sur les produits concernés
    const eligibleSubtotal = cart
      .filter((item) => eligibleProductIds.includes(item.productId))
      .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    if (promo.type === 'PERCENT') {
      discount = (eligibleSubtotal * promo.value) / 100
    } else {
      discount = Math.min(promo.value, eligibleSubtotal)
    }
  } else {
    // Réduction sur tout le panier
    if (promo.type === 'PERCENT') {
      discount = (subtotal * promo.value) / 100
    } else {
      discount = Math.min(promo.value, subtotal)
    }
  }

  return { discount, appliedPromotion: promo }
}