"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckCircle, Download, Building2, RefreshCw, Users, Zap, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import type { Subscription, UsageData, Invoice } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"

const plans = [
  {
    id: "snapshot",
    name: "Snapshot",
    price: "€30",
    period: "one-time",
    description: "For quick, one-time data needs",
    features: ["1 industry", "1 city", "One-time export", "No updates"],
    popular: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: "€99",
    period: "/month",
    description: "For growing teams and agencies",
    features: ["5 industries", "Monthly refresh", "Up to 5,000 exports/month", "Change detection"],
    popular: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: "€299",
    period: "/month",
    description: "For agencies with high volume needs",
    features: ["Unlimited industries", "Unlimited cities", "Monthly refresh", "Unlimited exports", "Priority crawling"],
    popular: false,
  },
]

// Plan limits based on plan type
const getPlanLimits = (plan: string) => {
  switch (plan) {
    case 'snapshot':
      return { industries: 1, exports: 1, datasets: 1 }
    case 'professional':
      return { industries: 5, exports: 5000, datasets: 5 }
    case 'agency':
      return { industries: Infinity, exports: Infinity, datasets: Infinity }
    default:
      return { industries: 0, exports: 0, datasets: 0 }
  }
}

function BillingPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [user, setUser] = useState<{ id: string; email: string; plan: string } | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    // Handle Stripe redirect
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const sessionId = searchParams.get('session_id')

    if (success && sessionId) {
      toast({
        title: "Payment successful",
        description: "Your subscription has been activated.",
      })
      // Reload data
      loadData()
      // Clean up URL
      router.replace('/billing')
    } else if (canceled) {
      toast({
        title: "Payment canceled",
        description: "Your payment was canceled.",
        variant: "default",
      })
      router.replace('/billing')
    }
  }, [searchParams, router, toast])

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [userRes, subscriptionRes, usageRes, invoicesRes] = await Promise.all([
        api.getCurrentUser(),
        api.getSubscription(),
        api.getUsage(),
        api.getInvoices(),
      ])

      if (userRes.data) {
        setUser({ id: userRes.data.id, email: userRes.data.email, plan: userRes.data.plan })
      }

      if (subscriptionRes.data) {
        setSubscription(subscriptionRes.data)
      }

      if (usageRes.data) {
        setUsage(usageRes.data)
      }

      if (invoicesRes.data) {
        setInvoices(invoicesRes.data)
      }
    } catch (error) {
      console.error('Failed to load billing data:', error)
      toast({
        title: "Error",
        description: "Failed to load billing information",
        variant: "destructive",
      })
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCheckout = async (planId: string) => {
    setLoading({ ...loading, [planId]: true })

    try {
      // Get current user
      const userResponse = await api.getCurrentUser()
      if (!userResponse.data) {
        toast({
          title: "Authentication required",
          description: "Please log in to continue",
          variant: "destructive",
        })
        return
      }

      const response = await api.createCheckoutSession(planId, userResponse.data.id)

      if (!response.data || !response.data.url) {
        toast({
          title: "Checkout failed",
          description: response.meta.gate_reason || "Failed to create checkout session",
          variant: "destructive",
        })
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = response.data.url
    } catch (error) {
      if (error instanceof NetworkError) {
        toast({
          title: "Network error",
          description: error.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    } finally {
      setLoading({ ...loading, [planId]: false })
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Plans</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and view your billing history
        </p>
      </div>

      {/* Current Plan Summary */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Current Plan</CardTitle>
              <CardDescription>
                {loadingData ? "Loading..." : `You are currently on the ${user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Demo'} plan`}
              </CardDescription>
            </div>
            {loadingData ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Demo'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingData ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : subscription ? (
            <>
              {subscription.current_period_end && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm text-muted-foreground">Next billing date</p>
                    <p className="text-lg font-medium text-foreground">
                      {new Date(subscription.current_period_end).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-lg font-medium text-foreground">
                      {subscription.status === 'active' ? 'Active' : subscription.status}
                    </p>
                  </div>
                </div>
              )}

              {/* Usage Bars */}
              {usage && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground">Usage this period</h4>
                  {(() => {
                    const limits = getPlanLimits(user?.plan || 'demo')
                    const usageItems = [
                      {
                        name: "Monthly exports",
                        used: usage.exports_this_month,
                        limit: limits.exports,
                        icon: Download,
                      },
                      {
                        name: "Datasets created",
                        used: usage.datasets_created_this_month,
                        limit: limits.datasets,
                        icon: Building2,
                      },
                      {
                        name: "Crawls this month",
                        used: usage.crawls_this_month,
                        limit: limits.datasets * 10, // Estimate
                        icon: RefreshCw,
                      },
                    ]
                    return usageItems.map((item) => (
                      <div key={item.name} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <item.icon className="w-4 h-4" />
                            {item.name}
                          </span>
                          <span className="font-medium text-foreground">
                            {item.used.toLocaleString()} / {item.limit === Infinity ? '∞' : item.limit.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              item.limit !== Infinity && item.used / item.limit > 0.9 ? "bg-warning" : "bg-primary"
                            )}
                            style={{ width: `${item.limit === Infinity ? 0 : Math.min((item.used / item.limit) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </>
          ) : null}
        </CardContent>
        {subscription && subscription.status === 'active' && (
          <CardFooter className="flex gap-3">
            <Button variant="outline">Cancel Subscription</Button>
            <Button variant="outline">Update Payment Method</Button>
          </CardFooter>
        )}
      </Card>

      {/* Pricing Plans */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Available Plans</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = user?.plan === plan.id
            return (
            <Card
              key={plan.id}
              className={cn(
                "bg-card relative",
                isCurrent ? "border-primary border-2" : "border-border"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  Recommended
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 px-3 py-1 bg-success text-success-foreground text-xs font-medium rounded-full">
                  Current
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-card-foreground">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-card-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-accent shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button variant="outline" className="w-full bg-transparent" disabled>
                    Current Plan
                  </Button>
                ) : plan.id === "agency" ? (
                  <Button 
                    variant="outline" 
                    className="w-full bg-transparent"
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
                        Upgrade
                      </>
                    )}
                  </Button>
                ) : plan.id === "snapshot" ? (
                  <Button 
                    variant="outline" 
                    className="w-full bg-transparent"
                    onClick={() => handleCheckout(plan.id)}
                    disabled={loading[plan.id]}
                  >
                    {loading[plan.id] ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Buy One-Time"
                    )}
                  </Button>
                ) : (
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
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
                        Upgrade
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
            )
          })}
        </div>
      </div>

      {/* Invoices */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Invoice History</CardTitle>
          <CardDescription>Download your past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No invoices yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Invoice</TableHead>
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invoice.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.currency === 'eur' ? '€' : invoice.currency} {invoice.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          invoice.status === 'paid' ? "bg-success/10 text-success border-success/20" :
                          invoice.status === 'pending' ? "bg-warning/10 text-warning border-warning/20" :
                          "bg-destructive/10 text-destructive border-destructive/20"
                        )}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.download_url ? (
                          <Button variant="ghost" size="sm" className="h-8" asChild>
                            <a href={invoice.download_url} download>
                              <Download className="w-4 h-4 mr-1" />
                              PDF
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading billing...</div>}>
      <BillingPageInner />
    </Suspense>
  )
}
