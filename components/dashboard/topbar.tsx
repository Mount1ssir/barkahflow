'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import i18n, { initI18n } from '@/lib/i18n/config'
import {
  Menu, Search, Moon, Sun, Settings, LogOut, ChevronDown,
  User, Store, HelpCircle, LayoutDashboard, ShoppingCart, Package,
  FileText, Users, Wallet, BarChart3, ArrowLeftRight,
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useSidebarStore } from '@/lib/sidebar-store'
import { supabase } from '@/src/lib/supabase'
import { VoiceAssistantButton } from '@/components/voice/VoiceAssistantButton'
import { Notifications } from '@/components/dashboard/notifications'
import { useUserContext } from '@/context/UserContext'
import { UserSwitchScreen } from '@/components/pin/UserSwitchScreen'
import type { AppUser } from '@/context/UserContext'

const langs = [
  { code: 'fr', label: 'français (French)', flag: 'https://flagcdn.com/w40/fr.png' },
  { code: 'en', label: 'English (UK)',       flag: 'https://flagcdn.com/w40/gb.png' },
  { code: 'ar', label: 'عربي (Arabic)',      flag: 'https://flagcdn.com/w40/ma.png' },
]

interface AppSection {
  label: string
  path: string
  keywords: string[]
  icon: React.ReactNode
}

