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
      // Log for debugging - cookie might not be accessible server-side
      // This can happen with cross-domain cookies set by api.leadscope.gr
      const allCookies = cookieStore.getAll().map(c => c.name)
      console.log(`[getServerUser] No ${COOKIE_NAME} cookie found. Available cookies:`, allCookies)
      
      // Try to make API call to verify auth (cookie will be sent automatically)
      // This works because the cookie is sent in the request headers
      try {
        const { headers } = await import('next/headers')
        const headersList = await headers()
        const cookieHeader = headersList.get('cookie')
        
        if (cookieHeader && cookieHeader.includes(`${COOKIE_NAME}=`)) {
          console.log(`[getServerUser] Cookie found in request headers, making API call to verify`)
          // Make API call to backend to verify auth
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
          const response = await fetch(`${apiUrl}/api/auth/me`, {
            method: 'GET',
            headers: {
              'Cookie': cookieHeader,
            },
            credentials: 'include',
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.user) {
              return {
                id: data.user.id,
                email: data.user.email,
                plan: data.user.plan,
              }
            }
          }
        }
      } catch (apiError) {
        console.error('[getServerUser] API fallback failed:', apiError)
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
