/**
 * Export Run API Route
 * 
 * POST /api/exports/run
 * 
 * Generates and returns CSV export file.
 * Enforces plan limits, generates file, inserts audit record.
 * Returns signed download URL or file content.
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
 * Convert integer business ID to UUID format
 */
function integerToUuid(integerId: number): string {
  const hex = integerId.toString(16).padStart(32, '0');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

/**
 * Escape CSV field
 */
function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Plan limits (matching backend planLimits.ts)
 */
const PLAN_LIMITS = {
  demo: { export_max_rows: 50 },
  starter: { export_max_rows: 1000 },
  pro: { export_max_rows: 1000000 }, // Effectively unlimited
} as const

export const POST = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user
    const permissions = request.permissions
    const body = await request.json()
    const { datasetId, format = 'csv' } = body

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

    if (format !== 'csv') {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Only CSV format is supported',
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

    // 2. Query businesses
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

    // 3. Query crawl_results
    const crawlResultsResult = await pool.query<{
      business_id: string
      crawl_status: string
      emails: string
      phones: string
      social: string
      finished_at: string | null
      website_url: string | null
    }>(
      `
      SELECT
        business_id,
        crawl_status,
        emails::text AS emails,
        phones::text AS phones,
        social::text AS social,
        finished_at::text AS finished_at,
        website_url
      FROM crawl_results
      WHERE dataset_id = $1
      `,
      [datasetId]
    )

    // 4. Match businesses to crawl_results (same logic as export route)
    const crawlResultMap = new Map<string, typeof crawlResultsResult.rows[0]>()
    for (const cr of crawlResultsResult.rows) {
      crawlResultMap.set(cr.business_id, cr)
    }

    const businessIdToCrawlResultMap = new Map<number, typeof crawlResultsResult.rows[0]>()
    
    for (const business of businessesResult.rows) {
      const businessIdUuid = integerToUuid(business.id)
      let crawlResult = crawlResultMap.get(businessIdUuid)
      
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
      
      if (crawlResult) {
        businessIdToCrawlResultMap.set(business.id, crawlResult)
      }
    }

    // 5. Build CSV rows
    const allRows: Array<{
      business_id: string
      business_name: string
      address: string
      website: string
      emails: string
      phones: string
      social: string
      crawl_status: string
      last_crawled_at: string
      dataset_id: string
    }> = []

    for (const business of businessesResult.rows) {
      const crawlResult = businessIdToCrawlResultMap.get(business.id)

      let emails: Array<{ value: string }> = []
      let phones: Array<{ value: string }> = []
      let social: { facebook?: string; instagram?: string; linkedin?: string; twitter?: string; youtube?: string } = {}

      if (crawlResult) {
        try {
          if (crawlResult.emails) {
            const parsed = JSON.parse(crawlResult.emails)
            emails = Array.isArray(parsed) ? parsed : []
          }
          if (crawlResult.phones) {
            const parsed = JSON.parse(crawlResult.phones)
            phones = Array.isArray(parsed) ? parsed : []
          }
          if (crawlResult.social) {
            const parsed = JSON.parse(crawlResult.social)
            social = typeof parsed === 'object' && parsed !== null ? parsed : {}
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      const website = crawlResult?.website_url || business.website_url || ''
      const emailValues = emails.map(e => typeof e === 'object' && 'value' in e ? e.value : String(e))
      const phoneValues = phones.map(p => typeof p === 'object' && 'value' in p ? p.value : String(p))

      allRows.push({
        business_id: String(business.id),
        business_name: business.name,
        address: business.address || '',
        website: website,
        emails: emailValues.join('|'),
        phones: phoneValues.join('|'),
        social: Object.keys(social).length > 0 ? JSON.stringify(social) : '',
        crawl_status: crawlResult?.crawl_status || 'not_crawled',
        last_crawled_at: crawlResult?.finished_at || '',
        dataset_id: datasetId,
      })
    }

    const rowsTotal = allRows.length

    // 6. Apply plan limits
    const planLimit = PLAN_LIMITS[permissions.plan].export_max_rows
    const isGated = rowsTotal > planLimit && !permissions.is_internal_user
    const rowsToExport = permissions.is_internal_user ? rowsTotal : allRows.slice(0, planLimit)

    // 7. Determine watermark
    let watermarkText = ''
    if (permissions.plan === 'demo') {
      watermarkText = isGated ? 'DEMO (max 50 leads)' : 'DEMO'
    } else if (permissions.plan === 'starter') {
      watermarkText = 'STARTER'
    } else {
      watermarkText = 'PRO'
    }

    // 8. Generate CSV
    const headers = [
      'business_id',
      'business_name',
      'address',
      'website',
      'emails',
      'phones',
      'social',
      'crawl_status',
      'last_crawled_at',
      'dataset_id',
    ]

    const csvRows: string[] = []
    csvRows.push(headers.map(escapeCsvField).join(','))

    for (const row of rowsToExport) {
      const values = [
        row.business_id,
        row.business_name,
        row.address,
        row.website,
        row.emails,
        row.phones,
        row.social,
        row.crawl_status,
        row.last_crawled_at,
        row.dataset_id,
      ]
      csvRows.push(values.map(escapeCsvField).join(','))
    }

    if (watermarkText) {
      csvRows.push(`# ${watermarkText}`)
    }

    const csvContent = csvRows.join('\n')
    const BOM = '\uFEFF' // UTF-8 BOM for Excel
    const csvWithBOM = BOM + csvContent

    // 9. Insert audit record
    const exportId = randomUUID()
    const filters = JSON.stringify({ datasetId, plan: permissions.plan })
    
    try {
      await pool.query(
        `
        INSERT INTO exports (
          id, user_id, export_type, total_rows, file_format, file_path, watermark_text, filters, expires_at
        )
        VALUES ($1, $2, 'subscription', $3, 'csv', 'api-export', $4, $5::jsonb, NULL)
        `,
        [exportId, user.id, rowsToExport.length, watermarkText, filters]
      )
    } catch (auditError) {
      console.warn('[export-run] Failed to insert audit record:', auditError)
    }

    // 10. Return CSV as downloadable response
    return new NextResponse(csvWithBOM, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="export-${datasetId}-${Date.now()}.csv"`,
        'X-Export-Id': exportId,
        'X-Export-Rows-Total': String(rowsTotal),
        'X-Export-Rows-Exported': String(rowsToExport.length),
        'X-Export-Gated': String(isGated),
        'X-Export-Watermark': watermarkText,
      },
    })
  } catch (error: any) {
    console.error('[export-run] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: request.permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to generate export',
        },
      },
      { status: 500 }
    )
  }
})
