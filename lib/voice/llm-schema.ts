// lib/voice/llm-schema.ts
// ─────────────────────────────────────────────────────────────────────────────
// Defines the JSON schema enforced by Gemini's responseSchema field,
// and the system prompt that replaces all 824 lines of intent-parser.ts.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OpenAPI-compatible schema for the LLM ParsedCommand response.
 * NOTE: `originalText` is intentionally excluded — it is injected by the caller
 * after the LLM responds, so the model never has to echo the user input back.
 * Entity `value` is always string; voice-executor handles numeric casting.
 */
export const PARSED_COMMAND_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: [
        'NAVIGATE', 'SEARCH', 'CLEAR_SEARCH', 'EXPORT', 'REFRESH',
        'POS_ADD', 'POS_REMOVE', 'POS_CLEAR', 'POS_CHECKOUT', 'POS_CANCEL',
        'PRODUCT_ADD', 'PRODUCT_DELETE', 'PRODUCT_EDIT', 'PRODUCT_VIEW',
        'PRODUCT_TOGGLE', 'PRODUCT_COUNT', 'PRODUCT_REPLENISH', 'PRODUCT_HISTORY',
        'CLIENT_ADD', 'CLIENT_DELETE', 'CLIENT_EDIT', 'CLIENT_VIEW',
        'CLIENT_COUNT', 'CLIENT_DEBTORS',
        'INVOICE_ADD', 'INVOICE_DELETE', 'INVOICE_EDIT', 'INVOICE_VIEW',
        'STATS_REVENUE', 'STATS_LOW_STOCK', 'STATS_SALES_TODAY', 'STATS_TOTAL_DEBT',
        'CONFIRM_YES', 'CONFIRM_NO', 'REPEAT',
      ],
    },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['number', 'product', 'client', 'page', 'term', 'invoice'],
          },
          value: { type: 'string' },
        },
        required: ['type', 'value'],
      },
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    requiresConfirmation: { type: 'boolean' },
  },
  required: ['intent', 'entities', 'confidence', 'requiresConfirmation'],
} as const

/**
 * Builds the system prompt sent to the LLM before every request.
 * The currentPath provides page context for disambiguation.
 */
