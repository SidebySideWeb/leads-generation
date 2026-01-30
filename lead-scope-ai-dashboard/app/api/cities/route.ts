import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * GET /api/cities
 * Get cities, optionally filtered by country (public endpoint - no auth required)
 */
export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')

    let query = `
      SELECT 
        c.id,
        c.name,
        c.latitude,
        c.longitude,
        co.code as country
      FROM cities c
      LEFT JOIN countries co ON co.id = c.country_id
    `
    const params: string[] = []

    if (country) {
      query += ' WHERE co.code = $1'
      params.push(country)
    }

    query += ' ORDER BY c.name ASC'

    const result = await pool.query<{
      id: number
      name: string
      country: string | null
      latitude: number | null
      longitude: number | null
    }>(query, params.length > 0 ? params : undefined)

    const cities = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      country: row.country || 'GR',
      latitude: row.latitude,
      longitude: row.longitude,
    }))

    return NextResponse.json({
      data: cities,
      meta: {
        plan_id: 'demo',
        gated: false,
        total_available: cities.length,
        total_returned: cities.length,
      },
    })
  } catch (error: any) {
    console.error('[cities] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: 'Failed to fetch cities',
        },
      },
      { status: 500 }
    )
  }
})
