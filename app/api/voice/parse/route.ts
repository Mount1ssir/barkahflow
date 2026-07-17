// app/api/voice/parse/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-side proxy for the Groq API.
// GROQ_API_KEY never reaches the browser — it lives here only.
// Called by llm-intent-parser.ts when Gemini fails.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL   = 'llama-3.3-70b-versatile'

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
  const GROQ_KEY = process.env.GROQ_API_KEY ?? ''

  if (!GROQ_KEY) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured on the server.' },
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
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: input },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 300,
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => 'unknown')
      return NextResponse.json(
        { error: `Groq API error ${groqRes.status}: ${errText}` },
        { status: 502, headers: corsHeaders }
      )
    }

    const groqData = await groqRes.json()
    const content: string | undefined = groqData?.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'Groq returned empty content' },
        { status: 502, headers: corsHeaders }
      )
    }

    // Parse and forward the JSON object directly
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json(
        { error: `Groq content was not valid JSON: ${content}` },
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
