/**
 * Contacts API Route (Plan-Gated)
 * 
 * GET /api/contacts?businessId=uuid
 * 
 * Returns contacts (emails, phones) for a business from crawl_results.
 * Enforces plan limits (demo: max 50 contacts).
 * Backend is source of truth for gating.
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

/**
 * Plan limits (matching backend planLimits.ts)
 */
const PLAN_LIMITS = {
  demo: { max_contacts: 50 },
  starter: { max_contacts: 1000 },
  pro: { max_contacts: 1000000 }, // Effectively unlimited
} as const

export const GET = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user
    const permissions = request.permissions
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'businessId query parameter is required',
          },
        },
        { status: 400 }
      )
    }

    // 1. Verify business ownership via dataset
    // First, get the business to find its dataset_id
    const businessResult = await pool.query<{
      id: number
      dataset_id: string
    }>(
      'SELECT id, dataset_id FROM businesses WHERE id = $1',
      [parseInt(businessId, 10)]
    )

    if (businessResult.rows.length === 0) {
      return NextResponse.json(
        {
          data: null,
          meta: {
            plan_id: permissions.plan,
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Business not found',
          },
        },
        { status: 404 }
      )
    }

    const business = businessResult.rows[0]
    const datasetId = business.dataset_id

    // 2. Verify dataset ownership
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
            gate_reason: 'Access denied: You do not own this business',
          },
        },
        { status: 403 }
      )
    }

    // 3. Fetch crawl_results for this business
    const businessIdUuid = integerToUuid(business.id)
    const crawlResultQuery = await pool.query<{
      emails: string // JSONB as text
      phones: string // JSONB as text
      social: string // JSONB as text
    }>(
      `
      SELECT
        emails::text AS emails,
        phones::text AS phones,
        social::text AS social
      FROM crawl_results
      WHERE business_id = $1 AND dataset_id = $2
      LIMIT 1
      `,
      [businessIdUuid, datasetId]
    )

    // 4. Parse contacts from crawl_results
    let allContacts: Array<{
      type: 'email' | 'phone'
      value: string
      source_url: string
    }> = []

    if (crawlResultQuery.rows.length > 0) {
      const cr = crawlResultQuery.rows[0]
      
      try {
        // Parse emails
        if (cr.emails) {
          const emails = JSON.parse(cr.emails)
          if (Array.isArray(emails)) {
            for (const email of emails) {
              const value = typeof email === 'object' && 'value' in email ? email.value : String(email)
              const source_url = typeof email === 'object' && 'source_url' in email ? email.source_url : ''
              allContacts.push({ type: 'email', value, source_url })
            }
          }
        }

        // Parse phones
        if (cr.phones) {
          const phones = JSON.parse(cr.phones)
          if (Array.isArray(phones)) {
            for (const phone of phones) {
              const value = typeof phone === 'object' && 'value' in phone ? phone.value : String(phone)
              const source_url = typeof phone === 'object' && 'source_url' in phone ? phone.source_url : ''
              allContacts.push({ type: 'phone', value, source_url })
            }
          }
        }
      } catch (e) {
        console.warn('[contacts] Failed to parse JSONB:', e)
      }
    }

    const totalAvailable = allContacts.length

    // 5. Apply plan limits (backend is source of truth)
    const planLimit = PLAN_LIMITS[permissions.plan].max_contacts
    const isGated = totalAvailable > planLimit && !permissions.is_internal_user
    const contactsToReturn = permissions.is_internal_user 
      ? allContacts 
      : allContacts.slice(0, planLimit)

    return NextResponse.json({
      data: {
        contacts: contactsToReturn,
      },
      meta: {
        plan_id: permissions.plan,
        total_available: totalAvailable,
        total_returned: contactsToReturn.length,
        gated: isGated,
        gate_reason: isGated ? `Plan limit: ${planLimit} contacts. Upgrade to see all ${totalAvailable} contacts.` : undefined,
        upgrade_hint: isGated ? `Upgrade to ${permissions.plan === 'demo' ? 'Starter' : 'Pro'} plan to see all contacts` : undefined,
      },
    })
  } catch (error: any) {
    console.error('[contacts] Error:', error)
    return NextResponse.json(
      {
        data: null,
        meta: {
          plan_id: request.permissions.plan,
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.message || 'Failed to load contacts',
        },
      },
      { status: 500 }
    )
  }
})
