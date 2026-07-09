import Fuse from 'fuse.js'
import { ParsedCommand, Intent } from './voice-types'

// ─── Nombres écrits en lettres ────────────────────────────────────
const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
};

const FILLER_PATTERN =
  /\b(est ce que|s il te plait|s il vous plait|stp|svp|please|tu peux|peux tu|pourrais tu|voudrais tu|dis moi|dis donc|dis|bonjour|merci)\b/g;

// ✅ Normalisation conservant les tirets et points
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/'/g, ' ')
    .replace(/[^a-z0-9 \-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFillers(text: string): string {
  return text.replace(FILLER_PATTERN, '').replace(/\s+/g, ' ').trim();
}

function parseQuantity(raw: string | undefined, fallback = 1): number {
  if (!raw) return fallback;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return NUMBER_WORDS[raw] ?? fallback;
}

function damerauLevenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[a.length][b.length];
}

function maxAllowedDistance(word: string): number {
  return word.length <= 4 ? 1 : 2;
}

function fuzzyMatchWord(word: string, candidates: string[]): boolean {
  return candidates.some((c) => damerauLevenshtein(word, c) <= maxAllowedDistance(c));
}

function findTriggerInTokens(
  tokens: string[],
  triggers: string[]
): { index: number; rest: string } | null {
  for (let i = 0; i < tokens.length; i++) {
    if (fuzzyMatchWord(tokens[i], triggers)) {
      return { index: i, rest: tokens.slice(i + 1).join(' ') };
    }
  }
  return null;
}

function fuzzyMatchWholeText(text: string, candidates: string[]): boolean {
  return candidates.some((c) => damerauLevenshtein(text, c) <= maxAllowedDistance(c));
}

// ─── Pages ─────────────────────────────────────────────────────────
const PAGE_PATHS: Record<string, string> = {
  'accueil': '/dashboard',
  'tableau de bord': '/dashboard',
  'dashboard': '/dashboard',
  'clients': '/dashboard/clients',
  'client': '/dashboard/clients',
  'produits': '/dashboard/produits',
  'stock': '/dashboard/produits',
  'articles': '/dashboard/produits',
  'factures': '/dashboard/factures',
  'facture': '/dashboard/factures',
  'dettes': '/dashboard/dettes',
  'creances': '/dashboard/dettes',
  'impayes': '/dashboard/dettes',
  'rapports': '/dashboard/rapports',
  'statistiques': '/dashboard/rapports',
  'revenus': '/dashboard/rapports',
  'caisse': '/dashboard/caisse',
  'pos': '/dashboard/caisse',
  'ventes': '/dashboard/caisse',
  'parametres': '/dashboard/parametres',
  'settings': '/dashboard/parametres',
  'profil': '/dashboard/profil',
  'profile': '/dashboard/profil',
  'support': '/dashboard/support',
  'aide': '/dashboard/support',
  'boutique': '/dashboard/boutique',
  'shop': '/dashboard/boutique',
  'ajout_produit': '/dashboard/produits/nouveau',
  'scan': '/dashboard/produits?scan=true',
};

const PAGE_SYNONYMS: Record<string, string[]> = {
  'accueil': ['tableau de bord', 'dashboard', 'home'],
  'clients': ['client', 'contact'],
  'produits': ['produit', 'article', 'stock', 'marchandise'],
  'factures': ['facture', 'invoice'],
  'dettes': ['creances', 'impayes', 'debt', 'du', 'dette'],
  'rapports': ['statistiques', 'stats', 'revenus', 'ca'],
  'caisse': ['pos', 'point de vente', 'ventes'],
  'parametres': ['settings', 'configuration', 'options'],
  'profil': ['profile', 'compte'],
  'support': ['aide', 'help', 'assistance'],
  'boutique': ['shop', 'store', 'entreprise'],
};

// ─── Triggers ──────────────────────────────────────────────────────
const TRIGGERS = {
  NAVIGATE: ['ouvre', 'va', 'vas', 'aller', 'navigue'],
  SEARCH: ['recherche', 'cherche', 'trouve', 'find', 'rechercher'],
  POS_ADD: ['ajoute', 'ajouter', 'add', 'rajoute', 'rajouter', 'mets', 'mettre', 'veux', 'voudrais', 'aimerais', 'prends'],
  POS_REMOVE: ['retire', 'retirer', 'enleve', 'enlever', 'remove'],
  POS_CLEAR: ['vide', 'vider', 'clear', 'efface'],
  POS_CHECKOUT: ['finalise', 'termine', 'valide', 'checkout', 'payer'],
  POS_CANCEL: ['annule', 'annuler', 'cancel', 'abandonne'],
};

const CONFIRM_YES_WORDS = ['oui', 'confirme', 'd accord', 'ok', 'yes', 'yep', 'ouais', 'vas y', 'allez', 'j accepte', 'c est bon', 'banco'];
const CONFIRM_NO_WORDS = ['non', 'annule', 'stop', 'cancel', 'nope', 'pas d accord', 'jamais', 'arrete', 'abandonne'];
const REPEAT_WORDS = ['repete', 'redemande', 'encore une fois', 'dis encore', 'ressaisis'];

// ─── Déterminer le type d'entité selon la page ────────────────────
function getEntityTypeFromPage(path: string): 'client' | 'product' | 'invoice' | null {
  if (path.includes('/clients')) return 'client';
  if (path.includes('/produits')) return 'product';
  if (path.includes('/factures')) return 'invoice';
  return null;
}

// ─── Filet de sécurité Fuse.js ──────────────────────────────────
const FALLBACK_EXAMPLES: { intent: Intent; text: string }[] = [
  { intent: 'PRODUCT_COUNT', text: 'combien de produits en stock' },
  { intent: 'PRODUCT_COUNT', text: 'nombre de produits' },
  { intent: 'PRODUCT_COUNT', text: 'total produits' },
  { intent: 'PRODUCT_COUNT', text: 'combien de produits' },
  { intent: 'CLIENT_COUNT', text: 'combien de clients jai' },
  { intent: 'CLIENT_COUNT', text: 'nombre de clients' },
  { intent: 'CLIENT_COUNT', text: 'total clients' },
  { intent: 'CLIENT_COUNT', text: 'combien de clients' },
  { intent: 'CLIENT_DEBTORS', text: 'qui me doit de largent' },
  { intent: 'CLIENT_DEBTORS', text: 'quels clients ont des dettes' },
  { intent: 'CLIENT_DEBTORS', text: 'clients endettés' },
  { intent: 'CLIENT_DEBTORS', text: 'liste des débiteurs' },
  { intent: 'STATS_REVENUE', text: 'quel est mon chiffre daffaires' },
  { intent: 'STATS_REVENUE', text: 'combien de revenus jai fait' },
  { intent: 'STATS_REVENUE', text: 'ca' },
  { intent: 'STATS_REVENUE', text: 'ca total' },
  { intent: 'STATS_REVENUE', text: 'chiffre d affaires' },
  { intent: 'STATS_REVENUE', text: 'total des ventes' },
  { intent: 'STATS_SALES_TODAY', text: 'combien jai encaisse aujourdhui' },
  { intent: 'STATS_SALES_TODAY', text: 'combien de ventes aujourdhui' },
  { intent: 'STATS_SALES_TODAY', text: 'recette du jour' },
  { intent: 'STATS_SALES_TODAY', text: 'ca aujourd hui' },
  { intent: 'STATS_SALES_TODAY', text: 'encaissement du jour' },
  { intent: 'STATS_LOW_STOCK', text: 'quels produits sont en rupture de stock' },
  { intent: 'STATS_LOW_STOCK', text: 'rupture de stock' },
  { intent: 'STATS_LOW_STOCK', text: 'produits en rupture' },
  { intent: 'STATS_LOW_STOCK', text: 'stock épuisé' },
  { intent: 'STATS_LOW_STOCK', text: 'produits manquants' },
  { intent: 'STATS_TOTAL_DEBT', text: 'quel est le total des dettes' },
  { intent: 'STATS_TOTAL_DEBT', text: 'montant total des creances' },
  { intent: 'STATS_TOTAL_DEBT', text: 'dettes totales' },
  { intent: 'STATS_TOTAL_DEBT', text: 'total des créances' },
  { intent: 'STATS_TOTAL_DEBT', text: 'combien de dettes' },
  { intent: 'EXPORT', text: 'exporter' },
  { intent: 'EXPORT', text: 'exporte' },
];

let fallbackFuse: Fuse<{ intent: Intent; text: string }> | null = null;
function getFallbackFuse() {
  if (!fallbackFuse) {
    fallbackFuse = new Fuse(FALLBACK_EXAMPLES, {
      keys: ['text'],
      threshold: 0.45,
      ignoreLocation: true,
      includeScore: true,
    });
  }
  return fallbackFuse;
}

function tryFallbackIntent(text: string): ParsedCommand | null {
  const results = getFallbackFuse().search(text);
  if (results.length > 0) {
    return {
      intent: results[0].item.intent,
      entities: [],
      originalText: text,
      confidence: 1 - (results[0].score ?? 0.45),
      requiresConfirmation: false,
    };
  }
  return null;
}

// ─── Parseur principal avec contexte de page ──────────────────────
export function parseCommand(input: string, currentPath?: string): ParsedCommand | null {
  const text = stripFillers(normalize(input));
  if (!text) return null;

  const tokens = text.split(' ');
  const entityType = currentPath ? getEntityTypeFromPage(currentPath) : null;

  // 1. Confirmations
  if (tokens.length <= 3) {
    if (fuzzyMatchWholeText(text, CONFIRM_YES_WORDS)) {
      return { intent: 'CONFIRM_YES', entities: [], originalText: input, confidence: 0.95, requiresConfirmation: false };
    }
    if (fuzzyMatchWholeText(text, CONFIRM_NO_WORDS)) {
      return { intent: 'CONFIRM_NO', entities: [], originalText: input, confidence: 0.95, requiresConfirmation: false };
    }
    if (fuzzyMatchWholeText(text, REPEAT_WORDS)) {
      return { intent: 'REPEAT', entities: [], originalText: input, confidence: 0.95, requiresConfirmation: false };
    }
  }

  // 2. EXPORT
  if (text === 'exporter' || text === 'exporte' || text === 'export' || text === 'exporte les données') {
    return {
      intent: 'EXPORT',
      entities: [],
      originalText: input,
      confidence: 0.9,
      requiresConfirmation: false,
    };
  }

  // ── Actions contextuelles pour "ajouter" selon la page ──
  if (entityType === 'client' && text.match(/^(ajouter|ajoute|crée|cree|nouveau)\s+(.+)/)) {
    const match = text.match(/^(ajouter|ajoute|crée|cree|nouveau)\s+(.+)/);
    if (match && match[2]) {
      return {
        intent: 'CLIENT_ADD',
        entities: [{ type: 'client', value: match[2].trim() }],
        originalText: input,
        confidence: 0.9,
        requiresConfirmation: true,
      };
    }
  }

  if (entityType === 'product' && text.match(/^(ajouter|ajoute|crée|cree|nouveau)\s+(.+)/)) {
    const match = text.match(/^(ajouter|ajoute|crée|cree|nouveau)\s+(.+)/);
    if (match && match[2]) {
      return {
        intent: 'PRODUCT_ADD',
        entities: [{ type: 'product', value: match[2].trim() }],
        originalText: input,
        confidence: 0.9,
        requiresConfirmation: true,
      };
    }
  }

  if (entityType === 'invoice' && text.match(/^(ajouter|ajoute|crée|cree|nouveau)\s+(.+)/)) {
    return {
      intent: 'INVOICE_ADD',
      entities: [],
      originalText: input,
      confidence: 0.9,
      requiresConfirmation: false,
    };
  }

  // 3. Navigation spéciale : ajouter un produit (sans contexte)
  if (text.includes('ajouter un produit') || text.includes('nouveau produit') || text.includes('crée un produit')) {
    return {
      intent: 'NAVIGATE',
      entities: [{ type: 'page', value: 'ajout_produit' }],
      originalText: input,
      confidence: 0.9,
      requiresConfirmation: false,
    };
  }

  // 4. Navigation spéciale : ajouter une facture = aller au POS
  if (text.includes('ajouter facture') || text.includes('nouvelle facture') || text.includes('crée une facture')) {
    return {
      intent: 'NAVIGATE',
      entities: [{ type: 'page', value: 'caisse' }],
      originalText: input,
      confidence: 0.9,
      requiresConfirmation: false,
    };
  }

  // 5. Navigation spéciale : ajouter un client (sans contexte)
  if (text.includes('ajouter un client') || text.includes('nouveau client') || text.includes('crée un client')) {
    return {
      intent: 'CLIENT_ADD',
      entities: [],
      originalText: input,
      confidence: 0.9,
      requiresConfirmation: true,
    };
  }

  // 6. Navigation spéciale : ouvrir le scan
  if (
    text === 'scanner' || text === 'scan' ||
    text.startsWith('scanner ') || text.startsWith('scan ') ||
    text.includes('ouvre le scan') || text.includes('lance le scan') ||
    text.includes('scanner un produit')
  ) {
    return {
      intent: 'NAVIGATE',
      entities: [{ type: 'page', value: 'scan' }],
      originalText: input,
      confidence: 0.9,
      requiresConfirmation: false,
    };
  }

  // 7. Actions spécifiques avec type explicite (priorité)
  // 7a. Supprimer un client
  if (text.includes('supprime client') || text.includes('supprimer client') || text.includes('delete client')) {
    const match = text.match(/supprime\s+client\s+(.+)/);
    if (match && match[1]) {
      return {
        intent: 'CLIENT_DELETE',
        entities: [{ type: 'client', value: match[1].trim() }],
        originalText: input,
        confidence: 0.9,
        requiresConfirmation: true,
      };
    }
    return {
      intent: 'CLIENT_DELETE',
      entities: [],
      originalText: input,
      confidence: 0.7,
      requiresConfirmation: true,
    };
  }

  // 7b. Supprimer un produit
  if (text.includes('supprime produit') || text.includes('supprimer produit') || text.includes('delete produit')) {
    const match = text.match(/supprime\s+produit\s+(.+)/);
    if (match && match[1]) {
      return {
        intent: 'PRODUCT_DELETE',
        entities: [{ type: 'product', value: match[1].trim() }],
        originalText: input,
        confidence: 0.9,
        requiresConfirmation: true,
      };
    }
    return {
      intent: 'PRODUCT_DELETE',
      entities: [],
      originalText: input,
      confidence: 0.7,
      requiresConfirmation: true,
    };
  }

  // 7c. Supprimer une facture
  if (text.includes('supprime facture') || text.includes('supprimer facture') || text.includes('delete facture')) {
    const match = text.match(/supprime\s+facture\s+(.+)/);
    if (match && match[1]) {
      return {
        intent: 'INVOICE_DELETE',
        entities: [{ type: 'invoice', value: match[1].trim() }],
        originalText: input,
        confidence: 0.9,
        requiresConfirmation: true,
      };
    }
    return {
      intent: 'INVOICE_DELETE',
      entities: [],
      originalText: input,
      confidence: 0.7,
      requiresConfirmation: true,
    };
  }

  // 7d. Modifier un client
  if (text.includes('modifie client') || text.includes('modifier client') || text.includes('éditer client')) {
    const match = text.match(/modifie\s+client\s+(.+)|modifier\s+client\s+(.+)|éditer\s+client\s+(.+)/);
    if (match) {
      const rawName = match[1] || match[2] || match[3];
      if (rawName) {
        return {
          intent: 'CLIENT_EDIT',
          entities: [{ type: 'client', value: rawName.trim() }],
          originalText: input,
          confidence: 0.9,
          requiresConfirmation: false,
        };
      }
    }
  }

  // 7e. Modifier un produit
  if (text.includes('modifie produit') || text.includes('modifier produit') || text.includes('éditer produit')) {
    const match = text.match(/modifie\s+produit\s+(.+)|modifier\s+produit\s+(.+)|éditer\s+produit\s+(.+)/);
    if (match) {
      const rawName = match[1] || match[2] || match[3];
      if (rawName) {
        return {
          intent: 'PRODUCT_EDIT',
          entities: [{ type: 'product', value: rawName.trim() }],
          originalText: input,
          confidence: 0.9,
          requiresConfirmation: false,
        };
      }
    }
  }

  // 7f. Modifier une facture ✅ ajout de "modifer"
  if (text.includes('modifie facture') || text.includes('modifier facture') || text.includes('modifer facture') || text.includes('éditer facture')) {
    const match = text.match(/modifie\s+facture\s+(.+)|modifier\s+facture\s+(.+)|modifer\s+facture\s+(.+)|éditer\s+facture\s+(.+)/);
    if (match) {
      const rawNumber = match[1] || match[2] || match[3] || match[4];
      if (rawNumber) {
        return {
          intent: 'INVOICE_EDIT',
          entities: [{ type: 'invoice', value: rawNumber.trim() }],
          originalText: input,
          confidence: 0.9,
          requiresConfirmation: false,
        };
      }
    }
  }

  // 7g. Voir un client
  if (text.includes('voir client') || text.includes('affiche client') || text.includes('ouvre client')) {
    const match = text.match(/(voir|affiche|ouvre)\s+client\s+(.+)/);
    if (match && match[2]) {
      return {
        intent: 'CLIENT_VIEW',
        entities: [{ type: 'client', value: match[2].trim() }],
        originalText: input,
        confidence: 0.9,
        requiresConfirmation: false,
      };
    }
  }

  // 7h. Voir un produit
  if (text.includes('voir produit') || text.includes('affiche produit') || text.includes('ouvre produit')) {
    const match = text.match(/(voir|affiche|ouvre)\s+produit\s+(.+)/);
    if (match && match[2]) {
      return {
        intent: 'PRODUCT_VIEW',
        entities: [{ type: 'product', value: match[2].trim() }],
        originalText: input,
        confidence: 0.9,
        requiresConfirmation: false,
      };
    }
  }

  // 7i. Voir une facture (explicite avec mot "facture")
  if (text.includes('voir facture') || text.includes('affiche facture') || text.includes('ouvre facture')) {
    const match = text.match(/(voir|affiche|ouvre)\s+facture\s+(.+)/);
    if (match && match[2]) {
      return {
        intent: 'INVOICE_VIEW',
        entities: [{ type: 'invoice', value: match[2].trim() }],
        originalText: input,
        confidence: 0.9,
        requiresConfirmation: false,
      };
    }
  }

  // ── ACTIONS SPÉCIFIQUES PRODUITS ───────────────────────────────
  // 8a. Réapprovisionner un produit
  if (text.match(/^(réapprovisionne|reapprovisionne|réapprovisionner|reapprovisionner|ajouter du stock)\s+(.+)/)) {
    const match = text.match(/^(réapprovisionne|reapprovisionne|réapprovisionner|reapprovisionner|ajouter du stock)\s+(.+)/);
    if (match && match[2]) {
      return {
        intent: 'PRODUCT_REPLENISH',
        entities: [{ type: 'product', value: match[2].trim() }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: true,
      };
    }
  }

  // 8b. Historique de stock d'un produit
  if (text.match(/^(historique|historique de|voir l historique|affiche historique)\s+(.+)/)) {
    const match = text.match(/^(historique|historique de|voir l historique|affiche historique)\s+(.+)/);
    if (match && match[2]) {
      if (entityType === 'product' || text.includes('produit')) {
        return {
          intent: 'PRODUCT_HISTORY',
          entities: [{ type: 'product', value: match[2].trim() }],
          originalText: input,
          confidence: 0.85,
          requiresConfirmation: false,
        };
      }
    }
  }

  // 8c. Activer / désactiver un produit (explicite)
  if (text.match(/^(activer|désactiver|desactiver)\s+(.+)/)) {
    const match = text.match(/^(activer|désactiver|desactiver)\s+(.+)/);
    if (match && match[2]) {
      return {
        intent: 'PRODUCT_TOGGLE',
        entities: [{ type: 'product', value: match[2].trim() }],
        originalText: input,
        confidence: 0.9,
        requiresConfirmation: true,
      };
    }
  }

  // ── Actions contextuelles (selon la page) ──
  // 9a. Supprimer (contexte)
  if (text.match(/^(supprime|supprimer|delete|efface)\s+(.+)/)) {
    const match = text.match(/^(supprime|supprimer|delete|efface)\s+(.+)/);
    if (match && entityType) {
      const name = match[2].trim();
      let intent: Intent;
      if (entityType === 'client') intent = 'CLIENT_DELETE';
      else if (entityType === 'product') intent = 'PRODUCT_DELETE';
      else if (entityType === 'invoice') intent = 'INVOICE_DELETE';
      else return null;
      return {
        intent,
        entities: [{ type: entityType, value: name }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: true,
      };
    }
  }

  // 9b. Modifier (contexte)
  if (text.match(/^(modifie|modifier|éditer|changer)\s+(.+)/)) {
    const match = text.match(/^(modifie|modifier|éditer|changer)\s+(.+)/);
    if (match && entityType) {
      const name = match[2].trim();
      let intent: Intent;
      if (entityType === 'client') intent = 'CLIENT_EDIT';
      else if (entityType === 'product') intent = 'PRODUCT_EDIT';
      else if (entityType === 'invoice') intent = 'INVOICE_EDIT';
      else return null;
      return {
        intent,
        entities: [{ type: entityType, value: name }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: false,
      };
    }
  }

  // 9c. Voir (contexte)
  if (text.match(/^(voir|affiche|afficher|ouvre)\s+(.+)/)) {
    const match = text.match(/^(voir|affiche|afficher|ouvre)\s+(.+)/);
    if (match && entityType) {
      const name = match[2].trim();
      let intent: Intent;
      if (entityType === 'client') intent = 'CLIENT_VIEW';
      else if (entityType === 'product') intent = 'PRODUCT_VIEW';
      else if (entityType === 'invoice') intent = 'INVOICE_VIEW';
      else return null;
      return {
        intent,
        entities: [{ type: entityType, value: name }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: false,
      };
    }
  }

  // 9d. Activer / désactiver un produit (contexte)
  if (text.match(/^(désactive|desactive|désactiver|desactiver|activer)\s+(.+)/)) {
    const match = text.match(/^(désactive|desactive|désactiver|desactiver|activer)\s+(.+)/);
    if (match && entityType === 'product') {
      const productName = match[2].trim();
      return {
        intent: 'PRODUCT_TOGGLE',
        entities: [{ type: 'product', value: productName }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: true,
      };
    }
  }

  // 9e. Réapprovisionner (contexte)
  if (text.match(/^(réapprovisionne|reapprovisionne|réapprovisionner|reapprovisionner|ajouter du stock)\s+(.+)/)) {
    const match = text.match(/^(réapprovisionne|reapprovisionne|réapprovisionner|reapprovisionner|ajouter du stock)\s+(.+)/);
    if (match && entityType === 'product') {
      return {
        intent: 'PRODUCT_REPLENISH',
        entities: [{ type: 'product', value: match[2].trim() }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: true,
      };
    }
  }

  // 9f. Historique (contexte)
  if (text.match(/^(historique|historique de|voir l historique|affiche historique)\s+(.+)/)) {
    const match = text.match(/^(historique|historique de|voir l historique|affiche historique)\s+(.+)/);
    if (match && entityType === 'product') {
      return {
        intent: 'PRODUCT_HISTORY',
        entities: [{ type: 'product', value: match[2].trim() }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: false,
      };
    }
  }

  // ✅ ── Actions contextuelles pour la page Factures (sans le mot "facture") ──
  if (entityType === 'invoice') {
    // "voir [numéro]" sans le mot "facture"
    const viewMatch = text.match(/^(voir|affiche|afficher|ouvre)\s+(.+)/);
    if (viewMatch && viewMatch[2]) {
      return {
        intent: 'INVOICE_VIEW',
        entities: [{ type: 'invoice', value: viewMatch[2].trim() }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: false,
      };
    }
    // "modifier [numéro]" sans le mot "facture"
    const editMatch = text.match(/^(modifie|modifier|modifer|éditer|changer)\s+(.+)/);
    if (editMatch && editMatch[2]) {
      return {
        intent: 'INVOICE_EDIT',
        entities: [{ type: 'invoice', value: editMatch[2].trim() }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: false,
      };
    }
    // "supprimer [numéro]" sans le mot "facture"
    const deleteMatch = text.match(/^(supprime|supprimer|delete|efface)\s+(.+)/);
    if (deleteMatch && deleteMatch[2]) {
      return {
        intent: 'INVOICE_DELETE',
        entities: [{ type: 'invoice', value: deleteMatch[2].trim() }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: true,
      };
    }
  }

  // 10. Navigation normale
  const nav = findTriggerInTokens(tokens, TRIGGERS.NAVIGATE);
  if (nav && nav.rest) {
    const target = nav.rest;
    let foundPage = Object.keys(PAGE_PATHS).find((p) => target.includes(p));
    if (!foundPage) {
      for (const [key, syns] of Object.entries(PAGE_SYNONYMS)) {
        if (syns.some((s) => target.includes(s))) { foundPage = key; break; }
      }
    }
    if (!foundPage) {
      for (const token of target.split(' ')) {
        const closePage = Object.keys(PAGE_PATHS).find((p) => damerauLevenshtein(token, p) <= maxAllowedDistance(p));
        if (closePage) { foundPage = closePage; break; }
      }
    }
    if (foundPage && PAGE_PATHS[foundPage]) {
      return {
        intent: 'NAVIGATE',
        entities: [{ type: 'page', value: foundPage }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: false,
      };
    }
  }

  // 11. Recherche
  const search = findTriggerInTokens(tokens, TRIGGERS.SEARCH);
  if (search && search.rest) {
    return {
      intent: 'SEARCH',
      entities: [{ type: 'term', value: search.rest }],
      originalText: input,
      confidence: 0.85,
      requiresConfirmation: false,
    };
  }

  // 12. Vider la recherche
  if (text.match(/^(efface|vider|clear)\s+(la\s+)?recherche/)) {
    return {
      intent: 'CLEAR_SEARCH',
      entities: [],
      originalText: input,
      confidence: 0.9,
      requiresConfirmation: false,
    };
  }

  // 13. POS / Panier
  const posAdd = findTriggerInTokens(tokens, TRIGGERS.POS_ADD);
  if (posAdd && posAdd.rest) {
    const restTokens = posAdd.rest.split(' ');
    const firstIsNumber = /^\d+$/.test(restTokens[0]) || restTokens[0] in NUMBER_WORDS;
    const qty = firstIsNumber ? parseQuantity(restTokens[0], 1) : 1;
    const product = (firstIsNumber ? restTokens.slice(1).join(' ') : posAdd.rest).trim();
    if (product) {
      return {
        intent: 'POS_ADD',
        entities: [{ type: 'number', value: qty }, { type: 'product', value: product }],
        originalText: input,
        confidence: 0.85,
        requiresConfirmation: true,
      };
    }
  }

  const posRemove = findTriggerInTokens(tokens, TRIGGERS.POS_REMOVE);
  if (posRemove && posRemove.rest) {
    return {
      intent: 'POS_REMOVE',
      entities: [{ type: 'product', value: posRemove.rest }],
      originalText: input,
      confidence: 0.85,
      requiresConfirmation: true,
    };
  }

  const posClear = findTriggerInTokens(tokens, TRIGGERS.POS_CLEAR);
  if (posClear && text.includes('panier')) {
    return { intent: 'POS_CLEAR', entities: [], originalText: input, confidence: 0.85, requiresConfirmation: true };
  }

  const posCheckout = findTriggerInTokens(tokens, TRIGGERS.POS_CHECKOUT);
  if (posCheckout && /commande|vente|panier|facture/.test(text)) {
    return { intent: 'POS_CHECKOUT', entities: [], originalText: input, confidence: 0.85, requiresConfirmation: true };
  }

  const posCancel = findTriggerInTokens(tokens, TRIGGERS.POS_CANCEL);
  if (posCancel && /commande|vente|panier|facture/.test(text)) {
    return { intent: 'POS_CANCEL', entities: [], originalText: input, confidence: 0.85, requiresConfirmation: true };
  }

  // ─── STATISTIQUES (formulations enrichies) ──────────────────────
  // 14a. Chiffre d'affaires / Revenus / CA
  if (
    text.match(/chiffre d affaires|\bca\b|revenu total|ventes totales|total des ventes|ca total|ca aujourd hui|recette du jour|encaissement total|chiffre d affaires total|chiffre d affaires du jour|ca du jour|recette d aujourd hui/) ||
    text.match(/combien.*chiffre|combien.*revenu|quel est mon chiffre|quel est le ca/)
  ) {
    // Vérifier si la phrase contient "aujourd'hui", "jour", "du jour"
    if (text.match(/aujourd hui|jour|du jour|today/)) {
      return { intent: 'STATS_SALES_TODAY', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
    }
    return { intent: 'STATS_REVENUE', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  // 14b. Dettes / Créances
  if (
    text.match(/total des dettes|montant des creances|dettes totales|creances totales|combien de dettes|total des creances|montant total des dettes|dettes actives|creances actives|solde des dettes/) ||
    text.match(/combien.*dettes|quelle est la dette totale|quel est le montant des creances/)
  ) {
    return { intent: 'STATS_TOTAL_DEBT', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  // 14c. Produits en rupture / stock faible
  if (
    text.match(/rupture|stock epuise|a reapprovisionner|produits manquants|en rupture|rupture de stock|stock faible|produits en rupture|produits a reapprovisionner|quels produits sont en rupture/) ||
    text.match(/combien.*rupture|combien.*stock faible/)
  ) {
    return { intent: 'STATS_LOW_STOCK', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  // 14d. Nombre de produits (déjà couvert par PRODUCT_COUNT, mais on ajoute des variantes)
  if (
    text.match(/combien.*produits|nombre de produits|stock total|total produits|combien de produits en stock|quantite de produits|produits en stock|inventaire total/) ||
    text.match(/combien.*articles|total articles|nombre d articles/)
  ) {
    return { intent: 'PRODUCT_COUNT', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  // 14e. Nombre de clients (déjà couvert par CLIENT_COUNT, mais on ajoute des variantes)
  if (
    text.match(/combien.*clients|nombre de clients|total clients|combien de contacts|nombre de contacts/) ||
    text.match(/combien.*clients au total/)
  ) {
    return { intent: 'CLIENT_COUNT', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  // 14f. Clients endettés (déjà couvert par CLIENT_DEBTORS)
  if (
    text.match(/qui me doit|clients endettes|debiteurs|dettes actives|me doivent de l argent|clients avec des dettes|liste des debiteurs|clients qui ont des dettes/) ||
    text.match(/combien.*clients endettes|quels clients ont des dettes/)
  ) {
    return { intent: 'CLIENT_DEBTORS', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  // 15. Filet de sécurité Fuse.js
  const fallback = tryFallbackIntent(text);
  if (fallback) return { ...fallback, originalText: input };

  return null;
}