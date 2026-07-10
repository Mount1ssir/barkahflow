import { dbExecute, dbSelect } from '@/src/lib/db'
import { generateInvoiceNumber } from './invoice-number'
import { logAudit } from './audit-log'
import { getCompanySettings } from './company-settings'
import { calculateDueDate } from './invoice-data'

export interface CartItem {
  productId: string
  quantity: number
  unitPrice: number
  discount?: number
}

export interface CheckoutInput {
  cart: CartItem[]
  customerId?: string | null
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID'
  paymentMethod?: string
  paidAmount: number
  poNumber?: string | null       // ajout : référence commande client
  userId?: string | null
  cashierId?: string | null
  ipAddress?: string
  userAgent?: string
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 300): Promise<T> {
  let lastError: any
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const msg = error?.message || ''
      if (msg.includes('database is locked') && attempt < maxRetries) {
        console.warn(`⚠️ Base verrouillée, tentative ${attempt}/${maxRetries}...`)
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
        continue
      }
      throw error
    }
  }
  throw lastError
}

// Échappe les apostrophes pour l'injection directe dans le SQL brut
// (nécessaire car ce fichier construit une transaction SQL sous forme
// de chaîne concaténée plutôt que des requêtes paramétrées)
function sqlEscape(value: string): string {
  return value.replace(/'/g, "''")
}

export async function processCheckout(input: CheckoutInput): Promise<{ invoiceId: string; invoiceNumber: string }> {
  if ((input.paymentStatus === 'PARTIAL' || input.paymentStatus === 'UNPAID') && !input.customerId) {
    throw new Error('Un client est requis pour les factures partielles ou impayées')
  }

  if (input.customerId) {
    const clientRows = await dbSelect<{ id: string }>(
      `SELECT id FROM clients WHERE id = ?`,
      [input.customerId]
    )
    if (clientRows.length === 0) {
      throw new Error(`Client introuvable (id: ${input.customerId}).`)
    }
  }

  for (const item of input.cart) {
    const product = await dbSelect<{ stock_qty: number; reserved_stock: number; name_ar: string }>(
      `SELECT stock_qty, reserved_stock, name_ar FROM products WHERE id = ?`,
      [item.productId]
    )
    if (product.length === 0) throw new Error(`Produit introuvable : ${item.productId}`)
    const available = (product[0].stock_qty ?? 0) - (product[0].reserved_stock ?? 0)
    if (available < item.quantity) {
      throw new Error(`Stock insuffisant pour ${product[0].name_ar}. Disponible : ${available}`)
    }
  }

  for (const item of input.cart) {
    await dbExecute(
      `UPDATE products SET reserved_stock = COALESCE(reserved_stock, 0) + ? WHERE id = ?`,
      [item.quantity, item.productId]
    )
  }

  let subtotal = 0
  let totalTax = 0
  let totalDiscount = 0
  const lineItems: any[] = []

  for (const item of input.cart) {
    const product = await dbSelect<{ tax_rate: number; retail_price: number }>(
      `SELECT tax_rate, retail_price FROM products WHERE id = ?`,
      [item.productId]
    )
    const price = item.unitPrice || product[0].retail_price / 100
    const discount = item.discount || 0
    const itemSubtotal = price * item.quantity
    const itemDiscount = (itemSubtotal * discount) / 100
    const itemAfterDiscount = itemSubtotal - itemDiscount
    const tax = (itemAfterDiscount * (product[0].tax_rate || 0)) / 100

    subtotal += itemSubtotal
    totalDiscount += itemDiscount
    totalTax += tax

    lineItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: price,
      discount: discount,
      subtotal: itemAfterDiscount,
      tax: tax,
    })
  }

  const total = subtotal - totalDiscount + totalTax
  const invoiceNumber = await generateInvoiceNumber('INV')
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()
  const paymentMethod = input.paymentMethod || 'cash'

  // ── Calcul de l'échéance ────────────────────────────────────────
  // Basée sur le délai de paiement par défaut configuré dans les
  // paramètres de l'entreprise (30 jours si non configuré).
  const companySettings = await getCompanySettings()
  const dueDate = calculateDueDate(now, companySettings.defaultPaymentTermsDays || 30)
  const poNumber = input.poNumber ? sqlEscape(input.poNumber) : null

  let sql = 'BEGIN;\n'

  sql += `
    INSERT INTO invoices (
      id, invoice_number, client_id, subtotal, tax, discount, total,
      status, payment_method, due_date, po_number, created_at, updated_at
    ) VALUES (
      '${invoiceId}',
      '${invoiceNumber}',
      ${input.customerId ? `'${input.customerId}'` : 'NULL'},
      ${Math.round(subtotal * 100)},
      ${Math.round(totalTax * 100)},
      ${Math.round(totalDiscount * 100)},
      ${Math.round(total * 100)},
      '${input.paymentStatus}',
      '${paymentMethod}',
      '${dueDate}',
      ${poNumber ? `'${poNumber}'` : 'NULL'},
      '${now}',
      '${now}'
    );
  `

  for (const item of lineItems) {
    const lineId = `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    sql += `
      INSERT INTO line_items (
        id, invoice_id, product_id, qty, unit_price, discount, subtotal
      ) VALUES (
        '${lineId}',
        '${invoiceId}',
        '${item.productId}',
        ${item.quantity},
        ${Math.round(item.unitPrice * 100)},
        ${item.discount},
        ${Math.round(item.subtotal * 100)}
      );
    `
  }

  for (const item of input.cart) {
    sql += `
      UPDATE products SET
        stock_qty = stock_qty - ${item.quantity},
        reserved_stock = COALESCE(reserved_stock, 0) - ${item.quantity}
      WHERE id = '${item.productId}';
    `
  }

  if (input.paymentStatus === 'PAID') {
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    sql += `
      INSERT INTO transactions (
        id, type, amount, source_type, source_id, transaction_date, created_at
      ) VALUES (
        '${txId}',
        'INCOME',
        ${Math.round(total * 100)},
        'invoice',
        '${invoiceId}',
        '${now}',
        '${now}'
      );
    `
    sql += `
      UPDATE invoices SET status = 'PAID' WHERE id = '${invoiceId}';
    `
  } else if (input.paymentStatus === 'PARTIAL' || input.paymentStatus === 'UNPAID') {
    const debtId = `debt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const remaining = input.paymentStatus === 'UNPAID' ? total : total - input.paidAmount
    sql += `
      INSERT INTO debt_ledger (
        id, type, contact_id, total_debt, remaining_debt, status, invoice_id, created_at, updated_at
      ) VALUES (
        '${debtId}',
        'RECEIVABLE',
        ${input.customerId ? `'${input.customerId}'` : 'NULL'},
        ${Math.round(total * 100)},
        ${Math.round(remaining * 100)},
        'ACTIVE',
        '${invoiceId}',
        '${now}',
        '${now}'
      );
    `
    if (input.paymentStatus === 'PARTIAL' && input.paidAmount > 0) {
      const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      sql += `
        INSERT INTO transactions (
          id, type, amount, source_type, source_id, transaction_date, created_at
        ) VALUES (
          '${txId}',
          'INCOME',
          ${Math.round(input.paidAmount * 100)},
          'invoice',
          '${invoiceId}',
          '${now}',
          '${now}'
        );
      `
    }
  }

  sql += `
    INSERT INTO audit_logs (
      id, user_id, action, entity_type, entity_id, before_state, after_state, ip_address, user_agent, created_at
    ) VALUES (
      'audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}',
      ${input.userId ? `'${input.userId}'` : 'NULL'},
      'checkout_completed',
      'invoice',
      '${invoiceId}',
      NULL,
      '{"invoiceNumber":"${invoiceNumber}","total":${total}}',
      '${input.ipAddress || '0.0.0.0'}',
      '${input.userAgent || ''}',
      '${now}'
    );
  `

  sql += 'COMMIT;'

  return await withRetry(async () => {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== 'BEGIN' && s !== 'COMMIT')
    
    for (const statement of statements) {
      await dbExecute(statement)
    }
    return { invoiceId, invoiceNumber }
  })
}