import { Routes, Route, Navigate } from 'react-router-dom'
import CurePage from './components/CurePage.jsx'
import CyberCubeHeavenPage from './components/CyberCubeHeavenPage.jsx'
import { ROUTES } from './routes.js'

/**
 * Site routes — CSV Hospital is the default view at /.
 *
 *   /                   → CSV Hospital (admit / triage / discharge)
 *   /hospital, /cure    → redirect to /
 *   /2                  → redirect to / (legacy hub removed)
 *   /cyber-cube-heaven  → Cyber Cube Heaven teaser
 *   *                   → /
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<CurePage />} />
      <Route path={ROUTES.CYBER_CUBE_HEAVEN} element={<CyberCubeHeavenPage />} />
      {/* Legacy hub / hospital paths → root CSV Hospital */}
      <Route path="/hospital" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="/hospital/*" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="/cure" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="/2" element={<Navigate to={ROUTES.ROOT} replace />} />
      <Route path="*" element={<Navigate to={ROUTES.ROOT} replace />} />
    </Routes>
  )
}
