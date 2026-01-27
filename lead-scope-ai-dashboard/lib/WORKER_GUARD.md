# Worker Secret Guard

Protects all `/api/internal/*` routes with `X-WORKER-SECRET` header authentication. Only allows Vercel as caller (server-to-server only).

## Overview

Worker endpoints are protected by:
1. **X-WORKER-SECRET Header**: Required for all `/api/internal/*` routes
2. **Vercel-Only Access**: In production, only requests from Vercel are allowed
3. **Server-Side Only**: Never exposed publicly, no client access

## Security Features

- **Secret Validation**: Constant-time comparison to prevent timing attacks
- **Vercel Verification**: Checks for Vercel-specific headers in production
- **Automatic Rejection**: Returns 401/403 for invalid requests
- **No Public Access**: Worker endpoints are never accessible from client

## Configuration

### Environment Variable

Set `WORKER_SECRET` in your environment:

```bash
# .env.local (for local development)
WORKER_SECRET=your-secret-key-here

# Vercel Environment Variables
WORKER_SECRET=your-production-secret-key
```

**Important**: 
- Use a strong, random secret (at least 32 characters)
- Never commit the secret to version control
- Use different secrets for development and production
- Rotate secrets periodically

### Generating a Secret

```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Usage

### Protecting Internal Routes

All routes under `/api/internal/*` are automatically protected by middleware.

**Example Route** (`app/api/internal/crawl/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withWorkerGuard } from '@/lib/worker-guard'

export const POST = withWorkerGuard(async (request: NextRequest) => {
  // Request is already validated - X-WORKER-SECRET is valid
  // Only Vercel can call this endpoint
  
  const body = await request.json()
  
  // Process worker task
  // ...
  
  return NextResponse.json({ success: true })
})
```

### Manual Guard Check

```typescript
import { workerGuard } from '@/lib/worker-guard'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Check worker guard
  const guardResponse = workerGuard(request)
  if (guardResponse) {
    return guardResponse // Guard rejected the request
  }
  
  // Request is valid, proceed
  // ...
}
```

## Request Headers

### Required Header

```
X-WORKER-SECRET: <your-worker-secret>
```

### Vercel Headers (Production)

In production, Vercel automatically adds:
- `x-vercel-id`: Vercel deployment ID
- `x-vercel-signature`: Vercel signature
- `x-forwarded-host`: Vercel host

## Response Codes

- **200 OK**: Request is valid and processed
- **401 Unauthorized**: Missing or invalid `X-WORKER-SECRET` header
- **403 Forbidden**: Request is not from Vercel (production only)

## Example Responses

### Missing Header

```json
{
  "error": "Unauthorized",
  "message": "Missing X-WORKER-SECRET header. Worker endpoints require authentication."
}
```

### Invalid Secret

```json
{
  "error": "Unauthorized",
  "message": "Invalid X-WORKER-SECRET header. Authentication failed."
}
```

### Not from Vercel (Production)

```json
{
  "error": "Forbidden",
  "message": "Worker endpoints are only accessible from Vercel."
}
```

## Vercel Integration

### Serverless Functions

When calling worker endpoints from Vercel serverless functions:

```typescript
// In your Vercel serverless function
const response = await fetch('https://your-app.vercel.app/api/internal/crawl', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-WORKER-SECRET': process.env.WORKER_SECRET, // From Vercel environment variables
  },
  body: JSON.stringify({ datasetId: '...' }),
})
```

### Cron Jobs

For Vercel cron jobs, add the header:

```json
{
  "crons": [
    {
      "path": "/api/internal/crawl",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Then in your cron handler:

```typescript
// app/api/internal/crawl/route.ts
import { withWorkerGuard } from '@/lib/worker-guard'

export const GET = withWorkerGuard(async (request: NextRequest) => {
  // Verify header is present (middleware already validated)
  const secret = request.headers.get('x-worker-secret')
  
  // Process cron job
  // ...
})
```

## Development

In development mode (`NODE_ENV=development`), the guard:
- Still requires `X-WORKER-SECRET` header
- Allows requests from any origin (for local testing)
- Logs warnings if `WORKER_SECRET` is not set

## Security Best Practices

1. **Never Expose Secret**: Never include `WORKER_SECRET` in client-side code
2. **Use Strong Secrets**: Generate random, long secrets (32+ characters)
3. **Rotate Regularly**: Change secrets periodically
4. **Separate Environments**: Use different secrets for dev/staging/production
5. **Monitor Access**: Log all worker endpoint access for security auditing
6. **Rate Limiting**: Consider adding rate limiting for worker endpoints

## Testing

### Local Testing

```bash
# Set secret in .env.local
WORKER_SECRET=test-secret-key

# Test with curl
curl -X POST http://localhost:3000/api/internal/crawl \
  -H "Content-Type: application/json" \
  -H "X-WORKER-SECRET: test-secret-key" \
  -d '{"datasetId": "test-id"}'
```

### Production Testing

```bash
# Test from Vercel serverless function
# Secret is automatically available via process.env.WORKER_SECRET
```

## Troubleshooting

### "Worker secret not configured"

**Problem**: `WORKER_SECRET` environment variable is not set.

**Solution**: Set `WORKER_SECRET` in your environment variables (`.env.local` for local, Vercel dashboard for production).

### "Missing X-WORKER-SECRET header"

**Problem**: Request doesn't include the required header.

**Solution**: Add `X-WORKER-SECRET` header to your request with the correct secret value.

### "Not from Vercel"

**Problem**: In production, request is not from Vercel.

**Solution**: 
- Ensure request is made from a Vercel serverless function or cron job
- Check that Vercel headers are present (`x-vercel-id`, etc.)
- For local development, this check is bypassed

## Related Files

- `lib/worker-guard.ts`: Worker guard implementation
- `middleware.ts`: Middleware that applies worker guard
- `lib/api-guard.ts`: User authentication guard (for regular API routes)
