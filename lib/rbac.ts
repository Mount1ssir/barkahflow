/**
 * lib/rbac.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core RBAC definitions for BarkahFlow.
 *
 * Permission keys are plain strings so they can be stored as a JSON array
 * in the SQLite `users.permissions` column.
 *
 * Admin always gets ALL permissions automatically — the list here only
 * matters for cashiers, whose grants are stored individually per user.
 */

// ─── All available permission keys ─────────────────────────────────────────
export const PERMISSIONS = {
  // Dashboard
  VIEW_FULL_DASHBOARD: 'view_full_dashboard',  // full stats + revenue charts

  // POS / Caisse
  CAN_APPLY_DISCOUNT: 'can_apply_discount',    // apply item/cart discounts
  CAN_PROCESS_REFUND: 'can_process_refund',    // issue refunds

  // Products
  CAN_EDIT_PRODUCTS: 'can_edit_products',      // create / edit / delete products

  // Invoices
  VIEW_ALL_INVOICES: 'view_all_invoices',      // see invoices from all users
  CAN_VOID_INVOICES: 'can_void_invoices',      // void / cancel an invoice

  // Clients
  CAN_EDIT_CLIENTS: 'can_edit_clients',        // create / edit / delete clients

  // Financial modules
  VIEW_REVENUE: 'view_revenue',                // Revenus + Dépenses pages
  VIEW_DEBTS: 'view_debts',                    // Dettes page
  VIEW_REPORTS: 'view_reports',               // Rapports page

  // Company settings
  CAN_EDIT_COMPANY: 'can_edit_company',        // edit Boutique / company profile
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * Default permissions granted to a newly created cashier.
 * Admin always has full access — these defaults only apply to cashiers.
 */
export const DEFAULT_CASHIER_PERMISSIONS: Permission[] = []

/**
 * All permissions an admin can assign to a cashier via the checklist.
 * Ordered for display in the User Management form.
 */
export const ASSIGNABLE_PERMISSIONS: { key: Permission; labelFr: string; group: string }[] = [
  // Dashboard
  { key: PERMISSIONS.VIEW_FULL_DASHBOARD, labelFr: 'Voir les statistiques complètes (revenus, graphiques)', group: 'Tableau de bord' },

  // POS
  { key: PERMISSIONS.CAN_APPLY_DISCOUNT,  labelFr: 'Appliquer des remises à la caisse',                    group: 'Caisse (POS)' },
  { key: PERMISSIONS.CAN_PROCESS_REFUND,  labelFr: 'Traiter les remboursements',                           group: 'Caisse (POS)' },

  // Products
  { key: PERMISSIONS.CAN_EDIT_PRODUCTS,   labelFr: 'Créer, modifier et supprimer des produits',            group: 'Produits' },

  // Invoices
  { key: PERMISSIONS.VIEW_ALL_INVOICES,   labelFr: 'Voir les factures de tous les utilisateurs',           group: 'Factures' },
  { key: PERMISSIONS.CAN_VOID_INVOICES,   labelFr: 'Annuler des factures',                                 group: 'Factures' },

  // Clients
  { key: PERMISSIONS.CAN_EDIT_CLIENTS,    labelFr: 'Créer, modifier et supprimer des clients',             group: 'Clients' },

  // Financial
  { key: PERMISSIONS.VIEW_REVENUE,        labelFr: 'Accéder aux revenus et dépenses',                      group: 'Finances' },
  { key: PERMISSIONS.VIEW_DEBTS,          labelFr: 'Accéder à la gestion des dettes',                      group: 'Finances' },
  { key: PERMISSIONS.VIEW_REPORTS,        labelFr: 'Accéder aux rapports',                                 group: 'Finances' },

  // Settings
  { key: PERMISSIONS.CAN_EDIT_COMPANY,   labelFr: "Modifier les informations de l'entreprise",             group: 'Paramètres' },
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
