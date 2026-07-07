'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { VoiceAssistantPanel } from './VoiceAssistantPanel'

export function VoiceAssistantButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative w-9 h-9 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 transition-colors"
        onClick={() => setOpen(!open)}
        title={t('voice.toggle_assistant', 'Assistant vocal')}
      >
        <span className="text-lg">🤖</span>
        {open && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        )}
      </Button>

      {open && <VoiceAssistantPanel onClose={() => setOpen(false)} />}
    </>
  )
}

export default VoiceAssistantButton