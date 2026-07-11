/**
 * lib/rbac.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core RBAC definitions for BarkahFlow.
 *
 * Permission keys are plain strings so they can be stored as a JSON array
 * in the SQLite `users.permissions` column.
 *
 * Structure: every module has exactly one ACCESS permission (controls
 * whether the module's sidebar entry / page is visible at all) plus zero
 * or more ACTION permissions (control individual buttons/features inside
 * that module once access is granted).
 *
 * Rule enforced by hasPermission(): an action permission is meaningless
 * without its module's access permission. The permission-editing UI
 * (checkbox tree) should auto-check the module's access box the moment
 * any of its actions is checked, and un-checking access should clear all
 * of that module's actions — see PERMISSION_MODULES below for the
 * grouping used to build that UI.
 *
 * Admin always gets ALL permissions automatically — the list here only
 * matters for cashiers, whose grants are stored individually per user.
 */

// ─── All available permission keys ─────────────────────────────────────────
export const PERMISSIONS = {
  // Tableau de bord
  DASHBOARD_ACCESS: 'dashboard_access',
  DASHBOARD_VIEW_STATS: 'dashboard_view_stats',
  DASHBOARD_VIEW_CHARTS: 'dashboard_view_charts',

  // Caisse (POS)
  POS_ACCESS: 'pos_access',
  POS_CREATE_SALE: 'pos_create_sale',
  POS_APPLY_DISCOUNT: 'pos_apply_discount',
  POS_CREATE_DEBT: 'pos_create_debt',

  // Produits
  PRODUCTS_ACCESS: 'products_access',
  PRODUCTS_VIEW: 'products_view',
  PRODUCTS_ADD: 'products_add',
  PRODUCTS_EDIT: 'products_edit',
  PRODUCTS_DELETE: 'products_delete',
  PRODUCTS_RESTOCK: 'products_restock',
  PRODUCTS_DEACTIVATE: 'products_deactivate',
  PRODUCTS_HISTORY: 'products_history',

  // Clients
  CLIENTS_ACCESS: 'clients_access',
  CLIENTS_VIEW: 'clients_view',
  CLIENTS_ADD: 'clients_add',
  CLIENTS_EDIT: 'clients_edit',
  CLIENTS_DELETE: 'clients_delete',
  CLIENTS_EXPORT: 'clients_export',

  // Factures
  INVOICES_ACCESS: 'invoices_access',
  INVOICES_VIEW: 'invoices_view',
  INVOICES_ADD: 'invoices_add',
  INVOICES_EDIT: 'invoices_edit',
  INVOICES_DELETE: 'invoices_delete',
  INVOICES_EXPORT: 'invoices_export',
  // INVOICES_PRINT: 'invoices_print', // RETIRÉ

  // Finances (4 pages séparées : revenus, dépenses, dettes, rapports)
  FINANCE_REVENUE: 'finance_revenue',
  FINANCE_EXPENSES: 'finance_expenses',
  FINANCE_DEBTS: 'finance_debts',
  FINANCE_REPORTS: 'finance_reports',

  // Paramètres
  SETTINGS_ACCESS: 'settings_access',
  SETTINGS_COMPANY: 'settings_company',
  SETTINGS_USERS: 'settings_users',

  // ─── NOUVEAUX : IA et Notifications ──────────────────────────────
  AI_ASSISTANT: 'ai_assistant',
  NOTIFICATIONS: 'notifications',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * Default permissions granted to a newly created cashier when the admin
 * picks "Utiliser les permissions par défaut" instead of customizing.
 * A sensible baseline: can operate the till and view products/clients,
 * nothing destructive, no finances, no settings.
 */
export const DEFAULT_CASHIER_PERMISSIONS: Permission[] = [
  PERMISSIONS.DASHBOARD_ACCESS,
  PERMISSIONS.DASHBOARD_VIEW_STATS,
  PERMISSIONS.POS_ACCESS,
  PERMISSIONS.POS_CREATE_SALE,
  PERMISSIONS.PRODUCTS_ACCESS,
  PERMISSIONS.PRODUCTS_VIEW,
  PERMISSIONS.CLIENTS_ACCESS,
  PERMISSIONS.CLIENTS_VIEW,
  PERMISSIONS.INVOICES_ACCESS,
  PERMISSIONS.INVOICES_VIEW,
]

// ─── Module structure for the permission-editing UI ────────────────────────
// Each module: one access permission + a list of action permissions shown
// under it once "Accéder" is checked. This is what the accordion form
// (Ajouter / Modifier un caissier) iterates over to render itself.

export interface PermissionAction {
  key: Permission
  labelFr: string
}

export interface PermissionModule {
  key: string
  labelFr: string
  access: Permission
  actions: PermissionAction[]
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: 'dashboard',
    labelFr: 'Tableau de bord',
    access: PERMISSIONS.DASHBOARD_ACCESS,
    actions: [
      { key: PERMISSIONS.DASHBOARD_VIEW_STATS, labelFr: 'Voir les statistiques' },
      { key: PERMISSIONS.DASHBOARD_VIEW_CHARTS, labelFr: 'Voir les graphiques' },
    ],
  },
  {
    key: 'pos',
    labelFr: 'Caisse',
    access: PERMISSIONS.POS_ACCESS,
    actions: [
      { key: PERMISSIONS.POS_CREATE_SALE, labelFr: 'Créer une vente' },
      { key: PERMISSIONS.POS_APPLY_DISCOUNT, labelFr: 'Appliquer une remise' },
      { key: PERMISSIONS.POS_CREATE_DEBT, labelFr: 'Créer une dette' },
    ],
  },
  {
    key: 'products',
    labelFr: 'Produits',
    access: PERMISSIONS.PRODUCTS_ACCESS,
    actions: [
      { key: PERMISSIONS.PRODUCTS_VIEW, labelFr: 'Voir' },
      { key: PERMISSIONS.PRODUCTS_ADD, labelFr: 'Ajouter' },
      { key: PERMISSIONS.PRODUCTS_EDIT, labelFr: 'Modifier' },
      { key: PERMISSIONS.PRODUCTS_DELETE, labelFr: 'Supprimer' },
      { key: PERMISSIONS.PRODUCTS_RESTOCK, labelFr: 'Réapprovisionner' },
      { key: PERMISSIONS.PRODUCTS_DEACTIVATE, labelFr: 'Désactiver' },
      { key: PERMISSIONS.PRODUCTS_HISTORY, labelFr: "Voir l'historique" },
    ],
  },
  {
    key: 'clients',
    labelFr: 'Clients',
    access: PERMISSIONS.CLIENTS_ACCESS,
    actions: [
      { key: PERMISSIONS.CLIENTS_VIEW, labelFr: 'Voir' },
      { key: PERMISSIONS.CLIENTS_ADD, labelFr: 'Ajouter' },
      { key: PERMISSIONS.CLIENTS_EDIT, labelFr: 'Modifier' },
      { key: PERMISSIONS.CLIENTS_DELETE, labelFr: 'Supprimer' },
      { key: PERMISSIONS.CLIENTS_EXPORT, labelFr: 'Exporter' },
    ],
  },
  {
    key: 'invoices',
    labelFr: 'Factures',
    access: PERMISSIONS.INVOICES_ACCESS,
    actions: [
      { key: PERMISSIONS.INVOICES_VIEW, labelFr: 'Voir' },
      { key: PERMISSIONS.INVOICES_ADD, labelFr: 'Ajouter' },
      { key: PERMISSIONS.INVOICES_EDIT, labelFr: 'Modifier' },
      { key: PERMISSIONS.INVOICES_DELETE, labelFr: 'Supprimer' },
      { key: PERMISSIONS.INVOICES_EXPORT, labelFr: 'Exporter' },
    ],
  },
  {
    key: 'finance',
    labelFr: 'Finances',
    access: PERMISSIONS.FINANCE_REVENUE, // placeholder, not used as a real gate
    actions: [
      { key: PERMISSIONS.FINANCE_REVENUE, labelFr: 'Revenus' },
      { key: PERMISSIONS.FINANCE_EXPENSES, labelFr: 'Dépenses' },
      { key: PERMISSIONS.FINANCE_DEBTS, labelFr: 'Dettes' },
      { key: PERMISSIONS.FINANCE_REPORTS, labelFr: 'Rapports' },
    ],
  },
  {
    key: 'settings',
    labelFr: 'Paramètres',
    access: PERMISSIONS.SETTINGS_ACCESS,
    actions: [
      { key: PERMISSIONS.SETTINGS_COMPANY, labelFr: "Informations de l'entreprise" },
      { key: PERMISSIONS.SETTINGS_USERS, labelFr: 'Gestion des utilisateurs' },
    ],
  },
  // ─── NOUVEAU MODULE : IA et Notifications ──────────────────────────────
  {
    key: 'features',
    labelFr: 'Fonctionnalités',
    access: PERMISSIONS.AI_ASSISTANT, // placeholder
    actions: [
      { key: PERMISSIONS.AI_ASSISTANT, labelFr: 'Assistant IA' },
      { key: PERMISSIONS.NOTIFICATIONS, labelFr: 'Notifications' },
    ],
  },
]

