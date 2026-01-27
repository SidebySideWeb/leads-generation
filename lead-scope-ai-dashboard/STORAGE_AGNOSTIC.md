# Storage-Agnostic UI Design

## Principle

The frontend UI must work **identically** whether the backend uses:
- **Database storage** (PostgreSQL/Supabase)
- **Local fallback storage** (JSON files)

## Rules

1. **UI must not detect storage mode**
   - Never check for storage type in UI code
   - Never use conditional logic based on storage mode
   - Never expose storage mode to users

2. **UI must rely ONLY on response data + meta**
   - All API responses follow `{ data, meta }` structure
   - UI components only use `response.data` and `response.meta`
   - No assumptions about response structure beyond this

3. **No conditional UI paths for fallback mode**
   - Same UI components for all storage modes
   - Same error handling for all storage modes
   - Same loading states for all storage modes

## Implementation

### API Client (`lib/api.ts`)

The API client normalizes all responses to ensure consistency:

```typescript
// All responses are normalized to { data, meta }
const response = await api.getDatasets()
// response.data: Dataset[] | null
// response.meta: ResponseMeta (always present)
```

### UI Components

All UI components follow this pattern:

```typescript
// ✅ CORRECT: Use only response.data and response.meta
const response = await api.getDatasets()
if (response.data) {
  setDatasets(response.data)
}
setMeta(response.meta)

// ❌ WRONG: Don't check storage mode
if (isLocalStorage) { ... }
if (response.storage_mode === 'local') { ... }
```

### Response Meta

The `ResponseMeta` type provides all necessary information:

```typescript
interface ResponseMeta {
  plan_id: 'demo' | 'starter' | 'pro'
  gated: boolean
  gate_reason?: string
  total_available: number
  total_returned: number
  upgrade_hint?: string
}
```

This meta is sufficient for all UI decisions - no storage mode detection needed.

## Benefits

1. **Consistent UX**: Users see the same interface regardless of backend storage
2. **Simpler code**: No conditional logic for storage modes
3. **Easier testing**: Test once, works for all storage modes
4. **Better maintainability**: Single code path for all scenarios
