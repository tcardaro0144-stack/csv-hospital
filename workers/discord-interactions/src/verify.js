/**
 * Discord request signature verification via DISCORD_PUBLIC_KEY (env).
 * Uses discord-interactions verifyKey — no hand-rolled Ed25519.
 */

import { verifyKey } from 'discord-interactions'

/**
 * @param {Request} request
 * @param {string} publicKey Hex public key from Discord Developer Portal
 * @returns {Promise<{ ok: true, body: string } | { ok: false, response: Response }>}
 */
export async function verifyDiscordInteraction(request, publicKey) {
  if (!publicKey || typeof publicKey !== 'string') {
    return {
      ok: false,
      response: new Response('DISCORD_PUBLIC_KEY is not configured on this Worker.', {
        status: 500,
      }),
    }
  }

  const signature = request.headers.get('X-Signature-Ed25519')
  const timestamp = request.headers.get('X-Signature-Timestamp')
  if (!signature || !timestamp) {
    return {
      ok: false,
      response: new Response('Missing signature headers.', { status: 401 }),
    }
  }

  const body = await request.text()
  const valid = await verifyKey(body, signature, timestamp, publicKey.trim())
  if (!valid) {
    return {
      ok: false,
      response: new Response('Bad request signature.', { status: 401 }),
    }
  }

  return { ok: true, body }
}
