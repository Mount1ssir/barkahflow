// lib/notifications-data.ts

import { dbSelect, dbExecute } from '@/src/lib/db'

export type NotificationSeverity = 'critical' | 'warning' | 'info'

export interface Notification {
  id: string
  type: 'stock' | 'debt' | 'overdue' | 'pin_reset'
  severity: NotificationSeverity
  title: string
  message: string
  time: string
  createdAt: string
  clientId?: string
  clientName?: string
  phone?: string
  amount?: number
  productId?: string
  read: boolean
  cashierId?: string
  cashierName?: string
}

interface LowStockProduct {
  id: string
  name_ar: string
  stock_qty: number
  alert_threshold: number
  updated_at: string
}

interface OverdueDebt {
  id: string
  contact_id: string
  remaining_debt: number
  updated_at: string
  full_name: string
  phone: string | null
  due_date: string
  days_overdue: number
}

interface OverLimitClient {
  contact_id: string
  full_name: string
  phone: string | null
  credit_limit: number
  total_debt: number
  updated_at: string
}

const OVERDUE_CRITICAL_DAYS = 15

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

// ─── Stockage localStorage ──────────────────────────────────────────
const DISMISSED_KEY = 'barkahflow-notifications-dismissed'
const READ_KEY = 'barkahflow-notifications-read'

function getStoredIds(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function setStoredIds(key: string, ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)))
  } catch {
    // ignore
  }
}

function pruneStoredIds(currentIds: Set<string>) {
  for (const key of [DISMISSED_KEY, READ_KEY]) {
    const stored = getStoredIds(key)
    let changed = false
    for (const id of stored) {
      if (!currentIds.has(id)) {
        stored.delete(id)
        changed = true
      }
    }
    if (changed) setStoredIds(key, stored)
  }
}

// ─── Vérification de l'existence des tables ────────────────────────
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await dbSelect<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
      [tableName]
    )
    return result.length > 0
  } catch {
    return false
  }
}

// ─── Actions individuelles ──────────────────────────────────────────
export function dismissNotification(id: string) {
  const ids = getStoredIds(DISMISSED_KEY)
  ids.add(id)
  setStoredIds(DISMISSED_KEY, ids)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('barkahflow:notifications-changed'))
  }
}

export function markAsRead(id: string) {
  const ids = getStoredIds(READ_KEY)
  ids.add(id)
  setStoredIds(READ_KEY, ids)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('barkahflow:notifications-changed'))
  }
}

export function markAsUnread(id: string) {
  const ids = getStoredIds(READ_KEY)
  ids.delete(id)
  setStoredIds(READ_KEY, ids)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('barkahflow:notifications-changed'))
  }
}

export function toggleRead(id: string, currentlyRead: boolean) {
  if (currentlyRead) markAsUnread(id)
  else markAsRead(id)
}

// ─── Actions de masse ──────────────────────────────────────────────
export function markAllAsRead(ids: string[]) {
  const stored = getStoredIds(READ_KEY)
  for (const id of ids) stored.add(id)
  setStoredIds(READ_KEY, stored)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('barkahflow:notifications-changed'))
  }
}

export function dismissAllNotifications(ids: string[]) {
  const stored = getStoredIds(DISMISSED_KEY)
  for (const id of ids) stored.add(id)
  setStoredIds(DISMISSED_KEY, stored)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('barkahflow:notifications-changed'))
  }
}

// ─── Envoi de notification de réinitialisation PIN ──────────────────
export async function sendPinResetNotification(cashierId: string, cashierName: string): Promise<void> {
  const notification: Notification = {
    id: `pin-reset-${cashierId}-${Date.now()}`,
    type: 'pin_reset',
    severity: 'warning',
    title: 'Demande de réinitialisation PIN',
    message: `${cashierName} demande la réinitialisation de son code PIN`,
    time: "à l'instant",
    createdAt: new Date().toISOString(),
    cashierId: cashierId,
    cashierName: cashierName,
    read: false,
  }

  if (typeof window !== 'undefined') {
    const existing = localStorage.getItem('barkahflow-pin-reset-notifications')
    let notifications: Notification[] = existing ? JSON.parse(existing) : []
    notifications = [notification, ...notifications]
    localStorage.setItem('barkahflow-pin-reset-notifications', JSON.stringify(notifications))
    window.dispatchEvent(new Event('barkahflow:notifications-changed'))
  }
}

