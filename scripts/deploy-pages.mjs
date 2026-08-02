#!/usr/bin/env node
/**
 * Standalone Cloudflare Pages deploy for facelessblur.
 *
 * Usage:
 *   npm run deploy:pages
 *   node scripts/deploy-pages.mjs
 *   node scripts/deploy-pages.mjs --skip-build
 *
 * Requires:
 *   CLOUDFLARE_API_TOKEN  (Account → Cloudflare Pages:Edit + Workers AI if used)
 *   CLOUDFLARE_ACCOUNT_ID (optional if set in wrangler.toml)
 *
 * Deploys ./dist to Pages project `facelessblur` (static assets only).
 * Do not add a repo-root /functions directory — Pages must stay function-free.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const skipBuild = process.argv.includes('--skip-build')

function loadDotEnv() {
  const path = join(root, '.env')
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  const result = spawnSync(cmd, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

loadDotEnv()

const token =
  process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || ''
if (!token.trim()) {
  console.error(
    '[deploy:pages] CLOUDFLARE_API_TOKEN is required in the environment or .env\n' +
      '  Token needs: Account → Cloudflare Pages → Edit\n' +
      '  Create at: https://dash.cloudflare.com/profile/api-tokens',
  )
  process.exit(1)
}
process.env.CLOUDFLARE_API_TOKEN = token.trim()

if (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID) {
  process.env.CLOUDFLARE_ACCOUNT_ID = (
    process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID
  ).trim()
}

if (!skipBuild) {
  run('npm', ['run', 'build'])
}

const dist = join(root, 'dist')
if (!existsSync(join(dist, 'index.html'))) {
  console.error('[deploy:pages] dist/index.html missing — build failed?')
  process.exit(1)
}

run('npx', [
  'wrangler',
  'pages',
  'deploy',
  'dist',
  '--project-name=facelessblur',
  '--branch=main',
  '--commit-dirty=true',
])

console.log('[deploy:pages] Done — project facelessblur')
console.log('  Verify: https://facelessblur.com/ (after domain is attached)')
console.log('  Env map: .env.pages.example')
