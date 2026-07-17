// lib/voice/llm-intent-parser.ts
// ─────────────────────────────────────────────────────────────────────────────
// Calls Gemini directly via the server-side proxy (/api/voice/parse) as the
// primary and only online API.
// Includes a generous 15-second timeout and robust response validation.
// ─────────────────────────────────────────────────────────────────────────────

import type { ParsedCommand, Intent } from './voice-types'
import { buildSystemPrompt } from './llm-schema'

// ── Constants ──────────────────────────────────────────────────────────────
const GEMINI_PROXY_ENDPOINT = '/api/voice/parse' // Next.js API route (server-side)
const REQUEST_TIMEOUT_MS  = 15000              // 15-second hard timeout for the online request

// ── LLM Response shape before we attach originalText ──────────────────────
interface LLMRawResponse {
  intent: Intent
  entities: Array<{ type: string; value: string }>
  confidence: number
  requiresConfirmation: boolean
}

// ── Utility: race a promise against a timeout ──────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[llm-parser] ${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

// ── Validation guard ───────────────────────────────────────────────────────
// Ensures the LLM returned a structurally valid and sufficiently confident object.
function isValidLLMResponse(obj: unknown): obj is LLMRawResponse {
  if (!obj || typeof obj !== 'object') return false
  const r = obj as Record<string, unknown>
  return (
    typeof r.intent === 'string' &&
    r.intent.length > 0 &&
    Array.isArray(r.entities) &&
    typeof r.confidence === 'number' &&
    r.confidence >= 0.5 &&          // Reject low-confidence results
    typeof r.requiresConfirmation === 'boolean'
  )
}

// ── Gemini via server-side proxy ─────────────────────────────────────────────
// The actual GEMINI_API_KEY lives server-side inside /api/voice/parse/route.ts.
// This function sends the user input + system prompt to that internal route.
async function callGeminiProxy(
  input: string,
  systemPrompt: string
): Promise<LLMRawResponse> {
  let origin = ''
  if (typeof window !== 'undefined') {
    const o = window.location.origin
    // If it's a standard browser origin, use it to ensure relative calls resolve locally
    if (o && !o.startsWith('tauri:') && !o.startsWith('capacitor:') && !o.startsWith('file:')) {
      origin = o
    }
  }
  if (!origin) {
    origin = process.env.NEXT_PUBLIC_API_URL ?? ''
  }

  const endpoint = origin ? `${origin.replace(/\/$/, '')}${GEMINI_PROXY_ENDPOINT}` : GEMINI_PROXY_ENDPOINT

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, systemPrompt }),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'unknown error')
    throw new Error(`[llm-parser] Gemini proxy HTTP ${res.status}: ${errorText}`)
  }

  const parsed: unknown = await res.json()

  if (!isValidLLMResponse(parsed)) {
    throw new Error('[llm-parser] Gemini proxy response failed validation')
  }

  return parsed
}

// ── Public API ─────────────────────────────────────────────────────────────
/**
 * Parses a user command using the Gemini online API.
 * Returns a full ParsedCommand or throws if the provider fails or times out.
 * The caller (voice-orchestrator.ts) handles the throw by routing to the offline fallback.
 */
export async function parseCommandWithLLM(
  input: string,
  currentPath?: string
): Promise<ParsedCommand> {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('[llm-parser] Empty input')

  const systemPrompt = buildSystemPrompt(currentPath)

  try {
    const raw = await withTimeout(
      callGeminiProxy(trimmed, systemPrompt),
      REQUEST_TIMEOUT_MS,
      'Gemini'
    )
    console.info('[llm-parser] ✅ Gemini succeeded')
    return {
      intent: raw.intent,
      entities: raw.entities.map(e => ({ type: e.type as any, value: e.value })),
      confidence: raw.confidence,
      requiresConfirmation: raw.requiresConfirmation,
      originalText: input,
    }
  } catch (geminiErr) {
    console.warn('[llm-parser] ⚠️ Gemini failed:', geminiErr)
    throw geminiErr
  }
}
