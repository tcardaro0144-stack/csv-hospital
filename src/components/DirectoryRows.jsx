import { Link } from 'react-router-dom'
import { padId } from '../directoryOps.js'

export function RedactedRow({ op }) {
  const id = op.id
  const status = op.status
  const label = op.label || '[REDACTED]'

  return (
    <div
      className={`fb-body fb-status fb-redact-row flex flex-col gap-1 px-2 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 ${
        id === 4 ? 'fb-redact-row--fourth' : ''
      }`}
      aria-disabled="true"
      data-redaction={id}
      tabIndex={id === 4 ? 0 : undefined}
    >
      <span className="text-gray-200">
        [{padId(id)}]{' '}
        <span className="fb-redact-bars" data-text={label}>
          {label}
        </span>
      </span>
      <span className="text-gray-300">[STATUS: {status}]</span>
    </div>
  )
}

/** Slot [03] — always paint the Glitched Reality name (no redaction bars). */
export function GlitchedRealityRow({ op }) {
  const name = op.label || 'Glitched Reality'

  return (
    <div
      className="fb-body fb-glitch-row flex flex-col gap-1 border border-transparent px-2 py-2 transition hover:border-[#00ffc2]/50 hover:bg-[#00ffc2]/5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
      aria-disabled="true"
      data-codename={name}
      data-slot="03"
      tabIndex={0}
      role="listitem"
    >
      <span className="fb-glitch-text font-semibold text-[#00ffc2]">
        [{padId(op.id)}]{' '}
        <span className="fb-glitch-label" data-text={name}>
          {name}
        </span>
      </span>
      <span className="text-[#00ffc2]/80">[STATUS: {op.status || 'ACTIVE'}]</span>
    </div>
  )
}

export function DirectoryRow({ op }) {
  if (!op) return null

  if (op.kind === 'link') {
    return (
      <Link
        to={op.to}
        className="fb-body group flex flex-col gap-1 border border-transparent px-2 py-2 transition hover:border-[#00ffc2] hover:bg-[#00ffc2]/5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
      >
        <span className="font-semibold text-[#00ffc2] group-hover:underline">
          [{padId(op.id)}] {op.label}
        </span>
        <span className={op.statusClass}>[STATUS: {op.status}]</span>
      </Link>
    )
  }

  if (op.kind === 'static') {
    return (
      <div
        className="fb-body fb-status flex flex-col gap-1 px-2 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        aria-disabled="true"
      >
        <span className="text-gray-200">
          [{padId(op.id)}] {op.label}
        </span>
        <span className={op.statusClass}>[STATUS: {op.status}]</span>
      </div>
    )
  }

  // Slot 3 / glitched — force Glitched Reality row even if kind is mistyped
  if (op.kind === 'glitched' || op.id === 3 || op.label === 'Glitched Reality') {
    return <GlitchedRealityRow op={op} />
  }

  if (op.kind === 'redacted') {
    return <RedactedRow op={op} />
  }

  return <RedactedRow op={op} />
}
