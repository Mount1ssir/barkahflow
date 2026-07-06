import { ParsedCommand, Entity, Intent } from './voice-types'

// ─── Nombres écrits en lettres (1 à 10) ───────────────────────────
const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
};

// ─── Mots de politesse / remplissage à ignorer avant le matching ──
const FILLER_PATTERN =
  /\b(est ce que|s il te plait|s il vous plait|stp|svp|please|tu peux|peux tu|pourrais tu|voudrais tu|dis moi|dis donc|dis|bonjour|merci)\b/g;

// ─── Normalisation ────────────────────────────────────────────────
// IMPORTANT : on remplace l'apostrophe par un ESPACE (pas une suppression)
// pour que "j'aimerais" devienne "j aimerais" et matche les regex sans apostrophe.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/'/g, ' ')               // apostrophe -> espace
    .replace(/[^a-z0-9 ]/g, ' ')       // ponctuation restante -> espace
    .replace(/\s+/g, ' ')             // espaces multiples -> un seul
    .trim();
}

function stripFillers(text: string): string {
  return text.replace(FILLER_PATTERN, '').replace(/\s+/g, ' ').trim();
}

// Convertit "deux" ou "2" en nombre. Retourne fallback si rien trouvé.
function parseQuantity(raw: string | undefined, fallback = 1): number {
  if (!raw) return fallback;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return NUMBER_WORDS[raw] ?? fallback;
}

// Groupe de nombres pour les regex (chiffres OU lettres)
const NUM_GROUP = '(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)';

// ─── Dictionnaire des synonymes (fusionné) ────────────────────────
const SYNONYMS: Record<string, string[]> = {
  'accueil': ['tableau de bord', 'dashboard', 'home'],
  'clients': ['client', 'contact'],
  'produits': ['produit', 'article', 'stock', 'marchandise'],
  'factures': ['facture', 'invoice'],
  'dettes': ['creances', 'impayes', 'debt', 'du', 'dette'],
  'rapports': ['statistiques', 'stats', 'revenus', 'ca'],
  'panier': ['commande', 'basket', 'cart'],
  'caisse': ['pos', 'point de vente', 'ventes'],
  'paramètres': ['settings', 'configuration', 'options'],
  'profil': ['profile', 'compte'],
  'support': ['aide', 'help', 'assistance'],
  'boutique': ['shop', 'store', 'entreprise'],
};

