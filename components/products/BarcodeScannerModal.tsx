'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, AlertCircle, CheckCircle2, Flashlight, FlashlightOff } from 'lucide-react'
import { toast } from 'sonner'
import { Capacitor } from '@capacitor/core'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat, NotFoundException } from '@zxing/library'
import {
  BarcodeScanner,
  BarcodeFormat as MlkitFormat,
} from '@capacitor-mlkit/barcode-scanning'
import { isValidChecksum } from '@/lib/barcode-utils'
import { processScan, clearPendingScans } from '@/lib/scan-validator'

interface BarcodeScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
}

const IS_NATIVE = Capacitor.isNativePlatform()
const REQUIRED_COUNT = 3

export function BarcodeScannerModal({ open, onOpenChange, onScan }: BarcodeScannerModalProps) {
  const [status, setStatus] = useState<'loading' | 'scanning' | 'detected' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [detectedCode, setDetectedCode] = useState('')
  const [scanProgress, setScanProgress] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const mlkitListenerRef = useRef<any>(null)
  const detectedRef = useRef(false)
  const mountedRef = useRef(false)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ─── Arrêt propre des deux moteurs ─────────────────────────────
  const stopScanner = async () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }
    if (controlsRef.current) {
      try { controlsRef.current.stop() } catch (_) {}
      controlsRef.current = null
    }
    if (IS_NATIVE) {
      try {
        if (mlkitListenerRef.current) {
          await mlkitListenerRef.current.remove()
          mlkitListenerRef.current = null
        }
        await BarcodeScanner.stopScan()
        document.body.classList.remove('mlkit-scanning')
      } catch (_) {}
    }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopScanner()
      clearPendingScans()
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stopScanner()
      detectedRef.current = false
      setStatus('loading')
      setErrorMsg('')
      setTorchOn(false)
      setTorchSupported(false)
      setScanCount(0)
      setDetectedCode('')
      setScanProgress(0)
      clearPendingScans()
      return
    }

    let cancelled = false

    // ─── HANDLE DETECTED ─────────────────────────────────────────────
    const handleDetected = (code: string) => {
      if (detectedRef.current || !mountedRef.current || cancelled) return
      
      const cleanCode = code.trim()
      
      // Afficher le code réellement lu
      console.log('📸 Code scanné (RAW):', JSON.stringify(code))
      console.log('📸 Code scanné (clean):', cleanCode)
      
      // Mettre à jour l'interface
      setDetectedCode(cleanCode)
      
      // Vérifier le checksum mais seulement pour informer
      if (!isValidChecksum(cleanCode)) {
        console.warn('⚠️ Checksum invalide pour:', cleanCode)
      }
      
      // Traiter le scan avec le validateur (3 scans)
      const result = processScan(cleanCode)
      
      // Mettre à jour l'interface
      setScanCount(result.count)
      setScanProgress(result.count / REQUIRED_COUNT)
      
      if (result.validated) {
        // ✅ Scan validé après 3 lectures identiques
        console.log(`✅ Scan validé après ${result.count} scans (${result.elapsed}ms)`)
        
        detectedRef.current = true
        setStatus('detected')
        
        // Arrêter le scanner
        stopScanner()
        
        // Vibration double pour confirmer
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200])
        }
        
        toast.success(`Code validé !`, {
          description: `${result.barcode}`,
          duration: 1500
        })
        
        // Appeler onScan
        scanTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            onScan(result.barcode)
            onOpenChange(false)
          }
        }, 400)
        
      } else {
        // ⏳ En attente de plus de scans
        const remaining = REQUIRED_COUNT - result.count
        toast.info(`Scan #${result.count}/${REQUIRED_COUNT}`, {
          description: `Scannez à nouveau (${remaining} scan${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`,
          duration: 1200
        })
        
        // Vibration courte pour indiquer qu'il faut rescanner
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(50)
        }
      }
    }

    // ─── Moteur natif : ML Kit ────────────────────────────────
    const initMlkit = async () => {
      const { camera } = await BarcodeScanner.requestPermissions()
      if (camera !== 'granted' && camera !== 'limited') {
        throw new Error('Permission caméra refusée')
      }

      const { supported } = await BarcodeScanner.isSupported()
      if (!supported) throw new Error('Scan non supporté sur cet appareil')

      document.body.classList.add('mlkit-scanning')

      if (!cancelled && mountedRef.current) setStatus('scanning')

      mlkitListenerRef.current = await BarcodeScanner.addListener(
        'barcodesScanned',
        (event: { barcodes: Array<{ rawValue?: string }> }) => {
          const first = event.barcodes?.[0]
          if (first?.rawValue) {
            handleDetected(first.rawValue)
          }
        }
      )

      await BarcodeScanner.startScan({
        formats: [
          MlkitFormat.Ean13,
          MlkitFormat.Ean8,
          MlkitFormat.UpcA,
          MlkitFormat.UpcE,
          MlkitFormat.Code128,
          MlkitFormat.Code39,
          MlkitFormat.Itf,
          MlkitFormat.Codabar,
          MlkitFormat.QrCode,
        ],
      })

      try {
        const flashResult = await BarcodeScanner.isTorchAvailable()
        setTorchSupported(!!flashResult.available)
      } catch (_) {}
    }

    // ─── Moteur web/desktop : ZXing ───────────────────────────────
    const initZxing = async () => {
      const hints = new Map<DecodeHintType, any>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.QR_CODE,
      ])
      hints.set(DecodeHintType.TRY_HARDER, false)

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 50,
        delayBetweenScanSuccess: 100,
      } as any)

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      if (!devices || devices.length === 0) {
        throw new Error('Aucune caméra détectée')
      }
      const backCamera = devices.find((d) =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment') ||
        d.label.toLowerCase().includes('arrière')
      )
      const deviceId = backCamera?.deviceId || devices[devices.length - 1].deviceId

      if (cancelled || !mountedRef.current || !videoRef.current) return

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: { exact: deviceId },
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
          advanced: [{ focusMode: 'continuous' } as any],
        },
      }

      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, err) => {
          if (detectedRef.current || !mountedRef.current || cancelled) return
          if (result) {
            handleDetected(result.getText())
            return
          }
          if (err && !(err instanceof NotFoundException)) {
            // Ignorer silencieusement les erreurs de décodage
          }
        }
      )

      controlsRef.current = controls

      try {
        const stream = videoRef.current.srcObject as MediaStream
        const track = stream?.getVideoTracks?.()[0]
        const caps = track?.getCapabilities?.() as any
        if (caps && 'torch' in caps) setTorchSupported(true)
      } catch (_) {}

      if (!cancelled && mountedRef.current) setStatus('scanning')
    }

    const initScanner = async () => {
      try {
        if (IS_NATIVE) {
          await initMlkit()
        } else {
          await initZxing()
        }
      } catch (err: any) {
        if (!cancelled && mountedRef.current) {
          console.error('Scanner error:', err)
          setErrorMsg(
            err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
              ? "Permission caméra refusée. Autorisez l'accès dans les paramètres."
              : err?.message || 'Impossible d\'initialiser le scanner'
          )
          setStatus('error')
        }
      }
    }

    initScanner()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [open, onScan, onOpenChange])

  const toggleTorch = async () => {
    try {
      const newState = !torchOn
      if (IS_NATIVE) {
        if (newState) await BarcodeScanner.enableTorch()
        else await BarcodeScanner.disableTorch()
      } else {
        const stream = videoRef.current?.srcObject as MediaStream
        const track = stream?.getVideoTracks?.()[0]
        if (!track) return
        await track.applyConstraints({ advanced: [{ torch: newState } as any] })
      }
      setTorchOn(newState)
    } catch (err) {
      console.error('Erreur torche:', err)
      toast.error('Torche indisponible sur cet appareil')
    }
  }

  const retry = () => {
    setStatus('loading')
    setErrorMsg('')
    detectedRef.current = false
    setScanCount(0)
    setDetectedCode('')
    setScanProgress(0)
    clearPendingScans()
    onOpenChange(false)
    setTimeout(() => onOpenChange(true), 150)
  }

  const handleClose = () => {
    stopScanner()
    clearPendingScans()
    setScanCount(0)
    setDetectedCode('')
    setScanProgress(0)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v) }}>
      <DialogContent
        className={`w-[360px] max-w-[95vw] p-0 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl ${
          IS_NATIVE && status === 'scanning' ? 'bg-transparent border-0 shadow-none' : 'bg-gray-950'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-700 ${
          IS_NATIVE && status === 'scanning' ? 'bg-gray-900/70 backdrop-blur-sm' : 'bg-gray-900'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white font-bold text-sm">Scanner un code-barres</span>
          </div>
          <div className="flex items-center gap-1">
            {torchSupported && status === 'scanning' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTorch}
                className={`rounded-xl h-8 w-8 ${
                  torchOn
                    ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {torchOn ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleClose}
              className="text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Indicateur de progression des scans */}
        {scanCount > 0 && scanCount < REQUIRED_COUNT && status === 'scanning' && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-amber-400 font-medium">
                Scan #{scanCount}/{REQUIRED_COUNT}
              </span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 font-mono">
                {detectedCode.slice(0, 4)}...{detectedCode.slice(-4)}
              </span>
            </div>
          </div>
        )}

        {/* Camera area */}
        <div className="relative bg-black" style={{ height: '300px' }}>

          {!IS_NATIVE && (
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          )}

          {status === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0" style={{
                background: IS_NATIVE
                  ? 'transparent'
                  : `linear-gradient(rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.55) 100%)`,
              }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ width: 340, height: 170, background: 'transparent',
                    boxShadow: IS_NATIVE ? 'none' : '0 0 0 9999px rgba(0,0,0,0.5)' }} />
              </div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: 340, height: 170 }}>
                <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 rounded-tl-lg"
                  style={{ borderColor: '#D4A017', borderTopWidth: 3, borderLeftWidth: 3 }} />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 rounded-tr-lg"
                  style={{ borderColor: '#D4A017', borderTopWidth: 3, borderRightWidth: 3 }} />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 rounded-bl-lg"
                  style={{ borderColor: '#D4A017', borderBottomWidth: 3, borderLeftWidth: 3 }} />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 rounded-br-lg"
                  style={{ borderColor: '#D4A017', borderBottomWidth: 3, borderRightWidth: 3 }} />
                <div className="absolute left-2 right-2 h-0.5 rounded-full scan-line"
                  style={{ backgroundColor: '#D4A017', boxShadow: '0 0 8px #D4A017' }} />
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <p className="text-white text-sm font-bold">Initialisation de la caméra…</p>
            </div>
          )}

          {status === 'detected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 z-10 gap-3">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
              <p className="text-white text-base font-extrabold">Code validé !</p>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-10 gap-3 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <p className="text-white text-sm font-bold">{errorMsg}</p>
              <Button onClick={retry} size="sm"
                className="rounded-xl font-bold text-white border border-white/30 bg-white/10 hover:bg-white/20 mt-1">
                Réessayer
              </Button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className={`px-4 py-3 border-t border-gray-700 ${
          IS_NATIVE && status === 'scanning' ? 'bg-gray-900/70 backdrop-blur-sm' : 'bg-gray-900'
        }`}>
          <p className="text-center text-gray-400 text-xs font-semibold">
            {status === 'scanning'
              ? scanCount > 0 && scanCount < REQUIRED_COUNT
                ? `Scannez à nouveau pour valider (${REQUIRED_COUNT - scanCount} restant${REQUIRED_COUNT - scanCount > 1 ? 's' : ''})`
                : 'Alignez le code-barres dans le cadre doré'
              : status === 'loading'
              ? 'Veuillez autoriser l\'accès à la caméra…'
              : status === 'detected'
              ? 'Redirection en cours…'
              : 'Vérifiez les permissions caméra'}
          </p>
          <p className="text-center text-gray-600 text-[10px] mt-1">
            EAN-13 · EAN-8 · UPC · CODE-128 · CODE-39 · ITF · CODABAR
          </p>
        </div>
      </DialogContent>

      <style>{`
        @keyframes scanLine {
          0%   { top: 4px; opacity: 1; }
          48%  { opacity: 1; }
          50%  { top: calc(100% - 4px); opacity: 0.7; }
          100% { top: 4px; opacity: 1; }
        }
        .scan-line {
          animation: scanLine 2s ease-in-out infinite;
          position: absolute;
        }
        body.mlkit-scanning,
        body.mlkit-scanning * {
          background: transparent !important;
        }
      `}</style>
    </Dialog>
  )
}