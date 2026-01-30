import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Debug endpoint to check cookie reception
 * GET /api/debug/cookies
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const cookieHeader = request.headers.get('cookie')
  
  const allCookies = cookieStore.getAll()
  const tokenCookie = cookieStore.get('token')
  
  return NextResponse.json({
    cookiesFromNextJS: allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })),
    tokenCookieFromNextJS: tokenCookie ? { name: tokenCookie.name, hasValue: !!tokenCookie.value } : null,
    cookieHeader: cookieHeader ? cookieHeader.substring(0, 500) : null,
    tokenInHeader: cookieHeader?.includes('token=') || false,
  })
}
