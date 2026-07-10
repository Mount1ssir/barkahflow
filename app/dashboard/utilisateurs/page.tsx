'use client'

/**
 * app/dashboard/utilisateurs/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * User Management page — accessible to Admin only.
 * Lists all local users, lets Admin create/edit cashiers.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Users } from 'lucide-react'
import { getAllUsers, type AppUserRow } from '@/lib/user-data'
import { UserListTable } from '@/components/users/UserListTable'
import { UserFormDialog } from '@/components/users/UserFormDialog'
import { Guard } from '@/components/rbac/Guard'
import { useUserContext } from '@/context/UserContext'

export default function UtilisateursPage() {
  const router = useRouter()
  const { currentUser } = useUserContext()

  const [users, setUsers] = useState<AppUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AppUserRow | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } catch {
      // silently fail — table may not exist yet
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: AppUserRow) => {
    setEditTarget(user)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

  return (
    <Guard role="admin" redirectTo="/dashboard">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => router.back()} className="gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-sky-400" />
              Gestion des utilisateurs
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Créez et gérez les profils caissiers de votre boutique.
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="rounded-xl text-white gap-2 shrink-0"
            style={{ backgroundColor: '#38BDF8' }}
          >
            <Plus className="h-4 w-4" />
            Nouveau caissier
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total', value: users.length },
            { label: 'Actifs', value: users.filter((u) => u.active).length },
            { label: 'Caissiers', value: users.filter((u) => u.role === 'cashier').length },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 text-center"
            >
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        <UserListTable
          users={users}
          loading={loading}
          currentAdminId={currentUser?.id || ''}
          onEdit={handleEdit}
          onRefresh={loadUsers}
        />

        {/* Form dialog */}
        <UserFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          editUser={editTarget}
          onSaved={loadUsers}
        />
      </div>
    </Guard>
  )
}
