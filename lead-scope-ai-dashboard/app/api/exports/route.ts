/**
 * Exports API Route
 * 
 * GET /api/exports?datasetId=...
 * 
 * Lists exports for the current user, optionally filtered by datasetId.
 */

import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { Pool } from 'pg'

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const GET = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user
    const { searchParams } = new URL(request.url)
    const datasetId = searchParams.get('datasetId')

    // Build query
    let query = `
      SELECT 
        id,
        user_id,
        export_type,
        industry_id,
        city_id,
        total_rows,
        file_format,
        file_path,
        watermark_text,
        filters,
        created_at,
        expires_at
      FROM exports
      WHERE user_id = $1
    `
    const params: any[] = [user.id]

    if (datasetId) {
      query += ` AND (filters->>'datasetId')::text = $2`
      params.push(datasetId)
    }

    query += ` ORDER BY created_at DESC LIMIT 100`

    const result = await pool.query(query, params)

    return NextResponse.json({
      data: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        exportType: row.export_type,
        industryId: row.industry_id,
        cityId: row.city_id,
        totalRows: row.total_rows,
        fileFormat: row.file_format,
        filePath: row.file_path,
        watermarkText: row.watermark_text,
        filters: row.filters,
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
      })),
      meta: {
        plan_id: request.permissions.plan,
        gated: false,
        total_available: result.rows.length,
        total_returned: result.rows.length,
      },
    })
  } catch (error: any) {
    console.error('[exports] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: request.permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to fetch exports',
        },
      },
      { status: 500 }
    )
  }
})
