/**
 * Frontend Permissions Types and Utilities
 * 
 * Mirrors backend permissions structure.
 * Used to drive UI behavior (visual states only).
 * Backend is always the source of truth.
 */

export type Plan = 'demo' | 'starter' | 'pro'

export interface UserPermissions {
  plan: Plan
  max_export_rows: number
  max_crawl_pages: number
  max_datasets: number
  can_refresh: boolean
  is_internal_user?: boolean
}

export interface MeResponse {
  user: {
    id: string
    email: string
    plan: Plan
  }
  permissions: UserPermissions
}

/**
 * Fetch user permissions from /api/me
 */
export async function fetchPermissions(): Promise<MeResponse | null> {
  try {
    const response = await fetch('/api/me', {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      console.error('[fetchPermissions] Failed to fetch permissions:', response.status)
      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('[fetchPermissions] Error:', error)
    return null
  }
}

/**
 * Check if user can perform an action based on current usage
 * 
 * This is for UI display only - backend always enforces limits
 */
export function canPerformAction(
  permissions: UserPermissions | null,
  action: 'export' | 'crawl' | 'dataset' | 'refresh',
  currentUsage?: {
    exports_this_month?: number
    crawls_this_month?: number
    datasets_this_month?: number
  }
): {
  allowed: boolean
  reason?: string
  upgrade_hint?: string
} {
  if (!permissions) {
    return {
      allowed: false,
      reason: 'Permissions not loaded',
    }
  }

  switch (action) {
    case 'export':
      // For UI, we can't know exact row count without backend
      // So we allow the action - backend will enforce
      return { allowed: true }

    case 'crawl':
      // For UI, we can't know exact page count without backend
      // So we allow the action - backend will enforce
      return { allowed: true }

    case 'dataset':
      if (currentUsage?.datasets_this_month !== undefined) {
        const limit = permissions.max_datasets
        if (limit !== Number.MAX_SAFE_INTEGER && currentUsage.datasets_this_month >= limit) {
          return {
            allowed: false,
            reason: `You have reached your limit of ${limit} dataset${limit === 1 ? '' : 's'} per month.`,
            upgrade_hint: permissions.plan === 'demo'
              ? 'Upgrade to Starter plan for up to 5 datasets per month.'
              : permissions.plan === 'starter'
              ? 'Upgrade to Pro plan for unlimited datasets.'
              : undefined,
          }
        }
      }
      return { allowed: true }

    case 'refresh':
      if (!permissions.can_refresh) {
        return {
          allowed: false,
          reason: 'Dataset refresh is not available on the demo plan.',
          upgrade_hint: 'Upgrade to Starter or Pro plan for monthly dataset refresh.',
        }
      }
      return { allowed: true }

    default:
      return { allowed: true }
  }
}

/**
 * Get upgrade hint for a plan
 */
export function getUpgradeHint(plan: Plan): string {
  switch (plan) {
    case 'demo':
      return 'Upgrade to Starter plan for more features.'
    case 'starter':
      return 'Upgrade to Pro plan for unlimited access.'
    case 'pro':
      return ''
    default:
      return ''
  }
}
