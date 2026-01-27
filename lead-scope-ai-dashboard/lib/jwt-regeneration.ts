/**
 * JWT Regeneration on Plan Change
 * 
 * Automatically regenerates JWT token when plan in DB differs from plan in token.
 * Token is stored in http-only cookie.
 */

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generateJWT, verifyJWT, COOKIE_NAME } from './jwt'
import { Pool } from 'pg'
import type { User } from './types'

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * Get user's current plan from database
 */
async function getUserPlanFromDB(userId: string): Promise<'demo' | 'starter' | 'pro'> {
  try {
    const result = await pool.query<{ plan: 'demo' | 'starter' | 'pro' }>(
      `SELECT plan FROM subscriptions
       WHERE user_id = $1
         AND status IN ('active', 'trialing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )
    return result.rows[0]?.plan || 'demo'
  } catch (error) {
    console.error('[getUserPlanFromDB] Error:', error)
    return 'demo'
  }
}

/**
 * Get user email from database
 */
async function getUserEmail(userId: string): Promise<string | null> {
  // This assumes you have a users table
  // Adjust based on your actual schema
  try {
    const result = await pool.query<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    )
    return result.rows[0]?.email || null
  } catch (error) {
    console.error('[getUserEmail] Error:', error)
    return null
  }
}

/**
 * Check if plan in DB differs from plan in token
 * If different, regenerate token and update cookie
 * 
 * @param token - Current JWT token
 * @returns New token if regenerated, null if no change needed
 */
export async function checkAndRegenerateToken(token: string): Promise<string | null> {
  try {
    // Decode token to get user info
    const tokenData = await verifyJWT(token)
    if (!tokenData) {
      return null // Invalid token, can't regenerate
    }

    const { id: userId, email, plan: tokenPlan } = tokenData

    // Get current plan from database
    const dbPlan = await getUserPlanFromDB(userId)

    // If plan matches, no regeneration needed
    if (dbPlan === tokenPlan) {
      return null
    }

    console.log(`[checkAndRegenerateToken] Plan mismatch for user ${userId}: token=${tokenPlan}, db=${dbPlan}`)

    // Get user email (in case it changed)
    const dbEmail = await getUserEmail(userId) || email

    // Generate new token with updated plan
    const newToken = await generateJWT({
      id: userId,
      email: dbEmail,
      plan: dbPlan,
    })

    // Update cookie using Next.js cookies() API
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 30, // 30 minutes
      path: '/',
    })

    console.log(`[checkAndRegenerateToken] Token regenerated for user ${userId}, new plan: ${dbPlan}`)
    return newToken
  } catch (error) {
    console.error('[checkAndRegenerateToken] Error:', error)
    return null
  }
}

/**
 * Regenerate JWT token for a user (used by webhook handler)
 * 
 * @param userId - User ID
 * @returns New token or null if user not found
 */
export async function regenerateTokenForUser(userId: string): Promise<string | null> {
  try {
    // Get user email and plan from database
    const email = await getUserEmail(userId)
    if (!email) {
      console.error(`[regenerateTokenForUser] User ${userId} not found`)
      return null
    }

    const plan = await getUserPlanFromDB(userId)

    // Generate new token
    const newToken = await generateJWT({
      id: userId,
      email,
      plan,
    })

    console.log(`[regenerateTokenForUser] Token regenerated for user ${userId}, plan: ${plan}`)
    return newToken
  } catch (error) {
    console.error('[regenerateTokenForUser] Error:', error)
    return null
  }
}
