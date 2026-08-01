/**
 * Slash command definitions + interaction handlers.
 * Register with: npm run discord:commands
 */

export const SLASH_COMMANDS = [
  {
    name: 'ask',
    description: 'Ask Frontline AI about Faceless Blur / CSV Hospital',
    options: [
      {
        name: 'question',
        description: 'Your question',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'frontline',
    description: 'Talk to Frontline (same as /ask)',
    options: [
      {
        name: 'message',
        description: 'What you want to say',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'bridge',
    description: 'Faceless Bridge status (Cloudflare Worker interactions)',
  },
  {
    name: 'ping',
    description: 'Check that the Discord Worker is alive',
  },
]

/**
 * @param {object} interaction Discord interaction JSON
 * @returns {string|null}
 */
export function extractAskText(interaction) {
  const name = interaction?.data?.name
  const options = interaction?.data?.options || []
  if (name === 'ask') {
    return options.find((o) => o.name === 'question')?.value || null
  }
  if (name === 'frontline') {
    return options.find((o) => o.name === 'message')?.value || null
  }
  return null
}
