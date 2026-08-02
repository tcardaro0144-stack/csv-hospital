import RootDirectoryShell from './RootDirectoryShell.jsx'
import { allDirectoryOps } from '../directoryOps.js'

/**
 * Home (/) — Root Directory hub.
 * Explicitly maps all 4 directory slots:
 *   [01] CSV Hospital · [02] Cyber Cube Heaven (coming soon) ·
 *   [03] Glitched Reality (ACTIVE) · [04] [REDACTED]
 */
export default function LandingPage() {
  const ops = allDirectoryOps()

  return (
    <RootDirectoryShell
      pageIndex={0}
      ops={ops}
      seoKey="home"
      footerHint="$ ls ./ops — enter [01] CSV Hospital · [02] Cyber Cube Heaven · [03] Glitched Reality ACTIVE"
    />
  )
}
