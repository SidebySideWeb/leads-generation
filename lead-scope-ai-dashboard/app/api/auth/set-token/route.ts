import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'auth-token'

/**
 * API route to set JWT token in http-only cookie
 * Called by backend after successful authentication
 * 
 * POST /api/auth/set-token
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Set http-only cookie
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to set auth token:', error)
    return NextResponse.json(
      { error: 'Failed to set auth token' },
      { status: 500 }
    )
  }
}

/**
 * API route to clear auth token
 * 
 * DELETE /api/auth/set-token
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to clear auth token:', error)
    return NextResponse.json(
      { error: 'Failed to clear auth token' },
      { status: 500 }
    )
  }
}
