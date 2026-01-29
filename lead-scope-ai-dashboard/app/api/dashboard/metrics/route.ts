/**
 * Dashboard Metrics API Route
 * 
 * GET /api/dashboard/metrics
 * 
 * Returns dashboard statistics:
 * - businesses_total
 * - businesses_crawled
 * - contacts_found
 * - exports_this_month
 */

import { NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { Pool } from 'pg'

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const GET = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user
    const permissions = request.permissions

    // Get current month start
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // 1. Total businesses (across all user's datasets)
    const businessesTotalResult = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*) AS count
      FROM businesses b
      INNER JOIN datasets d ON d.id::text = b.dataset_id
      WHERE d.user_id = $1
      `,
      [user.id]
    )
    const businessesTotal = parseInt(businessesTotalResult.rows[0]?.count || '0', 10)

    // 2. Businesses crawled (have crawl_results with status = 'completed')
    const businessesCrawledResult = await pool.query<{ count: string }>(
      `
      SELECT COUNT(DISTINCT cr.business_id) AS count
      FROM crawl_results cr
      INNER JOIN datasets d ON d.id = cr.dataset_id
      WHERE d.user_id = $1
        AND cr.crawl_status = 'completed'
      `,
      [user.id]
    )
    const businessesCrawled = parseInt(businessesCrawledResult.rows[0]?.count || '0', 10)

    // 3. Contacts found (emails + phones from completed crawls)
    const contactsFoundResult = await pool.query<{ count: string }>(
      `
      SELECT 
        SUM(
          COALESCE(jsonb_array_length(cr.emails), 0) + 
          COALESCE(jsonb_array_length(cr.phones), 0)
        ) AS count
      FROM crawl_results cr
      INNER JOIN datasets d ON d.id = cr.dataset_id
      WHERE d.user_id = $1
        AND cr.crawl_status = 'completed'
      `,
      [user.id]
    )
    const contactsFound = parseInt(contactsFoundResult.rows[0]?.count || '0', 10)

    // 4. Exports this month
    const exportsThisMonthResult = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*) AS count
      FROM exports
      WHERE user_id = $1
        AND created_at >= $2
      `,
      [user.id, monthStart]
    )
    const exportsThisMonth = parseInt(exportsThisMonthResult.rows[0]?.count || '0', 10)

    // 5. Last refresh (most recent dataset refresh)
    const lastRefreshResult = await pool.query<{ last_refreshed_at: string | null }>(
      `
      SELECT MAX(last_refreshed_at)::text AS last_refreshed_at
      FROM datasets
      WHERE user_id = $1
      `,
      [user.id]
    )
    const lastRefresh = lastRefreshResult.rows[0]?.last_refreshed_at || null

    return NextResponse.json({
      data: {
        businesses_total: businessesTotal,
        businesses_crawled: businessesCrawled,
        contacts_found: contactsFound,
        exports_this_month: exportsThisMonth,
        last_refresh: lastRefresh,
      },
      meta: {
        plan_id: permissions.plan,
        gated: false,
        total_available: 0,
        total_returned: 0,
      },
    })
  } catch (error: any) {
    console.error('[dashboard-metrics] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: request.permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to load dashboard metrics',
        },
      },
      { status: 500 }
    )
  }
})
