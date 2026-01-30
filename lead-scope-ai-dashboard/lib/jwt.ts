/**
 * JWT Token Generation and Management
 * 
 * Generates JWT tokens with user_id, email, and plan.
 * Token TTL: 30 minutes max
 */

import * as jose from 'jose'
import type { User } from './types'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_TTL_MINUTES = 30
const COOKIE_NAME = 'token' // Matches backend cookie name and middleware check

/**
 * Get the JWT secret key for signing
 */
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || JWT_SECRET
  return new TextEncoder().encode(secret)
}

/**
 * Generate JWT token with user data
 * 
 * @param user - User object with id, email, and plan
 * @returns JWT token string
 */
export async function generateJWT(user: User): Promise<string> {
  const secret = getJWTSecret()
  
  const token = await new jose.SignJWT({
    id: user.id,
    email: user.email,
    plan: user.plan,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${JWT_TTL_MINUTES}m`)
    .sign(secret)

  return token
}

/**
 * Decode JWT token without verification (for reading payload)
 * Use this only when you need to read the token before verifying
 */
export async function decodeJWT(token: string): Promise<{
  id: string
  email: string
  plan: 'demo' | 'starter' | 'pro'
} | null> {
  try {
    // Decode without verification – for read-only scenarios
    const payload = jose.decodeJwt(token)
    
    if (
      typeof payload.id === 'string' &&
      typeof payload.email === 'string' &&
      (payload.plan === 'demo' || payload.plan === 'starter' || payload.plan === 'pro')
    ) {
      return {
        id: payload.id,
        email: payload.email,
        plan: payload.plan,
      }
    }
    
    return null
  } catch (error) {
    console.error('[decodeJWT] Failed to decode token:', error)
    return null
  }
}

/**
 * Verify and decode JWT token
 */
export async function verifyJWT(token: string): Promise<{
  id: string
  email: string
  plan: 'demo' | 'starter' | 'pro'
} | null> {
  try {
    const secret = getJWTSecret()
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    })

    if (
      typeof payload.id === 'string' &&
      typeof payload.email === 'string' &&
      (payload.plan === 'demo' || payload.plan === 'starter' || payload.plan === 'pro')
    ) {
      return {
        id: payload.id,
        email: payload.email,
        plan: payload.plan,
      }
    }

    return null
  } catch (error) {
    console.error('[verifyJWT] Token verification failed:', error)
    return null
  }
}

export { COOKIE_NAME, JWT_TTL_MINUTES }
