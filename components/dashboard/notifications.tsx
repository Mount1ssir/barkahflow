'use client'

import { useState, useEffect } from 'react'
import { Bell, Package, Wallet, Loader2 } from 'lucide-react'
import { getNotifications, type Notification } from '@/lib/notifications-data'
// ✅ Ajout : import pour les traductions
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/config'

export function Notifications() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [])

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

  const count = notifications.length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg
                   transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-white/5"
      >
        <Bell size={18} className="text-gray-600 dark:text-gray-300" />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full
                       flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: '#ef4444' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div
            className="absolute right-0 mt-2 w-80 rounded-xl shadow-xl z-50 overflow-hidden
                       border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800
                            flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('notifications.title', 'Notifications')}
              </h3>
              {count > 0 && (
                <span className="text-xs text-gray-400">
                  {t('notifications.new_count', { count })}
                </span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-gray-400">
                    {t('notifications.empty', 'Aucune notification pour le moment')}
                  </p>
                </div>
              )}

              {!loading && notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50
                             dark:hover:bg-gray-800 transition-colors cursor-pointer
                             border-b border-gray-50 dark:border-gray-800 last:border-0"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: notif.type === 'stock'
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(201, 168, 76, 0.1)',
                    }}
                  >
                    {notif.type === 'stock' ? (
                      <Package size={14} style={{ color: '#f59e0b' }} />
                    ) : (
                      <Wallet size={14} style={{ color: '#c9a84c' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {notif.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}