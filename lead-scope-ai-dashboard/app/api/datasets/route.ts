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
    : 'http://localhost:3000')

export async function GET(request: NextRequest) {
  try {
    const backendUrl = `${API_BASE_URL}/datasets`
    console.log('[datasets] Proxying request to backend:', backendUrl)
    console.log('[datasets] API_BASE_URL:', API_BASE_URL)
    console.log('[datasets] NODE_ENV:', process.env.NODE_ENV)
    console.log('[datasets] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL)
    
    // Forward request to backend
    const cookieHeader = request.headers.get('cookie')
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader || '',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    console.log('[datasets] Backend response status:', response.status)

    // Get response body
    const data = await response.json()

    // Return backend response verbatim
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('[datasets] Proxy error:', {
      message: error.message,
      code: error.code,
      cause: error.cause,
      stack: error.stack,
      API_BASE_URL,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
    })
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: `Failed to connect to backend: ${error.message || 'Unknown error'}. Backend URL: ${API_BASE_URL}`,
        },
      },
      { status: 503 }
    )
  }
}
