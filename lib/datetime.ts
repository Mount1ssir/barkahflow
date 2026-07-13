/**
 * lib/datetime.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilitaires de date/heure LOCALE (machine), utilisés partout où on doit
 * comparer "aujourd'hui" ou calculer une présence en temps réel.
 *
 * Pourquoi : `datetime('now')` en SQLite renvoie l'heure UTC, alors que
 * `new Date()` côté JS raisonne en heure locale. Mélanger les deux crée un
 * décalage égal au fuseau horaire de la machine (ex: 1h au Maroc), et peut
 * faire "disparaître" des ventes proches de minuit si le jour UTC diffère
 * du jour local. Ces fonctions produisent des timestamps locaux non
 * ambigus, et les parsent de façon cohérente.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DD HH:MM:SS" — heure locale de la machine, format natif SQLite */
export function nowLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** "YYYY-MM-DD" — jour local de la machine */
export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Parse un timestamp qu'il soit :
 *  - au format local "YYYY-MM-DD HH:MM:SS" (produit par nowLocal())
 *  - au format ISO complet avec T/Z (ancien format, ou dates générées ailleurs)
 * et renvoie toujours un epoch ms cohérent avec Date.now().
 */
export function parseFlexibleTimestamp(ts: string | null | undefined): number {
  if (!ts) return NaN
  if (ts.includes('T')) {
    return new Date(ts).getTime()
  }
  const [datePart, timePart = '00:00:00'] = ts.split(' ')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi, s] = timePart.split(':').map(Number)
  return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, Math.floor(s || 0)).getTime()
}