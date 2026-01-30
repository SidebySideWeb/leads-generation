import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'

/**
 * GET /api/auth/me
 * Get current authenticated user
 * 
 * This endpoint returns the current user from the JWT token.
 * It's used by the API client's getCurrentUser() method.
 * 
 * More lenient than withGuard - tries to read cookie from headers if cookies() fails
 */
export async function GET(request: NextRequest) {
  try {
    // Try to get user, passing request so it can read from headers
    const user = await getServerUser(request)

    if (!user) {
      console.log('[auth/me] No user found. Cookie header:', request.headers.get('cookie')?.substring(0, 100))
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: 'demo',
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Not authenticated',
          },
        },
        { status: 401 }
      )
    }

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
}