// ─── Actions dépendantes de "Voir" pour le module Produits ──────
export const PRODUCTS_DEPENDENT_ACTIONS: Permission[] = [
  PERMISSIONS.PRODUCTS_EDIT,
  PERMISSIONS.PRODUCTS_DELETE,
  PERMISSIONS.PRODUCTS_RESTOCK,
  PERMISSIONS.PRODUCTS_DEACTIVATE,
  PERMISSIONS.PRODUCTS_HISTORY,
]

// ─── Actions dépendantes de "Voir" pour le module Clients ──────
export const CLIENTS_DEPENDENT_ACTIONS: Permission[] = [
  PERMISSIONS.CLIENTS_EDIT,
  PERMISSIONS.CLIENTS_DELETE,
  PERMISSIONS.CLIENTS_EXPORT,
]

/**
 * Returns true if the given user has the specified permission.
 *
 * Admins always pass — their permission list is never consulted.
 * Cashiers must have the key explicitly in their `permissions` array.
 */
export function hasPermission(
  role: 'admin' | 'cashier',
  permissions: string[],
  key: Permission
): boolean {
  if (role === 'admin') return true
  return permissions.includes(key)
}

/**
 * Finance is a special case: its sidebar group has no single access
 * permission — it shows up if the user has at least one of the four
 * finance page permissions. Use this instead of hasPermission() when
 * deciding whether to render the "Finances" nav group.
 */
