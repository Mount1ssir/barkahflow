// lib/invoice-data.ts

import { dbSelect, dbExecute } from '@/src/lib/db'
import { nowLocal, todayLocal } from '@/lib/datetime'

// ─── Interfaces ──────────────────────────────────────────────────
export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string | null
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  clientAddress: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  status: string
  paymentMethod: string
  dueDate: string | null
  poNumber: string | null
  createdAt: string
  updatedAt: string
  userId: string | null
  userName: string | null
}

export interface InvoiceLine {
  id: string
  invoiceId: string
  productId: string
  qty: number
  unitPrice: number
  discount: number
  subtotal: number
  productName?: string
}

export interface Client {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
}

export interface InvoicePaymentInfo {
  paidAmount: number
  remainingAmount: number
}

export interface CashierStatsToday {
  sales: number
  revenue: number
  discount: number
  debt: number
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

// ─── Map invoice ──────────────────────────────────────────────────
function mapInvoice(row: any): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id,
    clientName: row.client_name || null,
    clientPhone: row.client_phone || null,
    clientEmail: row.client_email || null,
    clientAddress: row.client_address || null,
    subtotal: row.subtotal,
    tax: row.tax,
    discount: row.discount,
    total: row.total,
    status: row.status,
    paymentMethod: row.payment_method || 'cash',
    dueDate: row.due_date || null,
    poNumber: row.po_number || null,
    userId: row.user_id || null,
    userName: row.user_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Factures ─────────────────────────────────────────────────────
export async function getAllInvoices(limit?: number): Promise<Invoice[]> {
  const hasInvoices = await tableExists('invoices')
  if (!hasInvoices) {
    console.warn('⚠️ Table invoices n\'existe pas encore')
    return []
  }

  try {
    const rows = await dbSelect<any>(
      `SELECT i.*, c.full_name as client_name, c.phone as client_phone, c.email as client_email, c.address as client_address
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       ORDER BY i.created_at DESC
       ${limit ? `LIMIT ${limit}` : ''}`
    )
    return rows.map(mapInvoice)
  } catch (error) {
    console.warn('⚠️ Erreur getAllInvoices:', error)
    return []
  }
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const hasInvoices = await tableExists('invoices')
  if (!hasInvoices) {
    return null
  }

  try {
    const rows = await dbSelect<any>(
      `SELECT i.*, c.full_name as client_name, c.phone as client_phone, c.email as client_email, c.address as client_address
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.id = ?`,
      [id]
    )
    return rows.length > 0 ? mapInvoice(rows[0]) : null
  } catch (error) {
    console.warn('⚠️ Erreur getInvoiceById:', error)
    return null
  }
}

export async function getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
  const hasLineItems = await tableExists('line_items')
  if (!hasLineItems) {
    return []
  }

  try {
    const rows = await dbSelect<any>(
      `SELECT l.*, p.name_ar as product_name
       FROM line_items l
       LEFT JOIN products p ON p.id = l.product_id
       WHERE l.invoice_id = ?
       ORDER BY l.id ASC`,
      [invoiceId]
    )
    return rows.map((row: any) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      productId: row.product_id,
      qty: row.qty,
      unitPrice: row.unit_price,
      discount: row.discount,
      subtotal: row.subtotal,
      productName: row.product_name,
    }))
  } catch (error) {
    console.warn('⚠️ Erreur getInvoiceLines:', error)
    return []
  }
}

export async function getInvoicesByClient(clientId: string): Promise<Invoice[]> {
  const hasInvoices = await tableExists('invoices')
  if (!hasInvoices) {
    return []
  }

  try {
    const rows = await dbSelect<any>(
      `SELECT i.*, c.full_name as client_name, c.phone as client_phone, c.email as client_email, c.address as client_address
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.client_id = ?
       ORDER BY i.created_at DESC`,
      [clientId]
    )
    return rows.map(mapInvoice)
  } catch (error) {
    console.warn('⚠️ Erreur getInvoicesByClient:', error)
    return []
  }
}

