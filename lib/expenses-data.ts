import { dbSelect, dbExecute } from '@/src/lib/db'

// ==========================================
// EXPENSES CRUD & STATISTICS
// ==========================================

export interface DbExpense {
  id: string
  date: string
  category: string
  vendor: string
  notes: string
  amount: number
  status: 'PENDING' | 'SETTLED'
}

export async function fetchExpenses(): Promise<DbExpense[]> {
  try {
    const rows = await dbSelect<any>(
      `SELECT 
        id, 
        transaction_date as date, 
        category, 
        source_id as vendor, 
        notes, 
        amount, 
        payment_method as status 
       FROM transactions 
       WHERE type = 'EXPENSE' 
       ORDER BY transaction_date DESC, created_at DESC`
    )
    return rows.map((row: any) => ({
      id: row.id,
      date: row.date ? row.date.split('T')[0] : '',
      category: row.category || '',
      vendor: row.vendor || 'N/A',
      notes: row.notes || '',
      amount: row.amount || 0,
      status: row.status === 'PENDING' ? 'PENDING' : 'SETTLED'
    }))
  } catch (error) {
    console.error('Error fetching expenses from DB:', error)
    return []
  }
}

export async function addExpenseToDb(expense: Omit<DbExpense, 'id'>): Promise<string> {
  const id = `exp-${Date.now()}`
  const now = new Date().toISOString()
  await dbExecute(
    `INSERT INTO transactions (id, type, amount, source_type, source_id, category, notes, payment_method, transaction_date, created_at)
     VALUES (?, 'EXPENSE', ?, 'manual', ?, ?, ?, ?, ?, ?)`,
    [id, expense.amount, expense.vendor, expense.category, expense.notes, expense.status, expense.date, now]
  )
  return id
}

export async function deleteExpenseFromDb(id: string): Promise<void> {
  await dbExecute(
    `DELETE FROM transactions WHERE id = ? AND type = 'EXPENSE'`,
    [id]
  )
}

// ==========================================
// SALES REPORTS DATA
// ==========================================

export interface ProductPerformance {
  name: string
  sku: string
  qty: number
  total: number
}

export interface SalesReportStats {
  totalRevenue: number
  avgOrderValue: number
  orderCount: number
  products: ProductPerformance[]
}

export async function fetchSalesReportData(): Promise<SalesReportStats> {
  try {
    // 1. Total Revenue & AOV
    const invoiceStats = await dbSelect<any>(
      `SELECT 
        COALESCE(SUM(total), 0) as totalRevenue,
        COALESCE(AVG(total), 0) as avgOrderValue,
        COUNT(*) as orderCount
       FROM invoices`
    )
    const stats = invoiceStats[0] || { totalRevenue: 0, avgOrderValue: 0, orderCount: 0 }

    // 2. Product performance
    const products = await dbSelect<any>(
      `SELECT 
        p.name_ar as name, 
        p.sku, 
        SUM(li.qty) as qty, 
        SUM(li.subtotal) as total
       FROM line_items li
       JOIN products p ON li.product_id = p.id
       JOIN invoices i ON li.invoice_id = i.id
       GROUP BY p.id, p.name_ar, p.sku
       ORDER BY total DESC`
    )

    return {
      totalRevenue: stats.totalRevenue,
      avgOrderValue: Math.round(stats.avgOrderValue),
      orderCount: stats.orderCount,
      products: products.map((p: any) => ({
        name: p.name,
        sku: p.sku || 'N/A',
        qty: p.qty || 0,
        total: p.total || 0
      }))
    }
  } catch (error) {
    console.error('Error fetching sales report data:', error)
    return { totalRevenue: 0, avgOrderValue: 0, orderCount: 0, products: [] }
  }
}

// ==========================================
// CUSTOMER REPORTS DATA
// ==========================================

export interface ClientDebtProfile {
  name: string
  phone: string
  orders: number
  debt: number
}

export interface CustomerReportStats {
  activeClientsCount: number
  totalUnpaidDebt: number
  clients: ClientDebtProfile[]
}

export async function fetchCustomerReportData(): Promise<CustomerReportStats> {
  try {
    // 1. Total active clients
    const activeClientsRows = await dbSelect<any>(
      `SELECT COUNT(*) as count FROM clients WHERE id != 'client_walkin'`
    )
    const activeClientsCount = activeClientsRows[0]?.count || 0

    // 2. Total Unpaid debt
    const unpaidDebtRows = await dbSelect<any>(
      `SELECT COALESCE(SUM(remaining_debt), 0) as total 
       FROM debt_ledger 
       WHERE type = 'RECEIVABLE' AND status != 'SETTLED'`
    )
    const totalUnpaidDebt = unpaidDebtRows[0]?.total || 0

    // 3. Client profile list
    const clients = await dbSelect<any>(
      `SELECT 
        c.full_name as name, 
        c.phone, 
        (SELECT COUNT(*) FROM invoices WHERE client_id = c.id) as orders,
        COALESCE((SELECT SUM(remaining_debt) FROM debt_ledger WHERE contact_id = c.id AND type = 'RECEIVABLE' AND status != 'SETTLED'), 0) as debt
       FROM clients c
       WHERE c.id != 'client_walkin'
       ORDER BY debt DESC, orders DESC`
    )

    return {
      activeClientsCount,
      totalUnpaidDebt,
      clients: clients.map((c: any) => ({
        name: c.name,
        phone: c.phone || 'N/A',
        orders: c.orders || 0,
        debt: c.debt || 0
      }))
    }
  } catch (error) {
    console.error('Error fetching customer report data:', error)
    return { activeClientsCount: 0, totalUnpaidDebt: 0, clients: [] }
  }
}

