/**
 * Export Preview API Route
 * 
 * POST /api/exports/preview
 * 
 * Computes export preview: rows_total, applies plan limits, returns watermark.
 * Does not generate file - just preview.
 */

import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { Pool } from 'pg'

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * Plan limits (matching backend planLimits.ts)
 */
const PLAN_LIMITS = {
  demo: { export_max_rows: 50 },
  starter: { export_max_rows: 1000 },
  pro: { export_max_rows: 1000000 }, // Effectively unlimited
} as const

export const POST = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user
    const permissions = request.permissions
    const body = await request.json()
    const { datasetId } = body

    if (!datasetId) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'datasetId is required',
          },
        },
        { status: 400 }
      )
    }

    // 1. Verify dataset ownership
    const datasetResult = await pool.query(
      'SELECT user_id FROM datasets WHERE id = $1',
      [datasetId]
    )

    if (datasetResult.rows.length === 0) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Dataset not found',
          },
        },
        { status: 404 }
      )
    }

    const dataset = datasetResult.rows[0]
    if (dataset.user_id !== user.id && !permissions.is_internal_user) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Access denied: You do not own this dataset',
          },
        },
        { status: 403 }
      )
    }

    // 2. Count total businesses in dataset
    const countResult = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM businesses WHERE dataset_id = $1',
      [datasetId]
    )

    const rowsTotal = parseInt(countResult.rows[0].count, 10) || 0

    // 3. Apply plan limits
    const planLimit = PLAN_LIMITS[permissions.plan].export_max_rows
    const isGated = rowsTotal > planLimit && !permissions.is_internal_user
    const rowsToExport = permissions.is_internal_user ? rowsTotal : Math.min(rowsTotal, planLimit)

    // 4. Determine watermark
    let watermarkText = ''
    if (permissions.plan === 'demo') {
      watermarkText = isGated ? 'DEMO (max 50 leads)' : 'DEMO'
    } else if (permissions.plan === 'starter') {
      watermarkText = 'STARTER'
    } else {
      watermarkText = 'PRO'
    }

    return NextResponse.json({
      data: {
        rows_total: rowsTotal,
        rows_to_export: rowsToExport,
        watermark_text: watermarkText,
      },
      meta: {
        plan_id: permissions.plan,
        total_available: rowsTotal,
        total_returned: rowsToExport,
        gated: isGated,
        gate_reason: isGated ? `Plan limit: ${planLimit} rows. Upgrade to export all ${rowsTotal} rows.` : undefined,
        upgrade_hint: isGated ? `Upgrade to ${permissions.plan === 'demo' ? 'Starter' : 'Pro'} plan to export all rows` : undefined,
      },
    })
  } catch (error: any) {
    console.error('[export-preview] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: request.permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to generate export preview',
        },
      },
      { status: 500 }
    )
  }
})