// ─── Factures par utilisateur (caissier) ────────────────────────────────
export async function getInvoicesByUser(userId: string, limit?: number): Promise<Invoice[]> {
  const hasInvoices = await tableExists('invoices')
  if (!hasInvoices) {
    return []
  }

  try {
    const rows = await dbSelect<any>(
      `SELECT i.*, c.full_name as client_name, c.phone as client_phone, c.email as client_email, c.address as client_address
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.user_id = ?
       ORDER BY i.created_at DESC
       ${limit ? `LIMIT ${limit}` : ''}`,
      [userId]
    )
    return rows.map(mapInvoice)
  } catch (error) {
    console.warn('⚠️ Erreur getInvoicesByUser:', error)
    return []
  }
}

// ─── STATISTIQUES EN TEMPS RÉEL (sans cache) ──────────────────────────────

/**
 * Calcule les statistiques d'un caissier en temps réel (sans cache)
 * Utilisé pour afficher les données à jour dans la table des caissiers
 * Exactement comme dans la page "Voir les détails"
 */
export async function getCashierStatsRealTime(userId: string): Promise<CashierStatsToday> {
  const today = todayLocal()
  
  // Utiliser LIKE pour trouver les dates du jour (format "YYYY-MM-DD HH:MM:SS")
  const datePattern = today + '%'
  
  try {
    // 1. Récupérer les factures du jour pour ce caissier
    const salesRows = await dbSelect<{ count: number; total: number; discount: number }>(
      `SELECT 
         COUNT(*) as count,
         COALESCE(SUM(CASE WHEN status IN ('PAID','PARTIAL') THEN total ELSE 0 END), 0) as total,
         COALESCE(SUM(discount), 0) as discount
       FROM invoices
       WHERE user_id = ?
         AND created_at LIKE ?`,
      [userId, datePattern]
    )

    // 2. Récupérer les dettes du jour pour ce caissier
    let debt = 0
    try {
      const debtRows = await dbSelect<{ debt: number }>(
        `SELECT COALESCE(SUM(dl.remaining_debt), 0) as debt
         FROM debt_ledger dl
         JOIN invoices i ON i.id = dl.invoice_id
         WHERE i.user_id = ?
           AND i.created_at LIKE ?
           AND dl.status IN ('ACTIVE', 'PARTIAL')`,
        [userId, datePattern]
      )
      debt = debtRows[0]?.debt ?? 0
    } catch (error) {
      console.warn('⚠️ Erreur récupération dette:', error)
    }

    return {
      sales: salesRows[0]?.count ?? 0,
      revenue: (salesRows[0]?.total ?? 0) / 100,
      discount: (salesRows[0]?.discount ?? 0) / 100,
      debt: debt / 100,
    }
  } catch (error) {
    console.warn('⚠️ Erreur getCashierStatsRealTime:', error)
    return { sales: 0, revenue: 0, discount: 0, debt: 0 }
  }
}

// ─── STATISTIQUES AVEC CACHE ──────────────────────────────────────────

/**
 * Calcule les statistiques d'un caissier pour une date donnée
 */
async function calculateStatsForDate(userId: string, date: string): Promise<CashierStatsToday> {
  const hasInvoices = await tableExists('invoices')
  if (!hasInvoices) {
    return { sales: 0, revenue: 0, discount: 0, debt: 0 }
  }

  try {
    const datePattern = date + '%'
    
    const salesRows = await dbSelect<{ count: number; total: number; discount: number }>(
      `SELECT 
         COUNT(*) as count,
         COALESCE(SUM(CASE WHEN status IN ('PAID','PARTIAL') THEN total ELSE 0 END), 0) as total,
         COALESCE(SUM(discount), 0) as discount
       FROM invoices
       WHERE user_id = ?
         AND created_at LIKE ?`,
      [userId, datePattern]
    )

    const hasDebtLedger = await tableExists('debt_ledger')
    let debt = 0
    
    if (hasDebtLedger) {
      try {
        const debtRows = await dbSelect<{ debt: number }>(
          `SELECT COALESCE(SUM(dl.remaining_debt), 0) as debt
           FROM debt_ledger dl
           JOIN invoices i ON i.id = dl.invoice_id
           WHERE i.user_id = ?
             AND i.created_at LIKE ?
             AND dl.status IN ('ACTIVE', 'PARTIAL')`,
          [userId, datePattern]
        )
        debt = debtRows[0]?.debt ?? 0
      } catch (error) {
        console.warn('⚠️ Erreur récupération dette:', error)
      }
    }

    return {
      sales: salesRows[0]?.count ?? 0,
      revenue: (salesRows[0]?.total ?? 0) / 100,
      discount: (salesRows[0]?.discount ?? 0) / 100,
      debt: debt / 100,
    }
  } catch (error) {
    console.warn('⚠️ Erreur calculateStatsForDate:', error)
    return { sales: 0, revenue: 0, discount: 0, debt: 0 }
  }
}

