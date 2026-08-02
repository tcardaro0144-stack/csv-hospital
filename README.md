# CSV Hospital

Browser-native CSV diagnosis and repair by **Faceless Blur** — *where broken data goes to heal.* Optional **Pro** discharge downloads via Stripe Checkout.

**Local path:** `C:\Users\tomca\facelessblur` (site repo; split from `table-fixer`).  
**Ops / Video-Pipeline:** still at `C:\Users\tomca\table-fixer`.

## Local git status (already done)

This folder is already a git repo on branch `main`:

| Check | Expected |
|-------|----------|
| Path | `C:\Users\tomca\facelessblur` |
| Branch | `main` |
| Secrets | `.env` is gitignored — never commit it |
| Remote | `origin` → `https://github.com/tcardaro0144-stack/facelessblur.git` |

Verify anytime:

```powershell
cd C:\Users\tomca\facelessblur
git status
git log --oneline -5
git remote -v
```

---

## Step-by-step: Push to GitHub + link Cloudflare Pages

Follow these in order. Do **not** delete `C:\Users\tomca\table-fixer` until step 6 succeeds.

### 1) Confirm the local commit is ready

```powershell
cd C:\Users\tomca\facelessblur
git status
# Expect: "On branch main" / "nothing to commit, working tree clean"
# If you changed files: git add -A && git status  (confirm .env is NOT listed)
# Then commit:
#   git -c user.name="Tom" -c user.email="tom@facelessblur.com" commit -m "Your message"
```

Set your real git identity once (optional, global):

```powershell
git config --global user.name "Tom"
git config --global user.email "your-email@example.com"
```

### 2) Create the GitHub repository and push

**Option A — GitHub CLI (recommended)**

1. Install [GitHub CLI](https://cli.github.com/) if missing, then open a **new** PowerShell.
2. Run:

```powershell
cd C:\Users\tomca\facelessblur
gh auth login
# Follow prompts: GitHub.com → HTTPS → login via browser

gh repo create facelessblur --private --source=. --remote=origin --push
# Creates github.com/<you>/facelessblur, sets origin, pushes main
```

**Option B — GitHub website (no `gh`)**

1. Go to [https://github.com/new](https://github.com/new).
2. Repository name: `facelessblur` · **Private** · **do not** add README / .gitignore / license (repo already has files).
3. Create repository, then:

```powershell
cd C:\Users\tomca\facelessblur
git remote add origin https://github.com/YOUR_USER/facelessblur.git
git push -u origin main
```

Replace `YOUR_USER` with your GitHub username or org.

### 3) Confirm the push

```powershell
git remote -v
git status
# Expect: "Your branch is up to date with 'origin/main'"
```

Open the repo on GitHub and confirm `README.md`, `src/`, `wrangler.toml` are present and `.env` is **absent**.

### 4) Link the repo to Cloudflare Pages (`csv-hospital` / facelessblur.com)

Production already uses Cloudflare Pages (see `wrangler.toml`: project name `csv-hospital`, output `dist`).

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Pages**.
2. Open the existing project **`csv-hospital`** (custom domain `facelessblur.com`).
3. Go to **Settings** → **Builds & deployments** (wording may be “Build configuration” / “Source”).
4. **Connect / change Git repository** to the new GitHub repo `facelessblur` (authorize Cloudflare’s GitHub app if prompted).
5. Set build settings:

| Setting | Value |
|---------|--------|
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (repo root) |

6. **Settings → Environment variables** (Production): keep / set live values, including at least:
   - `CLIENT_URL` = `https://facelessblur.com`
   - Live Freemius / Stripe / unlock / AI / Discord secrets as you use today  
   Never paste these into git.

7. Save, then **Deployments → Retry deployment** (or push an empty commit / “Create deployment” from `main`).

### 5) Discord Interactions Worker (if used)

Separate from Pages. From this repo:

```powershell
cd C:\Users\tomca\facelessblur
npm run discord:deploy
```

Only after Pages is healthy, if the Worker should stay on the same Cloudflare account.

### 6) Verify production

1. Open `https://facelessblur.com/` — hub / landing loads.
2. Open `https://facelessblur.com/hospital` — CSV Hospital tool loads.
3. Hard-refresh or purge cache if you still see an old shell (**Caching → Configuration → Purge Everything**).
4. Spot-check Freemius overlay / support chat if you rely on them.

Only after this passes may you treat `table-fixer` as ops-only (Video-Pipeline) and optionally rename it later.

### Quick reference

| Item | Value |
|------|--------|
| Local repo | `C:\Users\tomca\facelessblur` |
| Suggested GitHub name | `facelessblur` (private) |
| Cloudflare Pages project | `csv-hospital` |
| Domain | `facelessblur.com` |
| Build | `npm run build` → `dist` |
| Ops / YouTube pipeline | `C:\Users\tomca\table-fixer` |

## Setup

```bash
npm install
cp .env.example .env
# Add Stripe live keys for production (or Stripe test keys for local only)
npm run dev
```

This starts:
- Vite frontend at `https://localhost:5200` (HTTPS for wallet / tunnel testing)
- Express API at `http://localhost:4242` (proxied via `/api`)

## Stripe configuration

1. Create a [Stripe account](https://dashboard.stripe.com/register).
2. For **facelessblur.com production**, use **Live mode** keys (`sk_live_...`, `pk_live_...`) and a live Price ID.
3. Go to **Products** → **Add product** → name it "CSV Hospital Pro" → set a one-time price.
4. Set `STRIPE_PRICE_ID=price_...` and `STRIPE_SECRET_KEY` / `VITE_STRIPE_PUBLISHABLE_KEY` in `.env` (or Vercel env).
5. Set `UNLOCK_SECRET` to a long random string (signs the HttpOnly unlock cookie).
6. Set `CLIENT_URL=https://facelessblur.com` in production.
7. (Optional local webhooks) Run `stripe listen --forward-to localhost:4242/api/webhook` and put the printed `whsec_...` in `STRIPE_WEBHOOK_SECRET`.
8. Restart `npm run dev` (or redeploy).

There is **no in-app test-mode / payment bypass**. Download unlock always requires a paid Stripe Checkout Session.

### Local Stripe sandbox (development only)

When using Stripe **test** keys locally, you can pay with card `4242 4242 4242 4242`, any future expiry, any CVC.

On **facelessblur.com**, configure live Stripe keys only. There is no UI toggle or mock unlock.

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Admit & parse CSV | ✓ | ✓ |
| Automatic cleanup preview | ✓ | ✓ |
| Download discharged CSV | — | ✓ |

## Routes (live + local)

| URL | Page |
|-----|------|
| `/` | Root Directory hub (primary landing) |
| `/hospital` | CSV Hospital tool |
| `/cure` | Redirects to `/hospital` |

### Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: `public/_redirects` (copied into `dist/`)
- HTML shell is **not cached** (`public/_headers`) so deploys aren't stuck on an old hospital-only bundle

If production still opens the hospital tool on `/`, check Cloudflare **Redirect Rules / Bulk Redirects / Page Rules** for a rule sending `/` → `/hospital`, then purge cache (**Caching → Configuration → Purge Everything**) and redeploy.

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
- Stripe Checkout Elements / Express Checkout
- Vercel serverless (`api/`) + Express for local dev
