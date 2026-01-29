# Backend CORS + Auth Cookies Fix

This document contains the code changes needed for the backend repository (`https://github.com/SidebySideWeb/api-leadscope.git`) to fix CORS and authentication cookies for production.

## Files to Create/Modify

### 1. `src/middleware/cors.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from 'express'

const ALLOWED_ORIGIN = 'https://www.leadscope.gr'

/**
 * CORS middleware for production
 * Allows requests from https://www.leadscope.gr with credentials
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin

  // Allow requests from frontend domain
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    )
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    )
    res.setHeader('Access-Control-Max-Age', '86400') // 24 hours
  }

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  next()
}

/**
 * Debug logging for CORS (temporary)
 */
export function corsDebug(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin
  console.log('[CORS] Request origin:', origin)
  console.log('[CORS] Request method:', req.method)
  console.log('[CORS] Request path:', req.path)
  next()
}
```

### 2. Update `src/server.ts` (MODIFY)

Add CORS middleware before all routes:

```typescript
import express from 'express'
import { corsMiddleware, corsDebug } from './middleware/cors.js'

const app = express()

// CORS middleware - MUST be first
app.use(corsMiddleware)
app.use(corsDebug) // Temporary debug logging

// Other middleware
app.use(express.json())

// ... rest of your routes
```

### 3. Update Auth Routes Cookie Settings

For all auth routes (`/auth/login`, `/auth/register`, `/auth/logout`, `/auth/me`), ensure cookies are set with:

```typescript
// Example for login route
res.cookie('auth-token', token, {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'none', // Required for cross-domain
  domain: '.leadscope.gr', // Shared domain cookie
  path: '/',
  maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in milliseconds
})
```

### 4. Example Auth Route (`src/api/auth/login.ts`)

```typescript
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
// ... your auth logic

export async function loginHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body

    // ... validate credentials
    // ... get user from database

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    // Set cookie with proper cross-domain settings
    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: '.leadscope.gr',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days
    })

    // Debug logging
    const decoded = jwt.decode(token) as { id: string; email: string } | null
    console.log('[AUTH] Login successful:', {
      origin: req.headers.origin,
      userId: decoded?.id,
      email: decoded?.email,
      cookieSet: true,
    })

    res.json({
      success: true,
      token, // Also return token in response body (optional)
      user: {
        id: user.id,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('[AUTH] Login error:', error)
    res.status(401).json({ error: 'Invalid credentials' })
  }
}
```

### 5. Example `/auth/me` Route

```typescript
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export async function meHandler(req: Request, res: Response) {
  try {
    const token = req.cookies['auth-token'] || req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string }

    // ... fetch user from database

    res.json({
      user: {
        id: user.id,
        email: user.email,
        // ... other user fields
      },
    })
  } catch (error) {
    console.error('[AUTH] Me error:', error)
    res.status(401).json({ error: 'Invalid token' })
  }
}
```

## Environment Variables

Ensure these are set in production:

```env
JWT_SECRET=your-secret-key
NODE_ENV=production
```

## Testing Checklist

- [ ] Browser no longer shows CORS error
- [ ] Login request succeeds
- [ ] Cookie is visible in DevTools → Application → Cookies (domain: `.leadscope.gr`)
- [ ] `/auth/me` works on page refresh
- [ ] Registration works
- [ ] Logout clears cookie

## Important Notes

1. **Domain Cookie**: Using `.leadscope.gr` allows the cookie to be shared between `www.leadscope.gr` and `api.leadscope.gr`
2. **SameSite: 'none'**: Required for cross-domain cookies (must use with `secure: true`)
3. **Secure: true**: Required for HTTPS and `sameSite: 'none'`
4. **CORS Origin**: Only allow `https://www.leadscope.gr` (no wildcards for security)
