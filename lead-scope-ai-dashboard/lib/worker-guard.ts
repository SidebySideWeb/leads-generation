/**
 * Worker Secret Guard
 * 
 * Protects all /api/internal/* routes with X-WORKER-SECRET header.
 * Only allows Vercel as caller (server-to-server only).
 * 
 * Security:
 * - Requires X-WORKER-SECRET header
 * - Validates against WORKER_SECRET environment variable
 * - Only allows Vercel as caller (checks for Vercel-specific headers)
 * - Rejects if missing or invalid
 * - Never exposes worker endpoints publicly
 */

import { NextRequest, NextResponse } from 'next/server'

const WORKER_SECRET = process.env.WORKER_SECRET

if (!WORKER_SECRET) {
  console.warn('[worker-guard] WARNING: WORKER_SECRET environment variable is not set. Worker endpoints will be unprotected.')
}

/**
 * Check if request is from Vercel
 * 
 * Vercel-specific headers:
 * - x-vercel-id: Vercel deployment ID
 * - x-vercel-signature: Vercel signature (for webhooks)
 * - x-forwarded-host: Vercel host
 * 
 * In production, we can also check:
 * - Origin header matches Vercel domain
 * - IP address is from Vercel's IP range
 */
function isVercelRequest(request: NextRequest): boolean {
  // Check for Vercel-specific headers
  const vercelId = request.headers.get('x-vercel-id')
  const vercelSignature = request.headers.get('x-vercel-signature')
  const forwardedHost = request.headers.get('x-forwarded-host')
  
  // In production, check if host matches Vercel domain
  const host = request.headers.get('host') || ''
  const isVercelDomain = host.includes('.vercel.app') || host.includes('vercel.app')
  
  // Check if request is from Vercel (has Vercel headers or is on Vercel domain)
  // In serverless functions, requests from Vercel will have these headers
  // For local development, we allow if WORKER_SECRET is set (for testing)
  const isLocalDev = process.env.NODE_ENV === 'development'
  
  if (isLocalDev) {
    // In development, allow if secret is correct (for local testing)
    return true
  }
  
  // In production, require Vercel headers or Vercel domain
  return !!(vercelId || vercelSignature || isVercelDomain)
}

/**
 * Validate worker secret from request header
 */
function validateWorkerSecret(request: NextRequest): {
  valid: boolean
  error?: string
} {
  // Check if secret is configured
  if (!WORKER_SECRET) {
    return {
      valid: false,
      error: 'Worker secret not configured. Set WORKER_SECRET environment variable.',
    }
  }
  
  // Get secret from header
  const providedSecret = request.headers.get('x-worker-secret')
  
  if (!providedSecret) {
    return {
      valid: false,
      error: 'Missing X-WORKER-SECRET header. Worker endpoints require authentication.',
    }
  }
  
  // Validate secret (use constant-time comparison to prevent timing attacks)
  if (!constantTimeEquals(providedSecret, WORKER_SECRET)) {
    return {
      valid: false,
      error: 'Invalid X-WORKER-SECRET header. Authentication failed.',
    }
  }
  
  return { valid: true }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Check if path is an internal worker route
 */
export function isInternalRoute(pathname: string): boolean {
  return pathname.startsWith('/api/internal/')
}

/**
 * Worker Guard - Validates X-WORKER-SECRET header
 * 
 * Returns:
 * - null if request is allowed (continue to handler)
 * - NextResponse if request should be rejected
 */
export function workerGuard(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname
  
  // Only protect /api/internal/* routes
  if (!isInternalRoute(pathname)) {
    return null // Not an internal route, let other guards handle it
  }
  
  // Validate worker secret
  const secretValidation = validateWorkerSecret(request)
  if (!secretValidation.valid) {
    console.error(`[worker-guard] Rejected request to ${pathname}: ${secretValidation.error}`)
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: secretValidation.error || 'Worker authentication required',
      },
      { status: 401 }
    )
  }
  
  // Check if request is from Vercel (in production)
  if (process.env.NODE_ENV === 'production' && !isVercelRequest(request)) {
    console.error(`[worker-guard] Rejected request to ${pathname}: Not from Vercel`)
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Worker endpoints are only accessible from Vercel.',
      },
      { status: 403 }
    )
  }
  
  // Request is valid
  return null
}

/**
 * Higher-order function to wrap internal route handlers with worker guard
 */
export function withWorkerGuard(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse<any>>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse<any>> => {
    // Check worker guard
    const guardResponse = workerGuard(request)
    if (guardResponse) {
      return guardResponse // Guard rejected the request
    }
    
    // Request is allowed, proceed with handler
    return handler(request, context)
  }
}
