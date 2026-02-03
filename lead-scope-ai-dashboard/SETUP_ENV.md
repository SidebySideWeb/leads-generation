# Environment Setup Guide

## Problem: "No Exports" or Frontend Can't Connect to Backend

If you're seeing an empty exports page or the frontend can't connect to the backend, it's likely a port configuration issue.

## Solution

### 1. Create `.env.local` file

Create a `.env.local` file in the `lead-scope-ai-dashboard` directory with:

```env
# Backend API URL (backend should run on port 3001 to avoid conflict with Next.js)
NEXT_PUBLIC_API_URL=http://localhost:3001

# Frontend app URL (Next.js runs on port 3000)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Start Backend on Port 3001

In the `leads-generation-backend` directory, start the backend with:

```bash
# Windows PowerShell
$env:PORT=3001; npm run dev

# Or create a .env file in backend directory:
PORT=3001
```

### 3. Start Frontend

In the `lead-scope-ai-dashboard` directory:

```bash
npm run dev
```

The frontend will run on `http://localhost:3000` and connect to the backend on `http://localhost:3001`.

## Why This Is Needed

- **Next.js** (frontend) runs on port **3000** by default
- **Backend** also defaults to port **3000**, causing a conflict
- The frontend API client needs to know which port the backend is on
- Setting `NEXT_PUBLIC_API_URL` tells the frontend where to find the backend

## Verification

1. Backend should be accessible at: `http://localhost:3001/api/industries`
2. Frontend should be accessible at: `http://localhost:3000`
3. Check browser console for any API connection errors
4. The exports page should now be able to fetch data from the backend

## Troubleshooting

- **"Network error" or "Failed to fetch"**: Backend isn't running or wrong port
- **Empty exports list**: This is normal if you haven't created any exports yet
- **401/403 errors**: You need to log in first
