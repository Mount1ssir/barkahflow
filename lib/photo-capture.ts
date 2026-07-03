import { Capacitor } from '@capacitor/core'

export interface PhotoResult {
  path: string | null
  error?: string
}

// Détecte si on tourne sur mobile (Capacitor) ou Desktop (Tauri)
function isMobilePlatform(): boolean {
  const platform = Capacitor.getPlatform()
  return platform === 'android' || platform === 'ios'
}

// ── MOBILE (Capacitor) — Caméra ou Galerie ──────────────────────
async function captureMobile(source: 'camera' | 'gallery'): Promise<PhotoResult> {
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const { Filesystem, Directory } = await import('@capacitor/filesystem')

    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      quality: 80,
      width: 800,
    })

    if (!photo.base64String) {
      return { path: null, error: 'Aucune photo capturée' }
    }

    const fileName = `product_${Date.now()}.jpeg`

    await Filesystem.writeFile({
      path: `products/${fileName}`,
      data: photo.base64String,
      directory: Directory.Data,
      recursive: true,
    })

    const fileUri = await Filesystem.getUri({
      path: `products/${fileName}`,
      directory: Directory.Data,
    })

    return { path: fileUri.uri }
  } catch (error: any) {
    if (error?.message?.includes('cancel')) {
      return { path: null } // Annulation utilisateur, pas une vraie erreur
    }
    return { path: null, error: error?.message || 'Erreur capture photo' }
  }
}

// ── DESKTOP (Tauri) — Sélection de fichier uniquement ───────────
async function captureDesktop(): Promise<PhotoResult> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { copyFile, mkdir, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    const { appDataDir, join } = await import('@tauri-apps/api/path')

    const selected = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    })

    if (!selected || typeof selected !== 'string') {
      return { path: null } // Annulation
    }

    const dataDir = await appDataDir()
    const productsDir = await join(dataDir, 'products')

    const dirExists = await exists(productsDir)
    if (!dirExists) {
      await mkdir(productsDir, { recursive: true })
    }

    const extension = selected.split('.').pop()
    const fileName = `product_${Date.now()}.${extension}`
    const destPath = await join(productsDir, fileName)

    await copyFile(selected, destPath)

    return { path: destPath }
  } catch (error: any) {
    return { path: null, error: error?.message || 'Erreur sélection photo' }
  }
}

// ── Fonction publique unifiée ────────────────────────────────────
export async function capturePhoto(source: 'camera' | 'gallery' = 'gallery'): Promise<PhotoResult> {
  if (isMobilePlatform()) {
    return captureMobile(source)
  }
  return captureDesktop()
}

// ✅ AMÉLIORATION : gestion du base64 + fallback pour anciens chemins
export function getDisplayUrl(path: string | null): string {
  if (!path) return ''

  // 🔥 Si c'est déjà un base64, on le retourne tel quel
  if (path.startsWith('data:image/')) {
    return path
  }

  // Sinon, conversion selon la plateforme (fichier local)
  if (isMobilePlatform()) {
    return Capacitor.convertFileSrc(path)
  }

  // Tauri : utilise le protocole asset
  return `asset://localhost/${encodeURIComponent(path)}`
}