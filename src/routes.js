/**
 * CSV Hospital site routes (must match live + local).
 *   /                   → CSV Hospital (default)
 *   /cyber-cube-heaven  → Cyber Cube Heaven teaser / early access
 *   /hospital, /cure, /2 → legacy redirects to /
 */
export const ROUTES = {
  ROOT: '/',
  /** @deprecated Hub removed — same as ROOT */
  HOSPITAL: '/',
  CYBER_CUBE_HEAVEN: '/cyber-cube-heaven',
}

export default ROUTES
