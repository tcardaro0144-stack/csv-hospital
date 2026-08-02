import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './components/LandingPage.jsx'
import RootDirectoryPage2 from './RootDirectoryPage2.jsx'
import CurePage from './components/CurePage.jsx'
import CyberCubeHeavenPage from './components/CyberCubeHeavenPage.jsx'
import { ROUTES } from './routes.js'

/**
 * Site routes — no automatic redirect from / to /hospital.
 *
 *   /                   → Root Directory hub page 1
 *   /2                  → Root Directory hub page 2
 *   /hospital           → CSV Hospital tool (only via explicit Link / typed URL)
 *   /cyber-cube-heaven  → Cyber Cube Heaven teaser / early access
 *   /cure               → legacy alias → /hospital
 *   *                   → back to hub (/)
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<LandingPage />} />
      <Route path={ROUTES.ROOT_PAGE_2} element={<RootDirectoryPage2 />} />
      <Route path={ROUTES.HOSPITAL} element={<CurePage />} />
      <Route path={ROUTES.CYBER_CUBE_HEAVEN} element={<CyberCubeHeavenPage />} />
      {/* Legacy path only — does NOT run on "/" */}
      <Route path="/cure" element={<Navigate to={ROUTES.HOSPITAL} replace />} />
      <Route path="*" element={<Navigate to={ROUTES.ROOT} replace />} />
    </Routes>
  )
}
