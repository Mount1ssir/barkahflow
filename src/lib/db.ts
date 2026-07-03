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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  name_ar TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  name_ar TEXT NOT NULL,
  name_fr TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'piece',
  cost_price INTEGER NOT NULL,
  retail_price INTEGER NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER NOT NULL DEFAULT 0,
  alert_threshold INTEGER NOT NULL DEFAULT 5,
  tax_rate REAL DEFAULT 0,
  image_path TEXT,
  supplier_name TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('in', 'out')),
  quantity INTEGER NOT NULL,
  unit_price INTEGER,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  subtotal INTEGER NOT NULL,
  tax INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'PENDING', 'CONFIRMED', 'PAID', 'CANCELLED', 'RETURNED')),
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

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_state TEXT,
  after_state TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sequence_numbers (
  id TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  year TEXT NOT NULL
);

-- ✅ Table des paramètres de l'entreprise (sans contrainte NOT NULL)
CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY DEFAULT 'single',
  company_name TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  ice TEXT,
  rc TEXT,
  if_number TEXT,
  cnss TEXT,
  rib TEXT,
  bank_name TEXT,
  tva_rate REAL,
  invoice_prefix TEXT,
  invoice_footer TEXT,
  currency TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insertion d'une ligne vide si la table est nouvellement créée
INSERT OR IGNORE INTO company_settings (id, company_name) VALUES ('single', '');

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name_ar, name_fr);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status, created_at);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name_fr);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at);
`

// ── Migrations ─────────────────────────────────────────────────────
const MIGRATIONS = [
  `ALTER TABLE products ADD COLUMN reserved_stock INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'DRAFT' 
   CHECK(status IN ('DRAFT', 'PENDING', 'CONFIRMED', 'PAID', 'CANCELLED', 'RETURNED'));`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    before_state TEXT,
    after_state TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS sequence_numbers (
    id TEXT PRIMARY KEY,
    prefix TEXT NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0,
    year TEXT NOT NULL
  );`,
  `ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;`,
  `ALTER TABLE products ADD COLUMN image_path TEXT;`,
  `ALTER TABLE products ADD COLUMN supplier_name TEXT;`,
  `ALTER TABLE products ADD COLUMN description TEXT;`,
  `ALTER TABLE products ADD COLUMN tax_rate REAL DEFAULT 0;`,
  `ALTER TABLE products ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`,
  `ALTER TABLE products ADD COLUMN alert_threshold INTEGER NOT NULL DEFAULT 5;`,
  `ALTER TABLE products ADD COLUMN stock_qty INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE categories ADD COLUMN color TEXT DEFAULT '#3B82F6';`

  // ⚠️ ATTENTION : NE PAS SUPPRIMER LA TABLE company_settings !
  // La table est déjà créée dans le SCHEMA initial avec toutes les colonnes.
  // Supprimer et recréer effacerait les données de l'entreprise à chaque rechargement.
  // Les migrations suivantes sont donc SUPPRIMÉES :
  // `DROP TABLE IF EXISTS company_settings;`,
  // `CREATE TABLE company_settings ( ... );`,
  // `INSERT OR IGNORE INTO company_settings (id, company_name) VALUES ('single', '');`
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
        // ignoré
      } else {
        console.warn('Migration warning:', msg)
      }
    }
  }
}

// ── Détection de plateforme ──────────────────────────────────────
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

  console.log('BarkahFlow: SQLite Tauri prêt avec migrations')

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

  console.log('BarkahFlow: SQLite Capacitor prêt avec migrations')

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

// ── Mock ──────────────────────────────────────────────────────────
function createMockDriver(): DbDriver {
  console.warn('BarkahFlow: Mode navigateur web SQLite non disponible.')
  console.warn('Lance npm run tauri dev pour la vraie base de données.')
  return {
    select: async <T>() => [] as T[],
    execute: async () => {},
  }
}

// ── Sélecteur automatique ──────────────────────────────────────
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

// ─── Fonctions publiques ──────────────────────────────────────────
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

// ✅ dbSelectWithRetry – pour les lectures
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
        console.warn(`⚠️ Base verrouillée (lecture), tentative ${attempt}/${maxRetries}...`)
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
        continue
      }
      throw error
    }
  }
  throw lastError
}

// ✅ dbExecuteWithRetry – pour les écritures
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
        console.warn(`⚠️ Base verrouillée (écriture), tentative ${attempt}/${maxRetries}...`)
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
        continue
      }
      throw error
    }
  }
  throw lastError
}