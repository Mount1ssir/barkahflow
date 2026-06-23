PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- TABLE: clients
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- TABLE: products
-- ---------------------------------------------------------------------
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
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- TABLE: invoices
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- TABLE: line_items
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount INTEGER DEFAULT 0,
  subtotal INTEGER NOT NULL
);

-- ---------------------------------------------------------------------
-- TABLE: transactions
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- TABLE: debt_ledger
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name_ar, name_en);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status, created_at);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);