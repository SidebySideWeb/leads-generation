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
export async function getServerUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) {
      return null
    }

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
