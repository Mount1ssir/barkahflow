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

async function tryFetch(base: string, barcode: string, signal: AbortSignal) {
  const res = await fetch(`${base}/${barcode}.json`, { method: 'GET', signal })
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null
  return data.product
}

// Normalise pour comparaison : minuscules + suppression des accents
// (les tags OFF sont souvent en anglais sans accent, tes catégories
// FR ont des accents — sans ça la comparaison échoue tout le temps)
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function guessUnit(p: any): string | undefined {
  // 1. Champ dédié le plus fiable
  const rawUnit = (p.product_quantity_unit || '').toLowerCase()
  if (rawUnit === 'kg') return 'kg'
  if (rawUnit === 'g') return 'g'
  if (rawUnit === 'l') return 'l'
  if (rawUnit === 'ml') return 'ml'

  // 2. Parsing du texte libre "quantity" (ex: "500 g", "1L", "6x250ml")
  const quantity: string = p.quantity || p.product_quantity || ''
  const q = quantity.toLowerCase()
  if (/\bkg\b/.test(q)) return 'kg'
  if (/\bg\b/.test(q)) return 'g'
  if (/\bl\b/.test(q) && !/ml/.test(q)) return 'l'
  if (/\bml\b/.test(q)) return 'ml'

  // 3. Par défaut : la majorité des produits scannés en boutique
  // (conserves, paquets, bouteilles individuelles) se vendent à la
  // pièce — mieux vaut une valeur par défaut sensée que de bloquer
  // le formulaire sur un champ obligatoire vide
  return 'piece'
}

// Extrait un mot-clé de catégorie exploitable depuis les tags OFF,
// en testant TOUS les tags (pas seulement le premier) du plus
// spécifique au plus général, normalisé sans accents
function extractCategoryKeywords(p: any): string[] {
  const tags: string[] = p.categories_tags || []
  return tags
    .map((t) => t.replace(/^\w+:/, '').replace(/-/g, ' '))
    .map(normalize)
    .reverse() // du plus spécifique (souvent en fin de liste) au plus général
}

export async function lookupProductByBarcode(
  barcode: string
): Promise<ExternalProductData> {
  const clean = barcode.trim()
  if (!clean) return { found: false }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { found: false, offline: true }
  }

  for (const source of SOURCES) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    try {
      const p = await tryFetch(source.base, clean, controller.signal)
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
      const isOffline = err?.name === 'AbortError' && typeof navigator !== 'undefined' && !navigator.onLine
      if (isOffline) return { found: false, offline: true }
      continue
    }
  }

  return { found: false }
}

export async function urlToFile(url: string, filename = 'product.jpg'): Promise<File | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new File([blob], filename, { type: blob.type || 'image/jpeg' })
  } catch (err) {
    console.error('Erreur téléchargement image:', err)
    return null
  }
}