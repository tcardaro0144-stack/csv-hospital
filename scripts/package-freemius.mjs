#!/usr/bin/env node
/**
 * Package CSV Hospital into a Freemius-ready ZIP.
 *
 * - Builds the Vite frontend (unless --skip-build)
 * - Stages an app root folder with deployable sources + dist/
 * - Excludes secrets, git, caches, local DBs, and tooling cruft
 * - Zips via `tar -a` (Windows/macOS/Linux) so the archive has a single root folder
 *
 * Usage:
 *   npm run package:freemius
 *   npm run package:freemius -- --skip-build
 *   npm run package:freemius -- --keep-staging
 *
 * Upload the ZIP from Freemius Dashboard → Deployment → Add New Version.
 */

import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const VERSION = String(PKG.version || '0.0.0')
const APP_SLUG = 'csv-hospital'

const args = new Set(process.argv.slice(2))
const SKIP_BUILD = args.has('--skip-build')
const KEEP_STAGING = args.has('--keep-staging')

const RELEASE_DIR = join(ROOT, 'release')
const STAGING_ROOT = join(RELEASE_DIR, 'staging')
const STAGING_APP = join(STAGING_ROOT, APP_SLUG)
const ZIP_NAME = `${APP_SLUG}-v${VERSION}-freemius.zip`
const ZIP_PATH = join(RELEASE_DIR, ZIP_NAME)

/** Top-level paths to copy when present. */
const INCLUDE_TOP = [
  'api',
  'content',
  'lib',
  'public',
  'server',
  'src',
  'dist',
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'vercel.json',
  'wrangler.toml',
  'README.md',
  '.env.example',
]

/**
 * Path segments / patterns that must never enter the Freemius zip.
 * Matched against relative posix-ish paths and basenames.
 */
const EXCLUDE_NAMES = new Set([
  '.git',
  '.gitignore',
  '.gitattributes',
  '.cursor',
  '.vscode',
  '.idea',
  '.data',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  'node_modules',
  'coverage',
  '.nyc_output',
  '.turbo',
  '.cache',
  '.parcel-cache',
  '.vite',
  'release',
  'tmp',
  'temp',
  'Thumbs.db',
  '.DS_Store',
  'desktop.ini',
])

const EXCLUDE_FILE_REGEX = [
  /^\.env(\..+)?$/i, // any .env* except we allow .env.example via special-case
  /\.local$/i,
  /\.(db|sqlite|sqlite3)$/i,
  /\.(log|tmp|bak|swp)$/i,
  /^npm-debug\.log/i,
  /^yarn-error\.log/i,
  /^tmp-/i,
]

