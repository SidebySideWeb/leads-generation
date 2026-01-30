/**
 * JWT Token Generation and Management
 * 
 * Generates JWT tokens with user_id, email, and plan.
 * Token TTL: 30 minutes max
 */

import * as jose from 'jose'
import type { User, PlanId } from './types'

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
  plan: PlanId
} | null> {
  try {
    // Decode without verification – for read-only scenarios
    const payload = jose.decodeJwt(token)
    
    // Backend JWT only has id and email
    if (typeof payload.id === 'string' && typeof payload.email === 'string') {
      // If plan is in token, use it
      if (typeof payload.plan === 'string') {
        const validPlans: PlanId[] = ['demo', 'starter', 'pro', 'snapshot', 'professional', 'agency']
        if (validPlans.includes(payload.plan as PlanId)) {
          return {
            id: payload.id,
            email: payload.email,
            plan: payload.plan as PlanId,
          }
        }
      }
      
      // Plan not in token - return with demo plan (will be fetched from DB later)
      return {
        id: payload.id,
        email: payload.email,
        plan: 'demo', // Will be updated from database
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
 * Backend JWT only includes id and email, not plan
 * Plan will be fetched from database if not in token
 */
export async function verifyJWT(token: string): Promise<{
  id: string
  email: string
  plan: PlanId
} | null> {
  try {
    const secret = getJWTSecret()
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    })

    // Backend JWT only has id and email
    if (typeof payload.id === 'string' && typeof payload.email === 'string') {
      // If plan is in token, use it
      if (typeof payload.plan === 'string') {
        const validPlans: PlanId[] = ['demo', 'starter', 'pro', 'snapshot', 'professional', 'agency']
        if (validPlans.includes(payload.plan as PlanId)) {
          return {
            id: payload.id,
            email: payload.email,
            plan: payload.plan as PlanId,
          }
        }
      }
      
      // Plan not in token - fetch from database
      // This happens when token is from backend (which doesn't include plan)
      try {
        const { Pool } = await import('pg')
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
        })
        
        // Get user's plan from database (check subscriptions table first, then users table)
        const subResult = await pool.query<{ plan: string }>(
          `SELECT plan FROM subscriptions 
           WHERE user_id = $1 AND status IN ('active', 'trialing')
           ORDER BY created_at DESC LIMIT 1`,
          [payload.id]
        )
        
        let plan: PlanId = 'demo'
        if (subResult.rows[0]) {
          plan = subResult.rows[0].plan as PlanId
        } else {
          // Fallback to users table
          const userResult = await pool.query<{ plan: string }>(
            'SELECT plan FROM users WHERE id = $1',
            [payload.id]
          )
          if (userResult.rows[0]) {
            plan = userResult.rows[0].plan as PlanId
          }
        }
        
        await pool.end()
        
        return {
          id: payload.id,
          email: payload.email,
          plan: plan,
        }
      } catch (dbError) {
        console.error('[verifyJWT] Failed to fetch plan from database:', dbError)
        // Return with demo plan as fallback
        return {
          id: payload.id,
          email: payload.email,
          plan: 'demo',
        }
      }
    }

    return null
  } catch (error) {
    console.error('[verifyJWT] Token verification failed:', error)
    return null
  }
}

export { COOKIE_NAME, JWT_TTL_MINUTES }
