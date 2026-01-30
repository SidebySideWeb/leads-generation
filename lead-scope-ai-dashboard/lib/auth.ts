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
    const cookieStore = await cookies()
    let token = cookieStore.get(COOKIE_NAME)?.value

    // If token not found in cookies(), try reading from request headers (for cross-domain cookies)
    if (!token && request) {
      const cookieHeader = request.headers.get('cookie')
      if (cookieHeader) {
        const tokenMatch = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
        if (tokenMatch && tokenMatch[1]) {
          token = tokenMatch[1]
          console.log(`[getServerUser] Found ${COOKIE_NAME} in request headers`)
        }
      }
    }

    if (!token) {
      // Log for debugging - cookie might not be accessible server-side
      // This can happen with cross-domain cookies set by api.leadscope.gr
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
    const finalToken = cookieStore.get(COOKIE_NAME)?.value || token
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
