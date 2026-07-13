// lib/scan-validator.ts

import { normalizeBarcode } from './barcode-utils'

interface PendingScan {
  barcode: string
  normalized: string
  count: number
  firstSeen: number
  lastSeen: number
}

const pendingScans = new Map<string, PendingScan>()
const REQUIRED_COUNT = 3
const SCAN_TIMEOUT = 800 // 800ms max pour 3 scans

export function processScan(rawBarcode: string): {
  validated: boolean
  barcode: string
  normalized: string
  count: number
  elapsed: number
  needsMoreScans: boolean
} {
  const normalized = normalizeBarcode(rawBarcode)
  if (!normalized) {
    return {
      validated: false,
      barcode: rawBarcode,
      normalized: '',
      count: 0,
      elapsed: 0,
      needsMoreScans: false
    }
  }
  
  const now = Date.now()
  const existing = pendingScans.get(normalized)
  
  if (existing) {
    existing.count += 1
    existing.lastSeen = now
    existing.barcode = rawBarcode
    
    // ✅ VALIDÉ ! Dès que 3 scans identiques sont reçus
    if (existing.count >= REQUIRED_COUNT) {
      const elapsed = now - existing.firstSeen
      pendingScans.delete(normalized)
      
      console.log(`✅ Scan validé en ${elapsed}ms (${REQUIRED_COUNT} scans)`)
      
      return {
        validated: true,
        barcode: existing.barcode,
        normalized,
        count: existing.count,
        elapsed,
        needsMoreScans: false
      }
    }
    
    console.log(`⏳ Scan #${existing.count}/${REQUIRED_COUNT} pour:`, normalized)
    
    return {
      validated: false,
      barcode: existing.barcode,
      normalized,
      count: existing.count,
      elapsed: now - existing.firstSeen,
      needsMoreScans: true
    }
  } else {
    // Premier scan
    const newScan: PendingScan = {
      barcode: rawBarcode,
      normalized,
      count: 1,
      firstSeen: now,
      lastSeen: now
    }
    
    pendingScans.set(normalized, newScan)
    
    // Nettoyage automatique après 800ms
    setTimeout(() => {
      const scan = pendingScans.get(normalized)
      if (scan && scan.count < REQUIRED_COUNT) {
        console.log(`⏰ Timeout: scan abandonné pour:`, normalized)
        pendingScans.delete(normalized)
      }
    }, SCAN_TIMEOUT)
    
    console.log(`📸 Premier scan pour:`, normalized)
    
    return {
      validated: false,
      barcode: rawBarcode,
      normalized,
      count: 1,
      elapsed: 0,
      needsMoreScans: true
    }
  }
}

export function clearPendingScans(): void {
  pendingScans.clear()
  console.log('🧹 Scans en attente nettoyés')
}

export function getPendingScans(): Array<{
  barcode: string
  normalized: string
  count: number
  progress: number
}> {
  const results: Array<{
    barcode: string
    normalized: string
    count: number
    progress: number
  }> = []
  
  for (const [_, scan] of pendingScans) {
    results.push({
      barcode: scan.barcode,
      normalized: scan.normalized,
      count: scan.count,
      progress: scan.count / REQUIRED_COUNT
    })
  }
  
  return results
}