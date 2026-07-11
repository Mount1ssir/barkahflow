'use client'

/**
 * components/users/UserDetailsDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * User detail page with tabs: Informations, Permissions, Ventes, Activité
 */

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Pencil,
  Mail,
  Key,
  Shield,
  Clock,
  Calendar,
  Activity,
  FileText,
  ShoppingBag,
  Users,
  Settings,
  LayoutDashboard,
  Package,
  Receipt,
  Wallet,
} from 'lucide-react'
import { PERMISSION_MODULES, type Permission } from '@/lib/rbac'
import { type AppUserRow } from '@/lib/user-data'

interface UserDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AppUserRow | null
  onEdit: () => void
  onRefresh: () => void
}

const permissionIcons: Record<string, any> = {
  dashboard: LayoutDashboard,
  pos: ShoppingBag,
  products: Package,
  clients: Users,
  invoices: Receipt,
  finance: Wallet,
  settings: Settings,
}

const permissionColors: Record<string, string> = {
  dashboard: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20',
  pos: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
  products: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20',
  clients: 'text-pink-500 bg-pink-50 dark:bg-pink-950/20',
  invoices: 'text-orange-500 bg-orange-50 dark:bg-orange-950/20',
  finance: 'text-teal-500 bg-teal-50 dark:bg-teal-950/20',
  settings: 'text-gray-500 bg-gray-50 dark:bg-gray-950/20',
}

