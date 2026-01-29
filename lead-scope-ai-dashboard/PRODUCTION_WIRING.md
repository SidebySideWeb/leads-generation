# Production Wiring Summary

## Environment Configuration

### Required Environment Variable

Set in Vercel (or `.env.local` for local dev):

```env
NEXT_PUBLIC_API_BASE_URL=https://api.leadscope.gr
```

**Fallback**: If not set, defaults to `http://localhost:3000` for local development.

## API Client Configuration

### Base URL

- **Production**: `https://api.leadscope.gr` (from `NEXT_PUBLIC_API_BASE_URL`)
- **Local Dev**: `http://localhost:3000` (fallback)

### Authentication

- All requests use `credentials: 'include'` to send cookies
- JWT stored in http-only cookie (set by backend after login)
- No custom auth headers needed
- On 401/403: Automatically redirects to `/login?redirect=<current_path>`

### Response Format

All API responses follow:
```typescript
{
  data: T | null,
  meta: {
    plan_id: 'demo' | 'starter' | 'pro',
    gated: boolean,
    total_available: number,
    total_returned: number,
    gate_reason?: string,
    upgrade_hint?: string
  }
}
```

## API Endpoints

### Implemented Methods

- `getDatasets()` → `GET /datasets`
- `getDataset(datasetId)` → `GET /datasets/:datasetId`
- `getDatasetResults(datasetId)` → `GET /datasets/:datasetId/results`
- `getBusinesses(datasetId, params?)` → `GET /businesses?datasetId=...`
- `getContacts(businessId)` → `GET /contacts?businessId=...`
- `getDashboardMetrics()` → `GET /dashboard/metrics`
- `getRecentContacts(limit)` → `GET /contacts/recent?limit=...`
- `triggerCrawl(datasetId, options?)` → `POST /datasets/:datasetId/crawl`
- `previewExport(datasetId)` → `POST /exports/preview`
- `runExport(datasetId, format)` → `POST /exports/run` (returns file blob)

## Dashboard Pages

### ✅ Wired to Backend

1. **Dashboard Home** (`app/(dashboard)/page.tsx`)
   - Uses `getDashboardMetrics()` and `getRecentContacts()`
   - Shows: total businesses, active contacts, cities scanned, last refresh

2. **Datasets List** (`app/(dashboard)/datasets/page.tsx`)
   - Uses `getDatasets()`
   - Shows: name, city, industry, businesses count, contacts count, last refresh

3. **Dataset Detail** (`app/(dashboard)/datasets/[id]/page.tsx`)
   - Uses `getDataset()` and `getDatasetResults()`
   - Shows: businesses with crawl status, email/phone counts
   - Export button triggers `runExport()`

## Error Handling

### Network Errors
- Throws `NetworkError` for fetch failures, timeouts
- Displayed in UI with toast notifications

### HTTP Errors
- 401/403: Auto-redirect to login
- 429: Plan limit exceeded (shown in `meta.gated`)
- Other 4xx/5xx: Error message from backend shown to user

### Plan Gating
- Demo: max 50 rows in exports, max 2 crawl depth
- Starter: max 1000 rows, max 2 crawl depth
- Pro: Unlimited
- Gating info shown via `GateBanner` component
- Backend always enforces limits (UI never bypasses)

## Export Flow

1. User clicks "Export CSV/XLSX"
2. Frontend calls `api.runExport(datasetId, format)`
3. Backend generates file and returns blob
4. Frontend creates download link and triggers download
5. File downloads to user's browser

## CORS & Credentials

- All requests include `credentials: 'include'`
- Backend must allow CORS from Vercel domain
- No custom auth headers (cookies only)

## Verification Checklist

- ✅ API client uses `NEXT_PUBLIC_API_BASE_URL`
- ✅ All requests use `credentials: 'include'`
- ✅ Auth redirects on 401/403
- ✅ Dashboard pages use real API
- ✅ Export triggers file download
- ✅ Error states handled
- ✅ Loading states shown
- ✅ Plan gating displayed (never bypassed)

## Next Steps

1. Set `NEXT_PUBLIC_API_BASE_URL=https://api.leadscope.gr` in Vercel
2. Ensure backend CORS allows Vercel domain
3. Test end-to-end flow:
   - Login
   - View datasets
   - View businesses
   - Trigger crawl
   - Export CSV/XLSX