/**
 * Sauvegarde les statistiques dans la table de cache
 */
async function saveStatsToCache(userId: string, date: string, stats: CashierStatsToday): Promise<void> {
  try {
    const hasCashierStats = await tableExists('cashier_stats')
    if (!hasCashierStats) {
      return
    }

    const now = nowLocal()
    const id = `stats_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    
    const existing = await dbSelect<{ id: string }>(
      `SELECT id FROM cashier_stats WHERE user_id = ? AND date = ?`,
      [userId, date]
    )
    
    if (existing.length > 0) {
      await dbExecute(
        `UPDATE cashier_stats SET 
           sales = ?, 
           revenue = ?, 
           discount = ?, 
           debt = ?, 
           updated_at = ? 
         WHERE user_id = ? AND date = ?`,
        [
          stats.sales,
          Math.round(stats.revenue * 100),
          Math.round(stats.discount * 100),
          Math.round(stats.debt * 100),
          now,
          userId,
          date
        ]
      )
    } else {
      await dbExecute(
        `INSERT INTO cashier_stats (
          id, user_id, date, sales, revenue, discount, debt, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          date,
          stats.sales,
          Math.round(stats.revenue * 100),
          Math.round(stats.discount * 100),
          Math.round(stats.debt * 100),
          now,
          now,
        ]
      )
    }
  } catch (error) {
    console.warn('⚠️ Erreur saveStatsToCache:', error)
  }
}

/**
 * Récupère les statistiques depuis le cache
 */
async function getStatsFromCache(userId: string, date: string): Promise<CashierStatsToday | null> {
  try {
    const hasCashierStats = await tableExists('cashier_stats')
    if (!hasCashierStats) {
      return null
    }

    const rows = await dbSelect<{ sales: number; revenue: number; discount: number; debt: number }>(
      `SELECT sales, revenue, discount, debt 
       FROM cashier_stats 
       WHERE user_id = ? AND date = ?`,
      [userId, date]
    )
    
    if (rows.length === 0) return null
    
    return {
      sales: rows[0].sales,
      revenue: rows[0].revenue / 100,
      discount: rows[0].discount / 100,
      debt: rows[0].debt / 100,
    }
  } catch (error) {
    console.warn('⚠️ Erreur getStatsFromCache:', error)
    return null
  }
}

/**
 * Statistiques du caissier pour aujourd'hui (avec cache persistant)
 */
export async function getCashierStatsToday(userId: string): Promise<CashierStatsToday> {
  const today = todayLocal()
  
  const cached = await getStatsFromCache(userId, today)
  if (cached) {
    return cached
  }
  
  const stats = await calculateStatsForDate(userId, today)
  await saveStatsToCache(userId, today, stats)
  
  return stats
}

/**
 * Force le rafraîchissement des stats d'un caissier
 */
export async function refreshCashierStats(userId: string): Promise<CashierStatsToday> {
  const today = todayLocal()
  const stats = await calculateStatsForDate(userId, today)
  await saveStatsToCache(userId, today, stats)
  return stats
}

/**
 * Récupère toutes les stats d'un caissier (tous les jours)
 */
