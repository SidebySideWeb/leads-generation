"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Zap, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { useBilling } from "@/contexts/BillingContext"
import { Skeleton } from "@/components/ui/skeleton"

const PLANS = [
  {
    id: "demo",
    name: "Demo",
    price: "Free",
    period: "",
    description: "Perfect for trying out the platform",
    features: [
      "50 credits included",
      "1 discovery / month",
      "1 export / month",
      "1 dataset",
      "50 businesses per dataset",
    ],
    limits: {
      credits: 50,
      crawls: 1,
      exports: 1,
      datasets: 1,
      businessesPerDataset: 50,
    },
    popular: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "€29",
    period: "/month",
    description: "For small businesses and startups",
    features: [
      "500 credits / month",
      "10 discoveries / month",
      "10 exports / month",
      "5 datasets",
      "2,000 businesses per dataset",
    ],
    limits: {
      credits: 500,
      crawls: 10,
      exports: 10,
      datasets: 5,
      businessesPerDataset: 2000,
    },
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "€99",
    period: "/month",
    description: "For growing businesses and teams",
    features: [
      "3,000 credits / month",
      "100 discoveries / month",
      "50 exports / month",
      "20 datasets",
      "Unlimited businesses per dataset",
    ],
    limits: {
      credits: 3000,
      crawls: 100,
      exports: 50,
      datasets: 20,
      businessesPerDataset: Infinity,
    },
    popular: false,
  },
]

export default function PricingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: billingData } = useBilling()
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const handleCheckout = async (planId: string) => {
    if (planId === 'demo') {
      toast({
        title: "Demo Plan",
        description: "You're already on the demo plan. Choose a paid plan to upgrade.",
      })
      return
    }

    setLoading({ ...loading, [planId]: true })

    try {
      const response = await api.createBillingCheckout(planId)

      if (!response.data || !response.data.url) {
        toast({
          title: "Checkout failed",
          description: response.meta.gate_reason || "Failed to create checkout session",
          variant: "destructive",
        })
        return
      }

      window.location.href = response.data.url
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading({ ...loading, [planId]: false })
    }
  }

  const currentPlanId = billingData?.plan || 'demo'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Pricing Plans</h1>
        <p className="text-muted-foreground mt-2">
          Choose the plan that fits your needs. All plans include monthly credits and usage limits.
        </p>
      </div>

      {/* Credit Cost Info */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Credit Costs</h3>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Discovery:</span>{" "}
            <span className="font-medium">0.2 credits/business</span>
          </div>
          <div>
            <span className="text-muted-foreground">Website Crawl:</span>{" "}
            <span className="font-medium">1 credit</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email Extraction:</span>{" "}
            <span className="font-medium">2 credits</span>
          </div>
          <div>
            <span className="text-muted-foreground">Export Row:</span>{" "}
            <span className="font-medium">0.1 credits</span>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlanId === plan.id
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative",
                isCurrent ? "border-primary border-2" : "",
                plan.popular && !isCurrent ? "border-primary/50" : ""
              )}
            >
              {plan.popular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  Most Popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 px-3 py-1 bg-success text-success-foreground text-xs font-medium rounded-full">
                  Current Plan
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className={cn(
                      "w-full",
                      plan.popular && "bg-primary hover:bg-primary/90"
                    )}
                    onClick={() => handleCheckout(plan.id)}
                    disabled={loading[plan.id]}
                  >
                    {loading[plan.id] ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        {plan.id === 'demo' ? 'Start Free' : 'Upgrade'}
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* FAQ or Additional Info */}
      <div className="bg-muted/50 p-6 rounded-lg">
        <h3 className="font-semibold mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-1">What happens if I exceed my limits?</h4>
            <p className="text-muted-foreground">
              You can purchase additional credits or upgrade your plan. Credits never expire.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Can I change plans later?</h4>
            <p className="text-muted-foreground">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Do credits roll over?</h4>
            <p className="text-muted-foreground">
              Monthly credits reset each billing cycle, but purchased credits never expire.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
