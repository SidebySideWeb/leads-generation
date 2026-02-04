# Troubleshooting "Failed to fetch datasets" Error

## Common Causes

### 1. Backend Not Running

**Check if backend is running:**
```powershell
netstat -ano | findstr LISTENING | findstr :3001
```

**Start backend:**
```powershell
cd leads-generation-backend
$env:PORT=3001
npm run dev
```

### 2. Frontend Missing Environment Variable

**Create `.env.local` file** in `lead-scope-ai-dashboard` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Restart frontend** after creating `.env.local`:
```powershell
cd lead-scope-ai-dashboard
npm run dev
```

### 3. Backend Database Connection Failed

The backend requires a database connection. Check:
- Database is running (PostgreSQL)
- `.env` file in `leads-generation-backend` has correct `DATABASE_URL` or `DB_*` variables
- Database credentials are correct

### 4. Authentication Issue

If you see 401/403 errors:
- Make sure you're logged in
- Check browser console for auth errors
- Verify JWT cookie is being sent

## Quick Diagnostic Steps

1. **Check backend health:**
   ```powershell
   curl http://localhost:3001/health
   ```
   Should return JSON with status "ok"

2. **Check frontend API route:**
   Open browser console and look for:
   - `[datasets] Proxying request to backend: http://localhost:3001/datasets`
   - Any connection errors

3. **Verify environment variable:**
   In browser console, check if `NEXT_PUBLIC_API_URL` is set:
   ```javascript
   // This won't work in browser, but check server logs
   ```

## Expected Behavior

- Backend running on: `http://localhost:3001`
- Frontend running on: `http://localhost:3000`
- Frontend connects to backend via `NEXT_PUBLIC_API_URL`

## Still Having Issues?

1. Check backend terminal for errors
2. Check frontend terminal for errors
3. Check browser console (F12) for network errors
4. Verify both services are running on correct ports
