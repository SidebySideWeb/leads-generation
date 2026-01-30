import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

/**
 * GET /api/industries
 * Proxy to backend API (backend handles database queries)
 */
export async function GET() {
  try {
    const url = `${API_BASE_URL}/api/industries`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch industries' }))
      return NextResponse.json(
        {
          data: [],
          meta: {
            plan_id: 'demo',
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: error.error || 'Failed to fetch industries',
          },
        },
        { status: response.status }
      )
    }

    const json = await response.json()
    return NextResponse.json(json)
  } catch (error: any) {
    console.error('[industries] Error:', error)
    return NextResponse.json(
      {
        data: [],
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to fetch industries',
        },
      },
      { status: 500 }
    )
  }
}
