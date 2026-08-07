/**
 * CSV Hospital site routes (must match live + local).
 *   /         → CSV Hospital (only product surface)
 *   /guides   → Guides index
 *   /guides/* → Guide articles
 *   /terms    → Terms of Service
 */
export const ROUTES = {
  ROOT: '/',
  /** Alias kept for older imports — same as ROOT */
  HOSPITAL: '/',
  GUIDES: '/guides',
  TERMS: '/terms',
}

export default ROUTES
