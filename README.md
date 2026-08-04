# CSV Hospital

Browser-native CSV diagnosis and repair — *where broken data goes to heal.* Optional **Pro** discharge downloads via Freemius overlay checkout (Stripe legacy paths may still exist).

**Production:** [https://csvhospital.com/](https://csvhospital.com/)  
**GitHub:** `tcardaro0144-stack/csv-hospital`

## Local git

| Check | Expected |
|-------|----------|
| Branch | `main` |
| Secrets | `.env` is gitignored — never commit it |
| Remote | `origin` → `https://github.com/tcardaro0144-stack/csv-hospital.git` |

```powershell
git status
git log --oneline -5
git remote -v
```

---

## Deploy overview

### Cloudflare Pages (static site)

Dashboard project slug may still be the historical Cloudflare id `facelessblur` (see `wrangler.toml` / `npm run deploy:pages`). That is a **deploy target name only**, not a product brand. Custom domain: `csvhospital.com`.

| Setting | Value |
|---------|--------|
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |

Production env map: [`.env.pages.example`](.env.pages.example).

```powershell
npm run deploy:pages
```

### Discord Interactions Worker

```powershell
npm run discord:deploy
```

### Verify production

1. Open `https://csvhospital.com/` — CSV Hospital admit / triage UI.
2. Hard-refresh or purge cache if you still see an old shell.
3. Spot-check Freemius overlay / support chat if you rely on them.

### Quick reference

| Item | Value |
|------|--------|
| GitHub | `tcardaro0144-stack/csv-hospital` |
| Cloudflare Pages project slug | `facelessblur` (historical CF id; rename in dashboard when ready) |
| Discord Worker | `csv-hospital-discord` |
| Domain | `csvhospital.com` |
| Build | `npm run build` → `dist` |

## Setup

```bash
npm install
cp .env.example .env
# Add Freemius / Stripe keys as needed
npm run dev
```

This starts:
- Vite frontend at `https://localhost:5200` (HTTPS for wallet / tunnel testing)
- Express API at `http://localhost:4242` (proxied via `/api`)

## Stripe configuration

1. Create a [Stripe account](https://dashboard.stripe.com/register).
2. For **csvhospital.com production**, use **Live mode** keys (`sk_live_...`, `pk_live_...`) and a live Price ID.
3. Go to **Products** → **Add product** → name it "CSV Hospital Pro" → set a one-time price.
4. Set `STRIPE_PRICE_ID=price_...` and `STRIPE_SECRET_KEY` / `VITE_STRIPE_PUBLISHABLE_KEY` in `.env` (or Vercel env).
5. Set `UNLOCK_SECRET` to a long random string (signs the HttpOnly unlock cookie).
6. Set `CLIENT_URL=https://csvhospital.com` in production.
7. (Optional local webhooks) Run `stripe listen --forward-to localhost:4242/api/webhook` and put the printed `whsec_...` in `STRIPE_WEBHOOK_SECRET`.
8. Restart `npm run dev` (or redeploy).

There is **no in-app test-mode / payment bypass**. Download unlock always requires a paid checkout session when Stripe is active.

### Local Stripe sandbox (development only)

When using Stripe **test** keys locally, you can pay with card `4242 4242 4242 4242`, any future expiry, any CVC.

On **csvhospital.com**, configure live Stripe keys only. There is no UI toggle or mock unlock.

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Admit & parse CSV | ✓ | ✓ |
| Automatic cleanup preview | ✓ | ✓ |
| Download discharged CSV | — | ✓ |

## Routes (live + local)

| URL | Page |
|-----|------|
| `/` | CSV Hospital (default — admit / triage / discharge) |
| `/hospital`, `/cure`, `/2`, and other legacy paths | Redirect to `/` |

### Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: `public/_redirects` (copied into `dist/`)
- HTML shell is **not cached** (`public/_headers`) so deploys aren't stuck on an old bundle

## Production deployment (Vercel)

One project hosts both the Vite frontend and Stripe API routes:

```
api/
  create-checkout-session.js   → POST /api/create-checkout-session
  verify-session.js            → GET  /api/verify-session  (sets unlock cookie)
  unlock-status.js             → GET  /api/unlock-status
  webhook.js                   → POST /api/webhook
lib/
  unlockToken.js               → HMAC cookie create/verify
```

1. Push the repo and import it in [Vercel](https://vercel.com).
2. Set env vars in the Vercel project:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_ID`
   - `UNLOCK_SECRET`
   - `STRIPE_WEBHOOK_SECRET`
   - `CLIENT_URL` = `https://your-app.vercel.app`
3. In Stripe → Developers → Webhooks, add endpoint `https://your-app.vercel.app/api/webhook` for `checkout.session.completed`.
4. Deploy. `vercel.json` builds to `dist/` and keeps `/api/*` as serverless functions.

Local `npm run dev` still uses the Express server in `server/` (proxied by Vite). Production uses `api/`.

## Freemius deployment ZIP

Build a clean upload package for Freemius Dashboard → **Deployment** → **Add New Version**:

```bash
npm run package:freemius
```

This runs `vite build`, stages deployable app files under a single `csv-hospital/` root, and writes:

`release/csv-hospital-v{version}-freemius.zip`

Automatically **excluded**: `.env` / secrets, `.git`, `.cursor`, `node_modules`, `.data` (local DB), Vite caches, logs, and other local cruft. `.env.example` is included as a template only.

```bash
npm run package:freemius -- --skip-build   # reuse existing dist/
npm run package:freemius -- --keep-staging # leave release/staging for inspection
```

## Security (Access layer)

- All secrets come from environment variables only (validated on boot / request).
- Checkout, verify, and unlock-status endpoints are rate-limited (IP via `CF-Connecting-IP` when behind Cloudflare).
- `session_id` is allowlist-validated (`cs_test_` / `cs_live_` format) before any Stripe call.
- API errors never echo secret material.

## Security (Payload layer)

- CSV uploads are capped (5 MB, 50k rows, 200 columns, 2k chars/cell).
- Binary / NUL / high-control content is rejected before parse.
- Cells are sanitized (control + zero-width chars stripped) into a fixed schema:
  `{ schema_version, fileName, headers: string[], rows: string[][] }` — no free-form blobs for AI/edge pipelines.

## Security (Perimeter layer)

- Production responses set CSP, HSTS, `X-Frame-Options`, `nosniff`, Permissions-Policy (via `vercel.json` + API wrapper).
- API responses are `Cache-Control: no-store`.
- Rate limiting uses `CF-Connecting-IP` when Cloudflare is in front.
- Architecture stays WAF/Bot-friendly: standard HTTPS paths, no custom challenge protocol.
- **Cloudflare tip:** create a WAF/Bot skip rule for `POST /api/webhook` (Stripe cannot solve JS challenges). Enable Managed WAF + Bot Management on the zone.

## Support triage (backend)

`POST /api/support-triage` with `{ "message": "..." }` returns a structured result:

- `auto_reply` — high-confidence FAQ answer (`reply`)
- `needs_human` — summary + placeholder email notification (`notification.provider: "placeholder"`)

Edit FAQ copy in `content/support-faq.md`.

- **With `AI_API_KEY` (or `OPENAI_API_KEY`):** OpenAI JSON triage grounded in the FAQ; low confidence or ungrounded answers escalate to `needs_human`.
- **Without a key:** mock FAQ keyword matcher.
- Sensitive topics (refunds, legal, fraud, etc.) always escalate.
- AI failures fall back to the mock matcher (`provider: "mock_fallback"`).
- **Email:** set `RESEND_API_KEY`, `SUPPORT_EMAIL`, and `SUPPORT_FROM_EMAIL` to forward `needs_human` to your inbox via [Resend](https://resend.com). Without them, notifications stay on the placeholder logger.

```bash
curl -X POST http://localhost:5200/api/support-triage \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"How do I download my cleaned CSV?\"}"
```

## Stack

- React + Vite + Tailwind CSS
- Freemius overlay checkout (primary); Stripe Checkout / Express for legacy paths
- Vercel serverless (`api/`) + Express for local dev