// ==========================================
// BUSINESS REPORTS DATA
// ==========================================

export interface LedgerEntry {
  date: string
  type: 'INFLOW' | 'OUTFLOW'
  category: string
  amount: number
}

export interface BusinessReportStats {
  profitMargin: number
  totalExpenses: number
  expenseCount: number
  ledger: LedgerEntry[]
}

export async function fetchBusinessReportData(): Promise<BusinessReportStats> {
  try {
    // 1. Profit Margin
    const marginRows = await dbSelect<any>(
      `SELECT 
        COALESCE(SUM(li.subtotal), 0) as totalRevenue,
        COALESCE(SUM(li.qty * p.cost_price), 0) as totalCost
       FROM line_items li
       JOIN products p ON li.product_id = p.id`
    )
    const marginData = marginRows[0] || { totalRevenue: 0, totalCost: 0 }
    let profitMargin = 0
    if (marginData.totalRevenue > 0) {
      profitMargin = ((marginData.totalRevenue - marginData.totalCost) / marginData.totalRevenue) * 100
      profitMargin = Math.round(profitMargin * 10) / 10
    }

    // 2. Total expenses
    const expenseRows = await dbSelect<any>(
      `SELECT 
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as count
       FROM transactions
       WHERE type = 'EXPENSE'`
    )
    const expenseStats = expenseRows[0] || { total: 0, count: 0 }

    // 3. Ledger
    const ledger = await dbSelect<any>(
      `SELECT 
        date(transaction_date, 'localtime') as date,
        type,
        category,
        amount
       FROM transactions
       ORDER BY transaction_date DESC, created_at DESC
       LIMIT 50`
    )

    return {
      profitMargin,
      totalExpenses: expenseStats.total,
      expenseCount: expenseStats.count,
      ledger: ledger.map((item: any) => ({
        date: item.date || '',
        type: item.type === 'INCOME' ? 'INFLOW' : 'OUTFLOW',
        category: item.category || 'N/A',
        amount: item.amount || 0
      }))
    }
  } catch (error) {
    console.error('Error fetching business report data:', error)
    return { profitMargin: 0, totalExpenses: 0, expenseCount: 0, ledger: [] }
  }
}

// ==========================================
// INVENTORY REPORTS DATA
// ==========================================

export interface StockLevelStatus {
  name: string
  stock: number
  threshold: number
  value: number
  lowStock: boolean
}

export interface InventoryReportStats {
  totalValue: number
  lowStockCount: number
  skuCount: number
  stockMonitoring: StockLevelStatus[]
}

export async function fetchInventoryReportData(): Promise<InventoryReportStats> {
  try {
    // 1. Total inventory value & counts
    const countsRows = await dbSelect<any>(
      `SELECT 
        COALESCE(SUM(stock_qty * cost_price), 0) as totalValue,
        COUNT(*) as skuCount,
        SUM(CASE WHEN stock_qty <= alert_threshold THEN 1 ELSE 0 END) as lowStockCount
       FROM products
       WHERE is_active = 1`
    )
    const counts = countsRows[0] || { totalValue: 0, skuCount: 0, lowStockCount: 0 }

    // 2. Stock levels list
    const stockMonitoring = await dbSelect<any>(
      `SELECT 
        name_ar as name, 
        stock_qty as stock, 
        alert_threshold as threshold, 
        (stock_qty * cost_price) as value,
        (CASE WHEN stock_qty <= alert_threshold THEN 1 ELSE 0 END) as lowStock
       FROM products
       WHERE is_active = 1
       ORDER BY stock_qty ASC`
    )

    return {
      totalValue: counts.totalValue,
      lowStockCount: counts.lowStockCount || 0,
      skuCount: counts.skuCount || 0,
      stockMonitoring: stockMonitoring.map((item: any) => ({
        name: item.name,
        stock: item.stock || 0,
        threshold: item.threshold || 0,
        value: item.value || 0,
        lowStock: !!item.lowStock
      }))
    }
  } catch (error) {
    console.error('Error fetching inventory report data:', error)
    return { totalValue: 0, lowStockCount: 0, skuCount: 0, stockMonitoring: [] }
  }
}

// ==========================================
// TAX & INVOICE REPORTS DATA
// ==========================================

export interface InvoiceHistory {
  id: string
  client: string
  date: string
  tax: number
  total: number
  status: string
}

export interface TaxReportStats {
  totalTaxCollected: number
  outstandingCount: number
  invoices: InvoiceHistory[]
}

export async function fetchTaxReportData(): Promise<TaxReportStats> {
  try {
    // 1. Stats
    const statsRows = await dbSelect<any>(
      `SELECT 
        COALESCE(SUM(tax), 0) as totalTax,
        SUM(CASE WHEN status != 'PAID' THEN 1 ELSE 0 END) as outstandingCount
       FROM invoices`
    )
    const stats = statsRows[0] || { totalTax: 0, outstandingCount: 0 }

    // 2. List
    const invoices = await dbSelect<any>(
      `SELECT 
        i.invoice_number as id,
        COALESCE(c.full_name, 'Client de passage') as client,
        date(i.created_at, 'localtime') as date,
        i.tax,
        i.total,
        i.status
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       ORDER BY i.created_at DESC`
    )

    return {
      totalTaxCollected: stats.totalTax,
      outstandingCount: stats.outstandingCount || 0,
      invoices: invoices.map((inv: any) => ({
        id: inv.id,
        client: inv.client,
        date: inv.date || '',
        tax: inv.tax || 0,
        total: inv.total || 0,
        status: inv.status || 'UNPAID'
      }))
    }
  } catch (error) {
    console.error('Error fetching tax report data:', error)
    return { totalTaxCollected: 0, outstandingCount: 0, invoices: [] }
  }
}
