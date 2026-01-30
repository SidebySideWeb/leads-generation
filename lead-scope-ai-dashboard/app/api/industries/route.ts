import { NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * GET /api/industries
 * Get all industries (public endpoint - no auth required)
 */
export async function GET() {
  try {
    const result = await pool.query<{
      id: number
      name: string
    }>(
      'SELECT id, name FROM industries ORDER BY name ASC'
    )

    return NextResponse.json({
      data: result.rows,
      meta: {
        plan_id: 'demo',
        gated: false,
        total_available: result.rows.length,
        total_returned: result.rows.length,
      },
    })
  } catch (error: any) {
    console.error('[industries] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: 'Failed to fetch industries',
        },
      },
      { status: 500 }
    )
  }
}