export async function getAllCashierStats(userId: string): Promise<Record<string, CashierStatsToday>> {
  try {
    const hasCashierStats = await tableExists('cashier_stats')
    if (!hasCashierStats) {
      return {}
    }

    const rows = await dbSelect<{ date: string; sales: number; revenue: number; discount: number; debt: number }>(
      `SELECT date, sales, revenue, discount, debt 
       FROM cashier_stats 
       WHERE user_id = ?
       ORDER BY date DESC`,
      [userId]
    )
    
    const result: Record<string, CashierStatsToday> = {}
    for (const row of rows) {
      result[row.date] = {
        sales: row.sales,
        revenue: row.revenue / 100,
        discount: row.discount / 100,
        debt: row.debt / 100,
      }
    }
    return result
  } catch (error) {
    console.warn('⚠️ Erreur getAllCashierStats:', error)
    return {}
  }
}

/**
 * Force le rafraîchissement des stats pour TOUS les caissiers
 */
export async function refreshAllCashierStats(): Promise<void> {
  try {
    const hasUsers = await tableExists('users')
    if (!hasUsers) return
    
    const users = await dbSelect<{ id: string }>(
      `SELECT id FROM users WHERE role = 'cashier'`
    )
    
    const today = todayLocal()
    for (const user of users) {
      try {
        const stats = await calculateStatsForDate(user.id, today)
        await saveStatsToCache(user.id, today, stats)
      } catch (error) {
        console.warn(`⚠️ Erreur refresh stats pour ${user.id}:`, error)
      }
    }
    console.log(`✅ Stats recalculées pour ${users.length} caissiers`)
  } catch (error) {
    console.warn('⚠️ Erreur refreshAllCashierStats:', error)
  }
}

