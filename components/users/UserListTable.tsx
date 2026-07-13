'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  MoreVertical,
  Pencil,
  Eye,
  Key,
  UserX,
  UserCheck,
  Trash2,
  ShieldCheck,
} from 'lucide-react'
import {
  deactivateCashier,
  updateCashier,
  deleteCashier,
  type AppUserRow,
  getPresenceStatus,
  getPresenceColor,
  getLastConnectionText,
} from '@/lib/user-data'
import { getCashierStatsRealTime, type CashierStatsToday } from '@/lib/invoice-data'
import { toast } from 'sonner'

interface UserListTableProps {
  users: AppUserRow[]
  loading: boolean
  currentAdminId: string
  onEdit: (user: AppUserRow) => void
  onViewDetails: (user: AppUserRow) => void
  onResetPin: (user: AppUserRow) => void
  onRefresh: () => void
}

export function UserListTable({
  users,
  loading,
  currentAdminId,
  onEdit,
  onViewDetails,
  onResetPin,
  onRefresh,
}: UserListTableProps) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<AppUserRow | null>(null)
  const [userStats, setUserStats] = useState<Record<string, CashierStatsToday>>({})
  const [loadingStats, setLoadingStats] = useState(true)

  // Charger les stats immédiatement au montage
  useEffect(() => {
    loadAllStats()
  }, [users])

  // Rafraîchir les stats toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      loadAllStats()
    }, 30000)
    return () => clearInterval(interval)
  }, [users])

  // Rafraîchir les stats après une nouvelle vente
  useEffect(() => {
    const handleSaleCreated = () => {
      console.log('🔄 Sale created event received')
      loadAllStats()
    }
    window.addEventListener('barkahflow:sale-created', handleSaleCreated)
    return () => window.removeEventListener('barkahflow:sale-created', handleSaleCreated)
  }, [users])

  // Rafraîchir les stats après modification
  useEffect(() => {
    const handleStatsChanged = () => {
      console.log('🔄 Stats changed event received')
      loadAllStats()
    }
    window.addEventListener('barkahflow:stats-changed', handleStatsChanged)
    return () => window.removeEventListener('barkahflow:stats-changed', handleStatsChanged)
  }, [users])

  const loadAllStats = async () => {
    if (users.length === 0) {
      setLoadingStats(false)
      return
    }

    console.log('📊 Loading real-time stats for', users.length, 'users...')
    setLoadingStats(true)
    const stats: Record<string, CashierStatsToday> = {}

    for (const user of users) {
      try {
        const result = await getCashierStatsRealTime(user.id)
        stats[user.id] = result
        console.log(`📊 Stats for ${user.name}:`, result)
      } catch (error) {
        console.error(`Erreur chargement stats pour ${user.name}:`, error)
        stats[user.id] = { sales: 0, revenue: 0, discount: 0, debt: 0 }
      }
    }

    setUserStats(stats)
    setLoadingStats(false)
    console.log('📊 All stats loaded:', stats)
  }

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  const handleToggleActive = async (user: AppUserRow) => {
    try {
      if (user.active) {
        await deactivateCashier(user.id)
        toast.success(`${user.name} désactivé`)
      } else {
        await updateCashier(user.id, { active: true })
        toast.success(`${user.name} réactivé`)
      }
      onRefresh()
      setTimeout(() => loadAllStats(), 500)
    } catch (err: any) {
      toast.error(err?.message || 'Erreur')
    }
  }

  const handleDelete = async (user: AppUserRow) => {
    try {
      await deleteCashier(user.id)
      toast.success(`${user.name} supprimé`)
      setDeleteTarget(null)
      onRefresh()
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la suppression')
    }
  }

  // 🔥 Fonction pour gérer le clic sur "Voir les détails"
  const handleViewDetailsClick = (user: AppUserRow) => {
    console.log('👆 Clic sur Voir les détails pour:', user.name, user.id)
    if (onViewDetails) {
      onViewDetails(user)
    } else {
      // Fallback si onViewDetails n'est pas défini
      router.push(`/dashboard/settings/utilisateurs/${user.id}`)
    }
  }

  // 🔥 Fonction pour gérer le clic sur le nom
  const handleNameClick = (user: AppUserRow) => {
    console.log('👆 Clic sur le nom:', user.name, user.id)
    if (onViewDetails) {
      onViewDetails(user)
    } else {
      router.push(`/dashboard/settings/utilisateurs/${user.id}`)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ─── Message total simplifié ──────────────────────────────── */}
      {users.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {users.length} {users.length === 1 ? 'caissier' : 'caissiers'} au total
        </p>
      )}

      {users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
          </div>
          <p className="font-semibold text-gray-700 dark:text-gray-300">
            Aucun caissier
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Créez votre premier caissier avec le bouton ci-dessus
          </p>
        </div>
      )}

      {users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Caissier</th>
                <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Email</th>
                <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Dernière connexion</th>
                <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Ventes</th>
                <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">CA</th>
                <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Remises</th>
                <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Dette</th>
                <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Permissions</th>
                <th className="text-right text-xs font-medium text-gray-400 py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isCurrentAdmin = user.id === currentAdminId
                const stats = userStats[user.id] || { sales: 0, revenue: 0, discount: 0, debt: 0 }
                const status = getPresenceStatus(user)
                const presenceColor = getPresenceColor(status)
                const connectionText = getLastConnectionText(user)

                return (
                  <tr
                    key={user.id}
                    className={`border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${
                      !user.active ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                          <AvatarFallback
                            className="text-xs font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)' }}
                          >
                            {initials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        {/* 🔥 Le nom redirige vers la page de détails */}
                        <button
                          onClick={() => handleNameClick(user)}
                          className="font-medium text-sm text-gray-800 dark:text-gray-100 hover:text-sky-500 dark:hover:text-sky-400 transition-colors cursor-pointer"
                        >
                          {user.name}
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600 dark:text-gray-300">{user.email || '—'}</p>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: presenceColor,
                            animation: status === 'online' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                          }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">{connectionText}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {loadingStats ? '...' : stats.sales}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {loadingStats ? '...' : `${stats.revenue.toFixed(2)} DH`}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-orange-500">
                        {loadingStats ? '...' : `${stats.discount.toFixed(2)} DH`}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <p className={`text-sm font-semibold ${stats.debt > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {loadingStats ? '...' : `${stats.debt.toFixed(2)} DH`}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="text-xs">
                        {user.permissions?.length || 0}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {!isCurrentAdmin ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-48">
                            {/* 🔥 CORRECTION : "Voir les détails" utilise handleViewDetailsClick */}
                            <DropdownMenuItem
                              onClick={() => handleViewDetailsClick(user)}
                              className="cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 mr-2" />
                              Voir les détails
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(user)} className="cursor-pointer">
                              <Pencil className="w-3.5 h-3.5 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onResetPin(user)} className="cursor-pointer">
                              <Key className="w-3.5 h-3.5 mr-2" />
                              Réinitialiser le PIN
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(user)}
                              className={`cursor-pointer ${user.active ? 'text-amber-600' : 'text-green-600'}`}
                            >
                              {user.active ? <UserX className="w-3.5 h-3.5 mr-2" /> : <UserCheck className="w-3.5 h-3.5 mr-2" />}
                              {user.active ? 'Désactiver' : 'Activer'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(user)}
                              className="cursor-pointer text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-gray-400">Admin</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteTarget?.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées à ce caissier seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}