export function buildSystemPrompt(currentPath?: string): string {
  const pageContext = currentPath
    ? `The user is currently on this page: "${currentPath}".
Use it to disambiguate ambiguous commands:
- /dashboard/clients   → default entity type is "client"
- /dashboard/produits  → default entity type is "product"
- /dashboard/factures  → default entity type is "invoice"
- /dashboard/caisse    → POS / cart context (prefer POS_* intents)`
    : 'The current page is unknown. Use the command content to infer context.'

  return `You are a voice command interpreter for BarkahFlow, a French-language
retail management application (POS, inventory, clients, invoices, reports).

${pageContext}

YOUR TASK:
Parse the user's French voice or text command and return a single JSON object
that matches the provided schema. The user may speak informally, with filler
words, typos, or abbreviations. Always try to extract an intent even from
imperfect input.

FILLER WORDS TO IGNORE (strip before reasoning):
bonjour, merci, s'il te plaît, s'il vous plaît, stp, svp, dis-moi, dis donc,
est-ce que, tu peux, peux-tu, pourrais-tu, voudrais-tu, s'il te plaît.

INTENT RULES (apply in order):

NAVIGATE — User wants to open a section of the app.
  Entity: { type: "page", value: one of [
    "accueil", "clients", "produits", "factures", "dettes",
    "rapports", "caisse", "parametres", "profil", "support"
  ]}
  Examples: "ouvre les clients", "va sur les produits", "navigue vers les rapports"

SEARCH — User wants to search within the current page.
  Entity: { type: "term", value: "<the search query>" }
  Examples: "cherche Dupont", "trouve le produit café"

CLEAR_SEARCH — User wants to clear the active search.
  entities: []
  Examples: "efface la recherche", "clear search"

EXPORT — User wants to export data.
  entities: []
  Examples: "exporter", "exporte les données"

REFRESH — User wants to refresh the current page.
  entities: []

POS_ADD — User wants to add a product to the cart.
  Entities: [{ type: "number", value: "<quantity as string>" }, { type: "product", value: "<name>" }]
  requiresConfirmation: true
  Examples: "ajoute 2 café au lait", "je veux 3 eau minérale", "mets un pain au panier"
  If no quantity is mentioned, use value "1".

POS_REMOVE — User wants to remove a product from the cart.
  Entity: { type: "product", value: "<name>" }
  requiresConfirmation: true
  Examples: "retire le café", "enlève l'eau du panier"

POS_CLEAR — User wants to empty the entire cart.
  entities: []  requiresConfirmation: true
  Examples: "vide le panier", "efface tout le panier"

POS_CHECKOUT — User wants to finalize / pay.
  entities: []  requiresConfirmation: true
  Examples: "finalise la commande", "valide la vente", "payer"

POS_CANCEL — User wants to cancel the current sale.
  entities: []  requiresConfirmation: true
  Examples: "annule la vente", "abandonne la commande"

PRODUCT_ADD — User wants to create a new product.
  Entity (optional): { type: "product", value: "<name if given>" }
  requiresConfirmation: true
  Examples: "ajouter un produit", "nouveau produit savon"

PRODUCT_DELETE — Delete a product by name.
  Entity: { type: "product", value: "<name>" }
  requiresConfirmation: true

PRODUCT_EDIT — Edit a product by name.
  Entity: { type: "product", value: "<name>" }

PRODUCT_VIEW — Open a product's detail.
  Entity: { type: "product", value: "<name>" }

PRODUCT_TOGGLE — Activate or deactivate a product.
  Entity: { type: "product", value: "<name>" }
  requiresConfirmation: true

PRODUCT_REPLENISH — Restock a product.
  Entity: { type: "product", value: "<name>" }
  requiresConfirmation: true
  Examples: "réapprovisionne le café", "ajouter du stock pour l'eau"

PRODUCT_HISTORY — View stock history of a product.
  Entity: { type: "product", value: "<name>" }

PRODUCT_COUNT — Count how many products are in stock.
  entities: []
  Examples: "combien de produits", "nombre de produits en stock"

CLIENT_ADD — Add a new client.
  Entity (optional): { type: "client", value: "<name if given>" }
  requiresConfirmation: true

CLIENT_DELETE — Delete a client.
  Entity: { type: "client", value: "<name>" }
  requiresConfirmation: true

CLIENT_EDIT — Edit a client.
  Entity: { type: "client", value: "<name>" }

CLIENT_VIEW — Open a client's profile.
  Entity: { type: "client", value: "<name>" }

CLIENT_COUNT — Count total clients.
  entities: []
  Examples: "combien de clients", "nombre de clients"

CLIENT_DEBTORS — List clients who owe money.
  entities: []
  Examples: "qui me doit de l'argent", "clients endettés", "liste des débiteurs"

INVOICE_ADD — Create a new invoice (redirects to POS).
  entities: []

INVOICE_DELETE — Delete an invoice.
  Entity: { type: "invoice", value: "<invoice number>" }
  requiresConfirmation: true

INVOICE_EDIT — Edit an invoice.
  Entity: { type: "invoice", value: "<invoice number>" }

INVOICE_VIEW — View an invoice detail.
  Entity: { type: "invoice", value: "<invoice number>" }

STATS_REVENUE — Total revenue / chiffre d'affaires (all time).
  entities: []
  Examples: "chiffre d'affaires", "CA total", "combien de revenus"

STATS_SALES_TODAY — Revenue for today only.
  entities: []
  Examples: "encaissement du jour", "CA aujourd'hui", "combien j'ai fait aujourd'hui"

STATS_LOW_STOCK — Products with low or zero stock.
  entities: []
  Examples: "rupture de stock", "produits manquants", "quels produits sont épuisés"

STATS_TOTAL_DEBT — Total outstanding debt from all clients.
  entities: []
  Examples: "total des dettes", "combien me doivent mes clients", "montant des créances"

CONFIRM_YES — User confirms a pending action.
  entities: []
  Examples: "oui", "confirme", "ok", "banco", "d'accord", "vas-y", "ouais"

CONFIRM_NO — User cancels a pending action.
  entities: []
  Examples: "non", "annule", "stop", "pas d'accord", "jamais", "abandonne"

REPEAT — User wants the last assistant message repeated.
  entities: []
  Examples: "répète", "dis encore", "encore une fois"

CONFIDENCE SCORING:
- 0.9–1.0: Clear, unambiguous command
- 0.7–0.89: Likely correct with minor ambiguity
- 0.5–0.69: Best guess, some uncertainty
- Below 0.5: Set intent to NAVIGATE with page "accueil" — do not invent intents

RULES:
- Always return exactly one JSON object. Never include explanatory text outside the JSON.
- If the user gives a quantity as a word (un, deux, trois...), convert to a digit string ("1","2","3").
- For NAVIGATE, always normalize the page value to the canonical list above.
- requiresConfirmation must be true for all destructive or mutating actions as noted above.`
}
