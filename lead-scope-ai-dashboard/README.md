# LeadScope AI Dashboard

Production-ready Next.js 14 dashboard for business contact intelligence.

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** (strict mode)
- **Tailwind CSS** (already configured)
- **Radix UI** components
- **React Hook Form** for form handling
- **Zod** for validation

## Project Structure

```
app/
  (auth)/              # Auth route group (login, register)
    login/
    register/
  (dashboard)/        # Dashboard route group
    page.tsx          # Dashboard home
    layout.tsx        # Dashboard layout (sidebar + top nav)
    discover/
    datasets/
    exports/
    ...
  page.tsx            # Landing page
  layout.tsx          # Root layout
  globals.css

components/
  dashboard/          # Dashboard-specific components
  ui/                 # Reusable UI components (shadcn/ui)

lib/
  api.ts              # API client (no mock data)
  types.ts            # Shared TypeScript types
  config.ts           # Application configuration
  utils.ts            # Utility functions

hooks/
  use-toast.ts        # Toast notifications
  use-mobile.ts       # Mobile detection
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Set up environment variables:**
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_ENABLE_ANALYTICS=false
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Key Features

### ✅ Production-Ready
- No mock data
- No fake auth logic
- No client-side limits
- Real API integration ready
- Type-safe throughout

### ✅ Route Groups
- `(auth)` - Authentication pages
- `(dashboard)` - Dashboard pages
- Route groups don't affect URLs (still `/login`, `/dashboard`, etc.)

### ✅ API Client
All API calls go through `lib/api.ts`:
```typescript
import { api } from "@/lib/api"

// Login
const response = await api.login(email, password)

// Get datasets
const response = await api.getDatasets()

// Create export
const response = await api.createExport(datasetId, { format: 'csv', tier: 'starter' })
```

### ✅ Type Safety
All types defined in `lib/types.ts`:
```typescript
import type { Dataset, Business, Contact, User } from "@/lib/types"
```

## Route Structure

| URL | File Path |
|-----|-----------|
| `/` | `app/page.tsx` |
| `/login` | `app/(auth)/login/page.tsx` |
| `/register` | `app/(auth)/register/page.tsx` |
| `/dashboard` | `app/(dashboard)/page.tsx` |
| `/dashboard/discover` | `app/(dashboard)/discover/page.tsx` |
| `/dashboard/datasets` | `app/(dashboard)/datasets/page.tsx` |

## Components

### Dashboard Components
- `Sidebar` - Navigation sidebar
- `TopNav` - Top navigation bar
- `DashboardChart` - Contacts overview chart
- `RecentContactsTable` - Latest verified contacts

### UI Components
All components from `components/ui/` are from shadcn/ui and are production-ready.

## API Integration

The API client in `lib/api.ts` is ready for backend integration. All endpoints are defined but will need to be connected to your actual backend API.

Current endpoints:
- Auth: `login`, `register`, `logout`, `getCurrentUser`
- Datasets: `getDatasets`, `getDataset`, `createDataset`, `deleteDataset`
- Businesses: `getBusinesses`
- Contacts: `getContacts`
- Exports: `getExports`, `createExport`
- Discovery: `startDiscovery`, `getDiscoveryStatus`
- Industries & Cities: `getIndustries`, `getCities`
- Dashboard: `getDashboardStats`
- Refresh: `startRefresh`, `getRefreshStatus`

## Development Notes

- All components are client components where needed (`"use client"`)
- Server components are used by default in App Router
- TypeScript strict mode is enabled
- No build errors should be ignored (removed `ignoreBuildErrors: true`)

## Next Steps

1. Connect API endpoints to your backend
2. Implement authentication (JWT tokens, httpOnly cookies)
3. Add error boundaries
4. Add loading states where needed
5. Implement data fetching with React Query or SWR (optional)

## License

Private - LeadScope AI
