// lib.ts
import { Capacitor } from '@capacitor/core'

export interface DbDriver {
  select<T>(query: string, params?: any[]): Promise<T[]>
  execute(query: string, params?: any[]): Promise<void>
}

let driverInstance: DbDriver | null = null

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  credit_limit INTEGER DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  cost_price INTEGER NOT NULL,
  retail_price INTEGER NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  alert_threshold INTEGER NOT NULL DEFAULT 5,
  tax_rate REAL DEFAULT 0,
  show_in_pos INTEGER DEFAULT 1,
  track_stock INTEGER DEFAULT 1,
  is_favorite INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  subtotal INTEGER NOT NULL,
  tax INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PAID', 'PARTIAL', 'UNPAID')),
  due_date TEXT,
  po_number TEXT,
  user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount INTEGER DEFAULT 0,
  subtotal INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
  amount INTEGER NOT NULL,
  source_type TEXT CHECK(source_type IN ('invoice', 'manual')),
  source_id TEXT,
  category TEXT,
  payment_method TEXT DEFAULT 'cash',
  user_id TEXT REFERENCES users(id),
  transaction_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debt_ledger (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('RECEIVABLE', 'PAYABLE')),
  contact_id TEXT NOT NULL REFERENCES clients(id),
  total_debt INTEGER NOT NULL,
  remaining_debt INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'SETTLED', 'PARTIAL')),
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders_queue (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  debt_amount INTEGER NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('whatsapp', 'sms')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'opened', 'sent', 'failed')),
  scheduled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'cashier')) DEFAULT 'cashier',
  active INTEGER NOT NULL DEFAULT 1,
  permissions TEXT DEFAULT '[]',
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dismissed_notifications (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  dismissed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_read_status (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  UNIQUE(notification_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'ADJUSTMENT')),
  quantity INTEGER NOT NULL,
  previous_qty INTEGER NOT NULL,
  new_qty INTEGER NOT NULL,
  reason TEXT,
  user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name_ar, name_en);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
