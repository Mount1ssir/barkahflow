'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Search,
  ShieldCheck,
} from 'lucide-react'
import { deactivateCashier, updateCashier, deleteCashier, type AppUserRow } from '@/lib/user-data'
import { getInvoicesByUser, type Invoice } from '@/lib/invoice-data'
import { useTranslation } from 'react-i18next'
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

type FilterType = 'all' | 'active' | 'inactive'

// ─── Cache pour les stats ──────────────────────────────────────────
const statsCache = new Map<string, { sales: number; revenue: number }>()

export function UserListTable({
  users,
  loading,
  currentAdminId,
  onEdit,
  onViewDetails,
  onResetPin,
  onRefresh,
}: UserListTableProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [deleteTarget, setDeleteTarget] = useState<AppUserRow | null>(null)
  const [userStats, setUserStats] = useState<Record<string, { sales: number; revenue: number }>>({})
  const [loadingStats, setLoadingStats] = useState(true)

  // ─── Charger les stats ──────────────────────────────────────────────
  useEffect(() => {
    async function loadAllStats() {
      if (users.length === 0) {
        setLoadingStats(false)
        return
      }

      setLoadingStats(true)
      const stats: Record<string, { sales: number; revenue: number }> = {}
      
      for (const user of users) {
        if (statsCache.has(user.id)) {
          stats[user.id] = statsCache.get(user.id)!
          continue
        }

        try {
          const invoices = await getInvoicesByUser(user.id, 100)
          
          const now = new Date()
          const todayStr = now.toISOString().split('T')[0]
          
          const todayInvoices = invoices.filter(inv => {
            const invDate = new Date(inv.createdAt)
            return invDate.toISOString().split('T')[0] === todayStr
          })
          
          const sales = todayInvoices.length
          const revenue = todayInvoices.reduce((sum, inv) => sum + (inv.total / 100), 0)
          
          const userStat = { sales, revenue }
          statsCache.set(user.id, userStat)
          stats[user.id] = userStat
        } catch (error) {
          console.error(`Erreur chargement stats pour ${user.name}:`, error)
          stats[user.id] = { sales: 0, revenue: 0 }
        }
      }
      
      setUserStats(stats)
      setLoadingStats(false)
    }

    loadAllStats()
  }, [users])

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  // Filtrage
  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesFilter = filter === 'all' || 
      (filter === 'active' && user.active) ||
      (filter === 'inactive' && !user.active)
    
    return matchesSearch && matchesFilter
  })

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

  const formatLastLogin = (date: string | null) => {
    if (!date) return 'Jamais'
    try {
      const now = new Date()
      const last = new Date(date)
      const diff = now.getTime() - last.getTime()
      
      if (diff < 60000) {
        return t('cashiers_page.just_now', 'À l\'instant')
      } else if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000)
        return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`
      } else if (diff < 86400000) {
        return `Aujourd'hui ${last.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      } else if (diff < 172800000) {
        return 'Hier'
      } else {
        const days = Math.floor(diff / 86400000)
        return `Il y a ${days} jour${days > 1 ? 's' : ''}`
      }
    } catch {
      return 'Date invalide'
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
      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un caissier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl h-10"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'active', 'inactive'] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={`rounded-xl h-10 px-4 ${
                filter === f 
                  ? 'bg-sky-500 hover:bg-sky-600 text-white' 
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {f === 'all' && 'Tous'}
              {f === 'active' && 'Actifs'}
              {f === 'inactive' && 'Inactifs'}
            </Button>
          ))}
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
          </div>
          <p className="font-semibold text-gray-700 dark:text-gray-300">
            {searchQuery ? 'Aucun résultat' : 'Aucun caissier'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery 
              ? t('cashiers_page.try_another_search', 'Essayez une autre recherche')
              : t('cashiers_page.create_first_cashier', 'Créez votre premier caissier avec le bouton ci-dessus')}
          </p>
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-zinc-800">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
              <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Caissier</th>
              <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Email</th>
              <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Statut</th>
              <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Dernière connexion</th>
              <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Ventes</th>
              <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">CA</th>
              <th className="text-left text-xs font-medium text-gray-400 py-3 px-4">Permissions</th>
              <th className="text-right text-xs font-medium text-gray-400 py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const isCurrentAdmin = user.id === currentAdminId
              const stats = userStats[user.id] || { sales: 0, revenue: 0 }

              return (
                <tr
                  key={user.id}
                  className={`border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${
                    !user.active ? 'opacity-60' : ''
                  }`}
                >
                  {/* ─── Caissier ──────────────────────────────────────── */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                        <AvatarFallback
                          className="text-xs font-bold text-white"
                          style={{
                            background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)',
                          }}
                        >
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        onClick={() => router.push(`/dashboard/settings/utilisateurs/${user.id}`)}
                        className="font-medium text-sm text-gray-800 dark:text-gray-100 hover:text-sky-500 dark:hover:text-sky-400 transition-colors"
                      >
                        {user.name}
                      </button>
                    </div>
                  </td>

                  {/* ─── Email ────────────────────────────────────────── */}
                  <td className="py-3 px-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {user.email || '—'}
                    </p>
                  </td>

                  {/* ─── Statut ────────────────────────────────────────── */}
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={user.active
                        ? 'border-green-300 text-green-600 dark:border-green-600 dark:text-green-400'
                        : 'border-gray-300 text-gray-400'
                      }
                    >
                      {user.active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </td>

                  {/* ─── Dernière connexion ───────────────────────────── */}
                  <td className="py-3 px-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {formatLastLogin(user.lastLogin || null)}
                    </p>
                  </td>

                  {/* ─── Ventes aujourd'hui ───────────────────────────── */}
                  <td className="py-3 px-4">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {loadingStats ? '...' : stats.sales}
                    </p>
                  </td>

                  {/* ─── CA aujourd'hui ────────────────────────────────── */}
                  <td className="py-3 px-4">
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {loadingStats ? '...' : `${stats.revenue.toFixed(2)} DH`}
                    </p>
                  </td>

                  {/* ─── Permissions ───────────────────────────────────── */}
                  <td className="py-3 px-4">
                    <Badge variant="secondary" className="text-xs">
                      {user.permissions?.length || 0}
                    </Badge>
                  </td>

                  {/* ─── Actions ───────────────────────────────────────── */}
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
                          <DropdownMenuItem 
                            onClick={() => router.push(`/dashboard/settings/utilisateurs/${user.id}`)}
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
                            {user.active 
                              ? <UserX className="w-3.5 h-3.5 mr-2" />
                              : <UserCheck className="w-3.5 h-3.5 mr-2" />
                            }
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

      {/* Pagination */}
      {filteredUsers.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <p>1 – {filteredUsers.length} sur {filteredUsers.length} caissiers</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="rounded-xl" disabled>
              Précédent
            </Button>
            <Button variant="default" size="sm" className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white">
              1
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" disabled>
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de confirmation suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteTarget?.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées à ce caissier
              seront définitivement supprimées.
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
    </div>
  )
}