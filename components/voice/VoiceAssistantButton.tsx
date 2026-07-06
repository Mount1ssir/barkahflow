'use client'

import { useState, useEffect } from 'react'
import { Mic, MicOff, Loader2, CheckCircle } from 'lucide-react'
import { VoiceState, ParsedCommand } from '@/lib/voice/voice-types'
import { parseCommand } from '@/lib/voice/intent-parser'
import { executeCommand } from '@/lib/voice/voice-executor'
import { speak, cancelSpeech } from '@/lib/voice/voice-feedback'
import { VoiceAssistantPanel } from './VoiceAssistantPanel'
import { useTranslation } from 'react-i18next'

export function VoiceAssistantButton() {
  const { t } = useTranslation()
  const [state, setState] = useState<VoiceState>('IDLE')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<{ message: string; success: boolean } | null>(null)
  const [confirmationCommand, setConfirmationCommand] = useState<ParsedCommand | null>(null)
  const [confirmationMessage, setConfirmationMessage] = useState<string>('')
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    return () => cancelSpeech()
  }, [])

  const processCommand = async (text: string) => {
    if (!text.trim()) {
      const msg = t('voice.no_input', "Je n'ai rien entendu. Pouvez-vous répéter ?")
      setResult({ message: msg, success: false })
      speak(msg)
      setState('IDLE')
      return
    }

    setState('PROCESSING')
    setTranscript(text)

    let parsed: ParsedCommand | null = null
    try {
      parsed = parseCommand(text)
    } catch (err) {
      console.error('[VoiceAssistant] erreur parseCommand:', err)
    }

    if (!parsed) {
      // ✅ FIX : on met bien à jour `result` pour que l'échec soit VISIBLE à l'écran,
      // pas seulement audible (avant, rien ne s'affichait ici).
      const msg = t('voice.not_understood', "Désolé, je n'ai pas compris votre commande.")
      setResult({ message: msg, success: false })
      speak(msg)
      setState('IDLE')
      return
    }

    // Confirmation Oui
    if (parsed.intent === 'CONFIRM_YES') {
      if (confirmationCommand) {
        setState('EXECUTING')
        try {
          // ✅ true = exécution réelle (le panier n'a pas encore été modifié avant ce point)
          const execResult = await executeCommand(confirmationCommand, true)
          setResult({ message: execResult.message, success: execResult.success })
          speak(execResult.message)
        } catch (err) {
          console.error('[VoiceAssistant] erreur executeCommand (confirm):', err)
          const msg = 'Une erreur est survenue pendant l\'exécution.'
          setResult({ message: msg, success: false })
          speak(msg)
        } finally {
          setState('IDLE')
          setConfirmationCommand(null)
          setConfirmationMessage('')
        }
        return
      } else {
        const msg = t('voice.no_pending_confirmation', 'Je n\'ai pas de confirmation en attente.')
        setResult({ message: msg, success: false })
        speak(msg)
        setState('IDLE')
        return
      }
    }

    // Confirmation Non
    if (parsed.intent === 'CONFIRM_NO') {
      const msg = t('voice.action_cancelled', 'Action annulée.')
      setResult({ message: msg, success: true })
      speak(msg)
      setConfirmationCommand(null)
      setConfirmationMessage('')
      setState('IDLE')
      return
    }

    // Répéter
    if (parsed.intent === 'REPEAT') {
      if (confirmationMessage) {
        speak(confirmationMessage)
      } else if (result) {
        speak(result.message)
      } else {
        speak(t('voice.nothing_to_repeat', 'Je n\'ai rien à répéter.'))
      }
      setState('IDLE')
      return
    }

    // Commande normale — protégée par try/catch pour ne jamais bloquer l'UI
    try {
      const execResult = await executeCommand(parsed)
      setResult({ message: execResult.message, success: execResult.success })

      if (execResult.requiresConfirmation) {
        setConfirmationCommand(parsed)
        const msg = execResult.confirmationMessage || t('voice.confirm_default', 'Voulez-vous confirmer cette action ?')
        setConfirmationMessage(msg)
        setState('AWAITING_CONFIRMATION')
        speak(msg)
      } else {
        speak(execResult.message)
        setState('IDLE')
      }
    } catch (err) {
      console.error('[VoiceAssistant] erreur executeCommand:', err)
      const msg = 'Une erreur interne est survenue. Réessayez.'
      setResult({ message: msg, success: false })
      speak(msg)
      setState('IDLE')
    }
  }

  const togglePanel = () => setPanelOpen(!panelOpen)

  const getButtonStyle = () => {
    switch (state) {
      case 'LISTENING': return 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50'
      case 'PROCESSING': return 'bg-yellow-500'
      case 'AWAITING_CONFIRMATION': return 'bg-orange-500'
      case 'EXECUTING': return 'bg-green-500'
      default: return 'bg-blue-500 hover:bg-blue-600'
    }
  }

  const getIcon = () => {
    switch (state) {
      case 'LISTENING': return <MicOff size={24} className="text-white" />
      case 'PROCESSING':
      case 'EXECUTING': return <Loader2 size={24} className="text-white animate-spin" />
      case 'AWAITING_CONFIRMATION': return <CheckCircle size={24} className="text-white" />
      default: return <Mic size={24} className="text-white" />
    }
  }

  return (
    <>
      {panelOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-2rem)]">
          <VoiceAssistantPanel
            state={state}
            transcript={transcript}
            result={result}
            confirmationCommand={confirmationCommand}
            confirmationMessage={confirmationMessage}
            onProcessCommand={processCommand}
            onCancel={() => {
              cancelSpeech()
              setState('IDLE')
              setConfirmationCommand(null)
              setConfirmationMessage('')
            }}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      )}

      <button
        onClick={togglePanel}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${getButtonStyle()}`}
        title={t('voice.toggle_assistant', 'Assistant vocal')}
      >
        {getIcon()}
        {state !== 'IDLE' && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-blue-500" />
        )}
      </button>
    </>
  )
}