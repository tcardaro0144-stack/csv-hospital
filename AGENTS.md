# Agent instructions — CSV Hospital

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
| `lib/prompts/csvHospitalKnowledge.js` | **Authoritative** Frontline CSV Hospital knowledge base |
| `lib/prompts/frontlineBrandKnowledge.js` | Compat re-export of csvHospitalKnowledge |
| `lib/prompts/userPersona.js` | Address Tom by first name; professional tone |
| `lib/prompts/managerSystemPrompt.js` | CSV Hospital Manager ops / leadership prompt |
| `lib/prompts/guardianSystemPrompt.js` | CSV Hospital Guardian security prompt |

## Runtime wiring

- `lib/identityVerification.js` — 4-stage gauntlet (targets stay server-side)
- `lib/managerAi.js` — CSV Hospital Manager
- `lib/securityGuardian.js` — CSV Hospital Guardian
- `lib/triageAgent.js` — Frontline support triage
- `lib/frontlineFaqKnowledge.js` — injects csvHospitalKnowledge (+ optional `/knowledge`)
- `content/support-faq.md` — FAQ grounding for public chat
- `knowledge/` — supplemental Frontline markdown documents
