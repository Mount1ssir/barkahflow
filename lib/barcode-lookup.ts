// lib/barcode-lookup.ts

export interface ExternalProductData {
  found: boolean
  offline?: boolean
  source?: string
  nameFr?: string
  brand?: string
  categoryGuess?: string
  categoryTags?: string[]
  imageUrl?: string
  unitGuess?: string
}

const SOURCES = [
  { name: 'Open Food Facts', base: 'https://world.openfoodfacts.org/api/v2/product' },
  { name: 'Open Products Facts', base: 'https://world.openproductsfacts.org/api/v2/product' },
  { name: 'Open Beauty Facts', base: 'https://world.openbeautyfacts.org/api/v2/product' },
]

// Génère les variantes EAN-13 <-> UPC-A
export function barcodeVariants(barcode: string): string[] {
  const clean = barcode.trim().replace(/\s+/g, '')
  const variants = new Set<string>([clean])
  
  // UPC-A (12 chiffres) → EAN-13 avec zéro de tête
  if (clean.length === 12) variants.add('0' + clean)
  // EAN-13 commençant par 0 → UPC-A
  if (clean.length === 13 && clean.startsWith('0')) variants.add(clean.slice(1))
  
  return Array.from(variants)
}

// 🔥 CORRIGÉ : Gestion des aborts silencieuse
async function tryFetch(base: string, barcode: string, signal: AbortSignal, sourceName: string) {
  try {
    console.log(`[barcode-lookup] Tentative ${sourceName} pour ${barcode}`)
    const res = await fetch(`${base}/${barcode}.json`, { method: 'GET', signal })
    
    if (!res.ok) {
      console.warn(`[barcode-lookup] ${sourceName} → HTTP ${res.status}`)
      return null
    }
    
    const data = await res.json()
    if (data.status !== 1 || !data.product) {
      console.info(`[barcode-lookup] ${sourceName} → produit non référencé`)
      return null
    }
    
    console.log(`[barcode-lookup] ${sourceName} → trouvé !`)
    return data.product
  } catch (err: any) {
    // Ne pas logger comme erreur si c'est un abort (timeout normal)
    if (err?.name === 'AbortError') {
      console.log(`[barcode-lookup] ${sourceName} → timeout (requête annulée)`)
      throw err
    }
    console.error(`[barcode-lookup] ${sourceName} → ERREUR RÉSEAU:`, err?.message || err)
    throw err
  }
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function guessUnit(p: any): string | undefined {
  const rawUnit = (p.product_quantity_unit || '').toLowerCase()
  if (rawUnit === 'kg') return 'kg'
  if (rawUnit === 'g') return 'g'
  if (rawUnit === 'l') return 'l'
  if (rawUnit === 'ml') return 'ml'

  const quantity: string = p.quantity || p.product_quantity || ''
  const q = quantity.toLowerCase()
  if (/\bkg\b/.test(q)) return 'kg'
  if (/\bg\b/.test(q)) return 'g'
  if (/\bl\b/.test(q) && !/ml/.test(q)) return 'l'
  if (/\bml\b/.test(q)) return 'ml'

  return 'piece'
}

function extractCategoryKeywords(p: any): string[] {
  const tags: string[] = p.categories_tags || []
  return tags
    .map((t) => t.replace(/^\w+:/, '').replace(/-/g, ' '))
    .map(normalize)
    .reverse()
}

// 🔥 CORRIGÉ : Timeout augmenté à 15 secondes et gestion des aborts
export async function lookupProductByBarcode(
  barcode: string
): Promise<ExternalProductData> {
  const clean = barcode.trim()
  if (!clean) return { found: false }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.warn('[barcode-lookup] navigator.onLine = false')
    return { found: false, offline: true }
  }

  const variants = barcodeVariants(clean)
  console.log(`[barcode-lookup] Variantes du code-barres:`, variants)

  let hadNetworkError = false
  let hadAbortError = false

  for (const variant of variants) {
    for (const source of SOURCES) {
      const controller = new AbortController()
      // 🔥 Timeout augmenté à 15 secondes
      const timeout = setTimeout(() => {
        console.log(`[barcode-lookup] Timeout pour ${source.name} (15s)`);
        controller.abort();
      }, 15000)

      try {
        const p = await tryFetch(source.base, variant, controller.signal, source.name)
        clearTimeout(timeout)

        if (!p) continue

        const categoryKeywords = extractCategoryKeywords(p)

        return {
          found: true,
          source: source.name,
          nameFr: p.product_name_fr || p.product_name || undefined,
          brand: p.brands || undefined,
          categoryGuess: categoryKeywords[0] || undefined,
          categoryTags: categoryKeywords,
          imageUrl: p.image_front_url || p.image_url || undefined,
          unitGuess: guessUnit(p),
        }
      } catch (err: any) {
        clearTimeout(timeout)
        const isAbort = err?.name === 'AbortError'
        if (isAbort) {
          hadAbortError = true
          // C'est normal, on continue vers la prochaine source
          console.log(`[barcode-lookup] ${source.name} timeout, passage à la suivante`)
          continue
        }
        // Erreur réseau (probablement un blocage Tauri)
        hadNetworkError = true
        console.log(`[barcode-lookup] ${source.name} erreur réseau, passage à la suivante`)
        continue
      }
    }
  }

  // Si on a eu au moins un abort mais pas d'erreur réseau, c'est juste un timeout
  if (hadAbortError && !hadNetworkError) {
    console.log('[barcode-lookup] ⚠️ Timeout sur toutes les sources (connexion lente)')
    return { found: false }
  }

  if (hadNetworkError) {
    console.warn(
      '[barcode-lookup] ⚠️ Erreurs réseau sur toutes les sources.\n' +
      'Vérifie ta connexion internet et les permissions réseau.'
    )
  }

  return { found: false }
}

export async function urlToFile(url: string, filename = 'product.jpg'): Promise<File | null> {
  try {
    console.log('[barcode-lookup] Téléchargement image:', url)
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new File([blob], filename, { type: blob.type || 'image/jpeg' })
  } catch (err) {
    console.error('Erreur téléchargement image:', err)
    return null
  }
}