export function UserDetailsDialog({
  open,
  onOpenChange,
  user,
  onEdit,
  onRefresh,
}: UserDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState('informations')

  if (!user) return null

  const isAdmin = user.role === 'admin'
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

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
    } catch {
      return 'Date invalide'
    }
  }

  // Fonction pour obtenir le libellé d'une permission
  const getPermissionLabel = (permissionKey: Permission): string => {
    for (const mod of PERMISSION_MODULES) {
      // Vérifier si c'est la permission d'accès du module
      if (mod.access === permissionKey) {
        return 'Accéder'
      }
      // Vérifier parmi les actions
      const action = mod.actions.find((a) => a.key === permissionKey)
      if (action) {
        return action.labelFr
      }
    }
    return permissionKey // fallback
  }

  const groupedPermissions = () => {
    const grouped: Record<string, { module: string; permissions: Permission[] }> = {}
    
    PERMISSION_MODULES.forEach((mod) => {
      const userPerms = user.permissions.filter((p) => 
        mod.actions.some((a) => a.key === p) || p === mod.access
      )
      if (userPerms.length > 0) {
        grouped[mod.key] = {
          module: mod.labelFr,
          permissions: userPerms,
        }
      }
    })
    
    return grouped
  }

  const grouped = groupedPermissions()

  const ventesStats = {
    today: {
      count: 18,
      amount: 5420,
      debts: 3,
      discounts: 2,
    },
  }

  const activities = [
    { type: 'connexion', date: '2026-07-11T09:30:00', description: 'Connexion' },
    { type: 'deconnexion', date: '2026-07-10T18:42:00', description: 'Déconnexion' },
    { type: 'client', date: '2026-07-10T15:20:00', description: 'Suppression d\'un client' },
    { type: 'facture', date: '2026-07-10T14:10:00', description: 'Annulation d\'une facture' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">Détails de l'utilisateur</DialogTitle>
              <DialogDescription>
                Gérez les informations et permissions de {user.name}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="rounded-xl gap-2"
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
              <AvatarFallback
                className="text-lg font-bold text-white"
                style={{
                  background: isAdmin
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #38BDF8, #0EA5E9)',
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {user.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge
                  variant="outline"
                  className={isAdmin 
                    ? 'border-amber-300 text-amber-600'
                    : 'border-sky-300 text-sky-600'
                  }
                >
                  {isAdmin ? 'Administrateur' : 'Caissier'}
                </Badge>
                <Badge
                  variant="outline"
                  className={user.active
                    ? 'border-green-300 text-green-600'
                    : 'border-gray-300 text-gray-400'
                  }
                >
                  {user.active ? '🟢 Actif' : '⚪ Inactif'}
                </Badge>
                <span className="text-xs text-gray-400">
                  Dernière connexion: {formatDate(user.lastLogin || null)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="w-full justify-start rounded-none border-b border-gray-100 dark:border-gray-800 bg-transparent px-6 h-auto">
            <TabsTrigger value="informations" className="rounded-t-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">
              Informations
            </TabsTrigger>
            <TabsTrigger value="permissions" className="rounded-t-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">
              Permissions
            </TabsTrigger>
            <TabsTrigger value="ventes" className="rounded-t-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">
              Ventes
            </TabsTrigger>
            <TabsTrigger value="activite" className="rounded-t-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">
              Activité
            </TabsTrigger>
          </TabsList>

          <TabsContent value="informations" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Nom complet</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-medium">{user.name}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-medium">{user.email || 'Non défini'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    PIN
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-medium font-mono">••••••</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Statut
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={user.active ? 'bg-green-500' : 'bg-gray-400'}>
                    {user.active ? 'Actif' : 'Inactif'}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Date de création
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-medium">{formatDate(user.createdAt)}</p>
                </CardContent>
              </Card>
              {user.lastLogin && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Dernière connexion
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base font-medium">{formatDate(user.lastLogin)}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="p-6">
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {isAdmin 
                  ? "L'administrateur a un accès complet à toutes les fonctionnalités."
                  : `${user.permissions.length} permission${user.permissions.length !== 1 ? 's' : ''} accordée${user.permissions.length !== 1 ? 's' : ''}`
                }
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(grouped).map(([key, { module, permissions }]) => {
                  const Icon = permissionIcons[key] || Shield
                  const color = permissionColors[key] || 'text-gray-500 bg-gray-50'
                  return (
                    <Card key={key} className="overflow-hidden">
                      <CardHeader className="pb-2 bg-gray-50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <CardTitle className="text-sm font-medium">{module}</CardTitle>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {permissions.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="flex flex-wrap gap-1.5">
                          {permissions.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {getPermissionLabel(p)}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                {isAdmin && (
                  <Card className="col-span-2">
                    <CardContent className="pt-6 text-center text-gray-500">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                      <p className="text-sm font-medium">Accès complet</p>
                      <p className="text-xs">Toutes les fonctionnalités sont disponibles</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ventes" className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-blue-500">{ventesStats.today.count}</p>
                    <p className="text-xs text-gray-500">Ventes aujourd'hui</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-emerald-500">
                      {ventesStats.today.amount.toLocaleString()} DH
                    </p>
                    <p className="text-xs text-gray-500">Montant total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-amber-500">{ventesStats.today.debts}</p>
                    <p className="text-xs text-gray-500">Dettes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-purple-500">{ventesStats.today.discounts}</p>
                    <p className="text-xs text-gray-500">Remises</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    Dernières factures
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50">
                        <div>
                          <p className="text-sm font-medium">Facture #INV-2026-{String(i).padStart(3, '0')}</p>
                          <p className="text-xs text-gray-400">Client: Client {i}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{Math.floor(Math.random() * 1000)} DH</p>
                          <Badge variant="outline" className="text-xs">
                            {['PAID', 'PARTIAL', 'UNPAID'][i % 3]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activite" className="p-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-400" />
                  Historique des activités
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 space-y-4">
                  {activities.map((activity, index) => {
                    const icons: Record<string, string> = {
                      connexion: '🔵',
                      deconnexion: '🔴',
                      client: '👤',
                      facture: '📄',
                    }
                    return (
                      <div key={index} className="relative">
                        <div className="absolute -left-[25px] text-lg">
                          {icons[activity.type] || '📌'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{activity.description}</p>
                          <p className="text-xs text-gray-400">{formatDate(activity.date)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}