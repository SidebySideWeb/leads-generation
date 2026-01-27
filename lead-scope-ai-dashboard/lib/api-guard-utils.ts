/**
 * API Guard Utilities (Edge Runtime Compatible)
 * 
 * Pure functions that don't require Node.js modules.
 * Safe to use in middleware.
 */

/**
 * Check if a route should bypass the guard
 * 
 * Public routes that don't require authentication:
 * - /api/webhooks/* (Stripe webhooks)
 * - /api/auth/* (Auth endpoints)
 * - /api/internal/* (Worker routes - protected by worker guard instead)
 */
export function shouldBypassGuard(pathname: string): boolean {
  return (
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/internal/') || // Worker routes use worker guard
    pathname === '/api/health' // Optional health check endpoint
  )
}
