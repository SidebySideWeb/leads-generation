import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { shouldBypassGuard } from './lib/api-guard-utils'
import { workerGuard, isInternalRoute } from './lib/worker-guard'

const COOKIE_NAME = 'token'

/**
 * Middleware to protect routes
 * 
 * BACKEND IS THE SINGLE SOURCE OF TRUTH FOR AUTHENTICATION.
 * This middleware only checks for cookie presence, not validity.
 * 
 * Priority:
 * 1. Worker routes (/api/internal/*) - require X-WORKER-SECRET header
 * 2. Dashboard routes - check for auth cookie presence only
 * 3. API routes - proxy to backend which handles auth
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hostname = request.nextUrl.hostname

  // Handle Vercel redirect: leadscope.gr -> www.leadscope.gr
  if (hostname === 'leadscope.gr') {
    const url = request.nextUrl.clone()
    url.hostname = 'www.leadscope.gr'
    return NextResponse.redirect(url, 301)
  }

  // 1. Protect worker/internal routes first (highest priority)
  if (isInternalRoute(pathname)) {
    const guardResponse = workerGuard(request)
    if (guardResponse) {
      return guardResponse
    }
    return NextResponse.next()
  }

  // Allow access to auth routes and public API routes
  if (
    shouldBypassGuard(pathname) ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // Dashboard routes - check for cookie presence only
  // Do NOT verify JWT - backend handles that
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/datasets') || 
      pathname.startsWith('/discover') || pathname.startsWith('/exports') ||
      pathname.startsWith('/billing') || pathname.startsWith('/settings') ||
      pathname.startsWith('/cities') || pathname.startsWith('/industries') ||
      pathname.startsWith('/refresh')) {
    // Check for cookie presence (not validity)
    const cookieHeader = request.headers.get('cookie')
    const hasToken = cookieHeader?.includes(`${COOKIE_NAME}=`)
    
    if (!hasToken) {
      // No cookie found - redirect to login
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    
    // Cookie present - allow through
    // Backend will validate on API calls
    return NextResponse.next()
  }

  // API routes - allow through, they proxy to backend
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
