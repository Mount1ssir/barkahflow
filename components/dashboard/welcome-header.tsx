'use client'

import { useTranslation } from 'react-i18next'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WelcomeHeaderProps {
  user: any
}

function getFirstName(user: any): string {
  if (user?.user_metadata?.full_name) {
    return user.user_metadata.full_name.split(' ')[0]
  }
  if (user?.email) {
    return user.email.split('@')[0]
  }
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
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          {t('dashboard.greeting', { name: firstName })}
          <span role="img" aria-label="wave">👋</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('dashboard.subtitle')}
        </p>
      </div>
      <Button variant="outline" className="gap-2 rounded-xl">
        <CalendarIcon size={15} style={{ color: '#e0b86f' }} />
        {t('dashboard.today', { date: today })}
      </Button>
    </div>
  )
}