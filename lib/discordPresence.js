/**
 * Cyberpunk presence / activity rotation for CSV Hospital Bridge.
 * Separated from Gateway connection logic.
 */

import { ActivityType } from 'discord.js'

/** Brand-fit status lines (rotated in the background). */
export const CSV_HOSPITAL_PRESENCE_ROTATION = [
  { type: ActivityType.Listening, name: 'neon grid static // csvhospital.com' },
  { type: ActivityType.Playing, name: 'CSV Hospital night shift' },
  { type: ActivityType.Watching, name: 'autonomous agent mesh' },
  { type: ActivityType.Listening, name: 'admit desk triage beeps' },
  { type: ActivityType.Competing, name: 'zero-trust perimeter checks' },
  { type: ActivityType.Playing, name: 'Freemius overlay readiness' },
  { type: ActivityType.Watching, name: 'command-channel signal traffic' },
  { type: ActivityType.Listening, name: 'privacy-first operator net' },
]

/**
 * @param {import('discord.js').Client} client
 * @param {{ intervalMs?: number, activities?: typeof CSV_HOSPITAL_PRESENCE_ROTATION }} [opts]
 * @returns {{ stop: () => void, tick: () => Promise<void> }}
 */
export function startDiscordPresenceLoop(client, opts = {}) {
  const activities = opts.activities || CSV_HOSPITAL_PRESENCE_ROTATION
  const intervalMs = Math.max(30_000, Number(opts.intervalMs) || 5 * 60_000)
  let index = 0
  let timer = null
  let stopped = false

  async function apply(activity) {
    if (stopped || !client.user) return
    try {
      await client.user.setPresence({
        status: 'online',
        activities: [
          {
            name: activity.name,
            type: activity.type,
          },
        ],
      })
      console.log('[discord:presence]', activity.name)
    } catch (error) {
      console.warn(
        '[discord:presence] setPresence failed:',
        error?.message || error,
      )
    }
  }

  async function tick() {
    if (stopped || activities.length === 0) return
    const activity = activities[index % activities.length]
    index += 1
    await apply(activity)
  }

  void tick().catch((error) => {
    console.warn('[discord:presence] initial tick failed:', error?.message || error)
  })
  timer = setInterval(() => {
    void tick().catch((error) => {
      console.warn('[discord:presence] tick failed:', error?.message || error)
    })
  }, intervalMs)
  // Keep the timer referenced so a lone bot process does not GC the presence loop.
  // Gateway sockets already keep the process alive; this is intentional for clarity.

  return {
    stop() {
      stopped = true
      if (timer) clearInterval(timer)
      timer = null
    },
    tick,
  }
}

export default startDiscordPresenceLoop