`

const MIGRATIONS = [
  // Clients
  `ALTER TABLE clients ADD COLUMN credit_limit INTEGER DEFAULT NULL;`,
  
  // Transactions
  `ALTER TABLE transactions ADD COLUMN payment_method TEXT DEFAULT 'cash';`,
  
  // Reminders Queue
  `CREATE TABLE IF NOT EXISTS reminders_queue (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    debt_amount INTEGER NOT NULL,
    message TEXT NOT NULL,
    channel TEXT NOT NULL CHECK(channel IN ('whatsapp', 'sms')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'opened', 'sent', 'failed')),
    scheduled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  
  // Invoices
  `ALTER TABLE invoices ADD COLUMN due_date TEXT;`,
  `ALTER TABLE invoices ADD COLUMN po_number TEXT;`,
  `ALTER TABLE invoices ADD COLUMN user_id TEXT REFERENCES users(id);`,
  
  // Transactions user_id
  `ALTER TABLE transactions ADD COLUMN user_id TEXT REFERENCES users(id);`,
  
  // Users
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'cashier')) DEFAULT 'cashier',
    active INTEGER NOT NULL DEFAULT 1,
    permissions TEXT DEFAULT '[]',
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `ALTER TABLE users ADD COLUMN avatar_url TEXT;`,
  `ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]';`,
  
  // Products - options
  `ALTER TABLE products ADD COLUMN show_in_pos INTEGER DEFAULT 1;`,
  `ALTER TABLE products ADD COLUMN track_stock INTEGER DEFAULT 1;`,
  `ALTER TABLE products ADD COLUMN is_favorite INTEGER DEFAULT 0;`,
  
  // Notifications
  `CREATE TABLE IF NOT EXISTS dismissed_notifications (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    dismissed_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS notification_read_status (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    read_at TEXT NOT NULL,
    UNIQUE(notification_id)
  );`,
  
  // Stock Movements
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL
  );`,
  
  // ✅ AJOUT DES COLONNES MANQUANTES SUR stock_movements
  `ALTER TABLE stock_movements ADD COLUMN previous_qty INTEGER DEFAULT 0;`,
  `ALTER TABLE stock_movements ADD COLUMN new_qty INTEGER DEFAULT 0;`,
  `ALTER TABLE stock_movements ADD COLUMN user_id TEXT REFERENCES users(id);`,
  
  // Index
  `CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);`,
]

async function runMigrations(db: any) {
  for (const sql of MIGRATIONS) {
    try {
      await db.execute(sql)
    } catch (e: any) {
      const msg = e?.message || ''
      if (
        msg.includes('duplicate column name') ||
        msg.includes('already exists') ||
        msg.includes('no such table') ||
        msg.includes('SQLITE_ERROR')
      ) {
        // ignored
      } else {
        console.warn('Migration warning:', msg)
      }
    }
  }
}

function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  return (
    !!(window as any).__TAURI_INTERNALS__ ||
    !!(window as any).__TAURI__ ||
    !!(window as any).__TAURI_IPC__
  )
}

function isCapacitorMobile(): boolean {
  try {
    const platform = Capacitor.getPlatform()
    return platform === 'android' || platform === 'ios'
  } catch {
    return false
  }
}

async function createTauriDriver(): Promise<DbDriver> {
  console.log('BarkahFlow: Initialisation SQLite Tauri Desktop...')

  const Database = (await import('@tauri-apps/plugin-sql')).default
  const db = await Database.load('sqlite:barkahflow.db')

  await db.execute('PRAGMA busy_timeout = 10000;')

  const statements = SCHEMA
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    try {
      await db.execute(statement + ';')
    } catch (e: any) {
      if (!e?.message?.includes('already exists')) {
        console.warn('Schema warning:', e?.message)
      }
    }
  }

  await runMigrations(db)

  console.log('BarkahFlow: SQLite Tauri pret avec migrations')

  return {
    select: async <T>(query: string, params: any[] = []) => {
      return await db.select<T[]>(query, params)
    },
    execute: async (query: string, params: any[] = []) => {
      await db.execute(query, params)
    },
  }
}

async function createCapacitorDriver(): Promise<DbDriver> {
  console.log('BarkahFlow: Initialisation SQLite Capacitor Mobile...')

  const { CapacitorSQLite, SQLiteConnection } = await import(
    '@capacitor-community/sqlite'
  )
  const sqlite = new SQLiteConnection(CapacitorSQLite)

  const db = await sqlite.createConnection(
    'barkahflow',
    false,
    'no-encryption',
    1,
    false
  )
  await db.open()

  await db.execute('PRAGMA busy_timeout = 10000;')

  const statements = SCHEMA
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    try {
      await db.execute(statement + ';')
    } catch (e: any) {
      if (!e?.message?.includes('already exists')) {
        console.warn('Schema warning:', e?.message)
      }
    }
  }

  await runMigrations(db)

  console.log('BarkahFlow: SQLite Capacitor pret avec migrations')

  return {
    select: async <T>(query: string, params: any[] = []) => {
      const result = await db.query(query, params)
      return (result.values || []) as T[]
    },
    execute: async (query: string, params: any[] = []) => {
      await db.run(query, params)
    },
  }
}

function createMockDriver(): DbDriver {
  console.warn('BarkahFlow: Mode navigateur web SQLite non disponible.')
  console.warn('Lance npm run tauri dev pour la vraie base de donnees.')
  return {
    select: async <T>() => [] as T[],
    execute: async () => {},
  }
}

export async function getDriver(): Promise<DbDriver> {
  if (driverInstance) return driverInstance

  if (isCapacitorMobile()) {
    driverInstance = await createCapacitorDriver()
  } else if (isTauriEnv()) {
    driverInstance = await createTauriDriver()
  } else {
    driverInstance = createMockDriver()
  }

  return driverInstance
}

export async function dbSelect<T>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const driver = await getDriver()
  return await driver.select<T>(query, params)
}

export async function dbExecute(
  query: string,
  params: any[] = []
): Promise<void> {
  const driver = await getDriver()
  await driver.execute(query, params)
}

export async function dbSelectWithRetry<T>(
  query: string,
  params: any[] = [],
  maxRetries: number = 5,
  delay: number = 300
): Promise<T[]> {
  let lastError: any
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await dbSelect<T>(query, params)
    } catch (error: any) {
      lastError = error
      const msg = error?.message || ''
      if (msg.includes('database is locked') && attempt < maxRetries) {
        console.warn(`Base verrouillee (lecture), tentative ${attempt}/${maxRetries}...`)
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
        continue
      }
      throw error
    }
  }
  throw lastError
}

export async function dbExecuteWithRetry(
  query: string,
  params: any[] = [],
  maxRetries: number = 5,
  delay: number = 300
): Promise<void> {
  let lastError: any
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await dbExecute(query, params)
    } catch (error: any) {
      lastError = error
      const msg = error?.message || ''
      if (msg.includes('database is locked') && attempt < maxRetries) {
        console.warn(`Base verrouillee (ecriture), tentative ${attempt}/${maxRetries}...`)
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
        continue
      }
      throw error
    }
  }
  throw lastError
}