/**
 * Exports API Route
 * 
 * GET /api/exports?datasetId=...
 * 
 * Proxies to backend /exports endpoint
 */

import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.leadscope.gr'
  : 'http://localhost:3000'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const datasetId = searchParams.get('datasetId')
    
    // Build backend URL
    let backendUrl = `${API_BASE_URL}/exports`
    if (datasetId) {
      backendUrl += `?dataset=${datasetId}`
    }

    // Forward request to backend
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[exports] Backend error:', response.status, errorText)
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: 'demo',
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: `Backend returned ${response.status}`,
          },
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[exports] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to fetch exports',
        },
      },
      { status: 500 }
    )
  }
}
