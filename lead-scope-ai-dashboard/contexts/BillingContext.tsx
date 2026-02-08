"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface BillingData {
  credits: number
  usage: {
    crawls: number
    exports: number
    datasets: number
  }
  limits: {
    crawls: number | null
    exports: number | null
    datasets: number | null
    businessesPerDataset: number | null
  }
  plan: string
  subscription: {
    id: string
    status: string
    current_period_start: string | null
    current_period_end: string | null
    canceled_at: string | null
  } | null
  consumptionByFeature: Array<{
    feature: string
    credits: number
  }>
  creditCosts: {
    discoveryBusiness: number
    websiteCrawl: number
    emailExtraction: number
    exportRow: number
  } | null
}

interface BillingContextType {
  data: BillingData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  estimateDiscoveryCost: (estimatedBusinesses: number) => number
  estimateExportCost: (rows: number) => number
  hasEnoughCredits: (required: number) => boolean
  getUsagePercentage: (type: 'crawls' | 'exports' | 'datasets') => number
  isNearLimit: (type: 'crawls' | 'exports' | 'datasets', threshold?: number) => boolean
}

const BillingContext = createContext<BillingContextType | undefined>(undefined)

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadBillingData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [creditsRes, usageRes, subscriptionRes, costsRes] = await Promise.all([
        api.getCredits(),
        api.getBillingUsage(),
        api.getBillingSubscription(),
        api.getCreditCosts().catch(() => ({ data: null, meta: { plan_id: 'demo' as const, gated: false, total_available: 0, total_returned: 0 } })),
      ])

      if (creditsRes.data && usageRes.data && subscriptionRes.data) {
        setData({
          credits: creditsRes.data.credits,
          usage: usageRes.data.usage,
          limits: usageRes.data.limits,
          plan: subscriptionRes.data.plan,
          subscription: subscriptionRes.data.subscription,
          consumptionByFeature: usageRes.data.consumptionByFeature,
          creditCosts: costsRes.data?.costs || null,
        })
      }
    } catch (err: any) {
      console.error('[BillingContext] Error loading billing data:', err)
      setError(err.message || 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBillingData()
  }, [loadBillingData])

  const refetch = useCallback(async () => {
    await loadBillingData()
  }, [loadBillingData])

  const estimateDiscoveryCost = useCallback((estimatedBusinesses: number): number => {
    if (!data?.creditCosts) return 0
    return Math.ceil(estimatedBusinesses * data.creditCosts.discoveryBusiness)
  }, [data])

  const estimateExportCost = useCallback((rows: number): number => {
    if (!data?.creditCosts) return 0
    return Math.ceil(rows * data.creditCosts.exportRow)
  }, [data])

  const hasEnoughCredits = useCallback((required: number): boolean => {
    if (!data) return false
    return data.credits >= required
  }, [data])

  const getUsagePercentage = useCallback((type: 'crawls' | 'exports' | 'datasets'): number => {
    if (!data) return 0
    const limit = data.limits[type]
    if (limit === null) return 0 // Unlimited
    const used = data.usage[type]
    return Math.min((used / limit) * 100, 100)
  }, [data])

  const isNearLimit = useCallback((type: 'crawls' | 'exports' | 'datasets', threshold: number = 80): boolean => {
    return getUsagePercentage(type) >= threshold
  }, [getUsagePercentage])

  return (
    <BillingContext.Provider
      value={{
        data,
        loading,
        error,
        refetch,
        estimateDiscoveryCost,
        estimateExportCost,
        hasEnoughCredits,
        getUsagePercentage,
        isNearLimit,
      }}
    >
      {children}
    </BillingContext.Provider>
  )
}

export function useBilling() {
  const context = useContext(BillingContext)
  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider')
  }
  return context
}
