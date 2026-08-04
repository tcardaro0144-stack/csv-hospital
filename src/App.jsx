import { Routes, Route, Navigate } from 'react-router-dom'
import CurePage from './components/CurePage.jsx'
import TermsPage from './components/TermsPage.jsx'
import { ROUTES } from './routes.js'

/**
 * Site routes — CSV Hospital only.
 *
 *   /                   → CSV Hospital (admit / triage / discharge)
 *   /terms              → Terms of Service
 *   /hospital, /cure, /2, and other legacy paths → redirect to /
 *   *                   → /
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<CurePage />} />
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
