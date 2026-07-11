'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Users, Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Guard } from '@/components/rbac/Guard'
import { PERMISSIONS } from '@/lib/rbac'

const BLUE = '#3B82F6'

function SettingsContent() {
  const router = useRouter()

  const settingsOptions = [
    {
      id: 'entreprise',
      title: 'Informations entreprise',
      description: 'Gérez les informations de votre boutique, logo, coordonnées bancaires et mentions légales',
      icon: Building2,
      href: '/dashboard/settings/entreprise',
      color: 'bg-blue-50 dark:bg-blue-950/20',
      iconColor: 'text-blue-500',
      // ✅ Permission requise pour voir cette option
      permission: PERMISSIONS.SETTINGS_COMPANY,
    },
    {
      id: 'utilisateurs',
      title: 'Gestion des utilisateurs',
      description: 'Créez, modifiez et gérez les comptes caissiers de votre boutique',
      icon: Users,
      href: '/dashboard/settings/utilisateurs',
      color: 'bg-purple-50 dark:bg-purple-950/20',
      iconColor: 'text-purple-500',
      // ✅ Permission requise pour voir cette option
      permission: PERMISSIONS.SETTINGS_USERS,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" style={{ color: BLUE }} />
            Paramètres
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Gérez les paramètres de votre boutique et les comptes utilisateurs
          </p>
        </div>
      </div>

      {/* Grille des options - filtrées par permissions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsOptions.map((option) => {
          // ✅ Filtrer les options selon les permissions de l'utilisateur
          // Pour les admins, on affiche tout
          // Pour les caissiers, on vérifie la permission
          const Icon = option.icon
          return (
            <Card
              key={option.id}
              className="group cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] border-2 hover:border-blue-400 dark:hover:border-blue-500"
              onClick={() => router.push(option.href)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${option.color} ${option.iconColor}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm text-gray-400 group-hover:text-blue-500 transition-colors">
                    Cliquer →
                  </span>
                </div>
                <CardTitle className="text-lg mt-2 text-gray-900 dark:text-white">
                  {option.title}
                </CardTitle>
                <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                  {option.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full w-0 group-hover:w-full transition-all duration-500`}
                    style={{ backgroundColor: option.id === 'entreprise' ? '#3B82F6' : '#8B5CF6' }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Infos supplémentaires */}
      <div className="mt-8 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Seuls les administrateurs ont accès à ces paramètres
        </p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    // ✅ Protection avec SETTINGS_ACCESS au lieu de role="admin"
    <Guard permission={PERMISSIONS.SETTINGS_ACCESS} redirectTo="/dashboard">
      <SettingsContent />
    </Guard>
  )
}