'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import {
  Bell, Package, Wallet, AlertTriangle, Search, MessageSquare, Eye, EyeOff, X,
  MoreVertical, CheckCheck, Trash2,
} from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { saveReminder } from '@/lib/debt-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

type FilterType = 'all' | 'overdue' | 'debt' | 'stock'

const BLUE = '#3B82F6'

export default function NotificationsPage() {
  const router = useRouter()
  const { notifications, loading, dismiss, toggleRead, markAllAsRead, dismissAll } = useNotifications()
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')

  const handleNotifClick = (notif: any) => {
    if (!notif.read) {
      toggleRead(notif.id, false)
    }
    if ((notif.type === 'overdue' || notif.type === 'debt') && notif.clientId) {
      router.push(`/dashboard/dettes?client=${notif.clientId}`)
    } else if (notif.type === 'stock' && notif.productId) {
      router.push(`/dashboard/produits?produit=${notif.productId}`)
    }
  }

  const handleToggleRead = (notif: any) => {
    toggleRead(notif.id, notif.read)
    toast.success(notif.read ? 'Marqué comme non lu' : 'Marqué comme lu')
  }

  const handleDismiss = (notif: any) => {
    dismiss(notif.id)
    toast.success('Notification supprimée')
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
    toast.success('Toutes les notifications marquées comme lues')
  }

  const handleDismissAll = () => {
    dismissAll()
    toast.success('Toutes les notifications supprimées')
  }

  const handleWhatsApp = async (notif: any) => {
    if (!notif.phone) {
      toast.error("Ce client n'a pas de numéro de téléphone")
      return
    }
    const phone = notif.phone.replace(/^0/, '212').replace(/\s/g, '')
    const message = `Bonjour ${notif.clientName}, vous avez une dette de ${((notif.amount || 0) / 100).toFixed(2)} MAD chez nous. Merci de régler dès que possible.`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    try {
      await openExternal(url)
      if (notif.clientId && notif.amount) {
        await saveReminder(notif.clientId, notif.amount, message, 'whatsapp')
      }
      toast.success('WhatsApp ouvert')
    } catch (error: any) {
      toast.error(`Erreur: ${error?.message || 'Inconnue'}`)
    }
  }

  const filtered = notifications.filter((n) => {
    const matchType = filter === 'all' || n.type === filter
    const matchSearch =
      n.message.toLowerCase().includes(search.toLowerCase()) ||
      n.title.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const counts = {
    all: notifications.length,
    overdue: notifications.filter((n) => n.type === 'overdue').length,
    debt: notifications.filter((n) => n.type === 'debt').length,
    stock: notifications.filter((n) => n.type === 'stock').length,
  }

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'Toutes', count: counts.all },
    { key: 'overdue', label: 'Échéances dépassées', count: counts.overdue },
    { key: 'debt', label: 'Limite dépassée', count: counts.debt },
    { key: 'stock', label: 'Stock bas', count: counts.stock },
  ]

  const hasUnread = notifications.some((n) => !n.read)

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full p-6">

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8" style={{ color: BLUE }} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Échéances dépassées, limites de crédit et alertes stock.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={!hasUnread}
                className="rounded-xl text-xs h-9"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Tout marquer lu
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDismissAll}
                className="rounded-xl text-xs h-9 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer tout
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`p-3 rounded-xl border text-left transition-all
              ${filter === f.key
                ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300'
              }`}
          >
            <p className="text-xl font-bold text-gray-900 dark:text-white">{f.count}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.label}</p>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
        />
      </div>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="text-gray-900 dark:text-white">
              {filter === 'all' ? 'Toutes' :
               filter === 'overdue' ? 'Échéances' :
               filter === 'debt' ? 'Limites' : 'Stock'}
            </span>
            <span className="text-sm font-normal text-gray-400">{filtered.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bell className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((notif) => {
                const Icon = notif.type === 'stock' ? Package : notif.type === 'overdue' ? AlertTriangle : Wallet
                const isClickable = !!notif.clientId || !!notif.productId
                const canWhatsApp = !!notif.phone && (notif.type === 'overdue' || notif.type === 'debt')

                return (
                  <div
                    key={notif.id}
                    onClick={() => isClickable && handleNotifClick(notif)}
                    className={`flex items-start gap-4 px-5 py-4
                               ${isClickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}
                               ${notif.read ? 'opacity-50' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={16} className="text-gray-600 dark:text-gray-300" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`text-sm font-semibold ${notif.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {notif.title}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">{notif.time}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{notif.message}</p>
                      {canWhatsApp && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleWhatsApp(notif)
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 mt-1"
                        >
                          <MessageSquare size={12} /> Relancer WhatsApp
                        </button>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                          <MoreVertical className="h-4 w-4 text-gray-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleRead(notif) }}>
                          {notif.read ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Marquer non lu
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Marquer lu
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleDismiss(notif) }}
                          className="text-red-500 focus:text-red-500"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}