'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import i18n, { initI18n } from '@/lib/i18n/config'
import {
  Menu, Search, Moon, Sun, Bell, Settings, LogOut, ChevronDown,
  User, Store, HelpCircle,
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useSidebarStore } from '@/lib/sidebar-store'
import { supabase } from '@/src/lib/supabase'
import { getStockAlerts, countStockAlerts, type StockAlert } from '@/lib/stock-alerts-data'

const langs = [
  { code: 'fr', label: 'français (French)', flag: 'https://flagcdn.com/w40/fr.png' },
  { code: 'en', label: 'English (UK)',       flag: 'https://flagcdn.com/w40/gb.png' },
  { code: 'ar', label: 'عربي (Arabic)',      flag: 'https://flagcdn.com/w40/ma.png' },
]

function LanguageDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentCode = i18n.language?.slice(0, 2) || 'fr'
  const current = langs.find(l => l.code === currentCode) ?? langs[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectLang = (code: string) => {
    initI18n(code)
    localStorage.setItem('barkahflow-language', code)
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <img src={current.flag} alt={current.label}
             className="w-6 h-6 rounded-full object-cover shadow-sm" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-zinc-900 border border-[#EAECEF] dark:border-zinc-700 shadow-xl overflow-hidden z-[999]">
          {langs.map((lang) => (
            <button
              key={lang.code}
              onClick={() => selectLang(lang.code)}
              className="w-full flex items-center justify-between px-4 py-3 text-[13px] hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              style={{
                color: lang.code === currentCode ? '#2563EB' : '#374151',
                fontWeight: lang.code === currentCode ? 600 : 400,
              }}
            >
              <span>{lang.label}</span>
              <img src={lang.flag} alt={lang.label}
                   className="w-7 h-7 rounded-full object-cover shadow-sm" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface TopBarProps {
  user: any
}

export function TopBar({ user }: TopBarProps) {
  const router = useRouter()
  const toggle = useSidebarStore((s) => s.toggle)
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)

  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [alertCount, setAlertCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadAlerts = async () => {
    try {
      const [count, data] = await Promise.all([
        countStockAlerts(),
        getStockAlerts(10),
      ])
      setAlertCount(count)
      setAlerts(data)
    } catch (error) {
      console.error('Erreur chargement alertes:', error)
    }
  }

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  const isDark = theme === 'dark'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const avatarUrl = user?.user_metadata?.avatar_url
  const fullName = user?.user_metadata?.full_name || ''
  const email = user?.email || ''
  const displayName = fullName || email.split('@')[0] || 'Commerçant'
  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase() || 'A'

  const goToReplenish = (productId: string) => {
    setNotifOpen(false)
    router.push(`/dashboard/produits?replenish=${productId}`)
  }

  const goToAllAlerts = () => {
    setNotifOpen(false)
    router.push('/dashboard/produits?filter=stock_bas')
  }

  return (
    <header className="h-16 flex items-center justify-between px-5 gap-4 sticky top-0 z-30 bg-white dark:bg-zinc-900 border-b border-[#EAECEF] dark:border-zinc-800">

      <button
        onClick={toggle}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 transition-colors shrink-0"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1 max-w-xl mx-auto">
        <div className="flex items-center gap-2.5 bg-[#F8F9FB] dark:bg-zinc-800 border border-[#EAECEF] dark:border-zinc-700 rounded-xl px-4 py-2.5">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder={t('dashboard.header.search', 'Rechercher dans le tableau de bord...')}
            className="bg-transparent text-[13px] text-gray-600 dark:text-zinc-300 placeholder:text-gray-400 outline-none w-full"
          />
          <kbd className="text-[10px] text-gray-300 dark:text-zinc-500 font-mono shrink-0 border border-gray-200 dark:border-zinc-600 rounded px-1.5 py-0.5">
            Ctrl K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">

        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <button
              className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 transition-colors"
              onClick={() => setNotifOpen(!notifOpen)}
            >
              <Bell size={18} />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse border-2 border-white dark:border-zinc-900">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent className="w-80 p-0 rounded-2xl shadow-xl border border-[#EAECEF] dark:border-zinc-700" align="end">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EAECEF] dark:border-zinc-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('notifications.title', 'Alertes stock')}
              </h4>
              {alertCount > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {alertCount} {t('notifications.products', 'produit(s)')}
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                      <span className="text-2xl">✅</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('notifications.all_good', 'Tout est en stock')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {t('notifications.no_alerts', 'Aucun produit en dessous du seuil')}
                    </p>
                  </div>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.productId}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer border-b border-[#EAECEF] dark:border-zinc-700 last:border-0 transition-colors"
                    onClick={() => goToReplenish(alert.productId)}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {alert.nameAr}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('notifications.stock_left', 'Stock restant')} : <strong className="text-gray-700 dark:text-gray-300">{alert.stockQty}</strong>
                        {t('notifications.threshold', ' (seuil: ')}{alert.alertThreshold})
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        alert.severity === 'critical'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}
                    >
                      {alert.severity === 'critical'
                        ? t('notifications.critical', 'Critique')
                        : t('notifications.low', 'Bas')}
                    </span>
                  </div>
                ))
              )}
            </div>

            {alerts.length > 0 && (
              <div className="p-2 border-t border-[#EAECEF] dark:border-zinc-700">
                <button
                  className="w-full text-center text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  onClick={goToAllAlerts}
                >
                  {t('notifications.view_all', 'Voir toutes les alertes →')}
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <LanguageDropdown />

        {mounted && (
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 transition-colors"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}

        <div className="w-px h-5 bg-gray-200 dark:bg-zinc-700 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} referrerPolicy="no-referrer" />
                <AvatarFallback className="text-[11px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-[12px] font-semibold text-gray-800 dark:text-white leading-none">
                  {displayName}
                </span>
              </div>
              <ChevronDown size={13} className="text-gray-400" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 rounded-2xl border border-[#EAECEF] dark:border-zinc-700 shadow-xl bg-white dark:bg-zinc-900 z-[999] p-1">

            <div className="flex items-center gap-3 px-3 py-3 mb-1">
              <Avatar className="h-10 w-10">
                <AvatarImage src={avatarUrl} referrerPolicy="no-referrer" />
                <AvatarFallback className="text-sm font-bold text-white"
                                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                  {displayName}
                </span>
                <span className="text-[11px] text-gray-400 truncate">{email}</span>
              </div>
            </div>

            <DropdownMenuSeparator className="bg-[#EAECEF] dark:bg-zinc-700" />

            <DropdownMenuItem
              onClick={() => router.push('/dashboard/profil')}
              className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer text-[13px] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 focus:bg-gray-50"
            >
              <User size={15} className="text-gray-400" />
              {t('dashboard.menu.profile', 'Mon profil')}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push('/dashboard/boutique')}
              className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer text-[13px] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 focus:bg-gray-50"
            >
              <Store size={15} className="text-gray-400" />
              {t('dashboard.menu.shop', 'Ma boutique')}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#EAECEF] dark:bg-zinc-700" />

            <DropdownMenuItem
              onClick={() => router.push('/dashboard/settings')}
              className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer text-[13px] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 focus:bg-gray-50"
            >
              <Settings size={15} className="text-gray-400" />
              {t('dashboard.menu.settings', 'Paramètres')}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push('/dashboard/support')}
              className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer text-[13px] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 focus:bg-gray-50"
            >
              <HelpCircle size={15} className="text-gray-400" />
              {t('dashboard.menu.support', 'Support / Aide')}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#EAECEF] dark:bg-zinc-700" />

            <DropdownMenuItem
              onSelect={async (e) => { e.preventDefault(); await handleLogout() }}
              className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 focus:text-red-500"
            >
              <LogOut size={15} />
              {t('dashboard.menu.logout', 'Déconnexion')}
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}