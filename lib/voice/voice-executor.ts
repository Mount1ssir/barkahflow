import { ParsedCommand, CommandResult } from './voice-types'
import { getAllClients } from '@/lib/client-data'
import { getDashboardStats } from '@/lib/stats-data'
import { getAllProducts, type Product } from '@/lib/products-data'
import { cartStore } from '@/lib/store/cart-store'

// ─── Matching flou de nom de produit ──────────────────────────────
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function findProductByName(products: Product[], rawName: string): Product | null {
  const target = normalizeName(rawName)
  if (!target) return null

  // 1. Correspondance exacte (nom FR ou AR)
  let match = products.find(
    (p) => normalizeName(p.nameFr || '') === target || normalizeName(p.nameAr || '') === target
  )
  if (match) return match

  // 2. Correspondance partielle dans les deux sens (ex: "coca" trouve "Coca-Cola 33cl")
  match = products.find((p) => {
    const nameFr = normalizeName(p.nameFr || '')
    const nameAr = normalizeName(p.nameAr || '')
    return (
      (nameFr && (nameFr.includes(target) || target.includes(nameFr))) ||
      (nameAr && (nameAr.includes(target) || target.includes(nameAr)))
    )
  })
  return match || null
}

/**
 * Exécute une commande vocale.
 *
 * @param command      La commande parsée.
 * @param isConfirmed  false = phase de prévisualisation (ne modifie RIEN, sert juste à
 *                     construire le message de confirmation) ; true = exécution réelle,
 *                     appelée uniquement après que l'utilisateur a dit/cliqué "oui".
 *                     C'est ce qui empêche l'action de se déclencher avant confirmation,
 *                     même si executeCommand est techniquement appelé deux fois de suite.
 */
