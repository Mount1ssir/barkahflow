'use client'

import { useTranslation } from 'react-i18next'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WelcomeHeaderProps {
  user: any
}

function getFirstName(user: any): string {
  if (user?.user_metadata?.full_name) return user.user_metadata.full_name.split(' ')[0]
  if (user?.email) return user.email.split('@')[0]
  return 'Commerçant'
}

export function WelcomeHeader({ user }: WelcomeHeaderProps) {
  const { t, i18n } = useTranslation()
  const firstName = getFirstName(user)

  const today = new Date().toLocaleDateString(
    i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'en' ? 'en-US' : 'fr-FR',
    { day: 'numeric', month: 'long', year: 'numeric' }
  )

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('dashboard.greeting', { name: firstName })} !
        </h1>
        <p className="text-sm text-gray-400 dark:text-zinc-400 mt-1">
          {t('dashboard.subtitle')}
        </p>
      </div>
      <Button
        variant="outline"
        className="gap-2 rounded-xl border-[#EAECEF] text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
      >
        <CalendarIcon size={15} style={{ color: '#3B82F6' }} />
        {t('dashboard.today', { date: today })}
      </Button>
    </div>
  )
}