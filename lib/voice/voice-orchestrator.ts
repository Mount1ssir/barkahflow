// lib/voice/voice-orchestrator.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single entry point for the voice pipeline.
// Decides whether to route to the LLM (online) or the Fuse.js fallback (offline).
// voice-executor.ts and voice-feedback.ts receive the same ParsedCommand
// regardless of which engine produced it.
// ─────────────────────────────────────────────────────────────────────────────

import type { ParsedCommand } from './voice-types'
import { parseCommandWithLLM } from './llm-intent-parser'
import { parseCommandOffline } from './offline-fallback'

// ── Types ──────────────────────────────────────────────────────────────────
export type ParseSource = 'llm' | 'offline-fallback' | 'none'

export interface OrchestratorResult {
  /** The parsed command, or null if no intent could be determined. */
  command: ParsedCommand | null
  /** Which engine produced the result — useful for UI badges and logging. */
  source: ParseSource
}

// ── Network check ──────────────────────────────────────────────────────────
// navigator.onLine is reliable for hard disconnections (airplane mode, no cable).
// Subtle cases (connected to router but no internet) are caught by the LLM try/catch below.
function isNetworkAvailable(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}

// ── Main orchestrator ──────────────────────────────────────────────────────
/**
 * Orchestrates intent parsing for a given user input:
 *
 *  Online  → parseCommandWithLLM (Gemini → Groq cascade)
 *    └─ on LLM error → parseCommandOffline (Fuse.js limited mode)
 *
 *  Offline → parseCommandOffline directly
 *
 * @param input       The raw user utterance (voice transcript or typed text)
 * @param currentPath The current window.location.pathname for context disambiguation
 */
export async function orchestrateCommand(
  input: string,
  currentPath?: string
): Promise<OrchestratorResult> {
  const trimmed = input.trim()
  if (!trimmed) return { command: null, source: 'none' }

  // ── Path A: Online — try LLM first ────────────────────────────────────────
  if (isNetworkAvailable()) {
    try {
      const command = await parseCommandWithLLM(trimmed, currentPath)
      return { command, source: 'llm' }
    } catch (llmErr) {
      // LLM failed (timeout, rate limit, network glitch despite navigator.onLine).
      // Gracefully degrade to offline fallback rather than surfacing an error.
      console.warn(
        '[orchestrator] LLM pipeline failed, degrading to offline fallback:',
        llmErr
      )
    }
  }

  // ── Path B: Offline (or LLM error recovery) ───────────────────────────────
  const command = parseCommandOffline(trimmed, currentPath)
  return {
    command,
    source: command ? 'offline-fallback' : 'none',
  }
}