export async function executeCommand(
  command: ParsedCommand,
  isConfirmed: boolean = false
): Promise<CommandResult> {
  try {
    const { intent, entities } = command;

    // ─── Navigation ──────────────────────────────────────────────
    if (intent === 'NAVIGATE') {
      const page = entities.find(e => e.type === 'page')?.value as string;
      const pathMap: Record<string, string> = {
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
      const path = pathMap[page] || '/dashboard';
      return { success: true, message: `Navigation vers ${page}`, data: { path }, requiresConfirmation: false };
    }

    // ─── Recherche ──────────────────────────────────────────────
    if (intent === 'SEARCH') {
      const term = entities.find(e => e.type === 'term')?.value as string;
      return { success: true, message: `Recherche de "${term}"`, data: { term }, requiresConfirmation: false };
    }

    // ─── POS / Panier (réellement branchées sur cartStore) ───────
    if (intent === 'POS_ADD') {
      const qty = (entities.find(e => e.type === 'number')?.value as number) || 1;
      const rawName = entities.find(e => e.type === 'product')?.value as string;

      const products = await getAllProducts(true);
      const product = findProductByName(products, rawName);

      if (!product) {
        return {
          success: false,
          message: `Produit "${rawName}" introuvable. Vérifiez le nom et réessayez.`,
          data: null,
          requiresConfirmation: false,
        };
      }

      if (!isConfirmed) {
        // Phase de prévisualisation : on ne touche pas au panier
        return {
          success: true,
          message: `Ajout de ${qty} ${product.nameAr} au panier`,
          data: { productId: product.id, qty },
          requiresConfirmation: true,
          confirmationMessage: `Voulez-vous ajouter ${qty} ${product.nameAr} au panier ?`,
        };
      }

      // Exécution réelle, après "oui"
      cartStore.addToCart(product, qty);
      return {
        success: true,
        message: `${qty} ${product.nameAr} ajouté${qty > 1 ? 's' : ''} au panier.`,
        data: { productId: product.id, qty },
        requiresConfirmation: false,
      };
    }

    if (intent === 'POS_REMOVE') {
      const rawName = entities.find(e => e.type === 'product')?.value as string;
      const cartItems = cartStore.getSnapshot();
      const target = normalizeName(rawName);
      const matchInCart = cartItems.find((item) => {
        const nameFr = normalizeName((item.product as any).nameFr || '');
        const nameAr = normalizeName(item.product.nameAr || '');
        return nameFr.includes(target) || target.includes(nameFr) || nameAr.includes(target) || target.includes(nameAr);
      });

      if (!matchInCart) {
        return {
          success: false,
          message: `"${rawName}" n'est pas dans le panier.`,
          data: null,
          requiresConfirmation: false,
        };
      }

      if (!isConfirmed) {
        return {
          success: true,
          message: `Retrait de "${matchInCart.product.nameAr}" du panier`,
          data: { productId: matchInCart.product.id },
          requiresConfirmation: true,
          confirmationMessage: `Voulez-vous retirer "${matchInCart.product.nameAr}" du panier ?`,
        };
      }

      cartStore.removeFromCart(matchInCart.product.id);
      return {
        success: true,
        message: `"${matchInCart.product.nameAr}" retiré du panier.`,
        data: { productId: matchInCart.product.id },
        requiresConfirmation: false,
      };
    }

    if (intent === 'POS_CLEAR') {
      if (!isConfirmed) {
        return {
          success: true, message: 'Vider le panier', data: {},
          requiresConfirmation: true, confirmationMessage: 'Voulez-vous vider tout le panier ?',
        };
      }
      cartStore.clearCart();
      return { success: true, message: 'Panier vidé.', data: {}, requiresConfirmation: false };
    }

    if (intent === 'POS_CHECKOUT') {
      if (!isConfirmed) {
        return {
          success: true, message: 'Finaliser la commande', data: {},
          requiresConfirmation: true, confirmationMessage: 'Voulez-vous finaliser la commande ?',
        };
      }
      if (cartStore.getSnapshot().length === 0) {
        return { success: false, message: 'Le panier est vide, rien à finaliser.', data: {}, requiresConfirmation: false };
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barkahflow:open-checkout'));
      }
      return { success: true, message: 'Ouverture du récapitulatif de commande.', data: {}, requiresConfirmation: false };
    }

    if (intent === 'POS_CANCEL') {
      if (!isConfirmed) {
        return {
          success: true, message: 'Annuler la vente', data: {},
          requiresConfirmation: true, confirmationMessage: 'Voulez-vous annuler cette vente ?',
        };
      }
      cartStore.clearCart();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barkahflow:close-checkout'));
      }
      return { success: true, message: 'Vente annulée, panier vidé.', data: {}, requiresConfirmation: false };
    }

    // ─── Produits (⚠️ toujours des stubs — pas encore branchés) ──
    // Ces intents nécessitent des formulaires (nom, prix, catégorie...) qu'une
    // seule commande vocale ne peut pas fournir. Dis-moi si tu veux qu'on les
    // câble sur un flux "ouvrir le formulaire pré-rempli" plutôt qu'une création directe.
    if (intent === 'PRODUCT_ADD') {
      const product = entities.find(e => e.type === 'product')?.value as string;
      return {
        success: true, message: `Création du produit "${product}" (non branché)`, data: { product },
        requiresConfirmation: true, confirmationMessage: `Voulez-vous créer le produit "${product}" ?`,
      };
    }

    if (intent === 'PRODUCT_DELETE') {
      const product = entities.find(e => e.type === 'product')?.value as string;
      return {
        success: true, message: `Suppression du produit "${product}" (non branché)`, data: { product },
        requiresConfirmation: true, confirmationMessage: `Voulez-vous supprimer le produit "${product}" ?`,
      };
    }

    if (intent === 'PRODUCT_MODIFY') {
      const product = entities.find(e => e.type === 'product')?.value as string;
      return {
        success: true, message: `Modification du produit "${product}" (non branché)`, data: { product },
        requiresConfirmation: true, confirmationMessage: `Voulez-vous modifier le produit "${product}" ?`,
      };
    }

    if (intent === 'PRODUCT_COUNT') {
      try {
        const products = await getAllProducts();
        return {
          success: true, message: `Il y a ${products.length} produits en stock.`,
          data: { count: products.length }, requiresConfirmation: false,
        };
      } catch {
        return { success: false, message: 'Impossible de compter les produits.', data: null, requiresConfirmation: false };
      }
    }

    // ─── Clients (⚠️ CLIENT_ADD toujours un stub) ────────────────
    if (intent === 'CLIENT_ADD') {
      const client = entities.find(e => e.type === 'client')?.value as string;
      return {
        success: true, message: `Création du client "${client}" (non branché)`, data: { client },
        requiresConfirmation: true, confirmationMessage: `Voulez-vous créer le client "${client}" ?`,
      };
    }

    if (intent === 'CLIENT_COUNT') {
      try {
        const clients = await getAllClients();
        return { success: true, message: `Vous avez ${clients.length} clients.`, data: { count: clients.length }, requiresConfirmation: false };
      } catch {
        return { success: false, message: 'Impossible de compter les clients.', data: null, requiresConfirmation: false };
      }
    }

    if (intent === 'CLIENT_DEBTORS') {
      try {
        const clients = await getAllClients();
        const debtors = clients.filter((c: any) => c.debt > 0);
        if (debtors.length === 0) {
          return { success: true, message: "Aucun client ne vous doit de l'argent.", data: { debtors: [] }, requiresConfirmation: false };
        }
        const names = debtors.map((c: any) => c.fullName).join(', ');
        return { success: true, message: `Les clients endettés sont : ${names}`, data: { debtors }, requiresConfirmation: false };
      } catch {
        return { success: false, message: 'Impossible de récupérer les clients endettés.', data: null, requiresConfirmation: false };
      }
    }

    // ─── Statistiques ────────────────────────────────────────────
    if (intent === 'STATS_REVENUE') {
      try {
        const stats = await getDashboardStats();
        const total = stats.todayRevenue * 30;
        return {
          success: true, message: `Votre chiffre d'affaires estimé est de ${(total / 100).toFixed(2)} MAD.`,
          data: { revenue: total }, requiresConfirmation: false,
        };
      } catch {
        return { success: false, message: "Impossible de récupérer le chiffre d'affaires.", data: null, requiresConfirmation: false };
      }
    }

    if (intent === 'STATS_SALES_TODAY') {
      try {
        const stats = await getDashboardStats();
        return {
          success: true, message: `Vous avez encaissé ${(stats.todayRevenue / 100).toFixed(2)} MAD aujourd'hui.`,
          data: { revenue: stats.todayRevenue }, requiresConfirmation: false,
        };
      } catch {
        return { success: false, message: "Impossible de récupérer l'encaissement du jour.", data: null, requiresConfirmation: false };
      }
    }

    if (intent === 'STATS_LOW_STOCK') {
      try {
        const products = await getAllProducts();
        const lowStock = products.filter((p: any) => p.stockQty <= p.alertThreshold);
        return {
          success: true, message: `Vous avez ${lowStock.length} produits en rupture de stock ou stock faible.`,
          data: { count: lowStock.length }, requiresConfirmation: false,
        };
      } catch {
        return { success: false, message: 'Impossible de récupérer les alertes stock.', data: null, requiresConfirmation: false };
      }
    }

    if (intent === 'STATS_TOTAL_DEBT') {
      try {
        const clients = await getAllClients();
        const totalDebt = clients.reduce((sum: number, c: any) => sum + c.debt, 0);
        return {
          success: true, message: `Le total des dettes actives est de ${(totalDebt / 100).toFixed(2)} MAD.`,
          data: { debt: totalDebt }, requiresConfirmation: false,
        };
      } catch {
        return { success: false, message: 'Impossible de récupérer le total des dettes.', data: null, requiresConfirmation: false };
      }
    }

    // ─── Fallback ──────────────────────────────────────────────
    return {
      success: false,
      message: "Désolé, je n'ai pas compris votre commande. Pouvez-vous répéter ?",
      data: null,
      requiresConfirmation: false,
    };
  } catch (error) {
    console.error('[voice-executor] erreur inattendue:', error);
    return {
      success: false,
      message: 'Une erreur interne est survenue. Réessayez.',
      data: null,
      requiresConfirmation: false,
    };
  }
}