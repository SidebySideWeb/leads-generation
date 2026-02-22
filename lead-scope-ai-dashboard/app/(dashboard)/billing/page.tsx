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
import { CheckCircle, Download, Loader2, Zap, Info, Database, FileDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import type { Subscription, UsageData, Invoice, ExportResult } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { CreditDashboard } from "@/components/dashboard/credit-dashboard"
import { CreditPurchaseModal } from "@/components/dashboard/credit-purchase-modal"
import { useBilling } from "@/contexts/BillingContext"

// Plan configuration matching backend entitlements and plan limits
const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "€29",
    period: "/μήνα",
    description: "Για μικρές επιχειρήσεις και ξεκινήματα",
    features: [
      "500 credits / μήνα",
      "10 discoveries / μήνα",
      "10 exports / μήνα",
      "Έως 2.000 επιχειρήσεις ανά dataset",
      "5 datasets",
      "Refresh διαθέσιμο (επιπλέον χρέωση)",
    ],
    limits: {
      creditsPerMonth: 500,
      discoveriesPerMonth: 10,
      maxDatasetSize: 2000,
      maxExportSize: 2000,
      exportsPerMonth: 10,
      maxDatasets: 5,
      refreshAvailable: true,
      refreshType: "standard" as const,
    },
    popular: false,
  },
  {
    id: "professional",
    name: "Pro",
    price: "€99",
    period: "/μήνα",
    description: "Για μεγάλες επιχειρήσεις και ομάδες",
    features: [
      "3.000 credits / μήνα",
      "100 discoveries / μήνα",
      "50 exports / μήνα",
      "Unlimited επιχειρήσεις ανά dataset",
      "20 datasets",
      "Priority refresh",
    ],
    limits: {
      creditsPerMonth: 3000,
      discoveriesPerMonth: 100,
      maxDatasetSize: Infinity,
      maxExportSize: Infinity,
      exportsPerMonth: 50,
      maxDatasets: 20,
      refreshAvailable: true,
      refreshType: "priority" as const,
    },
    popular: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: "€299",
    period: "/μήνα",
    description: "Για agencies με υψηλές ανάγκες",
    features: [
      "Unlimited credits*",
      "Unlimited discoveries*",
      "100 exports / μήνα",
      "Έως 50.000 επιχειρήσεις ανά dataset",
      "Unlimited datasets",
      "Advanced refresh",
    ],
    limits: {
      creditsPerMonth: Infinity,
      discoveriesPerMonth: Infinity,
      maxDatasetSize: 50000,
      maxExportSize: Infinity,
      exportsPerMonth: 100,
      maxDatasets: Infinity,
      refreshAvailable: true,
      refreshType: "advanced" as const,
    },
    popular: false,
    footnote: "*Fair use policy applies",
  },
]

// Get plan limits for usage calculations
const getPlanLimits = (planId: string) => {
  const plan = plans.find(p => p.id === planId)
  if (!plan) {
    return {
      creditsPerMonth: 0,
      discoveriesPerMonth: 0,
      exportsPerMonth: 0,
      maxDatasetSize: 0,
      maxExportSize: 0,
      maxDatasets: 0,
      refreshAvailable: false,
      refreshType: "standard" as const,
    }
  }
  return plan.limits
}

function BillingPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: billingData, refetch: refetchBilling } = useBilling()
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [user, setUser] = useState<{ id: string; email: string; plan: string } | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [businessesExported, setBusinessesExported] = useState<number>(0)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [allExports, setAllExports] = useState<ExportResult[]>([])
  const [allDiscoveries, setAllDiscoveries] = useState<Array<{
    id: string;
    dataset_id: string;
    status: 'running' | 'completed' | 'failed';
    created_at: string;
    completed_at: string | null;
    businesses_found: number;
    dataset_name: string;
    industry_name: string;
    city_name: string | null;
  }>>([])

  useEffect(() => {
    // Handle Stripe redirect
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const sessionId = searchParams.get('session_id')

    if (success && sessionId) {
      const credits = searchParams.get('credits')
      if (credits) {
        toast({
          title: "Credits purchased",
          description: `You've successfully purchased ${credits} credits.`,
        })
      } else {
        toast({
          title: "Payment successful",
          description: "Your subscription has been activated.",
        })
      }
      loadData()
      refetchBilling()
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
      const [userRes, subscriptionRes, usageRes, invoicesRes, exportsRes, discoveriesRes] = await Promise.all([
        api.getCurrentUser(),
        api.getSubscription(),
        api.getUsage(),
        api.getInvoices(),
        api.getExports().catch(() => ({ data: null, meta: { plan_id: 'demo' as const, gated: false, total_available: 0, total_returned: 0 } })),
        api.getAllDiscoveryRuns().catch(() => ({ data: null, meta: { plan_id: 'demo' as const, gated: false, total_available: 0, total_returned: 0 } })),
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

      // Calculate businesses exported this month
      if (exportsRes.data) {
        setAllExports(exportsRes.data)
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
        const thisMonthExports = exportsRes.data.filter(exp => {
          const exportDate = new Date(exp.created_at).toISOString().slice(0, 7)
          return exportDate === currentMonth
        })
        const totalBusinesses = thisMonthExports.reduce((sum, exp) => sum + (exp.total_rows || 0), 0)
        setBusinessesExported(totalBusinesses)
      }

      // Load all discoveries
      if (discoveriesRes.data) {
        setAllDiscoveries(discoveriesRes.data)
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

  // Map user plan to plan ID (handle snapshot -> starter, professional -> pro)
  const getUserPlanId = (plan: string | undefined): string => {
    if (!plan || plan === 'demo') return 'demo'
    if (plan === 'snapshot') return 'starter'
    if (plan === 'professional' || plan === 'pro') return 'professional'
    return plan
  }
  
  const userPlanId = getUserPlanId(user?.plan)
  // For demo users, show starter plan as current (they can upgrade)
  const currentPlan = plans.find(p => p.id === userPlanId) || plans[0]
  const planLimits = getPlanLimits(userPlanId === 'demo' ? 'starter' : userPlanId)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Plans</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription, credits, and view billing history
        </p>
      </div>

      {/* Credit Dashboard */}
      <CreditDashboard />

      {/* Buy Credits CTA */}
      {billingData && billingData.credits < 50 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Low on Credits?</h3>
                <p className="text-sm text-muted-foreground">
                  Purchase additional credits to continue using the platform
                </p>
              </div>
              <Button onClick={() => setShowCreditModal(true)}>
                <Zap className="w-4 h-4 mr-2" />
                Buy Credits
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Explanation Block */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm text-muted-foreground">
          <strong className="text-foreground">Τα πακέτα καθορίζουν τα όρια χρήσης και τα credits.</strong>
          <br />
          <strong className="text-foreground">Credit Costs:</strong> Discovery (0.2 credits/business), Export (0.05 credits/row)
          <br />
          Η χρέωση γίνεται μόνο όταν εξάγετε αποτελέσματα. Μπορείτε να αγοράσετε επιπλέον credits αν χρειαστεί.
        </AlertDescription>
      </Alert>

      {/* Current Plan Summary */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Τρέχον Πακέτο</CardTitle>
              <CardDescription>
                {loadingData ? "Loading..." : user?.plan === 'demo' ? "Είστε στο δωρεάν πακέτο Demo" : `Είστε στο πακέτο ${currentPlan.name}`}
              </CardDescription>
            </div>
            {loadingData ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {user?.plan === 'demo' ? 'Demo' : currentPlan.name}
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
                    <p className="text-sm text-muted-foreground">Επόμενη χρέωση</p>
                    <p className="text-lg font-medium text-foreground">
                      {new Date(subscription.current_period_end).toLocaleDateString("el-GR", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Κατάσταση</p>
                    <p className="text-lg font-medium text-foreground">
                      {subscription.status === 'active' ? 'Ενεργό' : subscription.status}
                    </p>
                  </div>
                </div>
              )}

              {/* Usage Section */}
              {usage && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground">Χρήση αυτού του μήνα</h4>
                  
                  {/* Credits Used */}
                  {billingData && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Zap className="w-4 h-4" />
                          Credits διαθέσιμα
                        </span>
                        <span className="font-medium text-foreground">
                          {billingData.credits.toLocaleString()} {planLimits.creditsPerMonth === Infinity ? '' : `/ ${planLimits.creditsPerMonth.toLocaleString()}`}
                        </span>
                      </div>
                      {planLimits.creditsPerMonth !== Infinity && (
                        <Progress 
                          value={Math.min((billingData.credits / planLimits.creditsPerMonth) * 100, 100)} 
                          className="h-2"
                        />
                      )}
                    </div>
                  )}

                  {/* Discoveries Used */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Database className="w-4 h-4" />
                        Discoveries χρησιμοποιημένα
                      </span>
                      <span className="font-medium text-foreground">
                        {usage.datasets_created_this_month || 0} / {planLimits.discoveriesPerMonth === Infinity ? '∞' : planLimits.discoveriesPerMonth}
                      </span>
                    </div>
                    {planLimits.discoveriesPerMonth !== Infinity && (
                      <Progress 
                        value={Math.min(((usage.datasets_created_this_month || 0) / planLimits.discoveriesPerMonth) * 100, 100)} 
                        className="h-2"
                      />
                    )}
                  </div>

                  {/* Exports Used */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <FileDown className="w-4 h-4" />
                        Exports χρησιμοποιημένα
                      </span>
                      <span className="font-medium text-foreground">
                        {usage.exports_this_month || 0} / {planLimits.exportsPerMonth === Infinity ? '∞' : planLimits.exportsPerMonth}
                      </span>
                    </div>
                    {planLimits.exportsPerMonth !== Infinity && (
                      <Progress 
                        value={Math.min(((usage.exports_this_month || 0) / planLimits.exportsPerMonth) * 100, 100)} 
                        className="h-2"
                      />
                    )}
                  </div>

                  {/* Businesses Exported */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Download className="w-4 h-4" />
                        Επιχειρήσεις που εξήχθησαν
                      </span>
                      <span className="font-medium text-foreground">
                        {businessesExported.toLocaleString()}
                      </span>
                    </div>
                    {planLimits.maxExportSize !== Infinity && (
                      <Progress 
                        value={Math.min((businessesExported / planLimits.maxExportSize) * 100, 100)} 
                        className="h-2"
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
        {subscription && subscription.status === 'active' && (
          <CardFooter className="flex gap-3">
            <Button variant="outline">Ακύρωση Συνδρομής</Button>
            <Button variant="outline">Ενημέρωση Μεθόδου Πληρωμής</Button>
          </CardFooter>
        )}
      </Card>

      {/* Pricing Plans */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Διαθέσιμα Πακέτα</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = userPlanId === plan.id
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
                    Προτεινόμενο
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-success text-success-foreground text-xs font-medium rounded-full">
                    Τρέχον
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
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.footnote && (
                    <p className="text-xs text-muted-foreground mt-4 italic">
                      {plan.footnote}
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full bg-transparent" disabled>
                      Τρέχον Πακέτο
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
                          Επεξεργασία...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Αναβάθμιση
                        </>
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
                          Επεξεργασία...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Αναβάθμιση
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

      {/* Metrics & History Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Discoveries */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Πρόσφατες Discoveries</CardTitle>
            <CardDescription>Ιστορικό discovery runs</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : allDiscoveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Δεν υπάρχουν discoveries ακόμα</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {allDiscoveries.slice(0, 10).map((discovery) => (
                  <div key={discovery.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            discovery.status === 'completed' && "bg-success/10 text-success border-success/20",
                            discovery.status === 'running' && "bg-primary/10 text-primary border-primary/20",
                            discovery.status === 'failed' && "bg-destructive/10 text-destructive border-destructive/20"
                          )}
                        >
                          {discovery.status === 'completed' ? 'Ολοκληρώθηκε' : 
                           discovery.status === 'running' ? 'Σε εξέλιξη' : 
                           'Απέτυχε'}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {discovery.dataset_name || discovery.industry_name || 'Unknown'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(discovery.created_at).toLocaleDateString("el-GR", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {discovery.businesses_found > 0 && (
                          <span className="ml-2">• {discovery.businesses_found.toLocaleString()} επιχειρήσεις</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Exports */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Πρόσφατα Exports</CardTitle>
            <CardDescription>Ιστορικό exports</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : allExports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Δεν υπάρχουν exports ακόμα</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {allExports.slice(0, 10).map((exportItem) => {
                  const status = exportItem.status || (exportItem.download_url ? 'completed' : 'processing')
                  return (
                    <div key={exportItem.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              status === 'completed' && "bg-success/10 text-success border-success/20",
                              status === 'processing' && "bg-primary/10 text-primary border-primary/20",
                              status === 'failed' && "bg-destructive/10 text-destructive border-destructive/20"
                            )}
                          >
                            {status === 'completed' ? 'Ολοκληρώθηκε' : 
                             status === 'processing' ? 'Σε εξέλιξη' : 
                             'Απέτυχε'}
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
                            {exportItem.format.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(exportItem.created_at).toLocaleDateString("el-GR", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {exportItem.total_rows > 0 && (
                            <span className="ml-2">• {exportItem.total_rows.toLocaleString()} rows</span>
                          )}
                        </div>
                      </div>
                      {status === 'completed' && exportItem.download_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            const a = document.createElement('a')
                            a.href = exportItem.download_url!
                            a.download = `export-${exportItem.id}.${exportItem.format}`
                            a.click()
                          }}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Metrics */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Μετρικές Χρήσης</CardTitle>
          <CardDescription>Στατιστικά των τελευταίων 6 μηνών</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Calculate monthly metrics */}
              {(() => {
                const months: Array<{ month: string; discoveries: number; exports: number; businesses: number }> = []
                const now = new Date()
                
                for (let i = 5; i >= 0; i--) {
                  const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                  const monthName = date.toLocaleDateString("el-GR", { month: "long", year: "numeric" })
                  
                  const monthDiscoveries = allDiscoveries.filter(d => {
                    const discoveryDate = new Date(d.created_at)
                    return discoveryDate.getFullYear() === date.getFullYear() &&
                           discoveryDate.getMonth() === date.getMonth()
                  }).length
                  
                  const monthExports = allExports.filter(e => {
                    const exportDate = new Date(e.created_at)
                    return exportDate.getFullYear() === date.getFullYear() &&
                           exportDate.getMonth() === date.getMonth()
                  })
                  
                  const monthBusinesses = monthExports.reduce((sum, e) => sum + (e.total_rows || 0), 0)
                  
                  months.push({
                    month: monthName,
                    discoveries: monthDiscoveries,
                    exports: monthExports.length,
                    businesses: monthBusinesses,
                  })
                }
                
                return (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground">Μήνας</TableHead>
                          <TableHead className="text-muted-foreground text-right">Discoveries</TableHead>
                          <TableHead className="text-muted-foreground text-right">Exports</TableHead>
                          <TableHead className="text-muted-foreground text-right">Επιχειρήσεις</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {months.map((monthData, idx) => (
                          <TableRow key={idx} className="border-border hover:bg-muted/50">
                            <TableCell className="font-medium text-foreground">{monthData.month}</TableCell>
                            <TableCell className="text-muted-foreground text-right">
                              {monthData.discoveries}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-right">
                              {monthData.exports}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-right">
                              {monthData.businesses.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Ιστορικό Τιμολογίων</CardTitle>
          <CardDescription>Κατεβάστε τα προηγούμενα τιμολόγιά σας</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Δεν υπάρχουν τιμολόγια ακόμα</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Τιμολόγιο</TableHead>
                    <TableHead className="text-muted-foreground">Ημερομηνία</TableHead>
                    <TableHead className="text-muted-foreground">Ποσό</TableHead>
                    <TableHead className="text-muted-foreground">Κατάσταση</TableHead>
                    <TableHead className="text-muted-foreground text-right">Λήψη</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invoice.date).toLocaleDateString("el-GR", {
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
                          {invoice.status === 'paid' ? 'Πληρωμένο' : 
                           invoice.status === 'pending' ? 'Εκκρεμές' : 
                           invoice.status}
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

      <CreditPurchaseModal open={showCreditModal} onOpenChange={setShowCreditModal} />
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
