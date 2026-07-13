// lib/barcode-utils.ts

// ─── Nettoyage agressif ──────────────────────────────────────────
export function normalizeBarcode(code: string | null | undefined): string {
  if (!code) return ''
  
  // 1. Convertir en string
  let cleaned = String(code)
  
  // 2. Supprimer tous les caractères invisibles (espaces, \n, \r, \t, \u200B, etc.)
  cleaned = cleaned.replace(/[\s\n\r\t\u200B\uFEFF]/g, '')
  
  // 3. Supprimer les tirets, points, virgules
  cleaned = cleaned.replace(/[-.,]/g, '')
  
  // 4. Mettre en majuscules
  cleaned = cleaned.toUpperCase()
  
  return cleaned
}

// ─── Génération des variantes UPC/EAN ──────────────────────────
export function generateBarcodeVariants(code: string): string[] {
  const normalized = normalizeBarcode(code)
  if (!normalized) return []
  
  const variants = new Set<string>()
  
  // 1. Code original
  variants.add(normalized)
  
  // 2. Sans zéros de tête (pour UPC-A)
  const withoutLeadingZeros = normalized.replace(/^0+/, '')
  if (withoutLeadingZeros) variants.add(withoutLeadingZeros)
  
  // 3. Avec un zéro de tête (UPC-A → EAN-13)
  if (normalized.length === 12) {
    variants.add('0' + normalized)
  }
  
  // 4. Sans le dernier zéro si UPC-A
  if (normalized.length === 13 && normalized.startsWith('0')) {
    const upca = normalized.slice(1)
    if (upca.length === 12) variants.add(upca)
  }
  
  return Array.from(variants)
}

// ─── Vérification du checksum ──────────────────────────────────
function computeCheckDigit(payload: number[]): number {
  let sum = 0
  let weight = 3
  for (let i = payload.length - 1; i >= 0; i--) {
    sum += payload[i] * weight
    weight = weight === 3 ? 1 : 3
  }
  return (10 - (sum % 10)) % 10
}

export function isValidChecksum(code: string): boolean {
  if (!code || !/^\d+$/.test(code)) return true
  
  let processedCode = code
  if (code.length === 12) {
    processedCode = '0' + code
  }
  
  if (![8, 13, 14].includes(processedCode.length)) return true
  
  const digits = processedCode.split('').map(Number)
  const payload = digits.slice(0, -1)
  const checkDigit = digits[digits.length - 1]
  const computed = computeCheckDigit(payload)
  
  return computed === checkDigit
}