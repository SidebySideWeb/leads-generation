import { NextRequest, NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { getCurrentUser } from '@/lib/auth-server'

/**
 * GET /api/billing/invoices
 * Get invoice history for current user
 */
export const GET = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // TODO: Query backend database for actual invoices from Stripe
    // For now, return empty array
    const invoices: any[] = []

    return NextResponse.json({
      data: invoices,
      meta: {
        plan_id: currentUser.plan || 'demo',
        gated: false,
        total_available: invoices.length,
        total_returned: invoices.length,
      },
    })
  } catch (error: any) {
    console.error('Invoices fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
})
