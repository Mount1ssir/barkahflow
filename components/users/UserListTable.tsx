'use client'

/**
 * components/users/UserListTable.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays the list of all local users for the admin.
 * Shows: avatar, name, role badge, phone, permissions count, active status.
 * Actions: Edit, Activate/Deactivate.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Pencil, UserX, UserCheck, ShieldCheck } from 'lucide-react'
import { deactivateCashier, updateCashier, type AppUserRow } from '@/lib/user-data'
import { toast } from 'sonner'

interface UserListTableProps {
  users: AppUserRow[]
  loading: boolean
  currentAdminId: string
  onEdit: (user: AppUserRow) => void
  onRefresh: () => void
}

export function UserListTable({
  users, loading, currentAdminId, onEdit, onRefresh,
}: UserListTableProps) {
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
    } catch (err: any) {
      toast.error(err?.message || 'Erreur')
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

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <ShieldCheck className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
        </div>
        <p className="font-semibold text-gray-700 dark:text-gray-300">Aucun caissier</p>
        <p className="text-sm text-gray-400 mt-1">
          Créez votre premier caissier avec le bouton ci-dessus.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {users.map((user) => {
        const isCurrentAdmin = user.id === currentAdminId

        return (
          <div
            key={user.id}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all
              ${user.active
                ? 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800'
                : 'bg-gray-50 dark:bg-zinc-900/50 border-gray-100 dark:border-zinc-800 opacity-60'
              }`}
          >
            {/* Avatar */}
            <Avatar className="h-11 w-11 shrink-0">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
              <AvatarFallback
                className="text-sm font-bold text-white"
                style={{
                  background: user.role === 'admin'
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #38BDF8, #0EA5E9)',
                }}
              >
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">
                  {user.name}
                </p>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${
                    user.role === 'admin'
                      ? 'border-amber-300 text-amber-600 dark:text-amber-400'
                      : 'border-sky-300 text-sky-600 dark:text-sky-400'
                  }`}
                >
                  {user.role === 'admin' ? 'Admin' : 'Caissier'}
                </Badge>
                {!user.active && (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-gray-300 text-gray-400">
                    Inactif
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {user.email || user.phone || (
                  user.role === 'cashier'
                    ? `${user.permissions.length} permission${user.permissions.length !== 1 ? 's' : ''}`
                    : 'Accès complet'
                )}
              </p>
            </div>

            {/* Actions — only for cashiers, not the current admin */}
            {!isCurrentAdmin && user.role === 'cashier' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  onClick={() => onEdit(user)}
                  title="Modifier"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 rounded-xl ${
                        user.active
                          ? 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      }`}
                      title={user.active ? 'Désactiver' : 'Réactiver'}
                    >
                      {user.active
                        ? <UserX className="w-3.5 h-3.5" />
                        : <UserCheck className="w-3.5 h-3.5" />
                      }
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {user.active ? 'Désactiver' : 'Réactiver'} {user.name} ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {user.active
                          ? 'Ce caissier ne pourra plus se connecter à l\'application.'
                          : 'Ce caissier pourra à nouveau se connecter à l\'application.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleToggleActive(user)}
                        className={`rounded-xl text-white ${user.active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                      >
                        {user.active ? 'Désactiver' : 'Réactiver'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