const APP_SECTIONS: AppSection[] = [
  { label: 'Tableau de bord', path: '/dashboard', keywords: ['dashboard', 'accueil', 'tableau de bord'], icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Caisse (ventes)', path: '/dashboard/caisse', keywords: ['caisse', 'pos', 'ventes', 'checkout'], icon: <ShoppingCart className="h-4 w-4" /> },
  { label: 'Produits', path: '/dashboard/produits', keywords: ['produits', 'stock', 'articles', 'inventaire'], icon: <Package className="h-4 w-4" /> },
  { label: 'Factures', path: '/dashboard/factures', keywords: ['factures', 'invoice', 'facturation'], icon: <FileText className="h-4 w-4" /> },
  { label: 'Clients', path: '/dashboard/clients', keywords: ['clients', 'client', 'contacts'], icon: <Users className="h-4 w-4" /> },
  { label: 'Gestion des dettes', path: '/dashboard/dettes', keywords: ['dettes', 'créances', 'impayés', 'debt'], icon: <Wallet className="h-4 w-4" /> },
  { label: 'Rapports & Revenus', path: '/dashboard/rapports', keywords: ['rapports', 'revenus', 'ca', 'chiffre affaires', 'statistiques'], icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Paramètres', path: '/dashboard/parametres', keywords: ['paramètres', 'settings', 'sécurité', 'pin'], icon: <Settings className="h-4 w-4" /> },
  { label: 'Mon profil', path: '/dashboard/profil', keywords: ['profil', 'compte', 'profile'], icon: <User className="h-4 w-4" /> },
  { label: 'Ma boutique', path: '/dashboard/boutique', keywords: ['boutique', 'shop', 'entreprise'], icon: <Store className="h-4 w-4" /> },
  { label: 'Support / Aide', path: '/dashboard/support', keywords: ['support', 'aide', 'help'], icon: <HelpCircle className="h-4 w-4" /> },
]

function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function searchSections(query: string): AppSection[] {
  const q = normalize(query.trim())
  if (!q) return []
  return APP_SECTIONS.filter((section) => {
    const labelMatch = normalize(section.label).includes(q)
    const keywordMatch = section.keywords.some((k) => normalize(k).includes(q))
    return labelMatch || keywordMatch
  })
}

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
        <img src={current.flag} alt={current.label} className="w-6 h-6 rounded-full object-cover shadow-sm" />
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
              <img src={lang.flag} alt={lang.label} className="w-7 h-7 rounded-full object-cover shadow-sm" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GlobalSearch() {
  const router = useRouter()
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const results = searchSections(query)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setActiveIndex(0) }, [query])

  useEffect(() => {
    const inputEl = ref.current?.querySelector('input')
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputEl?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const goToSection = (section: AppSection) => {
    router.push(section.path)
    setQuery('')
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((prev) => (prev + 1) % results.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((prev) => (prev - 1 + results.length) % results.length) }
    else if (e.key === 'Enter') { e.preventDefault(); goToSection(results[activeIndex]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div ref={ref} className="relative flex-1 max-w-xl mx-auto">
      <div className="flex items-center gap-2.5 bg-[#F8F9FB] dark:bg-zinc-800 border border-[#EAECEF] dark:border-zinc-700 rounded-xl px-4 py-2.5">
        <Search size={15} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t('dashboard.header.search', 'Rechercher dans le tableau de bord...')}
          className="bg-transparent text-[13px] text-gray-600 dark:text-zinc-300 placeholder:text-gray-400 outline-none w-full"
        />
        <kbd className="text-[10px] text-gray-300 dark:text-zinc-500 font-mono shrink-0 border border-gray-200 dark:border-zinc-600 rounded px-1.5 py-0.5">
          Ctrl K
        </kbd>
      </div>

      {open && query && (
        <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-white dark:bg-zinc-900 border border-[#EAECEF] dark:border-zinc-700 shadow-xl overflow-hidden z-[999] max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Aucune section trouvée pour "{query}"
            </div>
          ) : (
            results.map((section, index) => (
              <button
                key={section.path}
                onClick={() => goToSection(section)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                  index === activeIndex ? 'bg-gray-50 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="text-gray-400">{section.icon}</span>
                <span className="text-gray-700 dark:text-gray-200 font-medium">{section.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface TopBarProps {
  user: AppUser | null
}

export function TopBar({ user }: TopBarProps) {
  const router = useRouter()
  const toggle = useSidebarStore((s) => s.toggle)
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const { setCurrentUser, isRole } = useUserContext()
  const [mounted, setMounted] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const isDark = theme === 'dark'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    sessionStorage.clear()
    window.location.href = '/'
  }

  const handleUserSwitched = (switchedUser: AppUser) => {
    setCurrentUser(switchedUser)
  }

  const avatarUrl = user?.avatarUrl || user?.supabaseUser?.user_metadata?.avatar_url
  const fullName = user?.name || ''
  const email = user?.email || ''
  const displayName = fullName || email.split('@')[0] || 'Commerçant'
  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase() || 'A'
  const isAdmin = isRole('admin')

  return (
    <header className="h-16 flex items-center justify-between px-5 gap-4 sticky top-0 z-30 bg-white dark:bg-zinc-900 border-b border-[#EAECEF] dark:border-zinc-800">

      <button
        onClick={toggle}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 transition-colors shrink-0"
      >
        <Menu size={18} />
      </button>

      <GlobalSearch />

      <div className="flex items-center gap-1 shrink-0">
        {/* Notifications */}
        <Notifications />

        <VoiceAssistantButton />

        <LanguageDropdown />

        {mounted && (
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 transition-colors"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}

        {/* Switch User button — admin only */}
        {isAdmin && (
          <button
            onClick={() => setSwitchOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 transition-colors"
            title="Changer d'utilisateur"
          >
            <ArrowLeftRight size={16} />
          </button>
        )}

        <div className="w-px h-5 bg-gray-200 dark:bg-zinc-700 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} referrerPolicy="no-referrer" />
                <AvatarFallback className="text-[11px] font-bold text-white"
                                style={{ background: isAdmin ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#38BDF8,#0EA5E9)' }}>
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
                                style={{ background: isAdmin ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#38BDF8,#0EA5E9)' }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 gap-1">
                <span className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{displayName}</span>
                {email && <span className="text-[11px] text-gray-400 truncate">{email}</span>}
                <Badge
                  variant="outline"
                  className={`text-[9px] w-fit ${
                    isAdmin
                      ? 'border-amber-300 text-amber-600 dark:text-amber-400'
                      : 'border-sky-300 text-sky-600 dark:text-sky-400'
                  }`}
                >
                  {isAdmin ? 'Administrateur' : 'Caissier'}
                </Badge>
              </div>
            </div>

            <DropdownMenuSeparator className="bg-[#EAECEF] dark:bg-zinc-700" />

            {/* Profile — admin only */}
            {isAdmin && (
              <DropdownMenuItem onClick={() => router.push('/dashboard/profil')} className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer text-[13px] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 focus:bg-gray-50">
                <User size={15} className="text-gray-400" /> {t('dashboard.menu.profile', 'Mon profil')}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="bg-[#EAECEF] dark:bg-zinc-700" />

            <DropdownMenuItem onClick={() => router.push('/dashboard/parametres')} className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer text-[13px] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 focus:bg-gray-50">
              <Settings size={15} className="text-gray-400" /> {t('dashboard.menu.settings', 'Paramètres')}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => router.push('/dashboard/support')} className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer text-[13px] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 focus:bg-gray-50">
              <HelpCircle size={15} className="text-gray-400" /> {t('dashboard.menu.support', 'Support / Aide')}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#EAECEF] dark:bg-zinc-700" />

            <DropdownMenuItem onSelect={async (e) => { e.preventDefault(); await handleLogout() }} className="gap-2.5 py-2.5 px-3 rounded-xl cursor-pointer text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 focus:text-red-500">
              <LogOut size={15} /> {t('dashboard.menu.logout', 'Déconnexion')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User switch screen */}
      <UserSwitchScreen
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        onSuccess={handleUserSwitched}
      />
    </header>
  )
}