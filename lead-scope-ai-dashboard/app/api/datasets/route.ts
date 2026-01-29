/**
 * Datasets API Route
 * 
 * GET /api/datasets
 * 
 * Returns all datasets for the authenticated user.
 * Includes city and industry names via joins.
 * Ordered by created_at DESC.
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

    // Query datasets with city and industry names
    const result = await pool.query<{
      id: string
      name: string
      city_id: number | null
      industry_id: number | null
      city_name: string | null
      industry_name: string | null
      last_refreshed_at: string | null
      created_at: string
      businesses_count: number
      contacts_count: number
    }>(
      `
      SELECT 
        d.id,
        d.name,
        d.city_id,
        d.industry_id,
        c.name AS city_name,
        i.name AS industry_name,
        d.last_refreshed_at::text AS last_refreshed_at,
        d.created_at::text AS created_at,
        COUNT(DISTINCT b.id) AS businesses_count,
        COUNT(DISTINCT cr.business_id) FILTER (WHERE cr.crawl_status = 'completed' AND (jsonb_array_length(cr.emails) > 0 OR jsonb_array_length(cr.phones) > 0)) AS contacts_count
      FROM datasets d
      LEFT JOIN cities c ON c.id = d.city_id
      LEFT JOIN industries i ON i.id = d.industry_id
      LEFT JOIN businesses b ON b.dataset_id = d.id::text
      LEFT JOIN crawl_results cr ON cr.dataset_id = d.id
      WHERE d.user_id = $1
      GROUP BY d.id, d.name, d.city_id, d.industry_id, c.name, i.name, d.last_refreshed_at, d.created_at
      ORDER BY d.created_at DESC
      `,
      [user.id]
    )

    // Determine refresh status for each dataset
    const datasets = result.rows.map((row) => {
      let refreshStatus: 'snapshot' | 'refreshing' | 'outdated' = 'snapshot'
      
      if (row.last_refreshed_at) {
        const lastRefresh = new Date(row.last_refreshed_at)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        if (lastRefresh < thirtyDaysAgo) {
          refreshStatus = 'outdated'
        } else {
          refreshStatus = 'snapshot'
        }
      } else {
        refreshStatus = 'outdated'
      }

      return {
        id: row.id,
        name: row.name,
        industry: row.industry_name || '',
        city: row.city_name || '',
        businesses: parseInt(String(row.businesses_count)) || 0,
        contacts: parseInt(String(row.contacts_count)) || 0,
        createdAt: row.created_at,
        refreshStatus,
        lastRefresh: row.last_refreshed_at,
      }
    })

    return NextResponse.json({
      data: datasets,
      meta: {
        plan_id: permissions.plan,
        gated: false,
        total_available: datasets.length,
        total_returned: datasets.length,
      },
    })
  } catch (error: any) {
    console.error('[datasets] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: request.permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to load datasets',
        },
      },
      { status: 500 }
    )
  }
})
