import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'

/**
 * API route to get current user from JWT token
 * 
 * GET /api/auth/user
 * Returns: { user: User | null }
 */
export async function GET() {
  try {
    const user = await getServerUser()

    return NextResponse.json({ user })
  } catch (error: any) {
    console.error('Failed to get user:', error)
    return NextResponse.json(
      { error: 'Failed to get user', user: null },
      { status: 500 }
    )
  }
}
