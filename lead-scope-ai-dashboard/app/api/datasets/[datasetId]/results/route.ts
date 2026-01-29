/**
 * Dataset Results API Route
 * 
 * GET /api/datasets/:datasetId/results
 * 
 * Returns businesses with their crawl_results v1 summary for a dataset.
 * Enforces ownership: only returns results if user owns the dataset or is internal.
 */

import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { getDatasetResults } from '../../../../../src/services/datasetResultsService.js'

export const GET = withGuard(async (
  request: GuardedRequest,
  { params }: { params: Promise<{ datasetId: string }> }
) => {
  try {
    const user = request.user
    const permissions = request.permissions
    const { datasetId } = await params

    // Get dataset results (enforces ownership internally)
    const results = await getDatasetResults(datasetId, user.id)

    // Transform to frontend format
    const businesses = results.map((result) => ({
      id: String(result.business.id),
      name: result.business.name,
      address: result.business.address,
      website: null, // Not in businesses table, will be in crawl_results.website_url if needed
      email: result.crawl.emails?.[0]?.value || null, // First email for display
      phone: result.crawl.phones?.[0]?.value || null, // First phone for display
      city: '', // Will be populated from join if needed
      industry: '', // Will be populated from join if needed
      lastVerifiedAt: result.crawl.finishedAt,
      isActive: true, // Default to active
      // Add crawl summary
      crawl: {
        status: result.crawl.status,
        emailsCount: result.crawl.emailsCount,
        phonesCount: result.crawl.phonesCount,
        socialCount: result.crawl.socialCount,
        finishedAt: result.crawl.finishedAt,
        pagesVisited: result.crawl.pagesVisited,
      },
    }))

    return NextResponse.json({
      data: businesses,
      meta: {
        plan_id: permissions.plan,
        gated: false,
        total_available: businesses.length,
        total_returned: businesses.length,
      },
    })
  } catch (error: any) {
    console.error('[dataset-results] Error:', error)
    
    // Check if it's an access denied error
    if (error.message?.includes('Access denied') || error.message?.includes('not found')) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: request.permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: error.message,
          },
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: request.permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to load dataset results',
        },
      },
      { status: 500 }
    )
  }
})