// ─── Créer une facture ──────────────────────────────────────────────────
export async function createInvoice(input: {
  clientId?: string | null
  clientName?: string | null
  clientPhone?: string | null
  clientEmail?: string | null
  clientAddress?: string | null
  items: { productId: string; qty: number; unitPrice: number; discount?: number; taxRate?: number }[]
  subtotal?: number
  tax?: number
  discount?: number
  paymentMethod?: string
  dueDate?: string | null
  poNumber?: string | null
  userId?: string | null
  userName?: string | null
  status?: 'PAID' | 'UNPAID' | 'PARTIAL'
  createdAt?: string
}): Promise<Invoice> {
  const hasInvoices = await tableExists('invoices')
  if (!hasInvoices) {
    throw new Error('La table invoices n\'existe pas encore')
  }

  const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
  const now = nowLocal()
  
  let subtotal = input.subtotal || 0
  if (subtotal === 0 && input.items.length > 0) {
    subtotal = input.items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0)
  }
  
  const discount = input.discount || 0
  const tax = input.tax || 0
  const total = subtotal - discount + tax
  
  const status = input.status || (input.paymentMethod === 'cash' ? 'PAID' : 'UNPAID')
  
  await dbExecute(
    `INSERT INTO invoices (
      id, invoice_number, client_id, client_name, client_phone, client_email, client_address,
      subtotal, discount, tax, total, status, payment_method, due_date, po_number,
      user_id, user_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      invoiceNumber,
      input.clientId || null,
      input.clientName || null,
      input.clientPhone || null,
      input.clientEmail || null,
      input.clientAddress || null,
      subtotal,
      discount,
      tax,
      total,
      status,
      input.paymentMethod || 'cash',
      input.dueDate || null,
      input.poNumber || null,
      input.userId || null,
      input.userName || null,
      input.createdAt || now,
      now,
    ]
  )

  for (const item of input.items) {
    const lineId = `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const itemSubtotal = item.unitPrice * item.qty
    const itemDiscount = item.discount || 0
    await dbExecute(
      `INSERT INTO line_items (id, invoice_id, product_id, qty, unit_price, discount, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        lineId,
        id,
        item.productId,
        item.qty,
        item.unitPrice,
        itemDiscount,
        itemSubtotal - itemDiscount,
      ]
    )
  }

  // FORCER LE RAFAÎCHISSEMENT IMMÉDIAT des stats
  if (input.userId) {
    try {
      const today = todayLocal()
      const stats = await calculateStatsForDate(input.userId, today)
      await saveStatsToCache(input.userId, today, stats)
      console.log(`✅ Stats recalculées immédiatement pour le caissier: ${input.userId}`, stats)
    } catch (error) {
      console.warn('⚠️ Erreur rafraîchissement stats immédiat:', error)
    }
  }

  // Déclencher les événements pour rafraîchir l'UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('barkahflow:sale-created'))
    window.dispatchEvent(new Event('barkahflow:stats-changed'))
  }

  return (await getInvoiceById(id))!
}

// ─── Suppression ──────────────────────────────────────────────────
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const hasInvoices = await tableExists('invoices')
  if (!hasInvoices) {
    return
  }

  const invoice = await getInvoiceById(invoiceId)
  const userId = invoice?.userId
  
  try {
    // Supprimer les transactions liées à cette facture (encaissé réel)
    await dbExecute('DELETE FROM transactions WHERE source_id = ? AND source_type = ?', [invoiceId, 'invoice'])
    
    // Supprimer les dettes liées à cette facture
    await dbExecute('DELETE FROM debt_ledger WHERE invoice_id = ?', [invoiceId])
    
    // Supprimer les lignes de facture
    await dbExecute('DELETE FROM line_items WHERE invoice_id = ?', [invoiceId])
    
    // Supprimer la facture
    await dbExecute('DELETE FROM invoices WHERE id = ?', [invoiceId])
    
  } catch (error) {
    console.warn('⚠️ Erreur deleteInvoice:', error)
    throw error
  }
  
  // FORCER LE RAFAÎCHISSEMENT DES STATS après suppression
  if (userId) {
    try {
      const today = todayLocal()
      const stats = await calculateStatsForDate(userId, today)
      await saveStatsToCache(userId, today, stats)
      console.log(`✅ Stats recalculées pour le caissier après suppression: ${userId}`)
    } catch (error) {
      console.warn('⚠️ Erreur rafraîchissement stats après suppression:', error)
    }
  }
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('barkahflow:stats-changed'))
    window.dispatchEvent(new Event('barkahflow:sale-deleted'))
  }
}

// ─── Dettes ───────────────────────────────────────────────────────
export async function getPendingDebtTotal(): Promise<number> {
  const hasDebtLedger = await tableExists('debt_ledger')
  if (!hasDebtLedger) {
    return 0
  }

  try {
    const rows = await dbSelect<{ total: number }>(
      `SELECT COALESCE(SUM(remaining_debt), 0) as total
       FROM debt_ledger
       WHERE status IN ('ACTIVE', 'PARTIAL')`
    )
    return rows[0]?.total ?? 0
  } catch (error) {
    console.warn('⚠️ Erreur getPendingDebtTotal:', error)
    return 0
  }
}

// ─── Info de paiement d'une facture ────────────────────────────
export async function getInvoicePaymentInfo(
  invoiceId: string,
  invoiceTotal: number
): Promise<InvoicePaymentInfo> {
  const hasDebtLedger = await tableExists('debt_ledger')
  if (!hasDebtLedger) {
    return { paidAmount: invoiceTotal, remainingAmount: 0 }
  }

  try {
    const rows = await dbSelect<{ total_debt: number; remaining_debt: number }>(
      `SELECT total_debt, remaining_debt
       FROM debt_ledger
       WHERE invoice_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [invoiceId]
    )

    if (rows.length === 0) {
      return { paidAmount: invoiceTotal, remainingAmount: 0 }
    }

    const remainingAmount = rows[0].remaining_debt
    const paidAmount = invoiceTotal - remainingAmount

    return { paidAmount, remainingAmount }
  } catch (error) {
    console.warn('⚠️ Erreur getInvoicePaymentInfo:', error)
    return { paidAmount: invoiceTotal, remainingAmount: 0 }
  }
}

