// app/api/voice/parse/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-side proxy for the Gemini API.
// GEMINI_API_KEY never reaches the browser — it lives here.
// Called by llm-intent-parser.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { PARSED_COMMAND_SCHEMA } from '@/lib/voice/llm-schema'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY || ''

  if (!GEMINI_KEY) {
    return NextResponse.json(
      { error: 'Gemini API key is not configured on the server.' },
      { status: 503, headers: corsHeaders }
    )
  }

  let body: { input: string; systemPrompt: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders }
    )
  }

  const { input, systemPrompt } = body
  if (!input || !systemPrompt) {
    return NextResponse.json(
      { error: 'Missing required fields: input, systemPrompt' },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: input }] }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: PARSED_COMMAND_SCHEMA,
          temperature: 0.1,
        },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => 'unknown')
      return NextResponse.json(
        { error: `Gemini API error ${geminiRes.status}: ${errText}` },
        { status: 502, headers: corsHeaders }
      )
    }

    const geminiData = await geminiRes.json()
    const content: string | undefined = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      return NextResponse.json(
        { error: 'Gemini returned empty content' },
        { status: 502, headers: corsHeaders }
      )
    }

    // Parse and forward the JSON object directly
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json(
        { error: `Gemini content was not valid JSON: ${content}` },
        { status: 502, headers: corsHeaders }
      )
    }

    return NextResponse.json(parsed, { headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Server error: ${message}` },
      { status: 500, headers: corsHeaders }
    )
  }
}
