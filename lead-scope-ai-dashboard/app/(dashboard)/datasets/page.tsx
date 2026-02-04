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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Database, Plus, MoreHorizontal, Eye, Download, ArrowUpCircle, AlertTriangle, Mail, Phone, Globe, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { api } from "@/lib/api"
import { NetworkError } from "@/lib/api"
import type { Dataset, ResponseMeta, Business } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"
import { ExportAction } from "@/components/dashboard/export-action"
import { FreshnessTag } from "@/components/dashboard/freshness-tag"
// Auth is handled client-side via API calls (they redirect on 401/403)

const statusConfig = {
  snapshot: {
    label: "Snapshot",
    className: "bg-muted text-muted-foreground border-border",
    description: "One-time export, no updates",
  },
  refreshing: {
    label: "Refreshing Monthly",
    className: "bg-success/10 text-success border-success/20",
    description: "Automatically updated",
  },
  outdated: {
    label: "Outdated",
    className: "bg-warning/10 text-warning border-warning/20",
    description: "Needs refresh",
  },
} as const

export default async function DatasetsPage() {
  // Don't check auth server-side - cookie might not be readable due to cross-domain
  // The cookie is sent in the request, but Next.js cookies() might not read it
  // Let the page load and API calls will handle auth (they'll redirect on 401/403)
  // This prevents the 307 redirect loop

  let datasets: Dataset[] | null = null
  let meta: ResponseMeta = {
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  }
  let networkError: string | null = null
  let datasetCompleteness: Record<string, { withEmail: number; withPhone: number; withWebsite: number; lastDiscovery: string | null }> = {}

  try {
    console.log('[DatasetsPage] Fetching datasets from API...')
    const response = await api.getDatasets()
    console.log('[DatasetsPage] API response:', { 
      hasData: !!response.data, 
      dataLength: response.data?.length || 0,
      meta: response.meta 
    })
    
    if (response.data) {
      datasets = response.data
      console.log('[DatasetsPage] Loaded datasets:', datasets.length)
      
      // Fetch completeness data for each dataset
      for (const dataset of datasets) {
        try {
          const businessesRes = await api.getBusinesses(dataset.id, { limit: 100 })
          if (businessesRes.data && businessesRes.data.length > 0) {
            const businesses = businessesRes.data
            const withEmail = businesses.filter(b => b.email).length
            const withPhone = businesses.filter(b => b.phone).length
            const withWebsite = businesses.filter(b => b.website).length
            
            // Get last discovery date from discovery runs
            let lastDiscovery: string | null = null
            try {
              const discoveryRunsRes = await api.getDiscoveryRuns(dataset.id)
              if (discoveryRunsRes.data && discoveryRunsRes.data.length > 0) {
                const completedRuns = discoveryRunsRes.data.filter(run => run.status === 'completed' && run.completed_at)
                if (completedRuns.length > 0) {
                  lastDiscovery = completedRuns.sort((a, b) => 
                    new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
                  )[0].completed_at!
                }
              }
            } catch (e) {
              // Ignore discovery runs errors
            }
            
            // Estimate percentages based on sample
            const sampleSize = businesses.length
            datasetCompleteness[dataset.id] = {
              withEmail: Math.round((withEmail / sampleSize) * 100),
              withPhone: Math.round((withPhone / sampleSize) * 100),
              withWebsite: Math.round((withWebsite / sampleSize) * 100),
              lastDiscovery,
            }
          }
        } catch (e) {
          // Ignore individual dataset errors
          console.error(`[DatasetsPage] Error loading completeness for dataset ${dataset.id}:`, e)
        }
      }
    } else {
      console.log('[DatasetsPage] No datasets in response')
    }
    meta = response.meta
  } catch (error) {
    console.error('[DatasetsPage] Error loading datasets:', error)
    if (error instanceof NetworkError) {
      networkError = error.message
    } else {
      networkError = 'Failed to load datasets'
    }
  }

  const outdatedCount = datasets?.filter((d) => d.refreshStatus === "outdated").length || 0

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Datasets</h1>
          <p className="text-sm text-muted-foreground">
            Manage your discovered business contact datasets
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/discover">
            <Plus className="mr-2 w-4 h-4" />
            New Discovery
          </Link>
        </Button>
      </div>

      {networkError && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{networkError}</p>
          </CardContent>
        </Card>
      )}

      {meta.gated && <GateBanner meta={meta} />}

      {/* Warning Banner */}
      {outdatedCount > 0 && (
        <Alert className="bg-warning/5 border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-foreground">
            <strong>{outdatedCount} dataset{outdatedCount > 1 ? "s" : ""}</strong> have not been 
            refreshed in over 30 days.{" "}
            <Link href="/billing" className="text-primary hover:underline">
              Upgrade to Professional
            </Link>{" "}
            for automatic monthly refreshes.
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!datasets || datasets.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Database className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground mb-2">No datasets yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              Run your first discovery to create a dataset of verified business contacts.
            </p>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/discover">
                <Plus className="mr-2 w-4 h-4" />
                Run First Discovery
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-card-foreground">All Datasets</CardTitle>
                <CardDescription>
                  {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} •{" "}
                  {datasets.reduce((acc, d) => acc + d.businesses, 0).toLocaleString()} total businesses
                </CardDescription>
              </div>
              {meta.total_available > 0 && <MetaInfo meta={meta} />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Dataset Name</TableHead>
                    <TableHead className="text-muted-foreground">Industry</TableHead>
                    <TableHead className="text-muted-foreground">City</TableHead>
                    <TableHead className="text-muted-foreground text-right">Businesses</TableHead>
                    <TableHead className="text-muted-foreground">Completeness</TableHead>
                    <TableHead className="text-muted-foreground">Last Discovery</TableHead>
                    <TableHead className="text-muted-foreground">Refresh Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow key={dataset.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/datasets/${dataset.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {dataset.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{dataset.industry}</TableCell>
                      <TableCell className="text-muted-foreground">{dataset.city}</TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {dataset.businesses.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {datasetCompleteness[dataset.id] ? (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1" title={`${datasetCompleteness[dataset.id].withWebsite}% have website`}>
                              <Globe className={cn(
                                "w-4 h-4",
                                datasetCompleteness[dataset.id].withWebsite > 50 ? "text-success" : 
                                datasetCompleteness[dataset.id].withWebsite > 20 ? "text-warning" : 
                                "text-muted-foreground"
                              )} />
                              <span className="text-xs text-muted-foreground">{datasetCompleteness[dataset.id].withWebsite}%</span>
                            </div>
                            <div className="flex items-center gap-1" title={`${datasetCompleteness[dataset.id].withEmail}% have email`}>
                              <Mail className={cn(
                                "w-4 h-4",
                                datasetCompleteness[dataset.id].withEmail > 50 ? "text-success" : 
                                datasetCompleteness[dataset.id].withEmail > 20 ? "text-warning" : 
                                "text-muted-foreground"
                              )} />
                              <span className="text-xs text-muted-foreground">{datasetCompleteness[dataset.id].withEmail}%</span>
                            </div>
                            <div className="flex items-center gap-1" title={`${datasetCompleteness[dataset.id].withPhone}% have phone`}>
                              <Phone className={cn(
                                "w-4 h-4",
                                datasetCompleteness[dataset.id].withPhone > 50 ? "text-success" : 
                                datasetCompleteness[dataset.id].withPhone > 20 ? "text-warning" : 
                                "text-muted-foreground"
                              )} />
                              <span className="text-xs text-muted-foreground">{datasetCompleteness[dataset.id].withPhone}%</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {datasetCompleteness[dataset.id]?.lastDiscovery ? (
                          <FreshnessTag lastUpdatedAt={datasetCompleteness[dataset.id].lastDiscovery} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(statusConfig[dataset.refreshStatus].className)}
                        >
                          {statusConfig[dataset.refreshStatus].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/datasets/${dataset.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <ExportAction datasetId={dataset.id} format="csv" />
                            <ExportAction datasetId={dataset.id} format="xlsx" />
                            <DropdownMenuSeparator />
                            {dataset.refreshStatus === "snapshot" && (
                              <DropdownMenuItem asChild>
                                <Link href="/billing">
                                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                                  Upgrade to Refresh
                                </Link>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {meta.gated && meta.total_available > meta.total_returned && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Showing {meta.total_returned} of {meta.total_available} datasets. Upgrade to see all.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
