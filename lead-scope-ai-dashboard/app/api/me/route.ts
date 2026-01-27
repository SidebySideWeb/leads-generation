/**
 * Get Current User with Permissions
 * 
 * GET /api/me
 * 
 * Returns current user with plan and permissions.
 * Used by frontend to drive UI behavior.
 */

import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'

export const GET = withGuard(async (request: GuardedRequest) => {
  try {
    // User and permissions already validated and attached by guard
    const { user, permissions } = request

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
      },
      permissions: {
        plan: permissions.plan,
        max_export_rows: permissions.max_export_rows,
        max_crawl_pages: permissions.max_crawl_pages,
        max_datasets: permissions.max_datasets,
        can_refresh: permissions.can_refresh,
      },
    })
  } catch (error: any) {
    console.error('[me] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get user permissions',
        user: null,
        permissions: null,
      },
      { status: 500 }
    )
  }
})
