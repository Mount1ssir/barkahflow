import { dbSelect } from '@/src/lib/db'

export interface Notification {
  id: string
  type: 'stock' | 'debt'
  title: string
  message: string
  time: string
  createdAt: string
}

interface LowStockProduct {
  id: string
  name_ar: string
  stock_qty: number
  alert_threshold: number
  updated_at: string
}

interface ActiveDebt {
  id: string
  contact_id: string
  remaining_debt: number
  status: string
  updated_at: string
  full_name: string
}

// Calcule un texte relatif simple ("il y a 12 min", "il y a 2h"...)
function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `il y a ${days}j`
  if (hours > 0) return `il y a ${hours}h`
  if (minutes > 0) return `il y a ${minutes} min`
  return "à l'instant"
}

export async function getNotifications(): Promise<Notification[]> {
  const notifications: Notification[] = []

  // 1. Récupérer les produits en stock bas
  const lowStockProducts = await dbSelect<LowStockProduct>(
    `SELECT id, name_ar, stock_qty, alert_threshold, updated_at
     FROM products
     WHERE stock_qty <= alert_threshold
     ORDER BY updated_at DESC
     LIMIT 10`
  )

  for (const product of lowStockProducts) {
    notifications.push({
      id: `stock-${product.id}`,
      type: 'stock',
      title: 'Stock bas',
      message: `${product.name_ar} — il ne reste que ${product.stock_qty} unité(s)`,
      time: timeAgo(product.updated_at),
      createdAt: product.updated_at,
    })
  }

  // 2. Récupérer les dettes actives (jointure avec clients pour avoir le nom)
  const activeDebts = await dbSelect<ActiveDebt>(
    `SELECT debt_ledger.id, debt_ledger.contact_id, debt_ledger.remaining_debt,
            debt_ledger.status, debt_ledger.updated_at, clients.full_name
     FROM debt_ledger
     JOIN clients ON clients.id = debt_ledger.contact_id
     WHERE debt_ledger.status != 'SETTLED' AND debt_ledger.type = 'RECEIVABLE'
     ORDER BY debt_ledger.updated_at DESC
     LIMIT 10`
  )

  for (const debt of activeDebts) {
    const montantMAD = (debt.remaining_debt / 100).toFixed(2)
    notifications.push({
      id: `debt-${debt.id}`,
      type: 'debt',
      title: 'Dette active',
      message: `${debt.full_name} doit ${montantMAD} MAD`,
      time: timeAgo(debt.updated_at),
      createdAt: debt.updated_at,
    })
  }

  // Trier toutes les notifications par date, la plus récente en premier
  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return notifications
}