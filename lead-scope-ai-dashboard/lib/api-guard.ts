/**
 * API Route Guard Middleware
 * 
 * Validates:
 * - Authenticated user
 * - Active subscription (not expired, not canceled)
 * 
 * Attaches:
 * - User object
 * - Permissions object
 * 
 * Rejects:
 * - Unauthenticated requests
 * - Expired subscriptions
 * - Canceled subscriptions
 * 
 * No route should bypass this middleware (except webhooks and public auth routes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from './auth'
import { Pool } from 'pg'
import type { UserPermissions } from './permissions'
import type { PlanId } from './types'

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export interface GuardedRequest extends NextRequest {
  user: {
    id: string
    email: string
    plan: PlanId
  }
  permissions: UserPermissions
}

export interface GuardResult {
  allowed: boolean
  user?: {
    id: string
    email: string
    plan: PlanId
  }
  permissions?: UserPermissions
  error?: string
  statusCode?: number
}

/**
 * Check if subscription is active and not expired
 * 
 * Rules:
 * - Rejects canceled subscriptions
 * - Rejects past_due subscriptions
 * - Rejects expired subscriptions (current_period_end < now)
 * - Allows demo plan (no subscription)
 * - Allows active/trialing subscriptions
 */
async function validateSubscription(userId: string): Promise<{
  valid: boolean
  reason?: string
  subscription?: {
    plan: PlanId
    status: string
    current_period_end: Date | null
  }
}> {
  try {
    const result = await pool.query<{
      plan: PlanId
      status: string
      current_period_end: Date | null
    }>(
      `SELECT plan, status, current_period_end
       FROM subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )

    const subscription = result.rows[0]

    // If no subscription found, user is on demo plan (allowed)
    if (!subscription) {
      return {
        valid: true,
        subscription: {
          plan: 'demo',
          status: 'demo',
          current_period_end: null,
        },
      }
    }

    // Reject canceled subscriptions
    if (subscription.status === 'canceled') {
      return {
        valid: false,
        reason: 'Subscription has been canceled. Please renew your subscription to continue.',
        subscription,
      }
    }

    // Reject past_due subscriptions
    if (subscription.status === 'past_due') {
      return {
        valid: false,
        reason: 'Subscription payment is past due. Please update your payment method to continue.',
        subscription,
      }
    }

    // Reject expired subscriptions
    if (subscription.current_period_end) {
      const now = new Date()
      const periodEnd = new Date(subscription.current_period_end)
      
      if (periodEnd < now) {
        return {
          valid: false,
          reason: 'Subscription has expired. Please renew your subscription to continue.',
          subscription,
        }
      }
    }

    // Only allow active or trialing subscriptions
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return {
        valid: false,
        reason: `Subscription status is ${subscription.status}. Active subscription required.`,
        subscription,
      }
    }

    // Subscription is active and valid
    return {
      valid: true,
      subscription,
    }
  } catch (error) {
    console.error('[validateSubscription] Error:', error)
    // On error, allow access (graceful degradation)
    // In production, you might want to be more strict
    return {
      valid: true,
      subscription: {
        plan: 'demo',
        status: 'demo',
        current_period_end: null,
      },
    }
  }
}

/**
 * Get user permissions from database
 * 
 * Queries the subscriptions table to determine user plan and permissions
 */
async function getUserPermissionsFromDB(userId: string): Promise<UserPermissions> {
  try {
    // Query active subscription
    const subscriptionResult = await pool.query<{
      plan: 'demo' | 'starter' | 'pro'
      status: string
      is_internal_user: boolean
    }>(
      `SELECT plan, status, is_internal_user
       FROM subscriptions
       WHERE user_id = $1
       AND status IN ('active', 'trialing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )

    const subscription = subscriptionResult.rows[0]

    // If no active subscription, user is on demo plan
    if (!subscription) {
      return {
        plan: 'demo',
        max_export_rows: 50,
        max_crawl_pages: 1,
        max_datasets: 1,
        can_refresh: false,
      }
    }

    // Internal users get pro permissions
    if (subscription.is_internal_user) {
      return {
        plan: 'pro',
        max_export_rows: Number.MAX_SAFE_INTEGER,
        max_crawl_pages: 10,
        max_datasets: Number.MAX_SAFE_INTEGER,
        can_refresh: true,
      }
    }

    // Map plan to permissions
    const plan = subscription.plan

    switch (plan) {
      case 'demo':
        return {
          plan: 'demo',
          max_export_rows: 50,
          max_crawl_pages: 1,
          max_datasets: 1,
          can_refresh: false,
        }
      case 'starter':
        return {
          plan: 'starter',
          max_export_rows: 1000,
          max_crawl_pages: 3,
          max_datasets: 5,
          can_refresh: true,
        }
      case 'pro':
        return {
          plan: 'pro',
          max_export_rows: Number.MAX_SAFE_INTEGER,
          max_crawl_pages: 10,
          max_datasets: Number.MAX_SAFE_INTEGER,
          can_refresh: true,
        }
      default:
        // Fallback to demo
        return {
          plan: 'demo',
          max_export_rows: 50,
          max_crawl_pages: 1,
          max_datasets: 1,
          can_refresh: false,
        }
    }
  } catch (error) {
    console.error('[getUserPermissionsFromDB] Error:', error)
    // Fallback to demo permissions on error
    return {
      plan: 'demo',
      max_export_rows: 50,
      max_crawl_pages: 1,
      max_datasets: 1,
      can_refresh: false,
    }
  }
}

/**
 * API Route Guard
 * 
 * Validates authentication and subscription status.
 * Attaches user and permissions to request context.
 * 
 * @param request - Next.js request object
 * @returns Guard result with user, permissions, or error
 */
export async function apiGuard(request: NextRequest): Promise<GuardResult> {
  try {
    // 1. Get authenticated user from JWT
    const user = await getServerUser()
    
    if (!user) {
      return {
        allowed: false,
        error: 'Unauthorized. Please log in to continue.',
        statusCode: 401,
      }
    }

    // 2. Validate subscription status
    const subscriptionCheck = await validateSubscription(user.id)
    
    if (!subscriptionCheck.valid) {
      return {
        allowed: false,
        error: subscriptionCheck.reason || 'Subscription is not active.',
        statusCode: 403,
      }
    }

    // 3. Get user permissions from database
    const permissions = await getUserPermissionsFromDB(user.id)

    // 4. Return success with user and permissions
    return {
      allowed: true,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
      },
      permissions,
    }
  } catch (error: any) {
    console.error('[apiGuard] Error:', error)
    return {
      allowed: false,
      error: 'Internal server error during authentication.',
      statusCode: 500,
    }
  }
}

/**
 * Create a guarded API route handler
 * 
 * Wraps an API route handler with authentication and subscription validation.
 * Automatically attaches user and permissions to request context.
 */
export function withGuard(
  handler: (
    request: GuardedRequest,
    context?: any
  ) => Promise<NextResponse<any>>
) {
  return async (
    request: NextRequest,
    context?: any
  ): Promise<NextResponse<any>> => {
    // Apply guard
    const guardResult = await apiGuard(request)

    if (!guardResult.allowed) {
      return NextResponse.json(
        {
          error: guardResult.error,
          data: null,
          meta: {
            plan_id: 'demo',
            gated: true,
            total_available: 0,
            total_returned: 0,
            gate_reason: guardResult.error,
          },
        },
        { status: guardResult.statusCode || 403 }
      )
    }

    // Attach user and permissions to request
    const guardedRequest = request as GuardedRequest
    guardedRequest.user = guardResult.user!
    guardedRequest.permissions = guardResult.permissions!

    // Call original handler with guarded request
    return handler(guardedRequest, context)
  }
}

// Re-export shouldBypassGuard from utils (Edge Runtime compatible)
export { shouldBypassGuard } from './api-guard-utils'
