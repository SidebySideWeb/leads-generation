/**
 * Internal Health Check Endpoint
 * 
 * Protected by worker guard - requires X-WORKER-SECRET header
 * Used by Vercel to verify worker endpoints are accessible
 */

import { NextRequest, NextResponse } from 'next/server'
import { withWorkerGuard } from '@/lib/worker-guard'

export const GET = withWorkerGuard(async (request: NextRequest) => {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'worker',
  })
})
