import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function generatePin(length = 6): string {
  let pin = ''
  for (let i = 0; i < length; i++) {
    pin += Math.floor(Math.random() * 10).toString()
  }
  return pin
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!RESEND_API_KEY || !SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({
        error: 'Variables manquantes',
        detail: {
          RESEND_API_KEY: !!RESEND_API_KEY,
          SUPABASE_URL: !!SUPABASE_URL,
          ANON_KEY: !!ANON_KEY,
          SERVICE_ROLE_KEY: !!SERVICE_ROLE_KEY,
        },
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Session invalide', detail: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const user = userData.user
    const email = user.email
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email introuvable' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const tempPin = generatePin(6)
    const pinHash = await hashPin(tempPin)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await adminClient
      .from('pin_reset_temp')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false)

    const { error: insertError } = await adminClient.from('pin_reset_temp').insert({
      user_id: user.id,
      pin_hash: pinHash,
      expires_at: expiresAt,
      used: false,
    })

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Erreur base de données', detail: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BarkahFlow <onboarding@resend.dev>',
        to: [email],
        subject: 'BarkahFlow - Votre code PIN temporaire',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#c9a84c;">BarkahFlow</h2>
            <p>Voici votre code PIN temporaire :</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; background:#f4f4f4; padding: 16px; border-radius: 12px;">${tempPin}</p>
            <p>Ce code est valable <strong>15 minutes</strong> et ne peut être utilisé qu'une seule fois.</p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      return new Response(JSON.stringify({ error: 'Erreur envoi email', detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Erreur serveur',
      detail: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})