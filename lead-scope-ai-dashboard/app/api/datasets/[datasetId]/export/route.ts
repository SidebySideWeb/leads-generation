/**
 * Export Dataset API Route
 * 
 * POST /api/datasets/[datasetId]/export
 * 
 * Exports a dataset with pricing gate enforcement.
 * Returns enhanced response with rows_returned, rows_total, gated, upgrade_hint.
 */

import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { exportWorkerV1New } from '../../../../../src/workers/exportWorkerV1New.js'

export const POST = withGuard(async (
  request: GuardedRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) => {
  try {
    // User and permissions are already validated and attached by guard
    const user = request.user
    const permissions = request.permissions
    const { datasetId } = await params

    // Parse request body
    const body = await request.json()
    const { format } = body

    if (!format || !['csv', 'xlsx'].includes(format)) {
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

    // Call backend export worker
    const result = await exportWorkerV1New({
      datasetId,
      userId: user.id,
      format: format as 'csv' | 'xlsx',
    })

    if (!result.success) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: result.gated,
            total_available: result.rows_total,
            total_returned: result.rows_returned,
            gate_reason: result.error || 'Export failed',
            upgrade_hint: result.upgrade_hint,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        exportId: result.exportId,
        downloadUrl: result.downloadUrl,
        filePath: result.filePath,
      },
      meta: {
        plan_id: permissions.plan,
        gated: result.gated,
        total_available: result.rows_total,
        total_returned: result.rows_returned,
        watermark: result.watermark,
        upgrade_hint: result.upgrade_hint,
      },
    })
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