export function hasFinanceGroupAccess(
  role: 'admin' | 'cashier',
  permissions: string[]
): boolean {
  if (role === 'admin') return true
  return (
    permissions.includes(PERMISSIONS.FINANCE_REVENUE) ||
    permissions.includes(PERMISSIONS.FINANCE_EXPENSES) ||
    permissions.includes(PERMISSIONS.FINANCE_DEBTS) ||
    permissions.includes(PERMISSIONS.FINANCE_REPORTS)
  )
}

/**
 * Given a set of selected permissions from the checkbox tree, ensures
 * consistency: every module whose access box isn't checked has its
 * actions stripped, and every module with at least one checked action
 * has its access box force-checked. Call this before saving a cashier's
 * permissions from the Add/Edit form.
 */
export function normalizePermissions(selected: Permission[]): Permission[] {
  const set = new Set(selected)

  for (const mod of PERMISSION_MODULES) {
    if (mod.key === 'finance') continue // finance has no single access gate
    if (mod.key === 'features') continue // features have no access gate

    // ─── LOGIQUE SPÉCIALE PRODUITS ──────────────────────────────
    if (mod.key === 'products') {
      const hasView = set.has(PERMISSIONS.PRODUCTS_VIEW)
      if (hasView) {
        PRODUCTS_DEPENDENT_ACTIONS.forEach((actionKey) => set.add(actionKey))
      } else {
        PRODUCTS_DEPENDENT_ACTIONS.forEach((actionKey) => set.delete(actionKey))
      }
    }

    // ─── LOGIQUE SPÉCIALE CLIENTS ──────────────────────────────
    if (mod.key === 'clients') {
      const hasView = set.has(PERMISSIONS.CLIENTS_VIEW)
      if (hasView) {
        CLIENTS_DEPENDENT_ACTIONS.forEach((actionKey) => set.add(actionKey))
      } else {
        CLIENTS_DEPENDENT_ACTIONS.forEach((actionKey) => set.delete(actionKey))
      }
    }

    // ─── LOGIQUE STANDARD ──────────────────────────────────────────
    const hasAnyAction = mod.actions.some((a) => set.has(a.key))
    
    if (hasAnyAction) {
      set.add(mod.access)
    } else if (!set.has(mod.access)) {
      if (mod.key === 'products') {
        const hasAdd = set.has(PERMISSIONS.PRODUCTS_ADD)
        mod.actions.forEach((a) => {
          if (a.key !== PERMISSIONS.PRODUCTS_ADD) set.delete(a.key)
        })
        if (hasAdd) set.add(mod.access)
      } else if (mod.key === 'clients') {
        const hasAdd = set.has(PERMISSIONS.CLIENTS_ADD)
        mod.actions.forEach((a) => {
          if (a.key !== PERMISSIONS.CLIENTS_ADD) set.delete(a.key)
        })
        if (hasAdd) set.add(mod.access)
      } else {
        mod.actions.forEach((a) => set.delete(a.key))
      }
    }
  }

  return Array.from(set)
}