"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useBilling } from "@/contexts/BillingContext"
import { Zap, Database, FileDown, FolderOpen, TrendingUp, AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export function CreditDashboard() {
  const { data, loading, getUsagePercentage, isNearLimit } = useBilling()

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Failed to load billing data</AlertDescription>
      </Alert>
    )
  }

  const crawlsPercent = getUsagePercentage('crawls')
  const exportsPercent = getUsagePercentage('exports')
  const datasetsPercent = getUsagePercentage('datasets')
  const creditsPercent = data.limits.crawls ? 
    Math.min((data.credits / (data.limits.crawls * 50)) * 100, 100) : 0 // Rough estimate

  return (
    <div className="space-y-6">
      {/* Credit Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Credit Balance
          </CardTitle>
          <CardDescription>Available credits for operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{data.credits.toLocaleString()}</span>
              <span className="text-muted-foreground">credits</span>
            </div>
            {data.limits.crawls && (
              <Progress 
                value={creditsPercent} 
                className={cn(
                  "h-2",
                  creditsPercent < 20 && "bg-destructive",
                  creditsPercent >= 20 && creditsPercent < 50 && "bg-warning",
                  creditsPercent >= 50 && "bg-primary"
                )}
              />
            )}
            {data.credits < 10 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Low credit balance. Consider purchasing more credits.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Crawls Usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Discoveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">
                  {data.usage.crawls} / {data.limits.crawls === null ? '∞' : data.limits.crawls}
                </span>
              </div>
              {data.limits.crawls !== null && (
                <>
                  <Progress 
                    value={crawlsPercent} 
                    className={cn(
                      "h-2",
                      isNearLimit('crawls') && "bg-destructive",
                      !isNearLimit('crawls') && crawlsPercent >= 50 && "bg-warning",
                      crawlsPercent < 50 && "bg-primary"
                    )}
                  />
                  {isNearLimit('crawls') && (
                    <p className="text-xs text-destructive">Near limit</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Exports Usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileDown className="h-4 w-4" />
              Exports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">
                  {data.usage.exports} / {data.limits.exports === null ? '∞' : data.limits.exports}
                </span>
              </div>
              {data.limits.exports !== null && (
                <>
                  <Progress 
                    value={exportsPercent} 
                    className={cn(
                      "h-2",
                      isNearLimit('exports') && "bg-destructive",
                      !isNearLimit('exports') && exportsPercent >= 50 && "bg-warning",
                      exportsPercent < 50 && "bg-primary"
                    )}
                  />
                  {isNearLimit('exports') && (
                    <p className="text-xs text-destructive">Near limit</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Datasets Usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Datasets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">
                  {data.usage.datasets} / {data.limits.datasets === null ? '∞' : data.limits.datasets}
                </span>
              </div>
              {data.limits.datasets !== null && (
                <>
                  <Progress 
                    value={datasetsPercent} 
                    className={cn(
                      "h-2",
                      isNearLimit('datasets') && "bg-destructive",
                      !isNearLimit('datasets') && datasetsPercent >= 50 && "bg-warning",
                      datasetsPercent < 50 && "bg-primary"
                    )}
                  />
                  {isNearLimit('datasets') && (
                    <p className="text-xs text-destructive">Near limit</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Consumption Breakdown */}
      {data.consumptionByFeature.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Credit Consumption This Month
            </CardTitle>
            <CardDescription>Breakdown by feature</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.consumptionByFeature.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground capitalize">
                    {item.feature.replace(/_/g, ' ')}
                  </span>
                  <Badge variant="outline">{item.credits.toLocaleString()} credits</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
