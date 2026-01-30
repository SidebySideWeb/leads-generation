import Link from "next/link"
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
import { RefreshCw, CheckCircle, Clock, AlertTriangle, ArrowUpCircle, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, NetworkError } from "@/lib/api"
import type { Dataset, ResponseMeta } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"

const statusConfig = {
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-success/10 text-success border-success/20",
  },
  running: {
    label: "Running",
    icon: RefreshCw,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  scheduled: {
    label: "Scheduled",
    icon: Clock,
    className: "bg-muted text-muted-foreground border-border",
  },
  snapshot: {
    label: "No Refresh",
    icon: AlertTriangle,
    className: "bg-warning/10 text-warning border-warning/20",
  },
} as const

export default async function RefreshStatusPage() {
  let datasets: Dataset[] | null = null
  let meta: ResponseMeta = {
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  }
  let networkError: string | null = null

  try {
    const response = await api.getDatasets()
    if (response.data) {
      datasets = response.data
    }
    meta = response.meta
  } catch (error) {
    if (error instanceof NetworkError) {
      networkError = error.message
    } else {
      networkError = 'Failed to load datasets'
    }
  }

  const runningJobs = datasets?.filter((d) => d.refreshStatus === "refreshing").length || 0
  const scheduledJobs = 0 // Would come from API

  const formatDate = (date: string | null) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Refresh Status</h1>
        <p className="text-sm text-muted-foreground">
          Monitor the refresh status of your datasets
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <RefreshCw className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{runningJobs}</p>
                <p className="text-sm text-muted-foreground">Currently Running</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{scheduledJobs}</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success/10">
                <Calendar className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                <p className="text-sm text-muted-foreground">Next Refresh Cycle</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Datasets */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">All Datasets</CardTitle>
              <CardDescription>Refresh status for all your datasets</CardDescription>
            </div>
            {meta.total_available > 0 && <MetaInfo meta={meta} />}
          </div>
        </CardHeader>
        <CardContent>
          {!datasets ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No datasets found</p>
              {meta.gated && meta.total_available > 0 && (
                <p className="text-xs mt-2">
                  {meta.total_available - meta.total_returned} more datasets available with upgrade
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Dataset</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Last Refresh</TableHead>
                      <TableHead className="text-muted-foreground">Next Refresh</TableHead>
                      <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datasets.map((dataset) => {
                      const status = dataset.refreshStatus === "refreshing" ? "running" : 
                                    dataset.refreshStatus === "snapshot" ? "snapshot" : "completed"
                      const StatusIcon = statusConfig[status].icon
                      return (
                        <TableRow key={dataset.id} className="border-border hover:bg-muted/50">
                          <TableCell className="font-medium text-foreground">
                            <Link
                              href={`/datasets/${dataset.id}`}
                              className="hover:text-primary hover:underline"
                            >
                              {dataset.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn("flex items-center gap-1 w-fit", statusConfig[status].className)}
                            >
                              <StatusIcon className={cn("w-3 h-3", status === "running" && "animate-spin")} />
                              {statusConfig[status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(dataset.lastRefresh)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {dataset.refreshStatus === "refreshing" ? "In progress" : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {dataset.refreshStatus === "snapshot" ? (
                              <Button variant="ghost" size="sm" asChild className="h-8">
                                <Link href="/billing">
                                  <ArrowUpCircle className="w-4 h-4 mr-1" />
                                  Upgrade
                                </Link>
                              </Button>
                            ) : dataset.refreshStatus === "refreshing" ? (
                              <Button variant="ghost" size="sm" className="h-8" disabled>
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Refreshing
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {meta.gated && meta.total_available > meta.total_returned && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Showing {meta.total_returned} of {meta.total_available} datasets. Upgrade to see all.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
