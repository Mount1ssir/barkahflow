import Fuse from 'fuse.js'
import { ParsedCommand, CommandResult } from './voice-types'
import { getAllClients, deleteClient, getClientById, type Client } from '@/lib/client-data'
import { getDashboardStats } from '@/lib/stats-data'
import { getAllProducts, deleteProduct, toggleProductStatus, getProductById, type Product } from '@/lib/products-data'
import { getAllInvoices, deleteInvoice, getInvoiceById, type Invoice } from '@/lib/invoice-data'
import { cartStore, type CartItem } from '@/lib/store/cart-store'

// ✅ CORRECTION : conserve les tirets et les points
function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 \-.]/g, '')
    .trim()
}

// ─── Recherche de produit (améliorée) ──────────────────────────────
function findProductByName(products: Product[], rawName: string): Product | null {
  if (!rawName?.trim()) return null
  const target = normalizeName(rawName)
  if (!target) return null

  const exactMatch = products.find((p) => {
    const nameFr = normalizeName(p.nameFr || '')
    const nameAr = normalizeName(p.nameAr || '')
    const sku = normalizeName(p.sku || '')
    return nameFr === target || nameAr === target || sku === target
  })
  if (exactMatch) return exactMatch

  const partialMatch = products.find((p) => {
    const nameFr = normalizeName(p.nameFr || '')
    const nameAr = normalizeName(p.nameAr || '')
    const sku = normalizeName(p.sku || '')
    return nameFr.includes(target) || target.includes(nameFr) ||
           nameAr.includes(target) || target.includes(nameAr) ||
           sku.includes(target) || target.includes(sku)
  })
  if (partialMatch) return partialMatch

  const searchable = products.map((p) => ({
    product: p,
    searchName: `${normalizeName(p.nameFr || '')} ${normalizeName(p.nameAr || '')} ${normalizeName(p.sku || '')}`.trim(),
  }))
  const fuse = new Fuse(searchable, {
    keys: ['searchName'],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
  })
  const results = fuse.search(target)
  if (results.length > 0) {
    return results[0].item.product
  }
  return null
}

// ─── Recherche de client (tolérante) ──────────────────────────────
function findClientByName(clients: Client[], rawName: string): Client | null {
  if (!rawName?.trim()) return null
  const target = normalizeName(rawName)
  const client = clients.find((c) => {
    const full = normalizeName(c.fullName)
    return full === target || full.includes(target) || target.includes(full)
  })
  if (client) return client
  return clients.find((c) => {
    const phone = normalizeName(c.phone || '')
    const email = normalizeName(c.email || '')
    return phone.includes(target) || email.includes(target)
  }) || null
}

// ✅ CORRECTION : recherche de facture qui préserve les tirets
function findInvoiceByNumber(invoices: Invoice[], rawNumber: string): Invoice | null {
  if (!rawNumber?.trim()) return null
  const target = normalizeName(rawNumber)
  return invoices.find(
    (inv) =>
      normalizeName(inv.invoiceNumber).includes(target) ||
      target.includes(normalizeName(inv.invoiceNumber))
  ) || null
}

// ─── Recherche dans le panier ────────────────────────────────────
function findCartItemByName(items: CartItem[], rawName: string): CartItem | null {
  if (!rawName?.trim()) return null
  const searchable = items.map((item) => ({
    item,
    searchName: `${normalizeName((item.product as any).nameFr || '')} ${normalizeName(item.product.nameAr || '')}`.trim(),
  }))
  const fuse = new Fuse(searchable, {
    keys: ['searchName'],
    threshold: 0.4,
    ignoreLocation: true,
  })
  const results = fuse.search(normalizeName(rawName))
  return results.length > 0 ? results[0].item.item : null
}

