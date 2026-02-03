import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/me
 * Pure proxy to backend /api/auth/me
 * 
 * BACKEND IS THE SINGLE SOURCE OF TRUTH.
 * This endpoint forwards the request to backend and returns the response verbatim.
 * No JWT verification or permission logic here.
 */
export async function GET(request: NextRequest) {
  try {
    // Get backend URL
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
      (process.env.NODE_ENV === 'production' 
        ? 'https://api.leadscope.gr'
        : 'http://localhost:3000')
    
    const backendUrl = `${API_BASE_URL}/api/auth/me`
    console.log('[auth/me] Proxying request to backend:', backendUrl)
    console.log('[auth/me] API_BASE_URL:', API_BASE_URL)
    console.log('[auth/me] NODE_ENV:', process.env.NODE_ENV)
    console.log('[auth/me] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL)
    
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

    console.log('[auth/me] Backend response status:', response.status)

    // Get response body
    const data = await response.json()

    // Return backend response verbatim
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('[auth/me] Proxy error:', {
      message: error.message,
      code: error.code,
      cause: error.cause,
      stack: error.stack,
      API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 
        (process.env.NODE_ENV === 'production' 
          ? 'https://api.leadscope.gr'
          : 'http://localhost:3001'),
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
          gate_reason: `Failed to connect to backend: ${error.message || 'Unknown error'}. Backend URL: ${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.leadscope.gr' : 'http://localhost:3000')}`,
        },
      },
      { status: 503 }
    )
  }
}
