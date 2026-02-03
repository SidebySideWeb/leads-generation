import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.leadscope.gr' : 'http://localhost:3001')

/**
 * Proxy login request to backend
 * POST /api/auth/login
 * Body: { email: string, password: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Forward request to backend
    const backendResponse = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const backendData = await backendResponse.json().catch(() => ({}))

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          error: backendData.error || backendData.message || 'Login failed',
        },
        { status: backendResponse.status }
      )
    }

    // If backend returns a token, set it in http-only cookie
    const token = backendData.token || backendData.data?.token
    if (token) {
      const response = NextResponse.json({
        token,
        data: { token },
      })

      // Set http-only cookie with cross-domain settings
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: true, // HTTPS only (required for sameSite: 'none')
        sameSite: 'none', // Required for cross-domain (www.leadscope.gr -> api.leadscope.gr)
        domain: '.leadscope.gr', // Shared domain cookie
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })
      
      // Debug logging (temporary)
      console.log('[AUTH] Login cookie set:', {
        origin: request.headers.get('origin'),
        cookieSet: true,
        domain: '.leadscope.gr',
      })

      return response
    }

    return NextResponse.json(backendData)
  } catch (error: any) {
    console.error('[login] Error:', error)
    return NextResponse.json(
      { error: 'Network error. Please try again.' },
      { status: 500 }
    )
  }
}