const EXCLUDE_PATH_REGEX = [
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.cursor(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.data(\/|$)/,
  /(^|\/)release(\/|$)/,
  /(^|\/)\.vite(\/|$)/,
  /(^|\/)agent-transcripts(\/|$)/,
  /(^|\/)terminals(\/|$)/,
]

function toPosix(p) {
  return p.split(sep).join('/')
}

function shouldExclude(relPath, name) {
  const posix = toPosix(relPath)
  const base = name || basename(posix)

  // Allow the safe example env file only
  if (base === '.env.example') return false
  if (EXCLUDE_NAMES.has(base)) return true
  if (EXCLUDE_FILE_REGEX.some((re) => re.test(base))) return true
  if (EXCLUDE_PATH_REGEX.some((re) => re.test(posix))) return true
  return false
}

function ensureCleanDir(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}

function copyFiltered(src, dest, relBase = '') {
  const name = basename(src)
  const rel = relBase ? join(relBase, name) : name
  if (shouldExclude(rel, name)) return { copied: 0, skipped: 1 }

  const st = statSync(src)
  if (st.isDirectory()) {
    mkdirSync(dest, { recursive: true })
    let copied = 0
    let skipped = 0
    for (const entry of readdirSync(src)) {
      const r = copyFiltered(join(src, entry), join(dest, entry), rel)
      copied += r.copied
      skipped += r.skipped
    }
    return { copied, skipped }
  }

  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest)
  return { copied: 1, skipped: 0 }
}

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    env: process.env,
    ...opts,
  })
  if (result.error) {
    throw new Error(`Command error: ${result.error.message} (${cmd})`)
  }
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${cmdArgs.join(' ')}`)
  }
}

function runNpm(scriptArgs) {
  // Prefer the local vite binary so Windows doesn't need npm.cmd + shell.
  if (scriptArgs[0] === 'run' && scriptArgs[1] === 'build') {
    const viteJs = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
    if (existsSync(viteJs)) {
      run(process.execPath, [viteJs, 'build'])
      return
    }
  }
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  run(npmCmd, scriptArgs, { shell: process.platform === 'win32' })
}

function findTar() {
  const candidates = process.platform === 'win32' ? ['tar.exe', 'tar'] : ['tar']
  for (const bin of candidates) {
    const probe = spawnSync(bin, ['--version'], { encoding: 'utf8' })
    if (probe.status === 0) return bin
  }
  return null
}

function assertNoSecretsInStaging() {
  const offenders = []
  function walk(dir, rel = '') {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry)
      const r = rel ? `${rel}/${entry}` : entry
      const st = statSync(abs)
      if (st.isDirectory()) {
        if (shouldExclude(r, entry) && entry !== '.env.example') {
          offenders.push(r)
          continue
        }
        walk(abs, r)
      } else if (shouldExclude(r, entry) && entry !== '.env.example') {
        offenders.push(r)
      } else if (/^\.env$/i.test(entry) || /^\.env\.(local|production|development)$/i.test(entry)) {
        offenders.push(r)
      }
    }
  }
  walk(STAGING_APP)
  if (offenders.length) {
    throw new Error(
      `Refusing to zip — sensitive/excluded paths found in staging:\n  - ${offenders.join('\n  - ')}`,
    )
  }
}

function writePackageManifest(stats) {
  const manifest = {
    name: APP_SLUG,
    version: VERSION,
    builtAt: new Date().toISOString(),
    mode: 'freemius-deployment',
    includesDist: existsSync(join(STAGING_APP, 'dist')),
    fileCount: stats.copied,
    notes: [
      'Do not put real .env secrets in this archive.',
      'Configure FREEMIUS_* / Stripe / Discord env vars on the host (Vercel/etc).',
      'Upload via Freemius Dashboard → Deployment → Add New Version.',
    ],
  }
  writeFileSync(join(STAGING_APP, 'FREEMIUS_PACKAGE.json'), JSON.stringify(manifest, null, 2))
}

function main() {
  console.log(`[package:freemius] CSV Hospital v${VERSION}`)

  if (!SKIP_BUILD) {
    console.log('[package:freemius] Building frontend (vite build)…')
    runNpm(['run', 'build'])
  } else if (!existsSync(join(ROOT, 'dist'))) {
    throw new Error('dist/ missing. Run without --skip-build, or npm run build first.')
  }

  console.log('[package:freemius] Staging clean app tree…')
  ensureCleanDir(STAGING_ROOT)
  mkdirSync(STAGING_APP, { recursive: true })

  let copied = 0
  let skipped = 0
  for (const item of INCLUDE_TOP) {
    const src = join(ROOT, item)
    if (!existsSync(src)) {
      console.warn(`[package:freemius] skip missing: ${item}`)
      continue
    }
    const r = copyFiltered(src, join(STAGING_APP, item))
    copied += r.copied
    skipped += r.skipped
  }

  writePackageManifest({ copied })
  assertNoSecretsInStaging()

  const tarBin = findTar()
  if (!tarBin) {
    throw new Error(
      'tar not found. Install system tar (Windows 10+ includes it) to create the Freemius ZIP.',
    )
  }

  mkdirSync(RELEASE_DIR, { recursive: true })
  rmSync(ZIP_PATH, { force: true })

  console.log(`[package:freemius] Creating ${ZIP_NAME}…`)
  // -a auto-compress by extension (.zip); -C so archive root is csv-hospital/
  run(tarBin, ['-a', '-c', '-f', ZIP_PATH, '-C', STAGING_ROOT, APP_SLUG])

  const zipStat = statSync(ZIP_PATH)
  const sizeMb = (zipStat.size / (1024 * 1024)).toFixed(2)

  if (!KEEP_STAGING) {
    rmSync(STAGING_ROOT, { recursive: true, force: true })
  }

  console.log('')
  console.log('[package:freemius] Done')
  console.log(`  ZIP:    ${relative(ROOT, ZIP_PATH)}`)
  console.log(`  Size:   ${sizeMb} MB`)
  console.log(`  Files:  ${copied} copied · ${skipped} skipped by exclude rules`)
  console.log('  Upload: Freemius Dashboard → Deployment → Add New Version')
}

try {
  main()
} catch (err) {
  console.error('[package:freemius]', err.message || err)
  process.exit(1)
}
