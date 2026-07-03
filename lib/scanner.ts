// lib/scanner.ts

export type ScannerType = 'web'

export function detectScanner(): ScannerType {
  return 'web'
}

export interface BarcodeResult {
  text: string
  format?: string
}

export interface ScannerOptions {
  onResult: (result: BarcodeResult) => void
  onError?: (error: any) => void
  onClose?: () => void
}

export async function startBarcodeScanner(options: ScannerOptions): Promise<{ stop: () => Promise<void> }> {
  try {
    const { Html5Qrcode } = await import('html5-qrcode')
    const container = document.getElementById('barcode-scanner-container')
    if (!container) {
      throw new Error('Conteneur de scan non trouvé')
    }
    const scanner = new Html5Qrcode('barcode-scanner-container')
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        options.onResult({ text: decodedText })
        scanner.stop()
      },
      (error) => {
        // Ignorer les erreurs de scanning
      }
    )
    return {
      stop: async () => {
        await scanner.stop()
        await scanner.clear()
      },
    }
  } catch (err) {
    options.onError?.(err)
    throw new Error('Web barcode scanner not available')
  }
}