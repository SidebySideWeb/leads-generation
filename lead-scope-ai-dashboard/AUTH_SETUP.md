# Authentication Setup Guide

## Overview

Minimal JWT-based authentication system for Next.js. Tokens are stored in http-only cookies and decoded server-side only.

## Architecture

- **JWT Token**: Stored in http-only cookie (`auth-token`)
- **Server-Side Only**: Token decoding happens in Server Components/API routes
- **No Client Exposure**: Token is never exposed to client-side JavaScript
- **User Object**: `{ id: string, email: string, plan: 'demo' | 'starter' | 'pro' }`

## Environment Variables

Add to `.env.local`:

```env
JWT_SECRET=your-secret-key-must-match-backend
```

⚠️ **Important**: The `JWT_SECRET` must match the secret used by your backend to sign tokens.

## API Routes

### Set Token (POST `/api/auth/set-token`)

Called by backend after successful login to set the http-only cookie.

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true
}
```

### Get User (GET `/api/auth/user`)

Returns current user from JWT token.

**Response:**
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "plan": "pro"
  }
}
```

### Clear Token (DELETE `/api/auth/set-token`)

Clears the auth token cookie (logout).

**Response:**
```json
{
  "success": true
}
```

## Server Component Usage

### Get Current User (Optional)

```tsx
import { getCurrentUser } from '@/lib/auth-server'

export default async function MyPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    return <div>Please log in</div>
  }
  
  return <div>Welcome, {user.email}! Plan: {user.plan}</div>
}
```

### Require Authentication

```tsx
import { requireAuth } from '@/lib/auth-server'

export default async function ProtectedPage() {
  const user = await requireAuth() // Throws if not authenticated
  
  return <div>Welcome, {user.email}!</div>
}
```

### Get User Plan Only

```tsx
import { getUserPlan } from '@/lib/auth-server'

export default async function MyPage() {
  const plan = await getUserPlan() // Returns 'demo' if not authenticated
  
  return <div>Current plan: {plan}</div>
}
```

## JWT Token Structure

Your backend should issue JWT tokens with this payload:

```json
{
  "id": "user-123",
  "email": "user@example.com",
  "plan": "pro",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Required fields:**
- `id`: User ID (string)
- `email`: User email (string)
- `plan`: User plan ('demo' | 'starter' | 'pro')

**Optional fields:**
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

## Middleware

The `middleware.ts` file protects dashboard routes by checking for the auth token cookie. If no token is present, users are redirected to login.

## Backend Integration

### After Login

When a user successfully logs in, your backend should:

1. Generate JWT token with user data
2. Call `/api/auth/set-token` to set the http-only cookie:

```typescript
// Backend code (example)
const response = await fetch('https://yourdomain.com/api/auth/set-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: jwtToken }),
  credentials: 'include', // Important for cookies
})
```

### Token Verification

The frontend automatically verifies tokens server-side using the `JWT_SECRET`. Make sure this matches your backend secret.

## Security Features

✅ **Http-Only Cookies**: Token cannot be accessed via JavaScript
✅ **Server-Side Only**: Token decoding happens server-side
✅ **Secure in Production**: Cookie is secure (HTTPS only) in production
✅ **SameSite Protection**: Cookie uses 'lax' SameSite policy
✅ **JWT Verification**: Tokens are verified using secret key
✅ **Expiration Handling**: Expired tokens are automatically rejected

## Example: Using Auth in Dashboard

```tsx
// app/(dashboard)/page.tsx
import { getCurrentUser } from '@/lib/auth-server'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const plan = user?.plan || 'demo'
  
  // Use plan for conditional rendering
  return (
    <div>
      {plan === 'pro' && <ProFeatures />}
      {plan === 'demo' && <UpgradePrompt />}
    </div>
  )
}
```

## Troubleshooting

### Token Not Working

1. Check `JWT_SECRET` matches backend
2. Verify token is being set in cookie (check browser DevTools > Application > Cookies)
3. Check token hasn't expired
4. Verify token payload includes required fields (id, email, plan)

### User Always Null

1. Check cookie is being set correctly
2. Verify JWT secret matches
3. Check token format is valid JWT
4. Verify token includes required fields

## Next Steps

1. ✅ Auth utilities created
2. ✅ API routes created
3. ✅ Server component helpers created
4. ⏳ Backend integration (set token after login)
5. ⏳ Update billing page to use real user plan
6. ⏳ Add logout functionality
