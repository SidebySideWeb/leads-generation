import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://api.leadscope.gr'
    : 'http://localhost:3000')

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
    
    console.log(`[cities] Proxying request to: ${url}`)
    
    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[cities] Backend returned ${response.status}:`, errorText)
      
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || 'Failed to fetch cities from backend' }
      }
      
      return NextResponse.json(
        {
          data: [],
          meta: {
            plan_id: 'demo',
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: errorData.error || errorData.gate_reason || `Backend error: ${response.status}`,
          },
        },
        { status: response.status }
      )
    }

    const json = await response.json()
    console.log(`[cities] Successfully fetched ${json.data?.length || 0} cities`)
    return NextResponse.json(json)
  } catch (error: any) {
    console.error('[cities] Proxy error:', error)
    
    // Handle specific error types
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        {
          data: [],
          meta: {
            plan_id: 'demo',
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Backend request timed out. Please ensure the backend is running and accessible.',
          },
        },
        { status: 504 }
      )
    }
    
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      return NextResponse.json(
        {
          data: [],
          meta: {
            plan_id: 'demo',
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: `Cannot connect to backend at ${API_BASE_URL}. Please ensure the backend is running.`,
          },
        },
        { status: 502 }
      )
    }
    
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
