// lib/db.ts
import { Capacitor } from '@capacitor/core'

export interface DbDriver {
  select<T>(query: string, params?: any[]): Promise<T[]>
  execute(query: string, params?: any[]): Promise<void>
}

let driverInstance: DbDriver | null = null
let driverPromise: Promise<DbDriver> | null = null

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

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  name_fr TEXT,
  description TEXT,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  name_fr TEXT,
  unit TEXT,
  cost_price INTEGER NOT NULL,
  retail_price INTEGER NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER DEFAULT 0,
  alert_threshold INTEGER NOT NULL DEFAULT 5,
  tax_rate REAL DEFAULT 0,
  image_path TEXT,
  supplier_name TEXT,
  description TEXT,
  show_in_pos INTEGER DEFAULT 1,
  track_stock INTEGER DEFAULT 1,
  is_favorite INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  category_id TEXT REFERENCES categories(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  client_address TEXT,
  subtotal INTEGER NOT NULL,
  tax INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PAID', 'PARTIAL', 'UNPAID')),
  payment_method TEXT DEFAULT 'cash',
  due_date TEXT,
  po_number TEXT,
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
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
  pin_hash TEXT,
  role TEXT CHECK(role IN ('admin', 'cashier')) DEFAULT 'cashier',
  active INTEGER NOT NULL DEFAULT 1,
  permissions TEXT DEFAULT '[]',
  avatar_url TEXT,
  supabase_uid TEXT,
  email TEXT,
  phone TEXT,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login TEXT,
  last_activity TEXT,
  is_online INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cashier_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS cashier_stats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  sales INTEGER NOT NULL DEFAULT 0,
  revenue INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  debt INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, date)
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
  unit_price INTEGER,
  previous_qty INTEGER,
  new_qty INTEGER,
  reason TEXT,
  user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
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
  year TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name_ar, name_en);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity);
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);
CREATE INDEX IF NOT EXISTS idx_cashier_settings_user_id ON cashier_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_cashier_settings_key ON cashier_settings(key);
CREATE INDEX IF NOT EXISTS idx_cashier_stats_user_id ON cashier_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_cashier_stats_date ON cashier_stats(date);
CREATE INDEX IF NOT EXISTS idx_sequence_numbers_id ON sequence_numbers(id);
`

const MIGRATIONS = [
  // Clients
  `ALTER TABLE clients ADD COLUMN credit_limit INTEGER DEFAULT NULL;`,

  // Categories
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  // Products - ajout des colonnes manquantes
  `ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1;`,
  `ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES categories(id);`,
  `ALTER TABLE products ADD COLUMN reserved_stock INTEGER DEFAULT 0;`,

  // Index products
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);`,

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
  `ALTER TABLE invoices ADD COLUMN user_name TEXT;`,
  `ALTER TABLE invoices ADD COLUMN client_name TEXT;`,
  `ALTER TABLE invoices ADD COLUMN client_phone TEXT;`,
  `ALTER TABLE invoices ADD COLUMN client_email TEXT;`,
  `ALTER TABLE invoices ADD COLUMN client_address TEXT;`,
  `ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'cash';`,

  // Transactions user_id
  `ALTER TABLE transactions ADD COLUMN user_id TEXT REFERENCES users(id);`,

  // Users - version initiale
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

  // AJOUT DES COLONNES MANQUANTES SUR stock_movements
  `ALTER TABLE stock_movements ADD COLUMN previous_qty INTEGER;`,
  `ALTER TABLE stock_movements ADD COLUMN new_qty INTEGER;`,
  `ALTER TABLE stock_movements ADD COLUMN user_id TEXT REFERENCES users(id);`,
  `ALTER TABLE stock_movements ADD COLUMN unit_price INTEGER;`,

  // Index
  `CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);`,

  // RBAC columns on users
  `ALTER TABLE users ADD COLUMN supabase_uid TEXT;`,
  `ALTER TABLE users ADD COLUMN email TEXT;`,
  `ALTER TABLE users ADD COLUMN phone TEXT;`,

  // Make pin_hash nullable for admin (Supabase auth, no PIN)
  `CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);`,

  // Audit logs table
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    before_state TEXT,
    after_state TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  );`,

  // Cashier PIN lockout columns
  `ALTER TABLE users ADD COLUMN failed_pin_attempts INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE users ADD COLUMN locked_until TEXT;`,

  // last_login sur users
  `ALTER TABLE users ADD COLUMN last_login TEXT;`,

  // ✅ AJOUT DE last_activity SUR users
  `ALTER TABLE users ADD COLUMN last_activity TEXT;`,

  // ✅ AJOUT DE last_activity INDEX
  `CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity);`,

  // ✅ AJOUT DE is_online SUR users (présence temps réel cohérente)
  `ALTER TABLE users ADD COLUMN is_online INTEGER NOT NULL DEFAULT 0;`,
  `CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);`,

  // ✅ AJOUT DE cashier_settings
  `CREATE TABLE IF NOT EXISTS cashier_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, key)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_cashier_settings_user_id ON cashier_settings(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_cashier_settings_key ON cashier_settings(key);`,

  // ✅ AJOUT DE cashier_stats
  `CREATE TABLE IF NOT EXISTS cashier_stats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    sales INTEGER NOT NULL DEFAULT 0,
    revenue INTEGER NOT NULL DEFAULT 0,
    discount INTEGER NOT NULL DEFAULT 0,
    debt INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, date)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_cashier_stats_user_id ON cashier_stats(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_cashier_stats_date ON cashier_stats(date);`,

  // ✅ Table de suivi de version du schéma (pour migrations idempotentes)
  `CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`,

  // ✅ Sequence numbers pour les factures
  `CREATE TABLE IF NOT EXISTS sequence_numbers (
    id TEXT PRIMARY KEY,
    prefix TEXT NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0,
    year TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_sequence_numbers_id ON sequence_numbers(id);`,
]

// ─── Suivi de version du schéma (migrations idempotentes) ────────────────
async function getSchemaVersion(db: any): Promise<number> {
  try {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
    )
    const rows = (await db.select(
      `SELECT value FROM schema_meta WHERE key = 'version'`
    )) as { value: string }[]
    return rows.length > 0 ? parseInt(rows[0].value, 10) : 0
  } catch {
    return 0
  }
}

async function setSchemaVersion(db: any, version: number): Promise<void> {
  await db.execute(
    `INSERT INTO schema_meta (key, value) VALUES ('version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(version)]
  )
}

// Vérifie si la table invoices a encore l'ancien CHECK (minuscules) et a donc besoin d'être reconstruite
async function invoicesNeedsStatusFix(db: any): Promise<boolean> {
  try {
    const rows = (await db.select(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='invoices'`
    )) as { sql: string }[]
    if (rows.length === 0) return false
    const ddl = rows[0].sql || ''
    return !ddl.includes("'PAID'")
  } catch {
    return false
  }
}

// Vérifie/ajoute une colonne de façon fiable via PRAGMA table_info, au lieu de
// compter sur un ALTER TABLE à l'aveugle dont l'échec pourrait être avalé silencieusement.
async function ensureColumn(
  db: any,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  try {
    const cols = (await db.select(`PRAGMA table_info(${table})`)) as { name: string }[]
    const exists = cols.some((c) => c.name === column)
    if (exists) return

    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)

    // Vérification post-exécution : confirme réellement que la colonne a été ajoutée
    const colsAfter = (await db.select(`PRAGMA table_info(${table})`)) as { name: string }[]
    const nowExists = colsAfter.some((c) => c.name === column)
    if (nowExists) {
      console.log(`BarkahFlow: colonne ${table}.${column} ajoutée avec succès`)
    } else {
      console.error(`BarkahFlow: ÉCHEC — ${table}.${column} toujours absente après ALTER TABLE`)
    }
  } catch (e: any) {
    console.error(`BarkahFlow: erreur ensureColumn(${table}.${column}):`, e?.message)
  }
}

async function runMigrations(db: any) {
  // Vérifié et fiable — remplace l'ancien ALTER TABLE à l'aveugle
  await ensureColumn(db, 'products', 'name_fr', 'TEXT')
  await ensureColumn(db, 'products', 'barcode', 'TEXT')
  await ensureColumn(db, 'products', 'unit', 'TEXT')
  await ensureColumn(db, 'products', 'image_path', 'TEXT')
  await ensureColumn(db, 'products', 'supplier_name', 'TEXT')
  await ensureColumn(db, 'products', 'description', 'TEXT')
  await ensureColumn(db, 'products', 'reserved_stock', 'INTEGER DEFAULT 0')
  await ensureColumn(db, 'categories', 'name_fr', 'TEXT')
  await ensureColumn(db, 'stock_movements', 'unit_price', 'INTEGER')
  await ensureColumn(db, 'stock_movements', 'previous_qty', 'INTEGER')
  await ensureColumn(db, 'stock_movements', 'new_qty', 'INTEGER')
  await ensureColumn(db, 'stock_movements', 'user_id', 'TEXT REFERENCES users(id)')

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

  // ✅ FORCER LA CRÉATION DE LA TABLE sequence_numbers
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sequence_numbers (
        id TEXT PRIMARY KEY,
        prefix TEXT NOT NULL,
        last_number INTEGER NOT NULL DEFAULT 0,
        year TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_sequence_numbers_id ON sequence_numbers(id)`)
    console.log('✅ Table sequence_numbers vérifiée/créée')
  } catch (e) {
    console.warn('⚠️ Erreur création sequence_numbers:', e)
  }

  // ✅ CORRECTION DÉFINITIVE: rebuild de invoices une seule fois, uniquement si nécessaire
  const schemaVersion = await getSchemaVersion(db)
  if (schemaVersion < 1) {
    const needsFix = await invoicesNeedsStatusFix(db)

    if (needsFix) {
      try {
        await db.execute('PRAGMA foreign_keys = OFF;')

        await db.execute(`DROP TABLE IF EXISTS invoices_new;`)

        await db.execute(`
          CREATE TABLE invoices_new (
            id TEXT PRIMARY KEY,
            invoice_number TEXT UNIQUE NOT NULL,
            client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
            client_name TEXT,
            client_phone TEXT,
            client_email TEXT,
            client_address TEXT,
            subtotal INTEGER NOT NULL,
            tax INTEGER NOT NULL DEFAULT 0,
            discount INTEGER NOT NULL DEFAULT 0,
            total INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('PAID', 'PARTIAL', 'UNPAID')),
            payment_method TEXT DEFAULT 'cash',
            due_date TEXT,
            po_number TEXT,
            user_id TEXT REFERENCES users(id),
            user_name TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `)

        await db.execute(`
          INSERT OR REPLACE INTO invoices_new (
            id, invoice_number, client_id, client_name, client_phone,
            client_email, client_address, subtotal, tax, discount, total,
            status, payment_method, due_date, po_number, user_id, user_name,
            created_at, updated_at
          )
          SELECT
            id, invoice_number, client_id, client_name, client_phone,
            client_email, client_address, subtotal, tax, discount, total,
            UPPER(status), payment_method, due_date, po_number, user_id, user_name,
            created_at, updated_at
          FROM invoices
        `)

        await db.execute(`DROP TABLE invoices`)
        await db.execute(`ALTER TABLE invoices_new RENAME TO invoices`)

        await db.execute(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status, created_at)`)
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)`)
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id)`)

        console.log('BarkahFlow: correction du CHECK status appliquée')
      } catch (e: any) {
        console.error('Migration status CHECK échouée:', e?.message)
      } finally {
        try {
          await db.execute('PRAGMA foreign_keys = ON;')
        } catch {}
      }
    } else {
      console.log('BarkahFlow: schéma invoices déjà correct, rebuild ignoré')
    }

    await setSchemaVersion(db, 1)
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
  if (driverPromise) return driverPromise

  driverPromise = (async () => {
    if (isCapacitorMobile()) {
      driverInstance = await createCapacitorDriver()
    } else if (isTauriEnv()) {
      driverInstance = await createTauriDriver()
    } else {
      driverInstance = createMockDriver()
    }
    return driverInstance
  })()

  try {
    return await driverPromise
  } catch (e) {
    driverPromise = null
    throw e
  }
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