import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, FileSpreadsheet, Info, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, NetworkError } from "@/lib/api"
import type { ExportResult, ResponseMeta } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"

const statusConfig = {
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-success/10 text-success border-success/20",
  },
  processing: {
    label: "Processing",
    icon: Clock,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
} as const

export default async function ExportsPage() {
  let exports: ExportResult[] | null = null
  let meta: ResponseMeta = {
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  }
  let networkError: string | null = null

  try {
    const response = await api.getExports()
    if (response.data) {
      exports = response.data
    }
    meta = response.meta
  } catch (error) {
    if (error instanceof NetworkError) {
      networkError = error.message
    } else {
      networkError = 'Failed to load exports'
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Calculate usage (this would come from API in production)
  const usageStats = {
    used: exports?.filter(e => {
      const exportDate = new Date(e.created_at)
      const now = new Date()
      return exportDate.getMonth() === now.getMonth() && exportDate.getFullYear() === now.getFullYear()
    }).length || 0,
    limit: 10, // Would come from user plan
    period: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Exports</h1>
        <p className="text-sm text-muted-foreground">
          Download and manage your exported datasets
        </p>
      </div>

      {networkError && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{networkError}</p>
          </CardContent>
        </Card>
      )}

      {meta.gated && <GateBanner meta={meta} />}

      {/* Info Banner */}
      <Alert className="bg-muted/50 border-border">
        <Info className="h-4 w-4 text-muted-foreground" />
        <AlertDescription className="text-muted-foreground">
          Exports are snapshots of your data at the time of export. Data freshness depends on your 
          subscription plan and refresh schedule.
        </AlertDescription>
      </Alert>

      {/* Usage Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Export Usage</CardTitle>
          <CardDescription>{usageStats.period}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Exports this month</span>
              <span className="font-medium text-foreground">
                {usageStats.used} / {usageStats.limit}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min((usageStats.used / usageStats.limit) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {usageStats.limit - usageStats.used} exports remaining. Resets on the 1st of next month.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Export History</CardTitle>
              <CardDescription>
                Your recent data exports
              </CardDescription>
            </div>
            {meta.total_available > 0 && <MetaInfo meta={meta} />}
          </div>
        </CardHeader>
        <CardContent>
          {!exports ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : exports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No exports yet</p>
              {meta.gated && meta.total_available > 0 && (
                <p className="text-xs mt-2">
                  {meta.total_available - meta.total_returned} more exports available with upgrade
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Date</TableHead>
                      <TableHead className="text-muted-foreground">Dataset</TableHead>
                      <TableHead className="text-muted-foreground text-right">Rows</TableHead>
                      <TableHead className="text-muted-foreground">Format</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((exportItem) => {
                      const StatusIcon = statusConfig.completed.icon // Status would come from API
                      const status = "completed" // Would come from exportItem.status
                      return (
                        <TableRow key={exportItem.id} className="border-border hover:bg-muted/50">
                          <TableCell className="text-muted-foreground">
                            {formatDate(exportItem.created_at)}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {exportItem.dataset_id}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right">
                            {exportItem.total_rows > 0 ? (
                              <div className="text-right">
                                <div className="font-medium text-foreground">
                                  {exportItem.total_rows.toLocaleString()} rows
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Export completed
                                </div>
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                              <FileSpreadsheet className="w-3 h-3 mr-1" />
                              {exportItem.format.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn("flex items-center gap-1 w-fit", statusConfig[status as keyof typeof statusConfig].className)}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {statusConfig[status as keyof typeof statusConfig].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {exportItem.download_url ? (
                              <Button variant="ghost" size="sm" className="h-8" asChild>
                                <a href={exportItem.download_url} download>
                                  <Download className="w-4 h-4 mr-1" />
                                  Download
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Processing...</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {meta.gated && meta.total_available > meta.total_returned && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Showing {meta.total_returned} of {meta.total_available} exports. Upgrade to see all.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
