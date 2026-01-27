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

    // Call backend export worker
    // NOTE: In production, this should call a backend API endpoint
    // For now, we'll use dynamic import to call the worker directly
    try {
      const { exportWorkerV1 } = await import('../../../../../src/workers/exportWorkerV1.js')
      
      // Pass only userId - plan is resolved from database (source of truth)
      // Never trust client payload
      // User and permissions already validated by guard
      const result = await exportWorkerV1({
        datasetId: params.datasetId,
        format: format as 'csv' | 'xlsx',
        userId: user.id, // User ID - plan resolved from database via getUserPermissions()
      })
      
      // Use plan from permissions (already validated by guard)
      const userPlan = permissions.plan

      if (!result.success) {
        return NextResponse.json(
          {
            data: null,
            meta: {
              plan_id: userPlan,
              gated: result.gated,
              total_available: result.rows_total,
              total_returned: result.rows_returned,
              gate_reason: result.error,
              upgrade_hint: result.upgrade_hint,
            },
          },
          { status: 400 }
        )
      }

      // Upload file to storage (Supabase Storage or local)
      // For now, return file as base64 data URL for download
      // In production, upload to Supabase Storage and return signed URL
      const fileBase64 = result.file?.toString('base64')
      const dataUrl = fileBase64
        ? `data:application/${format === 'csv' ? 'csv' : 'vnd.openxmlformats-officedocument.spreadsheetml.sheet'};base64,${fileBase64}`
        : null

      // Return enhanced export response with all required fields
      return NextResponse.json({
        data: {
          id: `export-${Date.now()}`,
          dataset_id: params.datasetId,
          format: format,
          tier: userPlan === 'demo' ? 'starter' : userPlan === 'starter' ? 'starter' : 'pro',
          total_rows: result.rows_returned,
          rows_returned: result.rows_returned, // Enhanced: rows actually exported
          rows_total: result.rows_total, // Enhanced: total rows available
          file_path: result.filename || '',
          download_url: dataUrl,
          created_at: new Date().toISOString(),
          expires_at: null,
        },
        meta: {
          plan_id: userPlan,
          gated: result.gated, // Enhanced: gated status
          total_available: result.rows_total,
          total_returned: result.rows_returned,
          gate_reason: result.gated ? `Export limited to ${result.rows_returned} of ${result.rows_total} rows` : undefined,
          upgrade_hint: result.upgrade_hint, // Enhanced: upgrade suggestion
        },
      })
    } catch (importError) {
      // Fallback if worker import fails (e.g., in production with separate backend)
      console.error('[export] Failed to import worker:', importError)
      
      // Return error response with proper structure
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Export service unavailable. Please try again later.',
          },
        },
        { status: 503 }
      )
    }
  } catch (error: any) {
    console.error('[export] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: permissions.plan,
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
