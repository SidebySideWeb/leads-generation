/**
 * Server-side authentication utilities
 * Handles JWT token decoding and user extraction
 * Automatically regenerates token if plan in DB differs from plan in token
 */

import { cookies } from 'next/headers'
import { verifyJWT, COOKIE_NAME } from './jwt'
import { checkAndRegenerateToken } from './jwt-regeneration'
import type { User } from './types'

/**
 * Get user from JWT token stored in http-only cookie
 * Automatically regenerates token if plan in DB differs from plan in token
 * Returns null if token is missing, invalid, or expired
 */
export async function getServerUser(request?: { headers: { get: (name: string) => string | null } }): Promise<User | null> {
  try {
    let token: string | null = null
    
    // First, try to read from request headers (most reliable for cross-domain cookies)
    if (request) {
      const cookieHeader = request.headers.get('cookie')
      if (cookieHeader) {
        const tokenMatch = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
        if (tokenMatch && tokenMatch[1]) {
          token = decodeURIComponent(tokenMatch[1])
          console.log(`[getServerUser] Found ${COOKIE_NAME} in request headers`)
        }
      }
    }
    
    // Fallback to Next.js cookies() if not found in headers
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get(COOKIE_NAME)?.value || null
      if (token) {
        console.log(`[getServerUser] Found ${COOKIE_NAME} in Next.js cookies()`)
      }
    }

    if (!token) {
      // Log for debugging
      const cookieStore = await cookies()
      const allCookies = cookieStore.getAll().map(c => c.name)
      console.log(`[getServerUser] No ${COOKIE_NAME} cookie found. Available cookies:`, allCookies)
      if (request) {
        const cookieHeader = request.headers.get('cookie')
        console.log(`[getServerUser] Request cookie header:`, cookieHeader ? cookieHeader.substring(0, 200) : 'none')
      }
      return null
    }

    console.log(`[getServerUser] Found ${COOKIE_NAME} cookie, verifying...`)

    // Verify and decode JWT
    const tokenData = await verifyJWT(token)
    if (!tokenData) {
      return null
    }

    // Check if plan changed and regenerate token if needed
    await checkAndRegenerateToken(token)

    // Return user object (use token data, which may have been updated)
    // Re-verify in case token was regenerated
    // Re-read cookie store to get potentially updated token
    const finalCookieStore = await cookies()
    const finalToken = finalCookieStore.get(COOKIE_NAME)?.value || token
    const finalData = await verifyJWT(finalToken)
    
    if (!finalData) {
      return null
    }

    return {
      id: finalData.id,
      email: finalData.email,
      plan: finalData.plan,
    }
  } catch (error) {
    // Token is invalid, expired, or malformed
    console.error('JWT verification failed:', error)
    return null
  }
}

/**
 * Set auth token in http-only cookie
 * This should be called from an API route after successful login
 */
export function setAuthTokenCookie(token: string): void {
  // This function is for reference - actual cookie setting happens in API routes
  // using NextResponse.cookies() or Response.cookies()
}

/**
 * Clear auth token cookie
 */
export function clearAuthTokenCookie(): void {
  // This function is for reference - actual cookie clearing happens in API routes
}