export async function executeCommand(
  command: ParsedCommand,
  isConfirmed: boolean = false
): Promise<CommandResult> {
  try {
    const { intent, entities } = command

    // ─── NAVIGATE ──────────────────────────────────────────────────
    if (intent === 'NAVIGATE') {
      const page = entities.find(e => e.type === 'page')?.value as string
      if (page === 'scan') {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('barkahflow:open-scanner'))
        }
        return { success: true, message: 'Ouverture du scanner...', data: {}, requiresConfirmation: false }
      }
      if (page === 'ajout_produit') {
        return {
          success: true,
          message: 'Redirection vers le formulaire d\'ajout de produit',
          data: { path: '/dashboard/produits/nouveau' },
          requiresConfirmation: false,
          navigateTo: '/dashboard/produits/nouveau',
        }
      }
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
      }
      const path = pathMap[page] || '/dashboard'
      return {
        success: true,
        message: `Navigation vers ${page}`,
        data: { path },
        requiresConfirmation: false,
        navigateTo: path,
      }
    }

    // ─── SEARCH ────────────────────────────────────────────────────
    if (intent === 'SEARCH') {
      const term = entities.find(e => e.type === 'term')?.value as string
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barkahflow:search', { detail: term }))
      }
      return { success: true, message: `Recherche de "${term}"`, data: { term }, requiresConfirmation: false }
    }

    // ─── CLEAR_SEARCH ──────────────────────────────────────────────
    if (intent === 'CLEAR_SEARCH') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barkahflow:clear-search'))
      }
      return { success: true, message: 'Recherche effacée.', data: {}, requiresConfirmation: false }
    }

    // ─── EXPORT ──────────────────────────────────────────────────
    if (intent === 'EXPORT') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barkahflow:export'))
      }
      return { success: true, message: 'Export en cours...', data: {}, requiresConfirmation: false }
    }

    // ─── POS / Panier ────────────────────────────────────────────
    if (intent === 'POS_ADD') {
      const qty = (entities.find(e => e.type === 'number')?.value as number) || 1
      const rawName = entities.find(e => e.type === 'product')?.value as string
      const products = await getAllProducts(true)
      const product = findProductByName(products, rawName)
      if (!product) {
        return {
          success: false,
          message: `Produit "${rawName}" introuvable. Vérifiez le nom et réessayez.`,
          data: null,
          requiresConfirmation: false,
        }
      }
      if (!isConfirmed) {
        return {
          success: true,
          message: `Ajout de ${qty} ${product.nameAr} au panier`,
          data: { productId: product.id, qty },
          requiresConfirmation: true,
          confirmationMessage: `Voulez-vous ajouter ${qty} ${product.nameAr} au panier ?`,
        }
      }
      cartStore.addToCart(product, qty)
      return {
        success: true,
        message: `${qty} ${product.nameAr} ajouté${qty > 1 ? 's' : ''} au panier.`,
        data: { productId: product.id, qty },
        requiresConfirmation: false,
      }
    }

    if (intent === 'POS_REMOVE') {
      const rawName = entities.find(e => e.type === 'product')?.value as string
      const cartItems = cartStore.getSnapshot()
      const matchInCart = findCartItemByName(cartItems, rawName)
      if (!matchInCart) {
        return {
          success: false,
          message: `"${rawName}" n'est pas dans le panier.`,
          data: null,
          requiresConfirmation: false,
        }
      }
      if (!isConfirmed) {
        return {
          success: true,
          message: `Retrait de "${matchInCart.product.nameAr}" du panier`,
          data: { productId: matchInCart.product.id },
          requiresConfirmation: true,
          confirmationMessage: `Voulez-vous retirer "${matchInCart.product.nameAr}" du panier ?`,
        }
      }
      cartStore.removeFromCart(matchInCart.product.id)
      return {
        success: true,
        message: `"${matchInCart.product.nameAr}" retiré du panier.`,
        data: { productId: matchInCart.product.id },
        requiresConfirmation: false,
      }
    }

    if (intent === 'POS_CLEAR') {
      if (!isConfirmed) {
        return {
          success: true, message: 'Vider le panier', data: {},
          requiresConfirmation: true, confirmationMessage: 'Voulez-vous vider tout le panier ?',
        }
      }
      cartStore.clearCart()
      return { success: true, message: 'Panier vidé.', data: {}, requiresConfirmation: false }
    }

    if (intent === 'POS_CHECKOUT') {
      if (!isConfirmed) {
        return {
          success: true, message: 'Finaliser la commande', data: {},
          requiresConfirmation: true, confirmationMessage: 'Voulez-vous finaliser la commande ?',
        }
      }
      if (cartStore.getSnapshot().length === 0) {
        return { success: false, message: 'Le panier est vide, rien à finaliser.', data: {}, requiresConfirmation: false }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barkahflow:open-checkout'))
      }
      return { success: true, message: 'Ouverture du récapitulatif de commande.', data: {}, requiresConfirmation: false }
    }

    if (intent === 'POS_CANCEL') {
      if (!isConfirmed) {
        return {
          success: true, message: 'Annuler la vente', data: {},
          requiresConfirmation: true, confirmationMessage: 'Voulez-vous annuler cette vente ?',
        }
      }
      cartStore.clearCart()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barkahflow:close-checkout'))
      }
      return { success: true, message: 'Vente annulée, panier vidé.', data: {}, requiresConfirmation: false }
    }

    // ─── CLIENTS ──────────────────────────────────────────────────
    if (intent === 'CLIENT_ADD') {
      const rawName = entities.find(e => e.type === 'client')?.value as string
      if (!isConfirmed) {
        const msg = rawName ? `Ajout du client "${rawName}"` : 'Ajout d\'un nouveau client'
        return {
          success: true,
          message: msg,
          data: { clientName: rawName },
          requiresConfirmation: true,
          confirmationMessage: rawName ? `Voulez-vous ajouter le client "${rawName}" ?` : 'Voulez-vous créer un nouveau client ?',
        }
      }
      return {
        success: true,
        message: rawName ? `Redirection pour ajouter "${rawName}"` : 'Redirection vers le formulaire d\'ajout de client',
        data: { path: '/dashboard/clients/nouveau' },
        requiresConfirmation: false,
        navigateTo: '/dashboard/clients/nouveau',
      }
    }

    if (intent === 'CLIENT_DELETE') {
      const rawName = entities.find(e => e.type === 'client')?.value as string
      if (!rawName) {
        return { success: false, message: 'Veuillez préciser le nom du client.', data: null, requiresConfirmation: false }
      }
      const clients = await getAllClients()
      const client = findClientByName(clients, rawName)
      if (!client) {
        return { success: false, message: `Client "${rawName}" introuvable.`, data: null, requiresConfirmation: false }
      }
      if (!isConfirmed) {
        return {
          success: true,
          message: `Suppression du client "${client.fullName}"`,
          data: { clientId: client.id },
          requiresConfirmation: true,
          confirmationMessage: `Voulez-vous supprimer le client "${client.fullName}" ? Cette action est irréversible.`,
        }
      }
      try {
        await deleteClient(client.id)
        return {
          success: true,
          message: `Client "${client.fullName}" supprimé.`,
          data: { clientId: client.id },
          requiresConfirmation: false,
          shouldRefresh: true,
        }
      } catch (error) {
        console.error('Erreur suppression client:', error)
        return { success: false, message: `Impossible de supprimer ce client.`, data: null, requiresConfirmation: false }
      }
    }

    if (intent === 'CLIENT_EDIT') {
      const rawName = entities.find(e => e.type === 'client')?.value as string
      if (!rawName) {
        return { success: false, message: 'Veuillez préciser le nom du client.', data: null, requiresConfirmation: false }
      }
      const clients = await getAllClients()
      const client = findClientByName(clients, rawName)
      if (!client) {
        return { success: false, message: `Client "${rawName}" introuvable.`, data: null, requiresConfirmation: false }
      }
      const path = `/dashboard/clients/${client.id}/edit`
      return {
        success: true,
        message: `Redirection vers l'édition du client "${client.fullName}"`,
        data: { path },
        requiresConfirmation: false,
        navigateTo: path,
      }
    }

    if (intent === 'CLIENT_VIEW') {
      const rawName = entities.find(e => e.type === 'client')?.value as string
      if (!rawName) {
        return { success: false, message: 'Veuillez préciser le nom du client.', data: null, requiresConfirmation: false }
      }
      const clients = await getAllClients()
      const client = findClientByName(clients, rawName)
      if (!client) {
        return { success: false, message: `Client "${rawName}" introuvable.`, data: null, requiresConfirmation: false }
      }
      const path = `/dashboard/clients/${client.id}`
      return {
        success: true,
        message: `Redirection vers la fiche de "${client.fullName}"`,
        data: { path },
        requiresConfirmation: false,
        navigateTo: path,
      }
    }

    if (intent === 'CLIENT_COUNT') {
      try {
        const clients = await getAllClients()
        return { success: true, message: `Vous avez ${clients.length} clients.`, data: { count: clients.length }, requiresConfirmation: false }
      } catch {
        return { success: false, message: 'Impossible de compter les clients.', data: null, requiresConfirmation: false }
      }
    }

    if (intent === 'CLIENT_DEBTORS') {
      try {
        const clients = await getAllClients()
        const debtors = clients.filter((c: any) => c.debt > 0)
        if (debtors.length === 0) {
          return { success: true, message: "Aucun client ne vous doit de l'argent.", data: { debtors: [] }, requiresConfirmation: false }
        }
        const names = debtors.map((c: any) => c.fullName).join(', ')
        return { success: true, message: `Les clients endettés sont : ${names}`, data: { debtors }, requiresConfirmation: false }
      } catch {
        return { success: false, message: 'Impossible de récupérer les clients endettés.', data: null, requiresConfirmation: false }
      }
    }

    // ─── PRODUITS ──────────────────────────────────────────────────
    if (intent === 'PRODUCT_ADD') {
      const rawName = entities.find(e => e.type === 'product')?.value as string
      if (!isConfirmed) {
        const msg = rawName ? `Ajout du produit "${rawName}"` : 'Ajout d\'un nouveau produit'
        return {
          success: true,
          message: msg,
          data: { productName: rawName },
          requiresConfirmation: true,
          confirmationMessage: rawName ? `Voulez-vous ajouter le produit "${rawName}" ?` : 'Voulez-vous créer un nouveau produit ?',
        }
      }
      return {
        success: true,
        message: 'Redirection vers le formulaire d\'ajout de produit',
        data: { path: '/dashboard/produits/nouveau' },
        requiresConfirmation: false,
        navigateTo: '/dashboard/produits/nouveau',
      }
    }

    if (intent === 'PRODUCT_DELETE') {
      const rawName = entities.find(e => e.type === 'product')?.value as string
      if (!rawName) {
        return { success: false, message: 'Veuillez préciser le nom du produit.', data: null, requiresConfirmation: false }
      }
      const products = await getAllProducts(false)
      const product = findProductByName(products, rawName)
      if (!product) {
        return { success: false, message: `Produit "${rawName}" introuvable.`, data: null, requiresConfirmation: false }
      }
      if (!isConfirmed) {
        return {
          success: true,
          message: `Suppression du produit "${product.nameAr}"`,
          data: { productId: product.id },
          requiresConfirmation: true,
          confirmationMessage: `Voulez-vous supprimer le produit "${product.nameAr}" ?`,
        }
      }
      try {
        await deleteProduct(product.id)
        return {
          success: true,
          message: `Produit "${product.nameAr}" supprimé.`,
          data: { productId: product.id },
          requiresConfirmation: false,
          shouldRefresh: true,
        }
      } catch (error: any) {
        return {
          success: false,
          message: `Le produit "${product.nameAr}" ne peut pas être supprimé car il a des ventes associées.`,
          data: { productId: product.id, product },
          requiresConfirmation: true,
          confirmationMessage: `Le produit "${product.nameAr}" a des ventes, il ne peut pas être supprimé. Voulez-vous le désactiver à la place ?`,
          fallbackIntent: 'PRODUCT_TOGGLE',
        }
      }
    }

    if (intent === 'PRODUCT_EDIT') {
      const rawName = entities.find(e => e.type === 'product')?.value as string
      if (!rawName) {
        return { success: false, message: 'Veuillez préciser le nom du produit.', data: null, requiresConfirmation: false }
      }
      const products = await getAllProducts(false)
      const product = findProductByName(products, rawName)
      if (!product) {
        return { success: false, message: `Produit "${rawName}" introuvable.`, data: null, requiresConfirmation: false }
      }
      const path = `/dashboard/produits/nouveau?id=${product.id}`
      return {
        success: true,
        message: `Redirection vers l'édition du produit "${product.nameAr}"`,
        data: { path },
        requiresConfirmation: false,
        navigateTo: path,
      }
    }

    if (intent === 'PRODUCT_VIEW') {
      const rawName = entities.find(e => e.type === 'product')?.value as string
      if (!rawName) {
        return { success: false, message: 'Veuillez préciser le nom du produit.', data: null, requiresConfirmation: false }
      }
      const products = await getAllProducts(false)
      const product = findProductByName(products, rawName)
      if (!product) {
        return { success: false, message: `Produit "${rawName}" introuvable.`, data: null, requiresConfirmation: false }
      }
      return {
        success: true,
        message: `Recherche du produit "${product.nameAr}"`,
        data: { product },
        requiresConfirmation: false,
        navigateTo: `/dashboard/produits?search=${encodeURIComponent(product.nameAr)}`,
      }
    }

    if (intent === 'PRODUCT_TOGGLE') {
      const rawName = entities.find(e => e.type === 'product')?.value as string
      if (!rawName) {
        return { success: false, message: 'Veuillez préciser le nom du produit.', data: null, requiresConfirmation: false }
      }
      const products = await getAllProducts(false)
      const product = findProductByName(products, rawName)
      if (!product) {
        return { success: false, message: `Produit "${rawName}" introuvable.`, data: null, requiresConfirmation: false }
      }
      if (!isConfirmed) {
        const action = product.isActive ? 'désactiver' : 'activer'
        return {
          success: true,
          message: `${action} le produit "${product.nameAr}"`,
          data: { productId: product.id },
          requiresConfirmation: true,
          confirmationMessage: `Voulez-vous ${action} le produit "${product.nameAr}" ?`,
        }
      }
      try {
        await toggleProductStatus(product.id, !product.isActive)
        const action = product.isActive ? 'désactivé' : 'activé'
        return {
          success: true,
          message: `Produit "${product.nameAr}" ${action}.`,
          data: { productId: product.id },
          requiresConfirmation: false,
          shouldRefresh: true,
        }
      } catch (error) {
        return { success: false, message: `Erreur lors de la modification du produit.`, data: null, requiresConfirmation: false }
      }
    }

    // ─── Réapprovisionner un produit ──────────────────────────────
    if (intent === 'PRODUCT_REPLENISH') {
      const rawName = entities.find(e => e.type === 'product')?.value as string
      if (!rawName) {
        return { success: false, message: 'Veuillez préciser le nom du produit.', data: null, requiresConfirmation: false }
      }
      const products = await getAllProducts(false)
      const product = findProductByName(products, rawName)
      if (!product) {
        return { success: false, message: `Produit "${rawName}" introuvable.`, data: null, requiresConfirmation: false }
      }
      if (!isConfirmed) {
        return {
          success: true,
          message: `Réapprovisionnement du produit "${product.nameAr}"`,
          data: { productId: product.id },
          requiresConfirmation: true,
          confirmationMessage: `Voulez-vous réapprovisionner le produit "${product.nameAr}" ?`,
        }
      }
      const path = `/dashboard/produits?replenish=${product.id}`
      return {
        success: true,
        message: `Ouverture du réapprovisionnement pour "${product.nameAr}"`,
        data: { path },
        requiresConfirmation: false,
        navigateTo: path,
      }
    }

    // ─── Historique de stock d'un produit ───────────────────────────
    if (intent === 'PRODUCT_HISTORY') {
      const rawName = entities.find(e => e.type === 'product')?.value as string
      if (!rawName) {
        return { success: false, message: 'Veuillez préciser le nom du produit.', data: null, requiresConfirmation: false }
      }
      const products = await getAllProducts(false)
      const product = findProductByName(products, rawName)
      if (!product) {
        return { success: false, message: `Produit "${rawName}" introuvable.`, data: null, requiresConfirmation: false }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barkahflow:history', { detail: product.id }))
      }
      return {
        success: true,
        message: `Ouverture de l'historique du produit "${product.nameAr}"`,
        data: { productId: product.id },
        requiresConfirmation: false,
      }
    }

    if (intent === 'PRODUCT_COUNT') {
      try {
        const products = await getAllProducts()
        return {
          success: true, message: `Il y a ${products.length} produits en stock.`,
          data: { count: products.length }, requiresConfirmation: false,
        }
      } catch {
        return { success: false, message: 'Impossible de compter les produits.', data: null, requiresConfirmation: false }
      }
    }

    // ─── FACTURES ──────────────────────────────────────────────────
    if (intent === 'INVOICE_ADD') {
      return {
        success: true,
        message: 'Redirection vers la caisse pour créer une facture',
        data: { path: '/dashboard/caisse' },
        requiresConfirmation: false,
        navigateTo: '/dashboard/caisse',
      }
    }

    if (intent === 'INVOICE_DELETE') {
      const rawNumber = entities.find(e => e.type === 'invoice')?.value as string
      if (!rawNumber) {
        return { success: false, message: 'Veuillez préciser le numéro de la facture.', data: null, requiresConfirmation: false }
      }
      const invoices = await getAllInvoices()
      const invoice = findInvoiceByNumber(invoices, rawNumber)
      if (!invoice) {
        return { success: false, message: `Facture "${rawNumber}" introuvable.`, data: null, requiresConfirmation: false }
      }
      if (!isConfirmed) {
        return {
          success: true,
          message: `Suppression de la facture "${invoice.invoiceNumber}"`,
          data: { invoiceId: invoice.id },
          requiresConfirmation: true,
          confirmationMessage: `Voulez-vous supprimer la facture "${invoice.invoiceNumber}" ? Cette action est irréversible.`,
        }
      }
      try {
        await deleteInvoice(invoice.id)
        return {
          success: true,
          message: `Facture "${invoice.invoiceNumber}" supprimée.`,
          data: { invoiceId: invoice.id },
          requiresConfirmation: false,
          shouldRefresh: true,
        }
      } catch (error) {
        return { success: false, message: `Impossible de supprimer cette facture.`, data: null, requiresConfirmation: false }
      }
    }

    if (intent === 'INVOICE_EDIT') {
      const rawNumber = entities.find(e => e.type === 'invoice')?.value as string
      if (!rawNumber) {
        return { success: false, message: 'Veuillez préciser le numéro de la facture.', data: null, requiresConfirmation: false }
      }
      const invoices = await getAllInvoices()
      const invoice = findInvoiceByNumber(invoices, rawNumber)
      if (!invoice) {
        return { success: false, message: `Facture "${rawNumber}" introuvable.`, data: null, requiresConfirmation: false }
      }
      const path = `/dashboard/factures/${invoice.id}/edit`
      return {
        success: true,
        message: `Redirection vers l'édition de la facture "${invoice.invoiceNumber}"`,
        data: { path },
        requiresConfirmation: false,
        navigateTo: path,
      }
    }

    if (intent === 'INVOICE_VIEW') {
      const rawNumber = entities.find(e => e.type === 'invoice')?.value as string
      if (!rawNumber) {
        return { success: false, message: 'Veuillez préciser le numéro de la facture.', data: null, requiresConfirmation: false }
      }
      const invoices = await getAllInvoices()
      const invoice = findInvoiceByNumber(invoices, rawNumber)
      if (!invoice) {
        return { success: false, message: `Facture "${rawNumber}" introuvable.`, data: null, requiresConfirmation: false }
      }
      const path = `/dashboard/factures/${invoice.id}`
      return {
        success: true,
        message: `Redirection vers la facture "${invoice.invoiceNumber}"`,
        data: { path },
        requiresConfirmation: false,
        navigateTo: path,
      }
    }

    // ─── STATISTIQUES ──────────────────────────────────────────────
    if (intent === 'STATS_REVENUE') {
      try {
        const stats = await getDashboardStats()
        const total = stats.todayRevenue * 30
        return {
          success: true, message: `Votre chiffre d'affaires estimé est de ${(total / 100).toFixed(2)} MAD.`,
          data: { revenue: total }, requiresConfirmation: false,
        }
      } catch {
        return { success: false, message: "Impossible de récupérer le chiffre d'affaires.", data: null, requiresConfirmation: false }
      }
    }

    if (intent === 'STATS_SALES_TODAY') {
      try {
        const stats = await getDashboardStats()
        return {
          success: true, message: `Vous avez encaissé ${(stats.todayRevenue / 100).toFixed(2)} MAD aujourd'hui.`,
          data: { revenue: stats.todayRevenue }, requiresConfirmation: false,
        }
      } catch {
        return { success: false, message: "Impossible de récupérer l'encaissement du jour.", data: null, requiresConfirmation: false }
      }
    }

    if (intent === 'STATS_LOW_STOCK') {
      try {
        const products = await getAllProducts()
        const lowStock = products.filter((p: any) => p.stockQty <= p.alertThreshold)
        return {
          success: true, message: `Vous avez ${lowStock.length} produits en rupture de stock ou stock faible.`,
          data: { count: lowStock.length }, requiresConfirmation: false,
        }
      } catch {
        return { success: false, message: 'Impossible de récupérer les alertes stock.', data: null, requiresConfirmation: false }
      }
    }

    if (intent === 'STATS_TOTAL_DEBT') {
      try {
        const clients = await getAllClients()
        const totalDebt = clients.reduce((sum: number, c: any) => sum + c.debt, 0)
        return {
          success: true, message: `Le total des dettes actives est de ${(totalDebt / 100).toFixed(2)} MAD.`,
          data: { debt: totalDebt }, requiresConfirmation: false,
        }
      } catch {
        return { success: false, message: 'Impossible de récupérer le total des dettes.', data: null, requiresConfirmation: false }
      }
    }

    // ─── FALLBACK ──────────────────────────────────────────────────
    return {
      success: false,
      message: "Désolé, je n'ai pas compris votre commande. Pouvez-vous répéter ?",
      data: null,
      requiresConfirmation: false,
    }
  } catch (error) {
    console.error('[voice-executor] erreur inattendue:', error)
    return {
      success: false,
      message: 'Une erreur interne est survenue. Réessayez.',
      data: null,
      requiresConfirmation: false,
    }
  }
}