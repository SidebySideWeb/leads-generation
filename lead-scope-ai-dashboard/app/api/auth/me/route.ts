import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'

/**
 * GET /api/auth/me
 * Get current authenticated user
 * 
 * This endpoint returns the current user from the JWT token.
 * It's used by the API client's getCurrentUser() method.
 */
export const GET = withGuard(async (request: GuardedRequest) => {
  try {
    const { user } = request

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        plan: user.plan,
      },
      meta: {
        plan_id: user.plan,
        gated: false,
        total_available: 1,
        total_returned: 1,
      },
    })
  } catch (error: any) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: 'Failed to get user',
        },
      },
      { status: 500 }
    )
  }
})
