import RootDirectoryShell from './components/RootDirectoryShell.jsx'
import { opsForPage } from './directoryOps.js'

/**
 * Root Directory page 2 — /2 (src/RootDirectoryPage2.jsx).
 * Maps the 4th directory slot: [04] [REDACTED] LOCKED.
 */
export default function RootDirectoryPage2() {
  const ops = opsForPage(1)

  return (
    <RootDirectoryShell
      pageIndex={1}
      ops={ops}
      seoKey="directoryPage2"
      footerHint="$ scan ./ops/page_2 — [04] classified / locked"
    />
  )
}
