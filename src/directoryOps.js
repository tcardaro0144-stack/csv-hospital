import { ROUTES } from './routes.js'

/**
 * Full Root Directory list — all four slots are always defined here.
 * [01] CSV Hospital (link)
 * [02] Cyber Cube Heaven (static)
 * [03] Glitched Reality (revealed — was redacted)
 * [04] [REDACTED] (locked; also featured on /2)
 */
export const DIRECTORY_OPS = [
  {
    id: 1,
    kind: 'link',
    label: 'CSV Hospital',
    status: 'ONLINE',
    statusClass: 'text-[#00ffc2]/90 group-hover:text-[#00ffc2]',
    to: ROUTES.HOSPITAL,
  },
  {
    id: 2,
    kind: 'static',
    label: 'Cyber Cube Heaven',
    status: 'IN_DEVELOPMENT',
    statusClass: 'text-amber-300',
  },
  {
    id: 3,
    kind: 'glitched',
    label: 'Glitched Reality',
    status: 'ACTIVE',
  },
  {
    id: 4,
    kind: 'redacted',
    label: '[REDACTED]',
    status: 'LOCKED',
  },
]

/** Page 1 shows slots 1–3; page 2 (/2) shows slot 4. */
export const PAGE_SIZE = 3

export function padId(id) {
  return String(id).padStart(2, '0')
}

/** Main hub: every directory slot, in order. */
export function allDirectoryOps() {
  return DIRECTORY_OPS
}

/** Page slice for / (0) and /2 (1). */
export function opsForPage(pageIndex) {
  const start = pageIndex * PAGE_SIZE
  return DIRECTORY_OPS.slice(start, start + PAGE_SIZE)
}

export function pageCount() {
  return Math.max(1, Math.ceil(DIRECTORY_OPS.length / PAGE_SIZE))
}
