"use client"

import { useState, useEffect } from "react"
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
import { Download, FileSpreadsheet, Info, CheckCircle, Clock, AlertCircle, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, NetworkError } from "@/lib/api"
import type { ExportResult, ResponseMeta, Dataset } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"
import { useToast } from "@/hooks/use-toast"
import { ExportModal } from "@/components/dashboard/export-modal"
import { FreshnessTag } from "@/components/dashboard/freshness-tag"

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

export default function ExportsPage() {
  const [exports, setExports] = useState<ExportResult[] | null>(null)
  const [datasets, setDatasets] = useState<Dataset[] | null>(null)
  const [meta, setMeta] = useState<ResponseMeta>({
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const { toast } = useToast()

  // Load exports and datasets on mount
  useEffect(() => {
    loadExports()
    loadDatasets()
  }, [])

  const loadExports = async () => {
    try {
      setLoading(true)
      const response = await api.getExports()
      if (response.data) {
        setExports(response.data)
      }
      setMeta(response.meta)
      setNetworkError(null)
    } catch (error) {
      if (error instanceof NetworkError) {
        setNetworkError(error.message)
      } else {
        setNetworkError('Failed to load exports')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadDatasets = async () => {
    try {
      const response = await api.getDatasets()
      if (response.data) {
        setDatasets(response.data)
      }
    } catch (error) {
      console.error('Failed to load datasets:', error)
    }
  }

  const handleDownload = async (exportItem: ExportResult) => {
    if (!exportItem.download_url) {
      toast({
        title: "Download unavailable",
        description: "This export file is not available for download",
        variant: "destructive",
      })
      return
    }

    try {
      // If download_url is a full URL, use it directly
      if (exportItem.download_url.startsWith('http')) {
        window.open(exportItem.download_url, '_blank')
      } else {
        // Otherwise, try to fetch from backend
        const response = await fetch(exportItem.download_url, {
          credentials: 'include',
        })
        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `export-${exportItem.id}.${exportItem.format}`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the export file",
        variant: "destructive",
      })
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Get usage data
  const [usageStats, setUsageStats] = useState({
    used: 0,
    limit: 10,
    period: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  })

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const usageResponse = await api.getUsage()
        if (usageResponse.data) {
          const userResponse = await api.getCurrentUser()
          const userPlan = userResponse.data?.plan || 'demo'
          const planLimits: Record<string, number> = {
            demo: 10,
            snapshot: 1,
            professional: 5000,
            agency: Infinity,
          }
          setUsageStats({
            used: usageResponse.data.exports_this_month,
            limit: planLimits[userPlan] || 10,
            period: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          })
        }
      } catch (error) {
        // Fallback to calculated usage
        setUsageStats({
          used: exports?.filter(e => {
            const exportDate = new Date(e.created_at)
            const now = new Date()
            return exportDate.getMonth() === now.getMonth() && exportDate.getFullYear() === now.getFullYear()
          }).length || 0,
          limit: 10,
          period: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        })
      }
    }
    fetchUsage()
  }, [exports])

  // Get dataset name helper
  const getDatasetName = (datasetId: string) => {
    const dataset = datasets?.find(d => d.id === datasetId)
    return dataset?.name || datasetId.substring(0, 8) + '...'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exports</h1>
          <p className="text-sm text-muted-foreground">
            Download and manage your exported datasets
          </p>
        </div>
        <Button 
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            if (datasets && datasets.length > 0) {
              setSelectedDataset(datasets[0])
              setDialogOpen(true)
            } else {
              toast({
                title: "No datasets",
                description: "Please create a dataset first",
                variant: "destructive",
              })
            }
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Export
        </Button>
        
        <ExportModal
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          dataset={selectedDataset}
          onComplete={() => {
            loadExports()
            setDialogOpen(false)
          }}
        />
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
          Το export περιλαμβάνει τα διαθέσιμα δεδομένα της βάσης. Το refresh είναι προαιρετικό 
          και εφαρμόζεται μόνο όπου απαιτείται. Μπορείτε να κατεβάσετε ξανά προηγούμενα exports 
          χωρίς επιπλέον χρέωση.
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
                {usageStats.used} / {usageStats.limit === Infinity ? '∞' : usageStats.limit}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${usageStats.limit === Infinity ? 0 : Math.min((usageStats.used / usageStats.limit) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {usageStats.limit === Infinity ? 'Unlimited exports' : `${usageStats.limit - usageStats.used} exports remaining`}. Resets on the 1st of next month.
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
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !exports || exports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No exports yet</p>
              <p className="text-xs mt-2">Click "Create Export" to generate your first export</p>
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
                      <TableHead className="text-muted-foreground">Data Freshness</TableHead>
                      <TableHead className="text-muted-foreground">Format</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((exportItem) => {
                      const StatusIcon = statusConfig.completed.icon
                      const status = "completed"
                      return (
                        <TableRow key={exportItem.id} className="border-border hover:bg-muted/50">
                          <TableCell className="text-muted-foreground">
                            {formatDate(exportItem.created_at)}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {getDatasetName(exportItem.dataset_id)}
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
                            <FreshnessTag lastUpdatedAt={exportItem.created_at} />
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
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8" 
                                onClick={() => handleDownload(exportItem)}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
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
