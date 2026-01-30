/**
 * Datasets API Route
 * 
 * GET /api/datasets
 * 
 * Pure proxy to backend /datasets endpoint.
 * BACKEND IS THE SINGLE SOURCE OF TRUTH.
 */

import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://api.leadscope.gr'
    : 'http://localhost:3001')

export async function GET(request: NextRequest) {
  try {
    // Forward request to backend
    const cookieHeader = request.headers.get('cookie')
    const response = await fetch(`${API_BASE_URL}/datasets`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader || '',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    // Get response body
    const data = await response.json()

    // Return backend response verbatim
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('[datasets] Proxy error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: 'Failed to connect to backend',
        },
      },
      { status: 503 }
    )
  }
}
