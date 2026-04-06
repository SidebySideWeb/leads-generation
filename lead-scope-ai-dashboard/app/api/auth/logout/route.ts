import { NextResponse } from "next/server"

/**
 * Clears authentication cookies from the frontend domain.
 * We remove both cookie names used in the codebase for compatibility.
 */
export async function POST() {
  const response = NextResponse.json({ success: true })

  const cookieBase = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    expires: new Date(0),
    maxAge: 0,
    path: "/",
  }

  // Clear local-scope cookies
  response.cookies.set("token", "", cookieBase)
  response.cookies.set("auth-token", "", cookieBase)

  // Clear shared-domain cookies for production hostnames (e.g. www.leadscope.gr)
  response.cookies.set("token", "", { ...cookieBase, sameSite: "none", domain: ".leadscope.gr" })
  response.cookies.set("auth-token", "", { ...cookieBase, sameSite: "none", domain: ".leadscope.gr" })

  return response
}
