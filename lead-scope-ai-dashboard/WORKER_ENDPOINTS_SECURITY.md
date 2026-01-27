# Worker Endpoints Security

All `/api/internal/*` routes are protected with `X-WORKER-SECRET` header authentication. Only Vercel is allowed as caller.

## Quick Start

1. **Set Environment Variable**:
   ```bash
   WORKER_SECRET=your-secret-key-here
   ```

2. **Generate Secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Use in Routes**:
   ```typescript
   import { withWorkerGuard } from '@/lib/worker-guard'
   
   export const POST = withWorkerGuard(async (request: NextRequest) => {
     // Your worker logic here
   })
   ```

## Protection

✅ **All `/api/internal/*` routes require `X-WORKER-SECRET` header**
✅ **Rejects if missing or invalid**
✅ **Only allows Vercel as caller (production)**
✅ **Never exposes worker endpoints publicly**

## Files

- `lib/worker-guard.ts`: Worker guard implementation
- `middleware.ts`: Applies worker guard to all `/api/internal/*` routes
- `lib/WORKER_GUARD.md`: Complete documentation

## Example

```typescript
// app/api/internal/crawl/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withWorkerGuard } from '@/lib/worker-guard'

export const POST = withWorkerGuard(async (request: NextRequest) => {
  // Request is validated - X-WORKER-SECRET is valid
  const body = await request.json()
  
  // Process worker task
  return NextResponse.json({ success: true })
})
```

## Testing

```bash
curl -X POST http://localhost:3000/api/internal/health \
  -H "X-WORKER-SECRET: your-secret-key"
```

## Security

- Constant-time secret comparison (prevents timing attacks)
- Vercel verification in production
- Automatic rejection of invalid requests
- Server-side only (never exposed to client)
