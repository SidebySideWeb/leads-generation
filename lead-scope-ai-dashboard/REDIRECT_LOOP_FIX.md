# 307 Redirect Loop Fix

## Issues Found

1. **Cookie Name Mismatch**
   - Backend was setting cookie as `auth-token`
   - Frontend middleware was checking for `token`
   - Frontend JWT utility was using `auth-token`

2. **Missing Domain in Cookie Options**
   - Backend cookie options were missing `domain: '.leadscope.gr'`
   - This prevented cross-subdomain cookie sharing between `api.leadscope.gr` and `www.leadscope.gr`

3. **Redirect Loop**
   - After login, redirect to `/datasets` happened before cookie was available
   - Middleware checked for cookie, didn't find it, redirected to `/login`
   - Created infinite redirect loop

## Fixes Applied

### Backend (`leads-generation-backend/src/api/auth.ts`)

1. **Updated Cookie Name**
   ```typescript
   // Changed from 'auth-token' to 'token'
   res.cookie('token', token, COOKIE_OPTIONS);
   ```

2. **Added Domain to Cookie Options**
   ```typescript
   const COOKIE_OPTIONS = {
     httpOnly: true,
     secure: true,
     sameSite: 'none' as const,
     domain: '.leadscope.gr', // Added for cross-subdomain sharing
     path: '/',
     maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days
   };
   ```

3. **Updated JWT Utility** (`src/utils/jwt.ts`)
   - Changed `getTokenFromCookie()` to check for `token` instead of `auth-token`

### Frontend (`lead-scope-ai-dashboard`)

1. **Updated JWT Utility** (`lib/jwt.ts`)
   ```typescript
   const COOKIE_NAME = 'token' // Changed from 'auth-token'
   ```

2. **Added Middleware Logging** (`middleware.ts`)
   - Added console logs to debug cookie presence
   - Helps identify timing issues

## Testing Checklist

After deployment, verify:

1. ✅ Login sets `token` cookie with domain `.leadscope.gr`
2. ✅ Cookie is accessible on `www.leadscope.gr` after login
3. ✅ Redirect to `/datasets` works without 307 loop
4. ✅ Middleware allows access when cookie is present
5. ✅ Middleware redirects to `/login` when cookie is missing

## Cookie Configuration

The cookie is now configured as:
- **Name**: `token`
- **Domain**: `.leadscope.gr` (shared across subdomains)
- **HttpOnly**: `true` (not accessible via JavaScript)
- **Secure**: `true` (HTTPS only)
- **SameSite**: `none` (required for cross-domain)
- **Path**: `/`
- **MaxAge**: 7 days

## Next Steps

1. Deploy backend changes
2. Deploy frontend changes
3. Test login flow end-to-end
4. Monitor console logs for middleware debugging
