import { NextRequest, NextResponse } from 'next/server'
import { withGuard, type GuardedRequest } from '@/lib/api-guard'
import { getCurrentUser } from '@/lib/auth-server'
import { api } from '@/lib/api'

/**
 * GET /api/billing/usage
 * Get current user's usage data
 */
export const GET = withGuard(async (request: GuardedRequest) => {
  try {
    const user = request.user
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get datasets and exports to calculate usage
    const [datasetsRes, exportsRes] = await Promise.all([
      api.getDatasets(),
      api.getExports(),
    ])

    const datasets = datasetsRes.data || []
    const exports = exportsRes.data || []

    // Calculate current month usage
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Count exports this month
    const exportsThisMonth = exports.filter(e => {
      const exportDate = new Date(e.created_at)
      return exportDate.getFullYear() === now.getFullYear() &&
             exportDate.getMonth() === now.getMonth()
    }).length

    // Count datasets created this month
    const datasetsCreatedThisMonth = datasets.filter(d => {
      const createdDate = new Date(d.createdAt)
      return createdDate.getFullYear() === now.getFullYear() &&
             createdDate.getMonth() === now.getMonth()
    }).length

    // TODO: Get actual crawl count from backend
    const crawlsThisMonth = 0

    const usage = {
      user_id: user.id,
      month_year: monthYear,
      exports_this_month: exportsThisMonth,
      crawls_this_month: crawlsThisMonth,
      datasets_created_this_month: datasetsCreatedThisMonth,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      data: usage,
      meta: {
        plan_id: currentUser.plan || 'demo',
        gated: false,
        total_available: 1,
        total_returned: 1,
      },
    })
  } catch (error: any) {
    console.error('Usage fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch usage' },
      { status: 500 }
    )
  }
})
