// lib/voice/offline-fallback.ts
// ─────────────────────────────────────────────────────────────────────────────
// Two-pass offline fallback:
//   Pass 1 — Keyword rules (regex-based, instant, covers all common phrasings)
//   Pass 2 — Fuse.js fuzzy search (catches edge cases not covered by rules)
// Total response time: < 5ms, zero network.
// ─────────────────────────────────────────────────────────────────────────────

import Fuse from 'fuse.js'
import type { ParsedCommand, Intent } from './voice-types'

// ─────────────────────────────────────────────────────────────────────────────
// PASS 1 — Keyword rule table
// Rules are evaluated in order; first match wins.
// Each `match` function receives the fully normalized input string.
// ─────────────────────────────────────────────────────────────────────────────
interface KeywordRule {
  intent: Intent
  page?: string
  requiresConfirmation: boolean
  match: (t: string) => boolean
}

const NAV_TRIGGERS = /aller|ouvre|ouvrir|va\b|vas\b|navigue|vers\b|affiche|afficher|voir\b|goto|go to/
const COUNT_TRIGGERS = /nombre|combien|total|count/

const KEYWORD_RULES: KeywordRule[] = [
  // ── Confirmation (short phrases, checked first) ───────────────────────────
  {
    intent: 'CONFIRM_YES', requiresConfirmation: false,
    match: t => t.split(' ').length <= 4 && /\b(oui|ok|confirme|banco|accord|ouais|vas.?y|allez|yep)\b/.test(t),
  },
  {
    intent: 'CONFIRM_NO', requiresConfirmation: false,
    match: t => t.split(' ').length <= 4 && /\b(non|annule|stop|jamais|abandonne|nope|nop)\b/.test(t),
  },
  {
    intent: 'REPEAT', requiresConfirmation: false,
    match: t => /repete|encore une fois|dis encore|redemande/.test(t),
  },

  // ── Statistics ────────────────────────────────────────────────────────────
  // Today's revenue — more specific, checked before STATS_REVENUE
  {
    intent: 'STATS_SALES_TODAY', requiresConfirmation: false,
    match: t => /aujourd|du jour|encaissement|journee|recette/.test(t),
  },
  // Total revenue / CA
  {
    intent: 'STATS_REVENUE', requiresConfirmation: false,
    match: t => /chiffre|affaires|\bca\b|revenu|ventes?.*(total|global)|total.*(ventes?|revenus?)/.test(t),
  },
  // Low stock / rupture
  {
    intent: 'STATS_LOW_STOCK', requiresConfirmation: false,
    match: t => /rupture|manquant|epuis|stock faible|a reapprovisionner/.test(t),
  },
  // Total debt — "dette" alone is ambiguous, require a quantity/total keyword
  {
    intent: 'STATS_TOTAL_DEBT', requiresConfirmation: false,
    match: t => /dette|creance|impay/.test(t) && /total|montant|combien|somme/.test(t),
  },

  // ── Counts ────────────────────────────────────────────────────────────────
  {
    intent: 'PRODUCT_COUNT', requiresConfirmation: false,
    match: t => COUNT_TRIGGERS.test(t) && /produit|article|stock/.test(t),
  },
  {
    intent: 'CLIENT_COUNT', requiresConfirmation: false,
    match: t => COUNT_TRIGGERS.test(t) && /client|contact/.test(t),
  },
  {
    intent: 'CLIENT_DEBTORS', requiresConfirmation: false,
    match: t => /qui me doit|endett|debiteur|clients?.*(dette|doit)|doit de l argent/.test(t),
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  {
    intent: 'NAVIGATE', page: 'clients', requiresConfirmation: false,
    match: t => /client/.test(t) && NAV_TRIGGERS.test(t),
  },
  {
    intent: 'NAVIGATE', page: 'produits', requiresConfirmation: false,
    match: t => /produit|product|article/.test(t) && NAV_TRIGGERS.test(t),
  },
  {
    intent: 'NAVIGATE', page: 'factures', requiresConfirmation: false,
    match: t => /facture|invoice/.test(t) && NAV_TRIGGERS.test(t),
  },
  {
    intent: 'NAVIGATE', page: 'caisse', requiresConfirmation: false,
    match: t => /caisse|\bpos\b|point de vente/.test(t) && NAV_TRIGGERS.test(t),
  },
  {
    intent: 'NAVIGATE', page: 'rapports', requiresConfirmation: false,
    match: t => /rapport|statistic|analyse/.test(t) && NAV_TRIGGERS.test(t),
  },
  {
    intent: 'NAVIGATE', page: 'dettes', requiresConfirmation: false,
    match: t => /dette|creance|impay/.test(t) && NAV_TRIGGERS.test(t),
  },
  {
    intent: 'NAVIGATE', page: 'accueil', requiresConfirmation: false,
    match: t => /accueil|dashboard|tableau.*bord|home/.test(t),
  },
  {
    intent: 'NAVIGATE', page: 'parametres', requiresConfirmation: false,
    match: t => /parametre|setting|configuration|option/.test(t),
  },

  // ── Misc ──────────────────────────────────────────────────────────────────
  {
    intent: 'EXPORT', requiresConfirmation: false,
    match: t => /export/.test(t),
  },
  {
    intent: 'CLEAR_SEARCH', requiresConfirmation: false,
    match: t => /efface|vide|clear/.test(t) && /recherche|search/.test(t),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// PASS 2 — Fuse.js catalogue (handles phrasings the rules don't catch)
// ─────────────────────────────────────────────────────────────────────────────
interface FuseExample {
  intent: Intent
  text: string
  page?: string
  requiresConfirmation: boolean
}

const FUSE_EXAMPLES: FuseExample[] = [
  { intent: 'STATS_REVENUE',     text: 'quel est mon chiffre affaires ca total revenus',          requiresConfirmation: false },
  { intent: 'STATS_SALES_TODAY', text: 'combien ai je encaisse aujourd hui recette encaissement', requiresConfirmation: false },
  { intent: 'STATS_LOW_STOCK',   text: 'produits rupture stock epuises manquants faibles',        requiresConfirmation: false },
  { intent: 'STATS_TOTAL_DEBT',  text: 'total dettes montant creances clients doivent',           requiresConfirmation: false },
  { intent: 'PRODUCT_COUNT',     text: 'combien produits nombre stock inventaire total articles', requiresConfirmation: false },
  { intent: 'CLIENT_COUNT',      text: 'combien clients nombre total contacts',                   requiresConfirmation: false },
  { intent: 'CLIENT_DEBTORS',    text: 'clients endettes qui doit argent debiteurs liste',        requiresConfirmation: false },
  { intent: 'NAVIGATE', page: 'clients',    text: 'aller ouvre clients page liste',               requiresConfirmation: false },
  { intent: 'NAVIGATE', page: 'produits',   text: 'aller ouvre produits articles stock',          requiresConfirmation: false },
  { intent: 'NAVIGATE', page: 'factures',   text: 'aller ouvre factures invoices',                requiresConfirmation: false },
  { intent: 'NAVIGATE', page: 'caisse',     text: 'aller ouvre caisse pos ventes',                requiresConfirmation: false },
  { intent: 'NAVIGATE', page: 'rapports',   text: 'aller ouvre rapports statistiques',            requiresConfirmation: false },
  { intent: 'NAVIGATE', page: 'accueil',    text: 'tableau bord accueil dashboard home',          requiresConfirmation: false },
  { intent: 'CONFIRM_YES', text: 'oui confirme ok ouais banco accord',                            requiresConfirmation: false },
  { intent: 'CONFIRM_NO',  text: 'non annule stop jamais',                                        requiresConfirmation: false },
  { intent: 'EXPORT',       text: 'exporter exporte donnees fichier',                             requiresConfirmation: false },
  { intent: 'REPEAT',       text: 'repete encore fois redis',                                     requiresConfirmation: false },
]

let _fuse: Fuse<FuseExample> | null = null
function getFuse(): Fuse<FuseExample> {
  if (!_fuse) {
    _fuse = new Fuse(FUSE_EXAMPLES, {
      keys: ['text'],
      threshold: 0.45,
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 3,
    })
  }
  return _fuse
}

// ─────────────────────────────────────────────────────────────────────────────
// Text normalizer
// ─────────────────────────────────────────────────────────────────────────────
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: é→e, à→a, etc.
    .replace(/[^a-z0-9 ]/g, ' ')    // remove punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Two-pass offline command parser.
 * Pass 1: Fast keyword rules (handles all common French phrasings).
 * Pass 2: Fuse.js fuzzy search (catches edge cases).
 * Returns null only if neither pass finds a confident match.
 */
export function parseCommandOffline(
  input: string,
  _currentPath?: string
): ParsedCommand | null {
  const t = normalize(input)
  if (!t) return null

  // ── Pass 1: Keyword rules ──────────────────────────────────────────────────
  for (const rule of KEYWORD_RULES) {
    if (rule.match(t)) {
      return {
        intent: rule.intent,
        entities: rule.page ? [{ type: 'page' as const, value: rule.page }] : [],
        originalText: input,
        confidence: 0.82,
        requiresConfirmation: rule.requiresConfirmation,
      }
    }
  }

  // ── Pass 2: Fuse.js fuzzy fallback ────────────────────────────────────────
  const results = getFuse().search(t)
  if (!results.length) return null

  const best = results[0]
  const score = best.score ?? 1
  if (score > 0.45) return null   // reject weak matches

  const match = best.item
  return {
    intent: match.intent,
    entities: match.page ? [{ type: 'page' as const, value: match.page }] : [],
    originalText: input,
    confidence: parseFloat((1 - score).toFixed(3)),
    requiresConfirmation: match.requiresConfirmation,
  }
}
