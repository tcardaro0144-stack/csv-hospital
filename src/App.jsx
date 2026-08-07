import { Routes, Route, Navigate } from 'react-router-dom'
import CurePage from './components/CurePage.jsx'
import TermsPage from './components/TermsPage.jsx'
import GuidesIndexPage from './components/GuidesIndexPage.jsx'
import GuideArticlePage from './components/GuideArticlePage.jsx'
import { ROUTES } from './routes.js'

/**
 * Site routes — CSV Hospital only.
 *
 *   /                   → CSV Hospital (admit / triage / discharge)
 *   /guides             → Guides index
 *   /guides/:slug       → Guide article
 *   /terms              → Terms of Service
 *   /hospital, /cure, /2, and other legacy paths → redirect to /
 *   *                   → /
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<CurePage />} />
      <Route path={ROUTES.GUIDES} element={<GuidesIndexPage />} />
      <Route path={`${ROUTES.GUIDES}/:slug`} element={<GuideArticlePage />} />
      <Route path={ROUTES.TERMS} element={<TermsPage />} />
      <Route path="/hospital" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="/hospital/*" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="/cure" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="/2" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="/cyber-cube-heaven" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="/cyber-cube-heaven/*" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="*" element={<Navigate to={ROUTES.ROOT} replace />} />
    </Routes>
  )
}
