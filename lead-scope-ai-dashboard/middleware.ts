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
  const hostname = request.nextUrl.hostname

  // Handle Vercel redirect: leadscope.gr -> www.leadscope.gr
  // This prevents cookie issues and redirect loops
  // Cookie is set with domain '.leadscope.gr' which works for both, but we want consistency
  if (hostname === 'leadscope.gr') {
    const url = request.nextUrl.clone()
    url.hostname = 'www.leadscope.gr'
    console.log(`[Middleware] Redirecting ${hostname} to www.leadscope.gr for ${pathname}`)
    return NextResponse.redirect(url, 301) // Permanent redirect
  }

  // 1. Protect worker/internal routes first (highest priority)
  if (isInternalRoute(pathname)) {
    const guardResponse = workerGuard(request)
    if (guardResponse) {
      return guardResponse // Reject if worker secret is invalid
    }
    // Worker secret is valid, continue
    return NextResponse.next()
  }

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

  // Dashboard routes - allow through without checking cookie
  // Cookie checking is unreliable for cross-domain cookies (api.leadscope.gr -> www.leadscope.gr)
  // The cookie is sent in request headers, but Next.js cookies() might not read it server-side
  // Let page components handle auth via API calls (they'll redirect on 401/403)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/datasets') || 
      pathname.startsWith('/discover') || pathname.startsWith('/exports') ||
      pathname.startsWith('/billing') || pathname.startsWith('/settings') ||
      pathname.startsWith('/cities') || pathname.startsWith('/industries') ||
      pathname.startsWith('/refresh')) {
    // Always allow through - no redirect here
    // Page components will handle auth checks
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
