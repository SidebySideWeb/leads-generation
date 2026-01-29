/**
 * Businesses API Route
 * 
 * GET /api/businesses?datasetId=uuid
 * 
 * Returns businesses for a dataset with crawl status summary.
 * Enforces dataset ownership.
 */

import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { Pool } from 'pg'

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * Convert integer business ID to UUID format
 */
function integerToUuid(integerId: number): string {
  const hex = integerId.toString(16).padStart(32, '0');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

export const GET = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user
    const permissions = request.permissions
    const { searchParams } = new URL(request.url)
    const datasetId = searchParams.get('datasetId')

    if (!datasetId) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'datasetId query parameter is required',
          },
        },
        { status: 400 }
      )
    }

    // 1. Verify dataset ownership
    const datasetResult = await pool.query(
      'SELECT user_id FROM datasets WHERE id = $1',
      [datasetId]
    )

    if (datasetResult.rows.length === 0) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Dataset not found',
          },
        },
        { status: 404 }
      )
    }

    const dataset = datasetResult.rows[0]
    if (dataset.user_id !== user.id && !permissions.is_internal_user) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Access denied: You do not own this dataset',
          },
        },
        { status: 403 }
      )
    }

    // 2. Fetch businesses with website URLs
    const businessesResult = await pool.query<{
      id: number
      name: string
      address: string | null
      website_url: string | null
    }>(
      `
      SELECT 
        b.id, 
        b.name, 
        b.address,
        (SELECT url FROM websites WHERE business_id = b.id ORDER BY created_at DESC LIMIT 1) AS website_url
      FROM businesses b
      WHERE b.dataset_id = $1
      ORDER BY b.created_at DESC
      `,
      [datasetId]
    )

    // 3. Fetch crawl_results for this dataset
    const crawlResultsResult = await pool.query<{
      business_id: string
      crawl_status: string
      emails: string // JSONB as text
      phones: string // JSONB as text
      finished_at: string | null
      pages_visited: number
    }>(
      `
      SELECT
        business_id,
        crawl_status,
        emails::text AS emails,
        phones::text AS phones,
        finished_at::text AS finished_at,
        pages_visited
      FROM crawl_results
      WHERE dataset_id = $1
      `,
      [datasetId]
    )

    // 4. Create map of business_id (UUID) -> crawl_result
    const crawlResultMap = new Map<string, typeof crawlResultsResult.rows[0]>()
    for (const cr of crawlResultsResult.rows) {
      crawlResultMap.set(cr.business_id, cr)
    }

    // 5. Match businesses to crawl_results
    const businessIdToCrawlResultMap = new Map<number, typeof crawlResultsResult.rows[0]>()
    
    for (const business of businessesResult.rows) {
      const businessIdUuid = integerToUuid(business.id)
      let crawlResult = crawlResultMap.get(businessIdUuid)
      
      // Try reverse lookup
      if (!crawlResult) {
        for (const [uuid, cr] of crawlResultMap.entries()) {
          const uuidHex = uuid.replace(/-/g, '').substring(0, 16)
          const possibleIntId = parseInt(uuidHex, 16)
          if (possibleIntId === business.id) {
            crawlResult = cr
            break
          }
        }
      }
      
      // Try website matching
      if (!crawlResult && business.website_url) {
        for (const [uuid, cr] of crawlResultMap.entries()) {
          // We'd need website_url in crawl_results to match - skip for now
        }
      }
      
      if (crawlResult) {
        businessIdToCrawlResultMap.set(business.id, crawlResult)
      }
    }

    // 6. Build response
    const businesses = businessesResult.rows.map((business) => {
      const crawlResult = businessIdToCrawlResultMap.get(business.id)
      
      // Parse JSONB arrays
      let emailsCount = 0
      let phonesCount = 0
      
      if (crawlResult) {
        try {
          if (crawlResult.emails) {
            const parsed = JSON.parse(crawlResult.emails)
            emailsCount = Array.isArray(parsed) ? parsed.length : 0
          }
          if (crawlResult.phones) {
            const parsed = JSON.parse(crawlResult.phones)
            phonesCount = Array.isArray(parsed) ? parsed.length : 0
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      return {
        id: String(business.id),
        name: business.name,
        website_url: crawlResult ? null : business.website_url, // Use from crawl_result if available
        crawl_status: (crawlResult?.crawl_status || 'not_crawled') as 'not_crawled' | 'partial' | 'completed',
        emails_count: emailsCount,
        phones_count: phonesCount,
        has_crawl_results: !!crawlResult,
      }
    })

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
    console.error('[businesses] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: request.permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to load businesses',
        },
      },
      { status: 500 }
    )
  }
})
