import { dbSelect, dbExecute } from '@/src/lib/db'

export interface CompanySettings {
  id: string
  companyName: string
  address: string
  city: string
  phone: string
  email: string
  website: string
  logoUrl: string
  ice: string
  rc: string
  ifNumber: string
  cnss: string
  rib: string
  bankName: string
  tvaRate: number
  invoicePrefix: string
  invoiceFooter: string
  currency: string
  defaultPaymentTermsDays: number      // ajout : délai de paiement par défaut (en jours)
  latePaymentPenaltyText: string        // ajout : mention légale pénalités de retard
  createdAt: string
  updatedAt: string
}

// Valeurs par défaut (tout vide)
const DEFAULT_SETTINGS: CompanySettings = {
  id: 'single',
  companyName: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '',
  ice: '',
  rc: '',
  ifNumber: '',
  cnss: '',
  rib: '',
  bankName: '',
  tvaRate: 0,
  invoicePrefix: '',
  invoiceFooter: '',
  currency: '',
  defaultPaymentTermsDays: 30,
  latePaymentPenaltyText:
    'Tout retard de paiement entraîne l\'application de pénalités au taux légal en vigueur, sans mise en demeure préalable.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// Mappe une ligne SQL vers l'interface
function mapRow(row: any): CompanySettings {
  return {
    id: row.id ?? 'single',
    companyName: row.company_name ?? '',
    address: row.address ?? '',
    city: row.city ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    website: row.website ?? '',
    logoUrl: row.logo_url ?? '',
    ice: row.ice ?? '',
    rc: row.rc ?? '',
    ifNumber: row.if_number ?? '',
    cnss: row.cnss ?? '',
    rib: row.rib ?? '',
    bankName: row.bank_name ?? '',
    tvaRate: row.tva_rate ?? 0,
    invoicePrefix: row.invoice_prefix ?? '',
    invoiceFooter: row.invoice_footer ?? '',
    currency: row.currency ?? '',
    defaultPaymentTermsDays: row.default_payment_terms_days ?? 30,
    latePaymentPenaltyText: row.late_payment_penalty_text ?? DEFAULT_SETTINGS.latePaymentPenaltyText,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Récupère les paramètres de l'entreprise.
 * Si la ligne n'existe pas, elle est créée automatiquement avec des valeurs vides.
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    // On s'assure que la table existe (déjà créée par db.ts, mais sécurité)
    await ensureTableExists()

    // Lecture de la ligne unique
    const rows = await dbSelect<any>('SELECT * FROM company_settings LIMIT 1')

    if (rows.length === 0) {
      // Aucune ligne : on en crée une avec des valeurs vides
      await createEmptySettings()
      const newRows = await dbSelect<any>('SELECT * FROM company_settings LIMIT 1')
      return mapRow(newRows[0])
    }

    return mapRow(rows[0])
  } catch (error) {
    console.error('❌ Erreur getCompanySettings:', error)
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Met à jour les paramètres de l'entreprise.
 * @param settings Objet partiel contenant les champs à modifier.
 */
export async function updateCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
  try {
    console.log('📝 updateCompanySettings appelé avec :', settings)

    await ensureTableExists()

    // Construire dynamiquement la requête UPDATE
    const fields: [string, any][] = []
    const validFields: Record<string, string> = {
      companyName: 'company_name',
      address: 'address',
      city: 'city',
      phone: 'phone',
      email: 'email',
      website: 'website',
      logoUrl: 'logo_url',
      ice: 'ice',
      rc: 'rc',
      ifNumber: 'if_number',
      cnss: 'cnss',
      rib: 'rib',
      bankName: 'bank_name',
      tvaRate: 'tva_rate',
      invoicePrefix: 'invoice_prefix',
      invoiceFooter: 'invoice_footer',
      currency: 'currency',
      defaultPaymentTermsDays: 'default_payment_terms_days',
      latePaymentPenaltyText: 'late_payment_penalty_text',
    }

    for (const [key, dbField] of Object.entries(validFields)) {
      if (settings[key as keyof CompanySettings] !== undefined) {
        const value = settings[key as keyof CompanySettings]
        fields.push([dbField, value === '' ? null : value])
      }
    }

    if (fields.length === 0) {
      console.warn('⚠️ Aucun champ à mettre à jour')
      return getCompanySettings()
    }

    // Construire la clause SET
    const setClause = fields.map(([field]) => `${field} = ?`).join(', ')
    const values = fields.map(([, value]) => value)

    // Ajouter updated_at
    const query = `UPDATE company_settings SET ${setClause}, updated_at = datetime('now') WHERE id = 'single'`

    console.log('🔧 Requête UPDATE :', query)
    console.log('📦 Valeurs :', values)

    await dbExecute(query, values)

    // Relecture pour vérifier la mise à jour
    const updated = await getCompanySettings()
    console.log('✅ Données après mise à jour :', updated)

    return updated
  } catch (error) {
    console.error('❌ Erreur updateCompanySettings:', error)
    return { ...DEFAULT_SETTINGS }
  }
}

// ─── Fonctions internes ──────────────────────────────────────────

async function ensureTableExists(): Promise<void> {
  try {
    const tables = await dbSelect<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='company_settings'`
    )
    if (tables.length === 0) {
      console.log('📦 Création de la table company_settings')
      await dbExecute(`
        CREATE TABLE company_settings (
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
          default_payment_terms_days INTEGER DEFAULT 30,
          late_payment_penalty_text TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
      await createEmptySettings()
    } else {
      // ── Migration douce pour les bases déjà existantes ──────────
      await ensureColumnExists('default_payment_terms_days', 'INTEGER DEFAULT 30')
      await ensureColumnExists('late_payment_penalty_text', 'TEXT')
    }
  } catch (error) {
    console.error('❌ Erreur ensureTableExists:', error)
    throw error
  }
}

async function ensureColumnExists(columnName: string, columnDef: string): Promise<void> {
  try {
    await dbExecute(`ALTER TABLE company_settings ADD COLUMN ${columnName} ${columnDef}`)
  } catch (e: any) {
    // Colonne déjà existante : on ignore silencieusement
    if (!e?.message?.includes('duplicate column name')) {
      console.warn(`⚠️ Migration company_settings.${columnName}:`, e?.message)
    }
  }
}

async function createEmptySettings(): Promise<void> {
  await dbExecute(`
    INSERT INTO company_settings (id, company_name, default_payment_terms_days, late_payment_penalty_text, created_at, updated_at)
    VALUES ('single', '', 30, ?, datetime('now'), datetime('now'))
  `, [
    'Tout retard de paiement entraîne l\'application de pénalités au taux légal en vigueur, sans mise en demeure préalable.'
  ])
  console.log('✅ Ligne vide créée dans company_settings')
}