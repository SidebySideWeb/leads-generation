/**
 * Server component utilities for authentication
 * Use these in Server Components to access user and plan
 */

import { getServerUser } from './auth'
import type { User } from './types'

/**
 * Get current user in a Server Component
 * 
 * Usage:
 * ```tsx
 * export default async function MyPage() {
 *   const user = await getCurrentUser()
 *   if (!user) {
 *     redirect('/login')
 *   }
 *   return <div>Welcome {user.email}</div>
 * }
 * ```
 */
export async function getCurrentUser(): Promise<User | null> {
  return getServerUser()
}

/**
 * Require authentication in a Server Component
 * Throws error if user is not authenticated
 * 
 * Usage:
 * ```tsx
 * export default async function ProtectedPage() {
 *   const user = await requireAuth()
 *   return <div>Welcome {user.email}, Plan: {user.plan}</div>
 * }
 * ```
 */
export async function requireAuth(): Promise<User> {
  const user = await getServerUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}

/**
 * Get user plan in a Server Component
 * Returns 'demo' as fallback if user is not authenticated
 * 
 * Usage:
 * ```tsx
 * export default async function MyPage() {
 *   const plan = await getUserPlan()
 *   return <div>Current plan: {plan}</div>
 * }
 * ```
 */
export async function getUserPlan(): Promise<'demo' | 'starter' | 'pro'> {
  const user = await getServerUser()
  return user?.plan || 'demo'
}
