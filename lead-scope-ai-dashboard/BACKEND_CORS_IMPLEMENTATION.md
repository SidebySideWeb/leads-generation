# Backend CORS Implementation Guide

This guide provides the exact code needed to fix CORS and authentication cookies in the backend repository.

## Quick Implementation

1. **Create `src/middleware/cors.ts`** (see code below)
2. **Update `src/server.ts`** to use CORS middleware first
3. **Update all auth routes** to set cookies correctly
4. **Test and deploy**

## Code Files

### `src/middleware/cors.ts`

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
 * Debug logging for CORS (temporary - remove after verification)
 */
export function corsDebug(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin
  console.log('[CORS] Request origin:', origin)
  console.log('[CORS] Request method:', req.method)
  console.log('[CORS] Request path:', req.path)
  next()
}
```

### Update `src/server.ts`

```typescript
import express from 'express'
import { corsMiddleware, corsDebug } from './middleware/cors.js'
// ... other imports

const app = express()

// CORS middleware - MUST be first, before all other middleware
app.use(corsMiddleware)
app.use(corsDebug) // Temporary - remove after verification

// Other middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ... rest of your routes
```

### Cookie Helper Function

Create `src/utils/cookies.ts`:

```typescript
import { Response } from 'express'

/**
 * Set authentication cookie with proper cross-domain settings
 */
export function setAuthCookie(res: Response, token: string) {
  res.cookie('auth-token', token, {
    httpOnly: true,
    secure: true, // HTTPS only
    sameSite: 'none', // Required for cross-domain
    domain: '.leadscope.gr', // Shared domain cookie
    path: '/',
    maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in milliseconds
  })
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(res: Response) {
  res.clearCookie('auth-token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: '.leadscope.gr',
    path: '/',
  })
}
```

### Updated Auth Routes Example

#### `src/api/auth/login.ts`

```typescript
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { setAuthCookie } from '../utils/cookies.js'
// ... your auth imports

export async function loginHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // ... validate credentials and get user from database
    // const user = await validateUser(email, password)

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    // Set cookie with proper cross-domain settings
    setAuthCookie(res, token)

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
      token, // Also return in body for compatibility
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

#### `src/api/auth/register.ts`

```typescript
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { setAuthCookie } from '../utils/cookies.js'
// ... your auth imports

export async function registerHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    // ... create user in database
    // const user = await createUser(email, password)

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    // Set cookie
    setAuthCookie(res, token)

    // Debug logging
    const decoded = jwt.decode(token) as { id: string; email: string } | null
    console.log('[AUTH] Registration successful:', {
      origin: req.headers.origin,
      userId: decoded?.id,
      email: decoded?.email,
      cookieSet: true,
    })

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('[AUTH] Registration error:', error)
    res.status(400).json({ error: 'Registration failed' })
  }
}
```

#### `src/api/auth/logout.ts`

```typescript
import { Request, Response } from 'express'
import { clearAuthCookie } from '../utils/cookies.js'

export async function logoutHandler(req: Request, res: Response) {
  clearAuthCookie(res)
  res.json({ success: true, message: 'Logged out successfully' })
}
```

#### `src/api/auth/me.ts`

```typescript
import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
// ... your user database imports

export async function meHandler(req: Request, res: Response) {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies['auth-token'] || 
                  req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { 
      id: string
      email: string 
    }

    // ... fetch user from database
    // const user = await getUserById(decoded.id)

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

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

## Installation

If using `cookie-parser`:

```bash
npm install cookie-parser
npm install --save-dev @types/cookie-parser
```

Then in `src/server.ts`:

```typescript
import cookieParser from 'cookie-parser'

app.use(cookieParser())
```

## Verification Steps

1. **Check CORS headers**:
   ```bash
   curl -H "Origin: https://www.leadscope.gr" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://api.leadscope.gr/auth/login \
        -v
   ```
   Should return `Access-Control-Allow-Origin: https://www.leadscope.gr`

2. **Test login**:
   ```bash
   curl -X POST https://api.leadscope.gr/auth/login \
        -H "Origin: https://www.leadscope.gr" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test123"}' \
        -v -c cookies.txt
   ```
   Check that `Set-Cookie` header includes `domain=.leadscope.gr; SameSite=None; Secure`

3. **Test /auth/me**:
   ```bash
   curl -X GET https://api.leadscope.gr/auth/me \
        -H "Origin: https://www.leadscope.gr" \
        -b cookies.txt \
        -v
   ```

## Production Checklist

- [ ] CORS middleware added and applied first
- [ ] All auth routes use `setAuthCookie()` helper
- [ ] Cookies have `domain: '.leadscope.gr'`
- [ ] Cookies have `sameSite: 'none'` and `secure: true`
- [ ] OPTIONS requests return 200
- [ ] Debug logging added (remove after verification)
- [ ] Tested in browser DevTools
- [ ] Cookie visible in Application → Cookies
