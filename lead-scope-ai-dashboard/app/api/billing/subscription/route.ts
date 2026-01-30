import { NextRequest, NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { getCurrentUser } from '@/lib/auth-server'

/**
 * GET /api/billing/subscription
 * Get current user's subscription information
 */
export const GET = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user

    // Get user from auth to get plan
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // For now, return subscription based on user plan
    // TODO: Query backend database for actual subscription data
    const subscription = {
      id: `sub_${user.id}`,
      user_id: user.id,
      plan: currentUser.plan || 'demo',
      status: currentUser.plan === 'demo' ? 'trialing' : 'active' as const,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_start: null,
      current_period_end: null,
      canceled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      data: subscription,
      meta: {
        plan_id: currentUser.plan || 'demo',
        gated: false,
        total_available: 1,
        total_returned: 1,
      },
    })
  } catch (error: any) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
})
