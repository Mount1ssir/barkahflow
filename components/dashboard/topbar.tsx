'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n/config'
import {
  Menu,
  Search,
  Globe,
  Moon,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'
import { useSidebarStore } from '@/lib/sidebar-store'
import { supabase } from '@/src/lib/supabase'

const GOLD = '#e0b86f'

const langs = [
  { code: 'fr', label: 'Français', flag: 'https://flagcdn.com/w20/fr.png' },
  { code: 'en', label: 'English', flag: 'https://flagcdn.com/w20/gb.png' },
  { code: 'ar', label: 'العربية', flag: 'https://flagcdn.com/w20/ma.png' },
]

interface TopBarProps {
  user: any
  notificationCount?: number
}

export function TopBar({ user, notificationCount = 0 }: TopBarProps) {
  const toggle = useSidebarStore((s) => s.toggle)
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const [notifEnabled, setNotifEnabled] = useState(true)

  const isDark = theme === 'dark'
  const currentLang = i18n.language?.slice(0, 2) || 'fr'

  const handleChangeLang = (code: string) => {
    i18n.changeLanguage(code)
    // ✅ Sauvegarde dans localStorage pour la page login
    localStorage.setItem('barkahflow-language', code)
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = code
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const initials = user?.user_metadata?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'

  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-4 gap-4 sticky top-0 z-30">

      {/* Gauche — Toggle sidebar + Recherche */}
      <div className="flex items-center gap-3 flex-1">
        <Button variant="ghost" size="icon" onClick={toggle} className="shrink-0">
          <Menu size={18} />
        </Button>

        <div className="relative max-w-md w-full hidden sm:block mx-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('dashboard.nav.dashboard') + '...'}
            className="pl-9 h-9 bg-muted/40 border-none rounded-xl"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-background border rounded px-1.5 py-0.5">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Droite — Cloche + Avatar */}
      <div className="flex items-center gap-2">

        {/* Cloche notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={18} />
              {notificationCount > 0 && (
                <Badge
                  className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[9px] border-2 border-background"
                  style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}
                >
                  {notificationCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 rounded-xl bg-background z-[999]">
            <div className="px-3 py-2 font-semibold text-sm border-b">
              {t('dashboard.alerts.title')}
            </div>
            {notificationCount === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t('dashboard.alerts.none')}
              </div>
            ) : (
              <DropdownMenuItem className="gap-2 py-2.5">
                <Bell size={14} style={{ color: GOLD }} />
                <span className="text-xs">{notificationCount} nouvelle(s) alerte(s)</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Avatar + dropdown complet */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-1.5 pl-1.5 pr-2 h-9 rounded-full">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                style={{ backgroundColor: '#8b5cf6' }}
              >
                {initials}
              </div>
              <ChevronDown size={14} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60 rounded-xl bg-background z-[999]">

            {/* Langue — sous-menu avec drapeaux */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2.5 py-2">
                <Globe size={16} style={{ color: GOLD }} />
                <span>{t('dashboard.menu.language')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="rounded-xl bg-background z-[999]">
                  {langs.map((l) => (
                    <DropdownMenuItem
                      key={l.code}
                      onClick={() => handleChangeLang(l.code)}
                      className="gap-2.5 py-2 cursor-pointer"
                    >
                      <img
                        src={l.flag}
                        alt={l.code}
                        className="w-5 h-3.5 object-cover rounded-sm shrink-0"
                      />
                      <span>{l.label}</span>
                      {currentLang === l.code && (
                        <CheckCircle2 size={14} className="ml-auto" style={{ color: GOLD }} />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {/* Mode sombre */}
            <div
              className="relative flex cursor-default select-none items-center justify-between
                         rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent
                         hover:text-accent-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5">
                <Moon size={16} style={{ color: GOLD }} />
                <span>{t('dashboard.menu.dark_mode')}</span>
              </div>
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>

            {/* Notifications toggle */}
            <div
              className="relative flex cursor-default select-none items-center justify-between
                         rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent
                         hover:text-accent-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5">
                <Bell size={16} style={{ color: GOLD }} />
                <span>{t('dashboard.menu.notifications')}</span>
              </div>
              <Switch
                checked={notifEnabled}
                onCheckedChange={setNotifEnabled}
              />
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => (window.location.href = '/dashboard/settings')}
              className="gap-2.5 py-2 cursor-pointer"
            >
              <Settings size={16} style={{ color: GOLD }} />
              {t('dashboard.menu.settings')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={async (e) => {
                e.preventDefault()
                await handleLogout()
              }}
              className="gap-2.5 py-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut size={16} />
              {t('dashboard.menu.logout')}
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}