// ─── Parseur principal ───────────────────────────────────────────
export function parseCommand(input: string): ParsedCommand | null {
  const cleaned = stripFillers(normalize(input));
  const text = cleaned;
  if (!text) return null;

  // 1. Confirmations (toute la phrase doit correspondre)
  if (text.match(/^(oui|confirme|d accord|ok|yes|yep|ouais|va y|allez|j accepte|c est bon|banco)$/)) {
    return { intent: 'CONFIRM_YES', entities: [], originalText: input, confidence: 1, requiresConfirmation: false };
  }
  if (text.match(/^(non|annule|stop|cancel|nope|pas d accord|jamais|arrete|abandonne)$/)) {
    return { intent: 'CONFIRM_NO', entities: [], originalText: input, confidence: 1, requiresConfirmation: false };
  }
  if (text.match(/^(repete|redemande|encore une fois|dis encore|ressaisis)$/)) {
    return { intent: 'REPEAT', entities: [], originalText: input, confidence: 1, requiresConfirmation: false };
  }

  // 2. Navigation — le verbe peut apparaître n'importe où dans la phrase
  const navMatch = text.match(/\b(ouvre|va|vas|aller|navigue vers|navigue)\b\s+(.+)/);
  if (navMatch) {
    const target = navMatch[2];
    const pages: Record<string, string> = {
      'accueil': '/dashboard', 'tableau de bord': '/dashboard', 'dashboard': '/dashboard',
      'clients': '/dashboard/clients', 'client': '/dashboard/clients',
      'produits': '/dashboard/produits', 'stock': '/dashboard/produits', 'articles': '/dashboard/produits',
      'factures': '/dashboard/factures', 'facture': '/dashboard/factures',
      'dettes': '/dashboard/dettes', 'creances': '/dashboard/dettes', 'impayes': '/dashboard/dettes',
      'rapports': '/dashboard/rapports', 'statistiques': '/dashboard/rapports', 'revenus': '/dashboard/rapports',
      'caisse': '/dashboard/caisse', 'pos': '/dashboard/caisse', 'ventes': '/dashboard/caisse',
      'parametres': '/dashboard/parametres', 'settings': '/dashboard/parametres',
      'profil': '/dashboard/profil', 'profile': '/dashboard/profil',
      'support': '/dashboard/support', 'aide': '/dashboard/support',
      'boutique': '/dashboard/boutique', 'shop': '/dashboard/boutique',
    };
    let foundPage = Object.keys(pages).find(p => target.includes(p));
    if (!foundPage) {
      for (const [key, syns] of Object.entries(SYNONYMS)) {
        if (syns.some(s => target.includes(s))) { foundPage = key; break; }
      }
    }
    if (foundPage && pages[foundPage]) {
      return {
        intent: 'NAVIGATE',
        entities: [{ type: 'page', value: foundPage }],
        originalText: input, confidence: 0.9, requiresConfirmation: false,
      };
    }
  }

  // 3. Recherche
  const searchMatch = text.match(/\b(recherche|cherche|trouve|find|rechercher)\b\s+(.+)/);
  if (searchMatch) {
    return {
      intent: 'SEARCH',
      entities: [{ type: 'term', value: searchMatch[2] }],
      originalText: input, confidence: 0.9, requiresConfirmation: false,
    };
  }

  // 4. POS / Panier
  const posAddRe = new RegExp(
    `\\b(ajoute|ajouter|add|rajoute|rajouter|mets|mettre|j aimerais|je veux|je voudrais|je prends)\\b\\s+(?:${NUM_GROUP}\\s+)?(.+)`
  );
  const posAdd = text.match(posAddRe);
  if (posAdd) {
    const qty = parseQuantity(posAdd[2], 1);
    const product = posAdd[3].trim();
    return {
      intent: 'POS_ADD',
      entities: [{ type: 'number', value: qty }, { type: 'product', value: product }],
      originalText: input, confidence: 0.9, requiresConfirmation: true,
    };
  }

  const posRemove = text.match(/\b(retire|retirer|enleve|enlever|remove)\b\s+(.+)/);
  if (posRemove) {
    return {
      intent: 'POS_REMOVE',
      entities: [{ type: 'product', value: posRemove[2].trim() }],
      originalText: input, confidence: 0.9, requiresConfirmation: true,
    };
  }

  if (text.match(/\b(vide|vider|clear|efface|supprime tout)\b\s+(le\s+)?panier/)) {
    return { intent: 'POS_CLEAR', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: true };
  }

  if (text.match(/\b(finalise|termine|valide|checkout|commande|payer)\b\s+(la\s+)?(commande|vente|panier|facture)/)) {
    return { intent: 'POS_CHECKOUT', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: true };
  }

  if (text.match(/\b(annule|annuler|cancel|abandonne)\b\s+(la\s+)?(commande|vente|panier|facture)/)) {
    return { intent: 'POS_CANCEL', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: true };
  }

  // 5. Produits
  const productAdd = text.match(/\b(cree|creer|ajoute un produit|nouveau produit)\b\s+(.+)/);
  if (productAdd) {
    return {
      intent: 'PRODUCT_ADD',
      entities: [{ type: 'product', value: productAdd[2].trim() }],
      originalText: input, confidence: 0.8, requiresConfirmation: true,
    };
  }

  const productDelete = text.match(/\b(supprime|delete|efface)\b\s+(le produit\s+)?(.+)/);
  if (productDelete) {
    return {
      intent: 'PRODUCT_DELETE',
      entities: [{ type: 'product', value: productDelete[3].trim() }],
      originalText: input, confidence: 0.8, requiresConfirmation: true,
    };
  }

  const productModify = text.match(/\b(modifie|editer|changer|update|modifier)\b\s+(le produit\s+)?(.+)/);
  if (productModify) {
    return {
      intent: 'PRODUCT_MODIFY',
      entities: [{ type: 'product', value: productModify[3].trim() }],
      originalText: input, confidence: 0.7, requiresConfirmation: true,
    };
  }

  if (text.match(/combien.*produits|nombre de produits|stock total/)) {
    return { intent: 'PRODUCT_COUNT', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  // 6. Clients
  const clientAdd = text.match(/\b(cree|creer|ajoute un client|nouveau client)\b\s+(.+)/);
  if (clientAdd) {
    return {
      intent: 'CLIENT_ADD',
      entities: [{ type: 'client', value: clientAdd[2].trim() }],
      originalText: input, confidence: 0.8, requiresConfirmation: true,
    };
  }

  if (text.match(/combien.*clients|nombre de clients/)) {
    return { intent: 'CLIENT_COUNT', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  if (text.match(/qui me doit|clients endettes|debiteurs|dettes actives|me doivent de l argent/)) {
    return { intent: 'CLIENT_DEBTORS', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  // 7. Statistiques
  if (text.match(/chiffre d affaires|\bca\b|revenu total|ventes totales|total des ventes/)) {
    return { intent: 'STATS_REVENUE', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  if (text.match(/encaisse aujourd hui|recette du jour|ventes du jour|encaissement du jour/)) {
    return { intent: 'STATS_SALES_TODAY', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  if (text.match(/rupture|stock epuise|a reapprovisionner|produits manquants/)) {
    return { intent: 'STATS_LOW_STOCK', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  if (text.match(/total des dettes|montant des creances|dettes totales|creances totales/)) {
    return { intent: 'STATS_TOTAL_DEBT', entities: [], originalText: input, confidence: 0.9, requiresConfirmation: false };
  }

  // 8. Non reconnu
  return null;
}