# JWT Regeneration on Plan Change

Automatic JWT token regeneration when user's plan changes in the database.

## Overview

When a user's plan changes (e.g., via Stripe webhook), the JWT token is automatically regenerated to reflect the new plan. This ensures the token always matches the current plan in the database.

## How It Works

### 1. Token Structure

JWT tokens contain:
- `id`: User ID
- `email`: User email
- `plan`: User plan (`demo` | `starter` | `pro`)
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp (30 minutes from issuance)

### 2. Automatic Regeneration

**Trigger**: When `getServerUser()` is called (in Server Components or API routes)

**Process**:
1. Decode current JWT token
2. Get user's current plan from database
3. Compare plan in token vs plan in database
4. If different: Generate new token with updated plan
5. Update http-only cookie with new token

### 3. Webhook Integration

When Stripe webhook updates a subscription:
- Plan is updated in database
- Token regeneration is triggered on next request
- User's next request automatically gets updated token

## Token TTL

- **Maximum TTL**: 30 minutes
- **Regeneration**: Happens automatically when plan changes
- **Cookie**: Http-only, secure in production, SameSite=lax

## Usage

### In Server Components

```tsx
import { getCurrentUser } from '@/lib/auth-server'

export default async function MyPage() {
  const user = await getCurrentUser()
  // Token is automatically regenerated if plan changed
  // user.plan always reflects current plan from database
  return <div>Plan: {user?.plan}</div>
}
```

### In API Routes

```tsx
import { getServerUser } from '@/lib/auth'

export async function GET() {
  const user = await getServerUser()
  // Token is automatically regenerated if plan changed
  return Response.json({ user })
}
```

## Functions

### `checkAndRegenerateToken(token: string)`

Checks if plan in DB differs from plan in token. If different, regenerates token and updates cookie.

**Returns**: New token string if regenerated, `null` if no change needed

### `regenerateTokenForUser(userId: string)`

Regenerates JWT token for a specific user (used by webhook handler).

**Returns**: New token string or `null` if user not found

## Security

- ✅ **Http-Only Cookie**: Token cannot be accessed via JavaScript
- ✅ **Automatic Regeneration**: Token always reflects current plan
- ✅ **30-Minute TTL**: Tokens expire after 30 minutes
- ✅ **Server-Side Only**: Token generation happens server-side only

## Example Flow

1. User subscribes to Pro plan
2. Stripe webhook updates database: `plan = 'pro'`
3. User makes next request
4. `getServerUser()` is called
5. Token has `plan = 'starter'`, DB has `plan = 'pro'`
6. New token generated with `plan = 'pro'`
7. Cookie updated with new token
8. User object returned with `plan = 'pro'`

## Database Query

The system queries the `subscriptions` table:

```sql
SELECT plan FROM subscriptions
WHERE user_id = $1
  AND status IN ('active', 'trialing')
ORDER BY created_at DESC
LIMIT 1
```

Falls back to `'demo'` if no active subscription found.
