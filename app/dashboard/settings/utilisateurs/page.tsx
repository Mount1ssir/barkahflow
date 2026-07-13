'use client'

import { Guard } from '@/components/rbac/Guard'
import { PERMISSIONS } from '@/lib/rbac'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Users, Search } from 'lucide-react'
import { getAllUsers, type AppUserRow, getPresenceStatus } from '@/lib/user-data'
import { UserListTable } from '@/components/users/UserListTable'
import { ResetPinDialog } from '@/components/users/ResetPinDialog'
import { useUserContext } from '@/context/UserContext'
import { Input } from '@/components/ui/input'

const BLUE_MAIN = '#0A2A5E'

function UtilisateursSettingsContent() {
  const router = useRouter()
  const { currentUser } = useUserContext()
  const [, forceUpdate] = useState({})

  const [users, setUsers] = useState<AppUserRow[]>([])
  const [filteredUsers, setFilteredUsers] = useState<AppUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [resetPinTarget, setResetPinTarget] = useState<AppUserRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [])

  // Filtrer les utilisateurs par recherche
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase().trim()
    const filtered = users.filter((user) => {
      const nameMatch = user.name.toLowerCase().includes(query)
      const emailMatch = user.email?.toLowerCase().includes(query) || false
      return nameMatch || emailMatch
    })
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const allUsers = await getAllUsers()
      const cashiers = allUsers.filter(u => u.role === 'cashier')
      setUsers(cashiers)
      setFilteredUsers(cashiers)
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error)
    } finally {
      setLoading(false)
    }
  }

  // 🔥 CORRECTION : Rediriger vers la page de détails de l'utilisateur
  const handleViewDetails = (user: AppUserRow) => {
    console.log('🔍 Redirection vers:', `/dashboard/settings/utilisateurs/${user.id}`)
    router.push(`/dashboard/settings/utilisateurs/${user.id}`)
  }

  // 🔥 CORRECTION : Rediriger vers la page d'édition
  const handleEdit = (user: AppUserRow) => {
    router.push(`/dashboard/settings/utilisateurs/editer/${user.id}`)
  }

  const handleCreate = () => {
    router.push('/dashboard/settings/utilisateurs/ajouter')
  }

  const handleResetPin = (user: AppUserRow) => {
    setResetPinTarget(user)
  }

  const totalUsers = filteredUsers.length

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/dashboard/settings')} 
          className="gap-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestion des caissiers
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Gérez les caissiers et suivez leur présence en temps réel
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors duration-150 shadow-sm shadow-blue-600/10 cursor-pointer"
        >
          <Plus size={15} />
          Ajouter un caissier
        </Button>
      </div>

      {/* ─── Total + Barre de recherche ───────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/20">
            <Users className="h-5 w-5" style={{ color: BLUE_MAIN }} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalUsers}</p>
            <p className="text-xs text-gray-400">
              {totalUsers === 1 ? 'caissier' : 'caissiers'}
              {searchQuery && ` (filtré)`}
            </p>
          </div>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-10"
          />
        </div>
      </div>

      {/* ─── Tableau ────────────────────────────────────────────────── */}
      <UserListTable
        users={filteredUsers}
        loading={loading}
        currentAdminId={currentUser?.id || ''}
        onEdit={handleEdit}
        onViewDetails={handleViewDetails} // 🔥 CORRECTION : fonction passée correctement
        onResetPin={handleResetPin}
        onRefresh={loadUsers}
      />

      <ResetPinDialog
        open={!!resetPinTarget}
        onOpenChange={() => setResetPinTarget(null)}
        user={resetPinTarget}
        onRefresh={loadUsers}
      />

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

export default function UtilisateursSettingsPage() {
  return (
    <Guard permission={PERMISSIONS.SETTINGS_USERS} redirectTo="/dashboard/settings">
      <UtilisateursSettingsContent />
    </Guard>
  )
}