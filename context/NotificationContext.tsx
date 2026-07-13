'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getNotifications, dismissNotification, toggleRead, markAllAsRead, dismissAllNotifications, type Notification } from '@/lib/notifications-data'

interface NotificationContextType {
  notifications: Notification[]
  loading: boolean
  refresh: () => Promise<void>
  dismiss: (id: string) => void
  toggleRead: (id: string, currentlyRead: boolean) => void
  markAllAsRead: () => void
  dismissAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = async () => {
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch (error) {
      console.error('Erreur chargement notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // ─── Chargement initial + écoute des changements ──────────────
  useEffect(() => {
    loadNotifications()
    
    // ✅ Écouter l'événement custom pour rafraîchir les notifications
    const handler = () => {
      console.log('📢 Événement notifications-changed reçu, rechargement...')
      loadNotifications()
    }
    
    window.addEventListener('barkahflow:notifications-changed', handler)
    return () => window.removeEventListener('barkahflow:notifications-changed', handler)
  }, [])

  const refresh = async () => {
    setLoading(true)
    await loadNotifications()
  }

  const dismiss = (id: string) => {
    dismissNotification(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const handleToggleRead = (id: string, currentlyRead: boolean) => {
    toggleRead(id, currentlyRead)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    )
  }

  const handleMarkAllAsRead = () => {
    const ids = notifications.map((n) => n.id)
    markAllAsRead(ids)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleDismissAll = () => {
    const ids = notifications.map((n) => n.id)
    dismissAllNotifications(ids)
    setNotifications([])
  }

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        loading,
        refresh,
        dismiss,
        toggleRead: handleToggleRead,
        markAllAsRead: handleMarkAllAsRead,
        dismissAll: handleDismissAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}