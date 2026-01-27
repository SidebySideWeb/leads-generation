# Permission-Driven Frontend

The frontend is now permission-driven, fetching user permissions on session load and using them to drive UI behavior.

## Architecture

### 1. API Endpoint: `/api/me`

Returns current user with plan and permissions:
```typescript
{
  user: {
    id: string
    email: string
    plan: 'demo' | 'starter' | 'pro'
  },
  permissions: {
    plan: 'demo' | 'starter' | 'pro'
    max_export_rows: number
    max_crawl_pages: number
    max_datasets: number
    can_refresh: boolean
  }
}
```

### 2. Permissions Context

**Location**: `contexts/PermissionsContext.tsx`

- Fetches permissions on mount via `/api/me`
- Stores permissions in React state
- Provides `usePermissions()` hook to all components
- Handles loading and error states

**Usage**:
```typescript
import { usePermissions } from '@/contexts/PermissionsContext'

function MyComponent() {
  const { permissions, user, loading, error } = usePermissions()
  
  // Use permissions to drive UI
}
```

### 3. Permission Utilities

**Location**: `lib/permissions.ts`

- `fetchPermissions()` - Fetches from `/api/me`
- `canPerformAction()` - Checks if action is allowed (for UI display only)
- `getUpgradeHint()` - Returns upgrade suggestion

## UI Behavior Rules

### ✅ DO:
- **Fetch permissions on session load** - Via PermissionsProvider
- **Disable buttons visually** - Use `opacity-50` when limits exceeded
- **Show upgrade hints** - Display upgrade suggestions when gated
- **Always allow actions** - Never block actions client-side
- **Rely on backend response** - Backend is source of truth

### ❌ DON'T:
- **Block actions client-side** - Never prevent onClick handlers
- **Hide features** - Never hide buttons or features
- **Enforce limits client-side** - Backend always enforces
- **Trust client state** - Always rely on backend response

## Component Updates

### ExportButton (`components/dashboard/export-button.tsx`)
- Uses `usePermissions()` hook
- Checks `canPerformAction(permissions, 'export')`
- Shows visual disabled state (opacity) if needed
- **Never blocks export action** - Always allows click

### ExportAction (`components/dashboard/export-action.tsx`)
- Uses `usePermissions()` hook
- Checks `canPerformAction(permissions, 'export')`
- Shows visual disabled state in dropdown
- **Never blocks export action** - Always allows click

### CrawlStatus (`components/dashboard/crawl-status.tsx`)
- Uses `usePermissions()` hook
- Checks `canPerformAction(permissions, 'crawl')`
- Shows visual disabled state on "Start Crawl" button
- **Never blocks crawl action** - Always allows click

### DiscoverPage (`app/(dashboard)/discover/page.tsx`)
- Uses `usePermissions()` hook
- Checks `canPerformAction(permissions, 'dataset')`
- Shows visual disabled state on "Run Discovery" button
- **Never blocks discovery action** - Always allows click

## Visual States

### Enabled Button
```tsx
<Button className="bg-primary hover:bg-primary/90">
  Export
</Button>
```

### Visually Disabled (but still clickable)
```tsx
<Button 
  className={cn(
    "bg-primary hover:bg-primary/90",
    !check.allowed && "opacity-50"
  )}
  // onClick still works - backend enforces
>
  Export
</Button>
```

## Backend Enforcement

All actions are always sent to backend:
1. User clicks button (even if visually disabled)
2. Request sent to API
3. Backend validates permissions
4. Backend enforces limits
5. Backend returns response with `gated: true/false`
6. UI displays result (may show upgrade hint)

## Example Flow

### Export Flow
1. User clicks "Export" button (may be visually disabled)
2. `handleExport()` called
3. API request sent to `/api/datasets/[id]/export`
4. Backend checks permissions and enforces limits
5. Backend returns response with:
   - `rows_returned` (actual rows exported)
   - `rows_total` (total available)
   - `gated: true/false`
   - `upgrade_hint` (if gated)
6. UI displays result and shows upgrade hint if gated
7. Download always allowed (even if gated)

### Crawl Flow
1. User clicks "Start Crawl" button (may be visually disabled)
2. `handleStartCrawl()` called
3. API request sent to `/api/datasets/[id]/crawl`
4. Backend checks permissions and enforces limits
5. Backend returns response with:
   - `pages_crawled` (actual pages)
   - `pages_limit` (max allowed)
   - `gated: true/false`
   - `upgrade_hint` (if gated)
6. UI displays result and shows upgrade hint if gated

## Integration Checklist

- [x] Created `/api/me` endpoint
- [x] Created PermissionsContext
- [x] Added PermissionsProvider to dashboard layout
- [x] Updated ExportButton to use permissions
- [x] Updated ExportAction to use permissions
- [x] Updated CrawlStatus to use permissions
- [x] Updated DiscoverPage to use permissions
- [x] All buttons show visual disabled state
- [x] All actions still work (never blocked)
- [x] All components rely on backend response

## Testing

1. **Test with demo plan**:
   - Buttons should show visual disabled state
   - Actions should still work
   - Backend should enforce limits
   - Upgrade hints should display

2. **Test with starter plan**:
   - Buttons should be enabled
   - Actions should work
   - Backend should enforce limits
   - Upgrade hints should display when limits hit

3. **Test with pro plan**:
   - All buttons enabled
   - All actions work
   - No limits enforced
   - No upgrade hints

## Security Notes

- **Never trust client state** - Backend always validates
- **Never block client-side** - Backend always enforces
- **Always show visual feedback** - User should know limits
- **Always allow actions** - User can try, backend decides
