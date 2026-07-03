'use client'

import { useEffect, useState } from 'react'
import { X, Lightbulb, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { dbSelect } from '@/src/lib/db'

const GOLD = '#D4A017'
const STORAGE_KEY = 'barkahflow-insight-last-shown'
const DISPLAY_DURATION = 8000 // 8 secondes

interface InsightData {
  icon: 'up' | 'down' | 'alert' | 'bulb'
  message: string
}

/**
 * Calcule l'insight du jour à partir des vraies données SQLite (table invoices)
 */
async function computeDailyInsight(): Promise<InsightData | null> {
  try {
    // Récupère les totaux des 7 derniers jours, groupés par date
    // ⚠️ total est stocké en CENTIMES dans SQLite (INTEGER) → on convertit en MAD (÷100)
    const rawRows = await dbSelect<{ day: string; total: number; count: number }>(
      `SELECT 
         date(created_at) as day,
         SUM(total) as total,
         COUNT(*) as count
       FROM invoices
       WHERE status = 'PAID'
         AND created_at >= date('now', '-7 days')
       GROUP BY date(created_at)
       ORDER BY day DESC`
    )

    if (!rawRows || rawRows.length === 0) return null

    // Conversion centimes → MAD
    const rows = rawRows.map((r) => ({ ...r, total: r.total / 100 }))

    const todayStr = new Date().toISOString().split('T')[0]
    const today = rows.find((r) => r.day === todayStr)
    const others = rows.filter((r) => r.day !== todayStr)

    // Cas 1 : aucune facture aujourd'hui
    if (!today) {
      // Vérifie l'heure de la dernière facture (tous statuts)
      const lastInvoiceRows = await dbSelect<{ created_at: string }>(
        `SELECT created_at FROM invoices ORDER BY created_at DESC LIMIT 1`
      )
      if (lastInvoiceRows?.[0]) {
        const lastDate = new Date(lastInvoiceRows[0].created_at)
        const hoursSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60)
        if (hoursSince >= 3) {
          return {
            icon: 'alert',
            message: `Aucune facture créée depuis ${Math.floor(hoursSince)}h. Pense à vérifier la caisse.`,
          }
        }
      }
      return null
    }

    // Cas 2 : comparaison avec le meilleur jour des 7 derniers jours
    const bestOther = others.reduce(
      (max, r) => (r.total > max ? r.total : max),
      0
    )

    if (today.total > bestOther && others.length > 0) {
      const diffPct = bestOther > 0
        ? Math.round(((today.total - bestOther) / bestOther) * 100)
        : 100
      return {
        icon: 'up',
        message: `Aujourd'hui est ton meilleur jour de la semaine avec ${today.total.toFixed(2)} MAD sur ${today.count} factures — soit +${diffPct}% par rapport à ton record précédent.`,
      }
    }

    // Cas 3 : comparaison simple avec hier
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const yesterday = others.find((r) => r.day === yesterdayStr)

    if (yesterday) {
      const diffPct = yesterday.total > 0
        ? Math.round(((today.total - yesterday.total) / yesterday.total) * 100)
        : 0
      if (diffPct > 0) {
        return {
          icon: 'up',
          message: `Tu as fait ${today.total.toFixed(2)} MAD aujourd'hui sur ${today.count} factures — soit +${diffPct}% par rapport à hier.`,
        }
      } else if (diffPct < -20) {
        return {
          icon: 'down',
          message: `Tes ventes ont baissé de ${Math.abs(diffPct)}% par rapport à hier (${today.total.toFixed(2)} MAD aujourd'hui).`,
        }
      }
    }

    // Cas 4 : message neutre par défaut
    return {
      icon: 'bulb',
      message: `Tu as déjà fait ${today.total.toFixed(2)} MAD aujourd'hui sur ${today.count} factures.`,
    }
  } catch (err) {
    console.warn('InsightToast: erreur calcul insight', err)
    return null
  }
}

function shouldShowToday(): boolean {
  if (typeof window === 'undefined') return false
  const last = localStorage.getItem(STORAGE_KEY)
  const todayStr = new Date().toISOString().split('T')[0]
  return last !== todayStr
}

function markShownToday() {
  if (typeof window === 'undefined') return
  const todayStr = new Date().toISOString().split('T')[0]
  localStorage.setItem(STORAGE_KEY, todayStr)
}

const ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  alert: AlertTriangle,
  bulb: Lightbulb,
}

export function InsightToast() {
  const [insight, setInsight] = useState<InsightData | null>(null)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // ✅ Affichage une seule fois par jour
    if (!shouldShowToday()) return

    let timeoutHide: ReturnType<typeof setTimeout>
    let timeoutShow: ReturnType<typeof setTimeout>

    computeDailyInsight().then((data) => {
      if (!data) return
      setInsight(data)

      // petit délai avant l'apparition (laisse le dashboard se charger)
      timeoutShow = setTimeout(() => {
        setVisible(true)
        markShownToday()

        timeoutHide = setTimeout(() => {
          setVisible(false)
        }, DISPLAY_DURATION)
      }, 400)
    })

    return () => {
      clearTimeout(timeoutShow)
      clearTimeout(timeoutHide)
    }
  }, [])

  const handleClose = () => setVisible(false)

  if (!mounted || !insight) return null

  const Icon = ICONS[insight.icon]

  return (
    <div
      className={`fixed top-4 left-1/2 z-[100] w-[420px] max-w-[90vw] -translate-x-1/2 transition-all duration-500 ease-out ${
        visible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-[130%] opacity-0 pointer-events-none'
      }`}
    >
      <div
        className="rounded-xl border bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
        style={{ borderColor: '#EAECEF', borderLeftWidth: '3px', borderLeftColor: GOLD }}
      >
        <div className="flex items-start gap-3 p-3.5 pl-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(212,160,23,0.12)', color: GOLD }}
          >
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-gray-900 dark:text-white mb-0.5">
              Insight du jour
            </div>
            <div className="text-[12.5px] text-gray-600 dark:text-zinc-300 leading-snug">
              {insight.message}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded p-0.5 shrink-0 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        {/* Barre de progression */}
        <div className="h-[2px] bg-gray-100 dark:bg-zinc-800">
          {visible && (
            <div
              className="h-full"
              style={{
                backgroundColor: GOLD,
                animation: `insightShrink ${DISPLAY_DURATION}ms linear forwards`,
              }}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes insightShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}