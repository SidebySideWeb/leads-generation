/**
 * Crawl Trigger API Route
 * 
 * POST /api/crawl
 * 
 * Triggers a crawl for a dataset.
 * Validates ownership, enforces plan crawl depth, creates crawl_job.
 * Returns job id.
 */

import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

/**
 * Plan limits (matching backend planLimits.ts)
 */
const PLAN_LIMITS = {
  demo: { crawl_max_depth: 1, crawl_pages_limit: 5 },
  starter: { crawl_max_depth: 2, crawl_pages_limit: 25 },
  pro: { crawl_max_depth: 3, crawl_pages_limit: 100 },
} as const

export const POST = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user
    const permissions = request.permissions
    const body = await request.json()
    const { datasetId, maxDepth: requestedDepth = 2, pagesLimit: requestedPagesLimit } = body

    if (!datasetId) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'datasetId is required',
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

    // 2. Apply plan-based crawl gates
    const planLimits = PLAN_LIMITS[permissions.plan]
    const maxDepth = permissions.is_internal_user 
      ? requestedDepth 
      : Math.min(requestedDepth, planLimits.crawl_max_depth)
    const pagesLimit = permissions.is_internal_user
      ? (requestedPagesLimit || planLimits.crawl_pages_limit)
      : Math.min(requestedPagesLimit || planLimits.crawl_pages_limit, planLimits.crawl_pages_limit)
    
    const isGated = !permissions.is_internal_user && (
      maxDepth < requestedDepth || 
      pagesLimit < (requestedPagesLimit || planLimits.crawl_pages_limit)
    )

    // 3. Get businesses with websites for this dataset
    const businessesResult = await pool.query<{
      id: number
      website_url: string | null
    }>(
      `
      SELECT 
        b.id,
        (SELECT url FROM websites WHERE business_id = b.id ORDER BY created_at DESC LIMIT 1) AS website_url
      FROM businesses b
      WHERE b.dataset_id = $1
        AND EXISTS (SELECT 1 FROM websites WHERE business_id = b.id)
      `,
      [datasetId]
    )

    if (businessesResult.rows.length === 0) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'No businesses with websites found in this dataset',
          },
        },
        { status: 400 }
      )
    }

    // 4. Create crawl_job entries for each business
    const jobIds: string[] = []
    const now = new Date().toISOString()

    for (const business of businessesResult.rows) {
      if (!business.website_url) continue

      const jobId = randomUUID()
      jobIds.push(jobId)

      try {
        await pool.query(
          `
          INSERT INTO crawl_jobs (
            id, business_id, website_url, status, pages_limit, 
            pages_crawled, attempts, created_at
          )
          VALUES ($1, $2, $3, 'queued', $4, 0, 0, $5)
          ON CONFLICT DO NOTHING
          `,
          [jobId, String(business.id), business.website_url, pagesLimit, now]
        )
      } catch (jobError) {
        console.warn(`[crawl] Failed to create crawl_job for business ${business.id}:`, jobError)
      }
    }

    return NextResponse.json({
      data: {
        job_ids: jobIds,
        jobs_created: jobIds.length,
        max_depth: maxDepth,
        pages_limit: pagesLimit,
        message: `Created ${jobIds.length} crawl job(s). Jobs will be processed by the crawl worker.`,
      },
      meta: {
        plan_id: permissions.plan,
        gated: isGated,
        total_available: businessesResult.rows.length,
        total_returned: jobIds.length,
        gate_reason: isGated 
          ? `Plan limit: max depth ${maxDepth}, pages limit ${pagesLimit}. Upgrade to increase limits.`
          : undefined,
        upgrade_hint: isGated 
          ? `Upgrade to ${permissions.plan === 'demo' ? 'Starter' : 'Pro'} plan for higher crawl limits`
          : undefined,
      },
    })
  } catch (error: any) {
    console.error('[crawl] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: request.permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to trigger crawl',
        },
      },
      { status: 500 }
    )
  }
})
