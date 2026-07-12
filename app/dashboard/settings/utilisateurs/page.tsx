'use client'

import { Guard } from '@/components/rbac/Guard'
import { PERMISSIONS } from '@/lib/rbac'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Users, UserCheck, UserX, Activity } from 'lucide-react'
import { getAllUsers, type AppUserRow } from '@/lib/user-data'
import { UserListTable } from '@/components/users/UserListTable'
import { ResetPinDialog } from '@/components/users/ResetPinDialog'
import { useUserContext } from '@/context/UserContext'
import { useTranslation } from 'react-i18next'

// ─── Couleurs ──────────────────────────────────────────────────────
const BLUE_MAIN = '#0A2A5E'
const BLUE = '#3B82F6'
const BLUE_DARK = '#1D4ED8'
const BLUE_SOFT = '#93C5FD'

// ─── KPI Card ──────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  bgColor: string
  progress: number
  delay: number
  isLoaded: boolean
}

function KpiCard({ label, value, icon, color, bgColor, progress, delay, isLoaded }: KpiCardProps) {
  const pct = Math.min(100, Math.max(0, progress))
  return (
    <div
      className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 relative overflow-hidden transition-all duration-700 ease-out"
      style={{
        transform: isLoaded ? 'translateY(0)' : 'translateY(-40px)',
        opacity: isLoaded ? 1 : 0,
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-800 dark:text-white">{value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${bgColor}`}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div className="mt-3 h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: isLoaded ? `${pct}%` : '0%',
            backgroundColor: color,
            transitionDelay: `${delay + 200}ms`,
          }}
        />
      </div>
    </div>
  )
}

function UtilisateursSettingsContent() {
  const router = useRouter()
  const { t } = useTranslation()
  const { currentUser } = useUserContext()

  const [users, setUsers] = useState<AppUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [resetPinTarget, setResetPinTarget] = useState<AppUserRow | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    loadUsers()
    const timer = setTimeout(() => setIsLoaded(true), 150)
    return () => clearTimeout(timer)
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const allUsers = await getAllUsers()
      // ✅ Filtrer : ne garder que les caissiers (role !== 'admin')
      const cashiers = allUsers.filter(u => u.role === 'cashier')
      setUsers(cashiers)
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: AppUserRow) => {
    router.push(`/dashboard/settings/utilisateurs/editer/${user.id}`)
  }

  const handleCreate = () => {
    router.push('/dashboard/settings/utilisateurs/ajouter')
  }

  const handleResetPin = (user: AppUserRow) => {
    setResetPinTarget(user)
  }

  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.active).length
  const inactiveUsers = users.filter((u) => !u.active).length
  const connectedUsers = 0

  const kpiData = [
    {
      label: t('settings.users.total_cashiers', 'Total caissiers'),
      value: totalUsers,
      icon: <Users className="h-5 w-5" />,
      color: BLUE_MAIN,
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      progress: 100,
    },
    {
      label: t('settings.users.active', 'Actifs'),
      value: activeUsers,
      icon: <UserCheck className="h-5 w-5" />,
      color: '#059669',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
      progress: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
    },
    {
      label: t('settings.users.inactive', 'Inactifs'),
      value: inactiveUsers,
      icon: <UserX className="h-5 w-5" />,
      color: '#6B7280',
      bgColor: 'bg-gray-50 dark:bg-gray-800/20',
      progress: totalUsers > 0 ? (inactiveUsers / totalUsers) * 100 : 0,
    },
    {
      label: t('settings.users.connected', 'Connectés actuellement'),
      value: connectedUsers,
      icon: <Activity className="h-5 w-5" />,
      color: '#0D9488',
      bgColor: 'bg-teal-50 dark:bg-teal-950/20',
      progress: totalUsers > 0 ? (connectedUsers / totalUsers) * 100 : 0,
    },
  ]

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/dashboard/settings')} 
          className="gap-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/20"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Retour')}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('settings.users.title', 'Gestion des caissiers')}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {t('settings.users.subtitle', 'Gérez les caissiers et leurs accès')}
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors duration-150 shadow-sm shadow-blue-600/10 cursor-pointer"
        >
          <Plus size={15} />
          {t('settings.users.add_cashier', 'Ajouter un caissier')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpiData.map((kpi, index) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            bgColor={kpi.bgColor}
            progress={kpi.progress}
            delay={index * 100}
            isLoaded={isLoaded}
          />
        ))}
      </div>

      {/* User list */}
      <UserListTable
        users={users}
        loading={loading}
        currentAdminId={currentUser?.id || ''}
        onEdit={handleEdit}
        onViewDetails={() => {}}
        onResetPin={handleResetPin}
        onRefresh={loadUsers}
      />

      {/* Dialog de réinitialisation du PIN */}
      <ResetPinDialog
        open={!!resetPinTarget}
        onOpenChange={() => setResetPinTarget(null)}
        user={resetPinTarget}
        onRefresh={loadUsers}
      />
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