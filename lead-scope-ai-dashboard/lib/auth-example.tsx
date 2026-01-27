/**
 * Example Server Component using authentication
 * 
 * This file demonstrates how to use auth in Server Components
 */

import { getCurrentUser, requireAuth, getUserPlan } from './auth-server'
import { redirect } from 'next/navigation'

// Example 1: Optional user (works for both authenticated and unauthenticated)
export async function ExampleOptionalUser() {
  const user = await getCurrentUser()
  
  if (!user) {
    return <div>Please log in</div>
  }
  
  return (
    <div>
      <p>Welcome, {user.email}!</p>
      <p>Your plan: {user.plan}</p>
    </div>
  )
}

// Example 2: Required authentication
export async function ExampleRequiredAuth() {
  const user = await requireAuth()
  
  return (
    <div>
      <h1>Protected Content</h1>
      <p>User ID: {user.id}</p>
      <p>Email: {user.email}</p>
      <p>Plan: {user.plan}</p>
    </div>
  )
}

// Example 3: Get plan only
export async function ExamplePlanOnly() {
  const plan = await getUserPlan()
  
  return (
    <div>
      <p>Current plan: {plan}</p>
      {plan === 'demo' && <p>Upgrade to unlock more features!</p>}
    </div>
  )
}

// Example 4: Redirect if not authenticated
export async function ExampleWithRedirect() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/(auth)/login')
  }
  
  return <div>Welcome, {user.email}!</div>
}

// Example 5: Conditional rendering based on plan
export async function ExamplePlanBasedContent() {
  const user = await getCurrentUser()
  const plan = user?.plan || 'demo'
  
  return (
    <div>
      {plan === 'pro' && <div>Pro features unlocked!</div>}
      {plan === 'starter' && <div>Starter plan active</div>}
      {plan === 'demo' && <div>Demo plan - upgrade to unlock more</div>}
    </div>
  )
}
