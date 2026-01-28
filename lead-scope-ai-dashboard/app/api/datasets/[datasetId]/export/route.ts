/**
 * Export Dataset API Route
 * 
 * POST /api/datasets/[datasetId]/export
 * 
 * Exports a dataset with pricing gate enforcement.
 * Returns enhanced response with rows_returned, rows_total, gated, upgrade_hint.
 * 
 * NOTE: This route should call the backend export worker.
 * For now, it returns a mock response structure that matches the expected format.
 * In production, this should call the actual backend API or worker.
 */

import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'

export const POST = withGuard(async (
  request: GuardedRequest,
  { params }: { params: { datasetId: string } }
) => {
  try {
    // User and permissions are already validated and attached by guard
    const user = request.user
    const permissions = request.permissions

    // Parse request body
    const body = await request.json()
    const { format } = body

    if (!format || !['csv', 'xlsx'].includes(format)) {
      // Use plan from permissions (already validated by guard)
      return NextResponse.json(
        { 
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Invalid format. Must be "csv" or "xlsx"',
          },
        },
        { status: 400 }
      )
    }

    // For this dashboard deployment, the heavy export work is handled by the backend worker
    // (outside the Next.js app). To keep the frontend build isolated from backend internals,
    // we do NOT import the worker directly here. Instead, we return a clear "service
    // unavailable" response that the UI can handle gracefully.
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: 'Export worker is not available in this deployment. Please try again later.',
        },
      },
      { status: 503 }
    )
  } catch (error: any) {
    console.error('[export] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: (request as GuardedRequest).permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Export failed',
        },
      },
      { status: 500 }
    )
  }
})
