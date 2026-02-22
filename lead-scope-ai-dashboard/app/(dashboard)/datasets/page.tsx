"use client"

import { useState, useEffect } from "react"
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
import { Database, Plus, MoreHorizontal, Eye, Download, ArrowUpCircle, AlertTriangle, Mail, Phone, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { api, NetworkError } from "@/lib/api"
import type { Dataset, ResponseMeta } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"
import { ExportAction } from "@/components/dashboard/export-action"
import { FreshnessTag } from "@/components/dashboard/freshness-tag"

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

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[] | null>(null)
  const [meta, setMeta] = useState<ResponseMeta>({
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [datasetCompleteness, setDatasetCompleteness] = useState<Record<string, { withEmail: number; withPhone: number; withWebsite: number; lastDiscovery: string | null }>>({})
  const [allDiscoveryRuns, setAllDiscoveryRuns] = useState<Array<{
    id: string;
    dataset_id: string;
    status: 'running' | 'completed' | 'failed';
    created_at: string;
    completed_at: string | null;
    businesses_found: number;
    dataset_name: string;
    industry_name: string;
    city_name: string | null;
  }> | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        console.log('[DatasetsPage] Fetching datasets from API...')
        
        // Load all discovery runs first (needed for completeness calculation)
        let allRuns: Array<{
          id: string;
          dataset_id: string;
          status: 'running' | 'completed' | 'failed';
          created_at: string;
          completed_at: string | null;
          businesses_found: number;
          dataset_name: string;
          industry_name: string;
          city_name: string | null;
        }> = []
        try {
          const discoveryRunsRes = await api.getAllDiscoveryRuns()
          if (discoveryRunsRes.data) {
            allRuns = discoveryRunsRes.data
          }
        } catch (e) {
          // Ignore discovery runs errors
        }
        
        const response = await api.getDatasets()
        console.log('[DatasetsPage] API response:', { 
          hasData: !!response.data, 
          dataLength: response.data?.length || 0,
          meta: response.meta 
        })
        
        if (response.data) {
          setDatasets(response.data)
          console.log('[DatasetsPage] Loaded datasets:', response.data.length)
          
          // Fetch completeness data for all datasets in parallel
          const completeness: Record<string, { withEmail: number; withPhone: number; withWebsite: number; lastDiscovery: string | null }> = {}
          
          // Make all API calls in parallel
          const completenessPromises = response.data.map(async (dataset) => {
            try {
              const businessesRes = await api.getBusinesses(dataset.id, { limit: 100 })
              if (businessesRes.data && businessesRes.data.length > 0) {
                const businesses = businessesRes.data
                const withEmail = businesses.filter(b => b.email).length
                const withPhone = businesses.filter(b => b.phone).length
                const withWebsite = businesses.filter(b => b.website).length
                
                // Get last discovery date from already-loaded discovery runs
                let lastDiscovery: string | null = null
                const datasetRuns = allRuns.filter(run => run.dataset_id === dataset.id)
                if (datasetRuns.length > 0) {
                  const completedRuns = datasetRuns.filter(run => run.status === 'completed' && run.completed_at)
                  if (completedRuns.length > 0) {
                    lastDiscovery = completedRuns.sort((a, b) => 
                      new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
                    )[0].completed_at!
                  }
                }
                
                // Estimate percentages based on sample
                const sampleSize = businesses.length
                return {
                  datasetId: dataset.id,
                  data: {
                    withEmail: Math.round((withEmail / sampleSize) * 100),
                    withPhone: Math.round((withPhone / sampleSize) * 100),
                    withWebsite: Math.round((withWebsite / sampleSize) * 100),
                    lastDiscovery,
                  }
                }
              }
            } catch (e) {
              // Ignore individual dataset errors
              console.error(`[DatasetsPage] Error loading completeness for dataset ${dataset.id}:`, e)
            }
            return null
          })
          
          // Wait for all completeness data to load
          const completenessResults = await Promise.all(completenessPromises)
          completenessResults.forEach(result => {
            if (result) {
              completeness[result.datasetId] = result.data
            }
          })
          
          setDatasetCompleteness(completeness)
        } else {
          console.log('[DatasetsPage] No datasets in response')
        }
        setMeta(response.meta)

        // Set discovery runs (already loaded above for completeness calculation)
        setAllDiscoveryRuns(allRuns)
      } catch (error) {
        console.error('[DatasetsPage] Error loading datasets:', error)
        if (error instanceof NetworkError) {
          setNetworkError(error.message)
        } else {
          setNetworkError('Failed to load datasets')
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const outdatedCount = datasets?.filter((d) => d.refreshStatus === "outdated").length || 0

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
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

      {/* All Discoveries Section */}
      {allDiscoveryRuns && allDiscoveryRuns.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-card-foreground">All Discoveries</CardTitle>
                <CardDescription>
                  History of all discovery runs across all datasets
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Dataset</TableHead>
                    <TableHead className="text-muted-foreground">Industry</TableHead>
                    <TableHead className="text-muted-foreground">City</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Businesses</TableHead>
                    <TableHead className="text-muted-foreground">Started</TableHead>
                    <TableHead className="text-muted-foreground">Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allDiscoveryRuns.map((run) => (
                    <TableRow key={run.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/datasets/${run.dataset_id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {run.dataset_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{run.industry_name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{run.city_name || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            run.status === 'completed' && "bg-success/10 text-success border-success/20",
                            run.status === 'running' && "bg-primary/10 text-primary border-primary/20",
                            run.status === 'failed' && "bg-destructive/10 text-destructive border-destructive/20"
                          )}
                        >
                          {run.status === 'completed' ? 'Completed' : run.status === 'running' ? 'Running' : 'Failed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {run.businesses_found.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(run.created_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {run.completed_at ? formatDate(run.completed_at) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
