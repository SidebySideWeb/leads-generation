"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useBilling } from "@/contexts/BillingContext"
import { AlertTriangle, Zap, ArrowUp } from "lucide-react"
import { useState } from "react"
import { CreditPurchaseModal } from "./credit-purchase-modal"
import Link from "next/link"

export function LimitWarningBanner() {
  const { data, isNearLimit, hasEnoughCredits, getUsagePercentage } = useBilling()
  const [showCreditModal, setShowCreditModal] = useState(false)

  if (!data) return null

  // Check for various limit conditions
  const crawlsNearLimit = isNearLimit('crawls')
  const exportsNearLimit = isNearLimit('exports')
  const datasetsNearLimit = isNearLimit('datasets')
  const lowCredits = data.credits < 10
  const noCredits = data.credits === 0

  // Priority: No credits > Low credits > Near limits
  if (noCredits) {
    return (
      <>
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Credits Remaining</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>You have no credits remaining. Purchase credits to continue using the platform.</span>
            <Button
              size="sm"
              onClick={() => setShowCreditModal(true)}
              className="ml-4"
            >
              <Zap className="w-4 h-4 mr-2" />
              Buy Credits
            </Button>
          </AlertDescription>
        </Alert>
        <CreditPurchaseModal open={showCreditModal} onOpenChange={setShowCreditModal} />
      </>
    )
  }

  if (lowCredits) {
    return (
      <>
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low Credit Balance</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>You have {data.credits} credits remaining. Consider purchasing more credits.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreditModal(true)}
              className="ml-4"
            >
              <Zap className="w-4 h-4 mr-2" />
              Buy Credits
            </Button>
          </AlertDescription>
        </Alert>
        <CreditPurchaseModal open={showCreditModal} onOpenChange={setShowCreditModal} />
      </>
    )
  }

  if (crawlsNearLimit || exportsNearLimit || datasetsNearLimit) {
    const warnings: string[] = []
    if (crawlsNearLimit) warnings.push('discoveries')
    if (exportsNearLimit) warnings.push('exports')
    if (datasetsNearLimit) warnings.push('datasets')

    return (
      <Alert variant="default" className="mb-4 border-warning bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle>Approaching Usage Limits</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            You're approaching your monthly limit for {warnings.join(', ')}. 
            {data.plan === 'demo' && ' Consider upgrading your plan.'}
          </span>
          {data.plan === 'demo' && (
            <Link href="/billing">
              <Button size="sm" variant="outline" className="ml-4">
                <ArrowUp className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
            </Link>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
