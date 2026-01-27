"use client"

import { useState, useEffect } from "react"
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

const plans = [
  {
    id: "snapshot",
    name: "Snapshot",
    price: "€30",
    period: "one-time",
    description: "For quick, one-time data needs",
    features: ["1 industry", "1 city", "One-time export", "No updates"],
    current: false,
    popular: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: "€99",
    period: "/month",
    description: "For growing teams and agencies",
    features: ["5 industries", "Monthly refresh", "Up to 5,000 exports/month", "Change detection"],
    current: true,
    popular: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: "€299",
    period: "/month",
    description: "For agencies with high volume needs",
    features: ["Unlimited industries", "Unlimited cities", "Monthly refresh", "Unlimited exports", "Priority crawling"],
    current: false,
    popular: false,
  },
]

// Usage data would come from API
const usageData = [
  {
    name: "Industries tracked",
    used: 3,
    limit: 5,
    icon: Building2,
  },
  {
    name: "Monthly exports",
    used: 2847,
    limit: 5000,
    icon: Download,
  },
  {
    name: "Datasets refreshed",
    used: 4,
    limit: 5,
    icon: RefreshCw,
  },
]

// Invoices would come from API
const invoices: Array<{
  id: string
  date: string
  amount: string
  status: "paid" | "pending" | "failed"
}> = []

export default function BillingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState<Record<string, boolean>>({})

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
      // Clean up URL
      router.replace('/(dashboard)/billing')
    } else if (canceled) {
      toast({
        title: "Payment canceled",
        description: "Your payment was canceled.",
        variant: "default",
      })
      router.replace('/(dashboard)/billing')
    }
  }, [searchParams, router, toast])

  const handleCheckout = async (planId: string) => {
    setLoading({ ...loading, [planId]: true })

    try {
      // Get current user ID (in production, get from auth context)
      const userId = 'user-id-placeholder' // TODO: Get from auth context

      const response = await api.createCheckoutSession(planId, userId)

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
              <CardDescription>You are currently on the Professional plan</CardDescription>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">
              Professional
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Next billing date</p>
              <p className="text-lg font-medium text-foreground">
                {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-lg font-medium text-foreground">€99.00</p>
            </div>
          </div>

          {/* Usage Bars */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Usage this period</h4>
            {usageData.map((item) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </span>
                  <span className="font-medium text-foreground">
                    {item.used.toLocaleString()} / {item.limit.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      item.used / item.limit > 0.9 ? "bg-warning" : "bg-primary"
                    )}
                    style={{ width: `${Math.min((item.used / item.limit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline">Cancel Subscription</Button>
          <Button variant="outline">Update Payment Method</Button>
        </CardFooter>
      </Card>

      {/* Pricing Plans */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Available Plans</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "bg-card relative",
                plan.current ? "border-primary border-2" : "border-border"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  Recommended
                </div>
              )}
              {plan.current && (
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
                {plan.current ? (
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
          ))}
        </div>
      </div>

      {/* Invoices */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Invoice History</CardTitle>
          <CardDescription>Download your past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
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
                      <TableCell className="font-medium text-foreground">{invoice.id}</TableCell>
                      <TableCell className="text-muted-foreground">{invoice.date}</TableCell>
                      <TableCell className="text-muted-foreground">{invoice.amount}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          Paid
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8">
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
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
