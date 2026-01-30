import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

/**
 * GET /api/industries
 * Proxy to backend API (backend handles database queries)
 */
export async function GET() {
  try {
    const url = `${API_BASE_URL}/api/industries`
    console.log(`[industries] Proxying request to: ${url}`)
    
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
      console.error(`[industries] Backend returned ${response.status}:`, errorText)
      
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || 'Failed to fetch industries from backend' }
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
    console.log(`[industries] Successfully fetched ${json.data?.length || 0} industries`)
    return NextResponse.json(json)
  } catch (error: any) {
    console.error('[industries] Proxy error:', error)
    
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
          gate_reason: error.message || 'Failed to fetch industries',
        },
      },
      { status: 500 }
    )
  }
}
