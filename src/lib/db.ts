import { Capacitor } from '@capacitor/core'

// ── Types communs aux deux plateformes ──────────────────────────
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
  image_path TEXT,
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

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name_ar, name_en);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status, created_at);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
`

// ── Détection de plateforme fiable ──────────────────────────────
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

// ── Driver Desktop (Tauri) ──────────────────────────────────────
async function createTauriDriver(): Promise<DbDriver> {
  console.log('🖥️ BarkahFlow: Initialisation SQLite Tauri Desktop...')

  const Database = (await import('@tauri-apps/plugin-sql')).default
  const db = await Database.load('sqlite:barkahflow.db')

  // Exécute le schéma statement par statement
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

  console.log('✅ BarkahFlow: SQLite Tauri prêt')

  return {
    select: async <T>(query: string, params: any[] = []) => {
      return await db.select<T[]>(query, params)
    },
    execute: async (query: string, params: any[] = []) => {
      await db.execute(query, params)
    },
  }
}

// ── Driver Mobile (Capacitor) ───────────────────────────────────
async function createCapacitorDriver(): Promise<DbDriver> {
  console.log('📱 BarkahFlow: Initialisation SQLite Capacitor Mobile...')

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

  console.log('✅ BarkahFlow: SQLite Capacitor prêt')

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

// ── Mock pour navigateur web pur (npm run dev) ──────────────────
function createMockDriver(): DbDriver {
  console.warn('⚠️ BarkahFlow: Mode navigateur web — SQLite non disponible.')
  console.warn('   → Lance "npm run tauri dev" pour la vraie base de données.')
  return {
    select: async <T>() => [] as T[],
    execute: async () => {},
  }
}

// ── Sélecteur automatique de plateforme ─────────────────────────
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

// ── Fonctions publiques utilisées partout dans l'app ────────────
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