// ─── Clients ────────────────────────────────────────────────────
export async function getAllClients(): Promise<Client[]> {
  const hasClients = await tableExists('clients')
  if (!hasClients) {
    return []
  }

  try {
    const rows = await dbSelect<any>(
      `SELECT id, full_name, phone, email, address
       FROM clients
       ORDER BY full_name`
    )
    return rows.map((row: any) => ({
      id: row.id,
      full_name: row.full_name,
      phone: row.phone || null,
      email: row.email || null,
      address: row.address || null,
    }))
  } catch (error) {
    console.warn('⚠️ Erreur getAllClients:', error)
    return []
  }
}

// ─── Mise à jour facture ──────────────────────────────────────────
export async function updateInvoice(
  id: string,
  data: { clientId?: string | null; status?: string; date?: string; dueDate?: string | null; poNumber?: string | null; userId?: string | null }
): Promise<void> {
  const hasInvoices = await tableExists('invoices')
  if (!hasInvoices) {
    return
  }

  const updates: string[] = []
  const values: any[] = []

  if (data.clientId !== undefined) {
    updates.push('client_id = ?')
    values.push(data.clientId)
  }
  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  if (data.date !== undefined) {
    updates.push('created_at = ?')
    values.push(data.date)
  }
  if (data.dueDate !== undefined) {
    updates.push('due_date = ?')
    values.push(data.dueDate)
  }
  if (data.poNumber !== undefined) {
    updates.push('po_number = ?')
    values.push(data.poNumber)
  }
  if (data.userId !== undefined) {
    updates.push('user_id = ?')
    values.push(data.userId)
  }

  if (updates.length === 0) return

  const ts = nowLocal()
  updates.push('updated_at = ?')
  values.push(ts)
  values.push(id)
  
  const sql = `UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`
  await dbExecute(sql, values)
}

// ─── Calcul automatique de l'échéance ────────────────────────────
export function calculateDueDate(createdAtIso: string, days: number): string {
  const date = new Date(createdAtIso)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

// ─── Montant en toutes lettres ────────────────────────────────────
const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf']
const DIX_A_DIX_NEUF = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

function convertGroupUnder1000(n: number): string {
  if (n === 0) return ''
  let result = ''

  const centaines = Math.floor(n / 100)
  const reste = n % 100

  if (centaines > 0) {
    result += (centaines > 1 ? UNITES[centaines] + ' cent' : 'cent') + (centaines > 1 && reste === 0 ? 's' : '')
    if (reste > 0) result += ' '
  }

  if (reste > 0) {
    if (reste < 10) {
      result += UNITES[reste]
    } else if (reste < 20) {
      result += DIX_A_DIX_NEUF[reste - 10]
    } else {
      const dizaine = Math.floor(reste / 10)
      const unite = reste % 10
      if (dizaine === 7 || dizaine === 9) {
        result += DIZAINES[dizaine] + '-' + DIX_A_DIX_NEUF[unite]
      } else {
        result += DIZAINES[dizaine] + (unite > 0 ? '-' + UNITES[unite] : (dizaine === 8 ? 's' : ''))
      }
    }
  }

  return result
}

export function amountToFrenchWords(amountInCentimes: number): string {
  const dirhams = Math.floor(amountInCentimes / 100)
  const centimes = amountInCentimes % 100

  if (dirhams === 0 && centimes === 0) return 'zéro dirham'

  let result = ''

  if (dirhams === 0) {
    result = ''
  } else if (dirhams === 1) {
    result = 'un dirham'
  } else {
    const millions = Math.floor(dirhams / 1000000)
    const milliers = Math.floor((dirhams % 1000000) / 1000)
    const unites = dirhams % 1000

    const parts: string[] = []
    if (millions > 0) {
      parts.push((millions > 1 ? convertGroupUnder1000(millions) + ' millions' : 'un million'))
    }
    if (milliers > 0) {
      parts.push((milliers > 1 ? convertGroupUnder1000(milliers) + ' mille' : 'mille'))
    }
    if (unites > 0) {
      parts.push(convertGroupUnder1000(unites))
    }
    result = parts.join(' ') + ' dirhams'
  }

  if (centimes > 0) {
    const centimesWords = convertGroupUnder1000(centimes)
    result += (result ? ' et ' : '') + centimesWords + ' centime' + (centimes > 1 ? 's' : '')
  }

  return result.trim()
}