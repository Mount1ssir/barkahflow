'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, AlertCircle, CheckCircle2, Flashlight } from 'lucide-react'
import { toast } from 'sonner'

interface BarcodeScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
}

export function BarcodeScannerModal({ open, onOpenChange, onScan }: BarcodeScannerModalProps) {
  const [status, setStatus] = useState<'loading' | 'scanning' | 'detected' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const scannerRef = useRef<any>(null)
  const detectedRef = useRef(false) // ref instead of state to avoid re-render loop
  const mountedRef = useRef(false)

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState?.()
        // State 2 = SCANNING, state 1 = NOT_STARTED
        if (state === 2) {
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch (_) {}
      scannerRef.current = null
    }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopScanner()
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stopScanner()
      detectedRef.current = false
      setStatus('loading')
      setErrorMsg('')
      return
    }

    let cancelled = false

    const initScanner = async () => {
      // Wait for DOM
      await new Promise(r => setTimeout(r, 200))
      if (cancelled || !mountedRef.current) return

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')

        const container = document.getElementById('qr-reader')
        if (!container) throw new Error('Conteneur introuvable')

        // Supported formats — all 1D + 2D
        const formats = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
        ]

        const scanner = new Html5Qrcode('qr-reader', {
          formatsToSupport: formats,
          verbose: false,
        })
        scannerRef.current = scanner

        // Get available cameras
        const cameras = await Html5Qrcode.getCameras()
        if (!cameras || cameras.length === 0) {
          throw new Error('Aucune caméra détectée')
        }

        // Prefer back camera
        const backCamera = cameras.find(c =>
          c.label.toLowerCase().includes('back') ||
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('environment') ||
          c.label.toLowerCase().includes('arrière')
        )
        const cameraId = backCamera?.id || cameras[cameras.length - 1].id

        await scanner.start(
          cameraId,
          {
            fps: 20,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.33,
            disableFlip: false,
          },
          (decodedText: string) => {
            if (!detectedRef.current && mountedRef.current && !cancelled) {
              detectedRef.current = true
              setStatus('detected')
              stopScanner()
              toast.success(`Code détecté : ${decodedText}`)
              onScan(decodedText)
              setTimeout(() => {
                if (mountedRef.current) onOpenChange(false)
              }, 800)
            }
          },
          () => {
            // QR not found in frame — normal, ignore
          }
        )

        if (!cancelled && mountedRef.current) {
          setStatus('scanning')
        }
      } catch (err: any) {
        if (!cancelled && mountedRef.current) {
          console.error('Scanner error:', err)
          setErrorMsg(
            err?.message?.includes('camera') || err?.message?.includes('Permission')
              ? 'Permission caméra refusée. Autorisez l\'accès dans les paramètres.'
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
  }, [open]) // only open as dep — onScan/onOpenChange via refs below

  const onScanRef = useRef(onScan)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => { onScanRef.current = onScan }, [onScan])
  useEffect(() => { onOpenChangeRef.current = onOpenChange }, [onOpenChange])

  const retry = () => {
    setStatus('loading')
    setErrorMsg('')
    detectedRef.current = false
    onOpenChange(false)
    setTimeout(() => onOpenChange(true), 150)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[360px] max-w-[95vw] p-0 bg-gray-950 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white font-bold text-sm">Scanner un code-barres</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Camera area */}
        <div className="relative bg-black" style={{ height: '300px' }}>
          
          {/* Html5Qrcode container */}
          <div id="qr-reader" className="w-full h-full" style={{ minHeight: '300px' }} />

          {/* Scanning overlay */}
          {status === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Dark overlay with cutout */}
              <div className="absolute inset-0" style={{
                background: `
                  linear-gradient(rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.55) 100%)
                `,
              }}>
                {/* Clear center */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ width: 260, height: 160, background: 'transparent',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
              </div>

              {/* Frame corners */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: 260, height: 160 }}>
                {/* Top-left */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 rounded-tl-lg"
                  style={{ borderColor: '#D4A017', borderTopWidth: 3, borderLeftWidth: 3 }} />
                {/* Top-right */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 rounded-tr-lg"
                  style={{ borderColor: '#D4A017', borderTopWidth: 3, borderRightWidth: 3 }} />
                {/* Bottom-left */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 rounded-bl-lg"
                  style={{ borderColor: '#D4A017', borderBottomWidth: 3, borderLeftWidth: 3 }} />
                {/* Bottom-right */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 rounded-br-lg"
                  style={{ borderColor: '#D4A017', borderBottomWidth: 3, borderRightWidth: 3 }} />
                {/* Scan line */}
                <div className="absolute left-2 right-2 h-0.5 rounded-full scan-line"
                  style={{ backgroundColor: '#D4A017', boxShadow: '0 0 8px #D4A017' }} />
              </div>
            </div>
          )}

          {/* Loading */}
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <p className="text-white text-sm font-bold">Initialisation de la caméra…</p>
            </div>
          )}

          {/* Detected */}
          {status === 'detected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 z-10 gap-3">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
              <p className="text-white text-base font-extrabold">Code détecté !</p>
            </div>
          )}

          {/* Error */}
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
        <div className="px-4 py-3 bg-gray-900 border-t border-gray-700">
          <p className="text-center text-gray-400 text-xs font-semibold">
            {status === 'scanning'
              ? '📷 Alignez le code-barres dans le cadre doré'
              : status === 'loading'
              ? 'Veuillez autoriser l\'accès à la caméra…'
              : status === 'detected'
              ? '✅ Redirection en cours…'
              : '❌ Vérifiez les permissions caméra'}
          </p>
          <p className="text-center text-gray-600 text-[10px] mt-1">
            EAN-13 · EAN-8 · UPC · CODE-128 · CODE-39 · QR Code
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
        #qr-reader video {
          width: 100% !important;
          height: 300px !important;
          object-fit: cover !important;
        }
        #qr-reader > div:last-child {
          display: none !important;
        }
      `}</style>
    </Dialog>
  )
}