import { useSyncExternalStore } from 'react'
import type { Product } from '@/lib/products-data'

export interface CartItem {
  product: Product
  quantity: number
}

const CART_STORAGE_KEY = 'barkahflow_cart'

type Listener = () => void

class CartStore {
  private items: CartItem[] = []
  private listeners = new Set<Listener>()

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromStorage()
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) this.items = JSON.parse(stored)
    } catch (error) {
      console.warn('[cart-store] erreur chargement localStorage:', error)
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return
    try {
      if (this.items.length > 0) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items))
      } else {
        localStorage.removeItem(CART_STORAGE_KEY)
      }
    } catch (error) {
      console.warn('[cart-store] erreur sauvegarde localStorage:', error)
    }
  }

  private notify() {
    this.saveToStorage()
    this.listeners.forEach((listener) => listener())
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): CartItem[] => this.items

  addToCart = (product: Product, qty: number = 1) => {
    const existing = this.items.find((i) => i.product.id === product.id)
    if (existing) {
      this.items = this.items.map((i) =>
        i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i
      )
    } else {
      this.items = [...this.items, { product, quantity: qty }]
    }
    this.notify()
  }

  removeFromCart = (productId: string) => {
    this.items = this.items.filter((i) => i.product.id !== productId)
    this.notify()
  }

  updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      this.removeFromCart(productId)
      return
    }
    this.items = this.items.map((i) =>
      i.product.id === productId ? { ...i, quantity } : i
    )
    this.notify()
  }

  clearCart = () => {
    this.items = []
    this.notify()
  }
}

// Instance unique, partagée entre la page React et l'assistant vocal
export const cartStore = new CartStore()

// Hook React pour consommer le store dans un composant (re-render automatique)
export function useCart() {
  const items = useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    () => [] as CartItem[] // snapshot serveur (SSR) : panier vide
  )
  return {
    items,
    addToCart: cartStore.addToCart,
    removeFromCart: cartStore.removeFromCart,
    updateQuantity: cartStore.updateQuantity,
    clearCart: cartStore.clearCart,
  }
}