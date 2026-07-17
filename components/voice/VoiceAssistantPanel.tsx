'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Mic, MicOff, Send, Trash2, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { VoiceState, ParsedCommand } from '@/lib/voice/voice-types'
import { orchestrateCommand } from '@/lib/voice/voice-orchestrator'
import { executeCommand } from '@/lib/voice/voice-executor'
import { speak, cancelSpeech } from '@/lib/voice/voice-feedback'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface VoiceAssistantPanelProps {
  onClose: () => void
}

// Commandes fréquentes (raccourcis)
const QUICK_COMMANDS = [
  { label: 'Chiffre d\'affaires aujourd\'hui', command: 'chiffre d\'affaires aujourd\'hui' },
  { label: 'Dettes totales', command: 'dettes totales' },
  { label: 'Total produits', command: 'nombre de produits' },
  { label: 'Produits en rupture', command: 'produits en rupture' },
  { label: 'Clients endettés', command: 'clients endettés' },
]

export function VoiceAssistantPanel({ onClose }: VoiceAssistantPanelProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [state, setState] = useState<VoiceState>('IDLE')
  const [transcript, setTranscript] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [confirmationCommand, setConfirmationCommand] = useState<ParsedCommand | null>(null)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [result, setResult] = useState<{ message: string; success: boolean; fallbackIntent?: string } | null>(null)
  const [lastNavigateTo, setLastNavigateTo] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Charger l'historique depuis localStorage au montage
  useEffect(() => {
    const saved = localStorage.getItem('voice_history')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setMessages(parsed)
      } catch (e) {
        // ignore
      }
    }
  }, [])

  // Sauvegarder l'historique à chaque changement
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('voice_history', JSON.stringify(messages))
    }
  }, [messages])

  // Scroll en bas des messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      role,
      content,
      timestamp: Date.now(),
    }])
  }

  const processCommand = async (text: string) => {
    if (!text.trim()) {
      toast.info(t('voice.no_input', 'Veuillez saisir une commande.'))
      return
    }

    addMessage('user', text)
    setInput('')
    setTranscript('')

    setState('PROCESSING')

    const { command: parsed, source } = await orchestrateCommand(text, window.location.pathname)

    // Inform the user if the offline fallback was used
    if (source === 'offline-fallback') {
      toast.info('Mode hors-ligne — commandes limitées disponibles')
    }

    if (!parsed) {
      const msg = t('voice.not_understood', "Désolé, je n'ai pas compris votre commande.")
      addMessage('assistant', msg)
      speak(msg)
      setState('IDLE')
      return
    }

    // Gestion de la confirmation
    if (parsed.intent === 'CONFIRM_YES') {
      if (confirmationCommand) {
        setState('EXECUTING')
        try {
          let commandToExecute = confirmationCommand
          if (result?.fallbackIntent) {
            commandToExecute = { ...confirmationCommand, intent: result.fallbackIntent as any }
          }
          const execResult = await executeCommand(commandToExecute, true)
          addMessage('assistant', execResult.message)
          speak(execResult.message)
          if (execResult.navigateTo) {
            setLastNavigateTo(execResult.navigateTo)
            router.push(execResult.navigateTo)
          }
          if (execResult.shouldRefresh) {
            router.refresh()
          }
        } catch (err) {
          console.error(err)
          addMessage('assistant', 'Une erreur est survenue.')
        } finally {
          setState('IDLE')
          setConfirmationCommand(null)
          setConfirmationMessage('')
        }
        return
      } else {
        const msg = t('voice.no_pending_confirmation', 'Je n\'ai pas de confirmation en attente.')
        addMessage('assistant', msg)
        speak(msg)
        setState('IDLE')
        return
      }
    }

    if (parsed.intent === 'CONFIRM_NO') {
      const msg = t('voice.action_cancelled', 'Action annulée.')
      addMessage('assistant', msg)
      speak(msg)
      setConfirmationCommand(null)
      setConfirmationMessage('')
      setState('IDLE')
      return
    }

    if (parsed.intent === 'REPEAT') {
      const lastMsg = messages.filter(m => m.role === 'assistant').pop()
      if (lastMsg) {
        speak(lastMsg.content)
      } else {
        speak(t('voice.nothing_to_repeat', 'Je n\'ai rien à répéter.'))
      }
      setState('IDLE')
      return
    }

    // Exécution normale
    try {
      const execResult = await executeCommand(parsed)
      setResult(execResult)

      if (execResult.success && execResult.navigateTo) {
        setLastNavigateTo(execResult.navigateTo)
        router.push(execResult.navigateTo)
      }
      if (execResult.shouldRefresh) {
        router.refresh()
      }

      if (execResult.requiresConfirmation) {
        setConfirmationCommand(parsed)
        const msg = execResult.confirmationMessage || t('voice.confirm_default', 'Voulez-vous confirmer cette action ?')
        setConfirmationMessage(msg)
        setState('AWAITING_CONFIRMATION')
        addMessage('assistant', msg)
        speak(msg)
      } else {
        addMessage('assistant', execResult.message)
        speak(execResult.message)
        setState('IDLE')
      }
    } catch (err) {
      console.error(err)
      addMessage('assistant', 'Une erreur est survenue.')
      setState('IDLE')
    }
  }

  // --- Micro ---
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Votre navigateur ne supporte pas la reconnaissance vocale')
      return
    }

    const recognitionInstance = new SpeechRecognition()
    recognitionInstance.lang = 'fr-FR'
    recognitionInstance.continuous = false
    recognitionInstance.interimResults = true
    recognitionInstance.maxAlternatives = 1

    recognitionInstance.onstart = () => {
      setIsListening(true)
      setState('LISTENING')
      setTranscript('🎤 Écoute en cours...')
    }

    recognitionInstance.onresult = (event: any) => {
      const last = event.results[event.results.length - 1]
      const text = last[0].transcript
      if (last.isFinal) {
        processCommand(text)
        setIsListening(false)
        setState('IDLE')
        setTranscript('')
      } else {
        setTranscript(text)
      }
    }

    recognitionInstance.onerror = (event: any) => {
      console.error('Erreur de reconnaissance:', event.error)
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setIsListening(false)
        setState('IDLE')
        setTranscript('')
        return
      }
      toast.error(`Erreur micro: ${event.error}`)
      setIsListening(false)
      setState('IDLE')
      setTranscript('')
    }

    recognitionInstance.onend = () => {
      setIsListening(false)
      if (state === 'LISTENING') setState('IDLE')
    }

    recognitionInstance.start()
    setRecognition(recognitionInstance)
  }

  const stopListening = () => {
    if (recognition) {
      try { recognition.stop() } catch (e) { }
    }
    setIsListening(false)
    setState('IDLE')
    setTranscript('')
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // --- Nouvelle discussion ---
  const newConversation = () => {
    setMessages([])
    localStorage.removeItem('voice_history')
    setConfirmationCommand(null)
    setConfirmationMessage('')
    setResult(null)
    toast.info('Nouvelle discussion commencée')
  }

  const deleteMessage = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  const clearHistory = () => {
    if (messages.length === 0) return
    if (confirm('Voulez-vous supprimer tout l\'historique ?')) {
      setMessages([])
      localStorage.removeItem('voice_history')
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700 shadow-2xl z-50 flex flex-col">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Assistant Barkah AI
          </span>
          {/* Network status badge */}
          <span
            title={isOnline ? 'IA cloud active (Gemini)' : 'Hors-ligne — mode limité'}
            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${isOnline
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}
          >
            {isOnline ? '● IA active' : '◎ Mode limité'}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
            {messages.length} messages
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={newConversation} title="Nouvelle discussion">
            <MessageSquare className="h-4 w-4 text-gray-400" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-red-400 hover:text-red-500" onClick={clearHistory} title="Effacer l'historique">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={onClose}>
            <X className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <Sparkles className="h-8 w-8 mb-2 text-gray-300" />
            <p>Posez-moi une question ou donnez-moi une commande.</p>
            <p className="text-xs mt-1">Ex: "ouvre les clients", "chiffre d'affaires aujourd'hui"</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200'}`}>
                {msg.content}
                <div className="text-[10px] opacity-50 mt-0.5 flex items-center gap-1">
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  {msg.role === 'user' && (
                    <button onClick={() => deleteMessage(msg.id)} className="hover:text-red-400 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {state === 'PROCESSING' && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl px-4 py-2 text-sm text-gray-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          )}
          {state === 'AWAITING_CONFIRMATION' && confirmationMessage && (
            <div className="flex justify-start">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl px-4 py-3 text-sm">
                <p className="text-orange-800 dark:text-orange-300 font-medium">⚠️ Confirmation requise</p>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{confirmationMessage}</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => processCommand('oui')}>
                    Oui
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-200 text-red-500 hover:bg-red-50" onClick={() => processCommand('non')}>
                    Non
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Commandes rapides */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-zinc-800">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd.command}
              className="text-xs bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 px-3 py-1 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
              onClick={() => processCommand(cmd.command)}
            >
              {cmd.label}
            </button>
          ))}
        </div>
      </div>

      {/* Saisie */}
      <div className="p-3 border-t border-gray-200 dark:border-zinc-700">
        <div className="flex gap-2">
          <form onSubmit={(e) => { e.preventDefault(); processCommand(input); }} className="flex-1 flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('voice.type_command', 'Tapez votre commande...')}
              className="flex-1 rounded-xl h-9 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-sm"
              disabled={state === 'PROCESSING' || state === 'EXECUTING' || state === 'LISTENING'}
            />
            <Button
              type="submit"
              size="sm"
              className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
              disabled={state === 'PROCESSING' || state === 'EXECUTING' || state === 'LISTENING'}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>

          <Button
            size="sm"
            variant={isListening ? 'destructive' : 'outline'}
            className={`rounded-xl ${isListening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'border-gray-300'}`}
            onClick={toggleListening}
            disabled={state === 'PROCESSING' || state === 'EXECUTING'}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        </div>
        {transcript && state === 'LISTENING' && (
          <p className="text-xs text-gray-400 mt-1">🔊 {transcript}</p>
        )}
      </div>
    </div>
  )
}