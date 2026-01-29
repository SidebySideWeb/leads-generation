# Deployment Checklist for Register Route Fix

## Files That MUST Be Included in Deployment

### 1. API Route Files (Critical)
These files must be committed and deployed:

```
✅ app/api/auth/register/route.ts
✅ app/api/auth/login/route.ts
✅ app/api/auth/user/route.ts
✅ app/api/auth/set-token/route.ts
```

### 2. Configuration Files
```
✅ next.config.mjs
✅ package.json
✅ tsconfig.json
✅ middleware.ts
```

### 3. Supporting Files
```
✅ lib/api.ts (contains register() method)
✅ lib/api-guard-utils.ts (allows /api/auth/* routes)
✅ app/(auth)/register/page.tsx (frontend registration page)
```

## Pre-Deployment Verification

### Step 1: Verify Files Are Committed
```bash
git status
# Should show "nothing to commit, working tree clean"
```

### Step 2: Verify Route Files Exist
```bash
# Check these files exist:
ls app/api/auth/register/route.ts
ls app/api/auth/login/route.ts
```

### Step 3: Verify No Build Errors
```bash
cd lead-scope-ai-dashboard
npm run build
# Should complete without errors
```

## Deployment Steps

### For Vercel Deployment:

1. **Push to Git**
   ```bash
   git add .
   git commit -m "Fix: Include register API route in deployment"
   git push origin main
   ```

2. **Verify Vercel Build**
   - Go to Vercel Dashboard
   - Check latest deployment logs
   - Verify `app/api/auth/register/route.ts` is included in build

3. **Check Environment Variables**
   Ensure these are set in Vercel:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://api.leadscope.gr
   JWT_SECRET=<your-secret>
   DATABASE_URL=<your-database-url>
   ```

4. **Test After Deployment**
   ```bash
   # Test the route exists
   curl -X POST https://www.leadscope.gr/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test1234"}'
   ```

## Common Issues

### Issue: 404 After Deployment
**Solution**: 
- Verify route file is committed: `git ls-files app/api/auth/register/route.ts`
- Check Vercel build logs for errors
- Ensure `next.config.mjs` doesn't exclude API routes

### Issue: Route Not Found in Build
**Solution**:
- Check `.vercelignore` doesn't exclude `app/api/`
- Verify file structure matches Next.js App Router conventions
- Ensure route exports `POST` function correctly

### Issue: TypeScript Errors
**Solution**:
- Run `npm run build` locally first
- Fix any TypeScript errors before deploying
- Check `tsconfig.json` includes `app/` directory

## Post-Deployment Verification

1. ✅ Route responds: `POST /api/auth/register` returns 400 (not 404)
2. ✅ Login route still works: `POST /api/auth/login`
3. ✅ Frontend can call register endpoint
4. ✅ Cookies are set correctly (check DevTools → Application → Cookies)

## Files Structure (Must Match)

```
lead-scope-ai-dashboard/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── login/
│   │       │   └── route.ts ✅
│   │       ├── register/
│   │       │   └── route.ts ✅ (THIS MUST BE DEPLOYED)
│   │       ├── user/
│   │       │   └── route.ts ✅
│   │       └── set-token/
│   │           └── route.ts ✅
│   └── (auth)/
│       └── register/
│           └── page.tsx ✅
├── lib/
│   ├── api.ts ✅
│   └── api-guard-utils.ts ✅
├── middleware.ts ✅
├── next.config.mjs ✅
└── package.json ✅
```

## Quick Fix Command

If route is missing, ensure it's committed:

```bash
cd lead-scope-ai-dashboard
git add app/api/auth/register/route.ts
git commit -m "Add register API route"
git push origin main
```

Then trigger a new deployment in Vercel.
