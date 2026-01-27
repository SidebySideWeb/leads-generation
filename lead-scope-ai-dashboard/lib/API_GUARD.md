# API Route Guard Middleware

Centralized authentication and subscription validation for all API routes.

## Overview

The API guard middleware:
- Validates authenticated user (JWT token)
- Validates active subscription (not expired, not canceled)
- Attaches user and permissions to request context
- Rejects unauthorized or invalid requests

**No route should bypass this middleware** (except webhooks and public auth routes).

## Features

- **Authentication Validation**: Checks JWT token from http-only cookie
- **Subscription Validation**: Verifies subscription is active and not expired
- **Permission Attachment**: Attaches user permissions to request context
- **Automatic Rejection**: Returns 401/403 for invalid requests
- **Type Safety**: TypeScript types for guarded requests

## Usage

### Basic Usage with `withGuard`

```typescript
import { withGuard, type GuardedRequest } from '@/lib/api-guard'

export const POST = withGuard(async (
  request: GuardedRequest,
  { params }: { params: { datasetId: string } }
) => {
  // User and permissions are already validated and attached
  const user = request.user
  const permissions = request.permissions

  // Use user.id, permissions.max_export_rows, etc.
  // No need to check authentication - already done by guard

  return NextResponse.json({ success: true })
})
```

### Manual Guard Check

```typescript
import { apiGuard } from '@/lib/api-guard'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const guardResult = await apiGuard(request)

  if (!guardResult.allowed) {
    return NextResponse.json(
      { error: guardResult.error },
      { status: guardResult.statusCode || 403 }
    )
  }

  // Use guardResult.user and guardResult.permissions
  const user = guardResult.user!
  const permissions = guardResult.permissions!

  // ... rest of handler
}
```

## Guarded Request Context

When using `withGuard`, the request is extended with:

```typescript
interface GuardedRequest extends NextRequest {
  user: {
    id: string
    email: string
    plan: 'demo' | 'starter' | 'pro'
  }
  permissions: UserPermissions
}
```

## Validation Rules

### Authentication
- ✅ Valid JWT token in http-only cookie
- ❌ Missing or invalid token → 401 Unauthorized

### Subscription Status
- ✅ Active subscription (`status = 'active'` or `'trialing'`)
- ✅ Not expired (`current_period_end >= now`)
- ✅ Not canceled (`status != 'canceled'` and `status != 'past_due'`)
- ❌ Expired subscription → 403 Forbidden
- ❌ Canceled subscription → 403 Forbidden

### Demo Plan
- ✅ Users without subscription default to demo plan (allowed)
- ✅ Demo plan users can access API (with demo limits)

## Bypass Rules

These routes bypass the guard (public access):

- `/api/webhooks/*` - Stripe webhooks (signature verified separately)
- `/api/auth/*` - Authentication endpoints
- `/api/health` - Health check endpoint (optional)

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized. Please log in to continue.",
  "data": null,
  "meta": {
    "plan_id": "demo",
    "gated": true,
    "total_available": 0,
    "total_returned": 0,
    "gate_reason": "Unauthorized. Please log in to continue."
  }
}
```

### 403 Forbidden (Expired/Canceled)
```json
{
  "error": "Subscription has expired. Please renew your subscription to continue.",
  "data": null,
  "meta": {
    "plan_id": "demo",
    "gated": true,
    "total_available": 0,
    "total_returned": 0,
    "gate_reason": "Subscription has expired. Please renew your subscription to continue."
  }
}
```

## Integration Example

### Before (Manual Check)

```typescript
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check subscription manually...
  // Get permissions manually...

  // Actual handler logic
}
```

### After (With Guard)

```typescript
import { withGuard, type GuardedRequest } from '@/lib/api-guard'

export const POST = withGuard(async (
  request: GuardedRequest,
  context
) => {
  // User and permissions already validated and attached
  const { user, permissions } = request

  // Direct access to user.id, permissions.max_export_rows, etc.
  // No manual checks needed

  // Actual handler logic
})
```

## Security

- **Never Trusts Client**: Always validates from database
- **JWT Verification**: Validates token signature and expiration
- **Subscription Check**: Queries database for current subscription status
- **Expiration Check**: Validates `current_period_end` against current time
- **Status Check**: Rejects canceled or past_due subscriptions

## Best Practices

1. **Always use `withGuard`** for protected routes
2. **Never bypass guard** except for public routes
3. **Use `request.user` and `request.permissions`** instead of re-querying
4. **Handle guard errors gracefully** in UI
5. **Log guard rejections** for monitoring

## Migration Checklist

- [ ] Import `withGuard` and `GuardedRequest` types
- [ ] Wrap route handler with `withGuard()`
- [ ] Remove manual `getServerUser()` calls
- [ ] Remove manual subscription checks
- [ ] Use `request.user` and `request.permissions` from context
- [ ] Test with expired/canceled subscriptions
- [ ] Test with demo plan users