// ─── Récupérer les notifications de réinitialisation PIN ────────────
export function getPinResetNotifications(): Notification[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem('barkahflow-pin-reset-notifications')
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

// ─── Supprimer une notification de réinitialisation PIN ─────────────
export function dismissPinResetNotification(id: string) {
  if (typeof window === 'undefined') return
  try {
    const data = localStorage.getItem('barkahflow-pin-reset-notifications')
    if (data) {
      const notifications: Notification[] = JSON.parse(data)
      const filtered = notifications.filter(n => n.id !== id)
      localStorage.setItem('barkahflow-pin-reset-notifications', JSON.stringify(filtered))
      window.dispatchEvent(new Event('barkahflow:notifications-changed'))
    }
  } catch {
    // ignore
  }
}

// ─── Récupération des notifications ───────────────────────────────
export async function getNotifications(): Promise<Notification[]> {
  const notifications: Omit<Notification, 'read'>[] = []

  // Vérifier si les tables existent
  const [hasProducts, hasInvoices, hasDebtLedger, hasClients] = await Promise.all([
    tableExists('products'),
    tableExists('invoices'),
    tableExists('debt_ledger'),
    tableExists('clients')
  ])

  // 1. Stock bas (uniquement si products existe)
  if (hasProducts) {
    try {
      const lowStockProducts = await dbSelect<LowStockProduct>(
        `SELECT id, name_ar, stock_qty, alert_threshold, updated_at
         FROM products
         WHERE stock_qty <= alert_threshold
         ORDER BY updated_at DESC
         LIMIT 10`
      )

      for (const product of lowStockProducts) {
        const isOut = product.stock_qty <= 0
        notifications.push({
          id: `stock-${product.id}`,
          type: 'stock',
          severity: isOut ? 'critical' : 'warning',
          title: isOut ? 'Rupture de stock' : 'Stock bas',
          message: isOut
            ? `${product.name_ar} — rupture de stock`
            : `${product.name_ar} — il ne reste que ${product.stock_qty} unité(s)`,
          time: timeAgo(product.updated_at),
          createdAt: product.updated_at,
          productId: product.id,
        })
      }
    } catch (error) {
      console.warn('Erreur chargement stock bas:', error)
    }
  }

  // 2. Échéances dépassées (uniquement si toutes les tables existent)
  if (hasInvoices && hasDebtLedger && hasClients) {
    try {
      const overdueDebts = await dbSelect<OverdueDebt>(
        `SELECT 
           dl.id,
           dl.contact_id,
           dl.remaining_debt,
           dl.updated_at,
           c.full_name,
           c.phone,
           i.due_date,
           CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
         FROM debt_ledger dl
         JOIN clients c ON c.id = dl.contact_id
         JOIN invoices i ON i.id = dl.invoice_id
         WHERE dl.status IN ('ACTIVE', 'PARTIAL')
           AND dl.remaining_debt > 0
           AND i.due_date IS NOT NULL
           AND i.due_date < date('now')
           AND c.id != 'client_walkin'
         ORDER BY days_overdue DESC
         LIMIT 10`
      )

      const overdueClientIds = new Set<string>()

      for (const debt of overdueDebts) {
        overdueClientIds.add(debt.contact_id)
        notifications.push({
          id: `overdue-${debt.id}`,
          type: 'overdue',
          severity: debt.days_overdue >= OVERDUE_CRITICAL_DAYS ? 'critical' : 'warning',
          title: 'Échéance dépassée',
          message: `${debt.full_name} — ${(debt.remaining_debt / 100).toFixed(2)} MAD (${debt.days_overdue}j de retard)`,
          time: timeAgo(debt.updated_at),
          createdAt: debt.updated_at,
          clientId: debt.contact_id,
          clientName: debt.full_name,
          phone: debt.phone || undefined,
          amount: debt.remaining_debt,
        })
      }

      // 3. Limite de crédit dépassée
      const overLimitClients = await dbSelect<OverLimitClient>(
        `SELECT 
           c.id as contact_id,
           c.full_name,
           c.phone,
           c.credit_limit,
           SUM(dl.remaining_debt) as total_debt,
           MAX(dl.updated_at) as updated_at
         FROM debt_ledger dl
         JOIN clients c ON c.id = dl.contact_id
         WHERE dl.status IN ('ACTIVE', 'PARTIAL')
           AND dl.remaining_debt > 0
           AND dl.type = 'RECEIVABLE'
           AND c.id != 'client_walkin'
           AND c.credit_limit IS NOT NULL
         GROUP BY c.id
         HAVING SUM(dl.remaining_debt) > c.credit_limit
         ORDER BY total_debt DESC
         LIMIT 10`
      )

      for (const client of overLimitClients) {
        if (overdueClientIds.has(client.contact_id)) continue
        notifications.push({
          id: `debt-${client.contact_id}`,
          type: 'debt',
          severity: 'warning',
          title: 'Limite de crédit dépassée',
          message: `${client.full_name} doit ${(client.total_debt / 100).toFixed(2)} MAD (limite ${(client.credit_limit / 100).toFixed(2)} MAD)`,
          time: timeAgo(client.updated_at),
          createdAt: client.updated_at,
          clientId: client.contact_id,
          clientName: client.full_name,
          phone: client.phone || undefined,
          amount: client.total_debt,
        })
      }
    } catch (error) {
      console.warn('Erreur chargement dettes/échéances:', error)
    }
  }

  // 4. Ajouter les notifications de réinitialisation PIN
  const pinResetNotifications = getPinResetNotifications()
  for (const notif of pinResetNotifications) {
    notifications.push({
      id: notif.id,
      type: 'pin_reset',
      severity: 'warning',
      title: notif.title,
      message: notif.message,
      time: notif.time,
      createdAt: notif.createdAt,
      cashierId: notif.cashierId,
      cashierName: notif.cashierName,
    })
  }

  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const currentIds = new Set(notifications.map((n) => n.id))
  pruneStoredIds(currentIds)

  const dismissed = getStoredIds(DISMISSED_KEY)
  const readIds = getStoredIds(READ_KEY)

  return notifications
    .filter((n) => !dismissed.has(n.id))
    .map((n) => ({ ...n, read: readIds.has(n.id) }))
}