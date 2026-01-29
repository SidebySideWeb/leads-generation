import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { shouldBypassGuard } from './lib/api-guard-utils'
import { workerGuard, isInternalRoute } from './lib/worker-guard'

/**
 * Middleware to protect routes
 * 
 * Priority:
 * 1. Worker routes (/api/internal/*) - require X-WORKER-SECRET header
 * 2. Dashboard routes - require auth token
 * 3. API routes - protected by withGuard() in route handlers
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 1. Protect worker/internal routes first (highest priority)
  if (isInternalRoute(pathname)) {
    const guardResponse = workerGuard(request)
    if (guardResponse) {
      return guardResponse // Reject if worker secret is invalid
    }
    // Worker secret is valid, continue
    return NextResponse.next()
  }

  const token = request.cookies.get('auth-token')?.value

  // Allow access to auth routes and public API routes (webhooks, auth endpoints)
  // Note: Route groups like (auth) don't appear in URLs, so check actual paths
  if (
    shouldBypassGuard(pathname) ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // Protect dashboard routes
  // Note: Route groups like (dashboard) don't appear in URLs
  // Cookie is set by backend API (api.leadscope.gr) with domain '.leadscope.gr'
  // Allow request through - let page components handle auth check
  // This is necessary because cross-domain cookies may not be immediately available
  // The page will check auth and redirect if needed
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/datasets') || 
      pathname.startsWith('/discover') || pathname.startsWith('/exports') ||
      pathname.startsWith('/billing') || pathname.startsWith('/settings') ||
      pathname.startsWith('/cities') || pathname.startsWith('/industries') ||
      pathname.startsWith('/refresh')) {
    // Don't block here - let the page component check authentication
    // Pages will use getServerUser() which properly handles cross-domain cookies
    return NextResponse.next()
  }

  // API routes are protected by withGuard() in route handlers
  // This middleware doesn't block them - guard handles validation

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
