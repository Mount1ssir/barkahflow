'use client'

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Mic, Send, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VoiceState, ParsedCommand } from '@/lib/voice/voice-types'

interface VoiceAssistantPanelProps {
  state: VoiceState
  transcript: string
  result: { message: string; success: boolean } | null
  confirmationCommand: ParsedCommand | null
  confirmationMessage: string
  onProcessCommand: (text: string) => void
  onCancel: () => void
  onClose: () => void
}

export function VoiceAssistantPanel({
  state,
  transcript,
  result,
  confirmationCommand,
  confirmationMessage,
  onProcessCommand,
  onCancel,
  onClose,
}: VoiceAssistantPanelProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputRef.current) {
      const text = inputRef.current.value.trim()
      if (text) {
        inputRef.current.value = ''
        onProcessCommand(text)
      }
    }
  }

  const getStatusIcon = () => {
    switch (state) {
      case 'LISTENING': return <Mic className="h-4 w-4 text-red-500 animate-pulse" />
      case 'PROCESSING': return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
      case 'AWAITING_CONFIRMATION': return <CheckCircle className="h-4 w-4 text-orange-500" />
      case 'EXECUTING': return <Loader2 className="h-4 w-4 text-green-500 animate-spin" />
      default: return null
    }
  }

  const getStatusText = () => {
    switch (state) {
      case 'LISTENING': return t('voice.listening', 'Écoute en cours...')
      case 'PROCESSING': return t('voice.processing', 'Analyse de la commande...')
      case 'AWAITING_CONFIRMATION': return t('voice.awaiting_confirmation', 'En attente de confirmation')
      case 'EXECUTING': return t('voice.executing', 'Exécution en cours...')
      default: return t('voice.idle', 'Prêt')
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            🤖 {t('voice.assistant_title', 'Assistant Barkah AI')}
          </span>
          {getStatusIcon()}
          <span className="text-xs text-gray-400">{getStatusText()}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Corps */}
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {transcript && (
          <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">{t('voice.you_said', 'Vous avez dit :')}</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">"{transcript}"</p>
          </div>
        )}

        {state === 'AWAITING_CONFIRMATION' && confirmationCommand && confirmationMessage && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
              ⚠️ {t('voice.confirmation_required', 'Confirmation requise')}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              {confirmationMessage}
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                onClick={() => onProcessCommand('oui')}
              >
                {t('voice.yes', 'Oui')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-red-200 text-red-500 hover:bg-red-50"
                onClick={() => onProcessCommand('non')}
              >
                {t('voice.no', 'Non')}
              </Button>
            </div>
          </div>
        )}

        {result && state !== 'AWAITING_CONFIRMATION' && (
          <div className="p-3 rounded-xl border">
            <p className="text-xs text-gray-400 mb-1">{t('voice.response', 'Réponse :')}</p>
            <p className={`text-sm font-medium ${result.success ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {result.message}
            </p>
          </div>
        )}

        <div className="text-xs text-gray-400 border-t border-gray-200 dark:border-zinc-700 pt-3 mt-2">
          <p>{t('voice.voice_hint', '📢 Tapez votre commande ci-dessous ou cliquez sur le micro pour parler.')}</p>
        </div>
      </div>

      {/* Champ de saisie texte */}
      <div className="border-t border-gray-200 dark:border-zinc-700 p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder={t('voice.type_command', 'Tapez votre commande...')}
            className="flex-1 rounded-xl h-9 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-sm"
            disabled={state === 'PROCESSING' || state === 'EXECUTING'}
          />
          <Button
            type="submit"
            size="sm"
            className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
            disabled={state === 'PROCESSING' || state === 'EXECUTING'}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}