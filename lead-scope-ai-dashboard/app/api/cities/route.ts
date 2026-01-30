import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

/**
 * GET /api/cities
 * Proxy to backend API (backend handles database queries)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    
    const queryString = country ? `?country=${country}` : ''
    const url = `${API_BASE_URL}/api/cities${queryString}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch cities' }))
      return NextResponse.json(
        {
          data: [],
          meta: {
            plan_id: 'demo',
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: error.error || 'Failed to fetch cities',
          },
        },
        { status: response.status }
      )
    }

    const json = await response.json()
    return NextResponse.json(json)
  } catch (error: any) {
    console.error('[cities] Error:', error)
    return NextResponse.json(
      {
        data: [],
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to fetch cities',
        },
      },
      { status: 500 }
    )
  }
}
