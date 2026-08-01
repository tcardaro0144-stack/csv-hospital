# Agent instructions — Faceless Blur / CSV Hospital

Central index for Cursor agents and in-app AI (Manager, Guardian, Frontline).

## Cursor rules (this repo)

- `.cursor/rules/core-identity-security.mdc` — Zero-Trust identity & attack defenses
- `.cursor/rules/public-chat-security.mdc` — Frontline CS / brand voice

Mirrored as Cursor **User Rules** for global persistence outside this repo.

## System prompts (`lib/prompts/`)

| File | Role |
|------|------|
| `lib/prompts/coreIdentityProtocol.js` | Shared core identity + Zero-Trust protocol |
| `lib/prompts/publicChatSecurityProtocol.js` | Frontline chat / CS security protocol |
| `lib/prompts/frontlineBrandKnowledge.js` | Faceless Blur brand & product knowledge |
| `lib/prompts/userPersona.js` | Address Tom by first name; professional tone |
| `lib/prompts/managerSystemPrompt.js` | Faceless Manager ops / leadership prompt |

## Runtime wiring

- `lib/identityVerification.js` — 4-stage gauntlet (targets stay server-side)
- `lib/managerAi.js` — Faceless Manager
- `lib/securityGuardian.js` — Faceless Guardian
- `lib/triageAgent.js` — Frontline support triage
- `content/support-faq.md` — FAQ grounding for public chat
