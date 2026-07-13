'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useUserContext } from '@/context/UserContext'
import { PERMISSIONS } from '@/lib/rbac'
import { Guard } from '@/components/rbac/Guard'
import { getUserById, type AppUserRow } from '@/lib/user-data'
import { getInvoicesByUser, type Invoice } from '@/lib/invoice-data'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Mail, Clock, Calendar, Activity, FileText, ShoppingBag, Wallet, Tag, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Couleurs ──────────────────────────────────────────────────────
const BLUE = '#3B82F6'
const BLUE_DARK = '#1D4ED8'
const ONLINE_GREEN = '#31A24C'

function UserDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<AppUserRow | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Chargement ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      if (!userId) return
      setLoading(true)
      try {
        const userData = await getUserById(userId)
        if (!userData) {
          router.push('/dashboard/settings/utilisateurs')
          return
        }
        setUser(userData)

        const userInvoices = await getInvoicesByUser(userId, 10)
        setInvoices(userInvoices)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [userId, router])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (!user) return null

  const isAdmin = user.role === 'admin'
  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  // Calcul des stats
  const now = new Date()
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const todayStr = formatLocalDate(now)
  const todayInvoices = invoices.filter(i => {
    const invDate = new Date(i.createdAt)
    return formatLocalDate(invDate) === todayStr
  })

  const formatAmount = (amount: number) => {
    const value = amount / 100
    return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH'
  }

  const salesStats = {
    today: {
      sales: todayInvoices.length,
      amount: todayInvoices.reduce((sum, i) => sum + i.total, 0),
      discounts: todayInvoices.reduce((sum, i) => sum + i.discount, 0),
      debts: todayInvoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIAL').length,
    },
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Jamais'
    try {
      const d = new Date(date)
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch { return 'Date invalide' }
  }

  // ─── Format "Dernière connexion : il y a X ..." comme WhatsApp ───
  const formatLastSeen = (date: string | null): string => {
    if (!date) return 'Jamais connecté'
    
    try {
      const d = new Date(date)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffSec = Math.floor(diffMs / 1000)
      const diffMin = Math.floor(diffSec / 60)
      const diffHours = Math.floor(diffMin / 60)
      const diffDays = Math.floor(diffHours / 24)

      // Moins d'1 minute
      if (diffSec < 60) {
        return 'Dernière connexion : à l\'instant'
      }
      
      // Moins d'1 heure
      if (diffMin < 60) {
        return `Dernière connexion : il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`
      }
      
      // Moins de 24 heures
      if (diffHours < 24) {
        return `Dernière connexion : il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`
      }
      
      // Moins de 48 heures (hier)
      if (diffDays === 1) {
        const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        return `Dernière connexion : hier à ${time}`
      }
      
      // Plus de 2 jours
      return `Dernière connexion : ${d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`
      
    } catch {
      return 'Date invalide'
    }
  }

  // Vérifier si l'utilisateur est en ligne (moins de 5 minutes)
  const isOnline = (): boolean => {
    if (!user.lastActivity) return false
    try {
      const lastActivity = new Date(user.lastActivity).getTime()
      const now = Date.now()
      const diffSeconds = (now - lastActivity) / 1000
      return diffSeconds < 300 // 5 minutes
    } catch {
      return false
    }
  }

  const online = isOnline()

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/settings/utilisateurs')}
          className="gap-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Détails du caissier
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Gérez les informations et les performances du caissier
          </p>
        </div>
        <Button
          onClick={() => router.push(`/dashboard/settings/utilisateurs/editer/${user.id}`)}
          className="rounded-xl gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Pencil className="h-4 w-4" />
          Modifier
        </Button>
      </div>

      {/* ─── Profil ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 mb-6">
        <div className="flex items-start gap-6">
          <Avatar className="h-20 w-20">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
            <AvatarFallback
              className="text-2xl font-bold text-white"
              style={{
                background: isAdmin
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>

            {/* ─── Statut comme WhatsApp ─────────────────────────────── */}
            <p className="text-xs mt-0.5">
              {online ? (
                <span className="font-medium" style={{ color: ONLINE_GREEN }}>
                  En ligne
                </span>
              ) : (
                <span className="text-gray-400">
                  {formatLastSeen(user.lastActivity)}
                </span>
              )}
            </p>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isAdmin && (
                <Badge className="border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
                  Administrateur
                </Badge>
              )}
              {!user.active && (
                <Badge className="border-gray-300 text-gray-400">
                  Inactif
                </Badge>
              )}
            </div>
            {user.email && (
              <p className="text-sm text-gray-400 mt-1.5 flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                {user.email}
              </p>
            )}
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-4 gap-3 mt-6">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{salesStats.today.sales}</p>
            <p className="text-xs text-gray-500">Ventes</p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{formatAmount(salesStats.today.amount)}</p>
            <p className="text-xs text-gray-500">Chiffre d'affaires</p>
          </div>
          <div className="rounded-xl bg-orange-50 dark:bg-orange-950/20 p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{salesStats.today.discounts}</p>
            <p className="text-xs text-gray-500">Remises</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-950/20 p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{salesStats.today.debts}</p>
            <p className="text-xs text-gray-500">Dettes</p>
          </div>
        </div>
      </div>

      {/* ─── Informations ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Date de création</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{formatDate(user.createdAt)}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Dernière connexion</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
            {online ? 'En ligne' : formatDate(user.lastLogin)}
          </p>
        </div>
      </div>

      {/* ─── Dernières factures ────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100 dark:border-zinc-800">
          <FileText className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Dernières factures</h3>
          <span className="text-xs text-gray-400 ml-auto">{invoices.length}</span>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucune facture</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">#{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(inv.createdAt)} · {inv.clientName || 'Client de passage'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatAmount(inv.total)}</p>
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: inv.status === 'PAID' ? '#16A34A' : inv.status === 'PARTIAL' ? '#F59E0B' : '#DC2626',
                    }}
                  >
                    {inv.status === 'PAID' ? 'Payée' : inv.status === 'PARTIAL' ? 'Partielle' : 'Impayée'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function UserDetailsPageWrapper() {
  return (
    <Guard permission={PERMISSIONS.SETTINGS_USERS} redirectTo="/dashboard/settings">
      <UserDetailsPage />
    </Guard>
  )
}