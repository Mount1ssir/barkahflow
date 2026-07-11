'use client'

import { cn } from '@/lib/utils'

// ─── Couleurs style WhatsApp / Messenger ──────────────────────────
const ONLINE_GREEN = '#31A24C' // vert Messenger (proche du #25D366 WhatsApp)

type StatusDotSize = 'sm' | 'md' | 'lg'

interface StatusDotProps {
  active: boolean
  size?: StatusDotSize
  pulse?: boolean // effet de pulsation façon Messenger "actif maintenant"
  className?: string
}

const SIZE_MAP: Record<StatusDotSize, { dot: string; ring: string }> = {
  sm: { dot: 'h-2.5 w-2.5', ring: 'ring-2' },
  md: { dot: 'h-3 w-3', ring: 'ring-2' },
  lg: { dot: 'h-4 w-4', ring: 'ring-[3px]' },
}

export function StatusDot({ active, size = 'md', pulse = false, className }: StatusDotProps) {
  if (!active) return null

  const { dot, ring } = SIZE_MAP[size]

  return (
    <span
      className={cn(
        'absolute bottom-0 right-0 flex items-center justify-center',
        className
      )}
    >
      {/* Halo de pulsation (optionnel, comme "actif maintenant" sur Messenger) */}
      {pulse && (
        <span
          className={cn('absolute inline-flex rounded-full opacity-60 animate-ping', dot)}
          style={{ backgroundColor: ONLINE_GREEN }}
        />
      )}

      {/* Point vert avec anneau blanc (le vrai indicateur, comme WhatsApp/Messenger) */}
      <span
        className={cn(
          'relative inline-flex rounded-full ring-white dark:ring-zinc-900',
          dot,
          ring
        )}
        style={{ backgroundColor: ONLINE_GREEN }}
      />
    </span>
  )
}