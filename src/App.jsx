import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './components/LandingPage.jsx'
import CurePage from './components/CurePage.jsx'
import { ROUTES } from './routes.js'

/**
 * Site routes — no automatic redirect from / to /hospital.
 *
 *   /          → Root Directory hub (stays here on load)
 *   /hospital  → CSV Hospital tool (only via explicit Link / typed URL)
 *   /cure      → legacy alias → /hospital
 *   *          → back to hub (/)
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<LandingPage />} />
      <Route path={ROUTES.HOSPITAL} element={<CurePage />} />
      {/* Legacy path only — does NOT run on "/" */}
      <Route path="/cure" element={<Navigate to={ROUTES.HOSPITAL} replace />} />
      <Route path="*" element={<Navigate to={ROUTES.ROOT} replace />} />
    </Routes>
  )
}
