"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Play,
  Loader2
} from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { CrawlJob, ExtractionJob, ResponseMeta } from "@/lib/types"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { usePermissions } from "@/contexts/PermissionsContext"
import { canPerformAction } from "@/lib/permissions"

interface CrawlStatusProps {
  datasetId: string
}

const statusConfig = {
  queued: {
    label: "Queued",
    icon: Clock,
    className: "bg-muted text-muted-foreground border-border",
  },
  running: {
    label: "Running",
    icon: RefreshCw,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-success/10 text-success border-success/20",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
} as const

export function CrawlStatus({ datasetId }: CrawlStatusProps) {
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([])
  const [meta, setMeta] = useState<ResponseMeta>({
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { permissions } = usePermissions()
  
  // Check if crawl is allowed (for UI display only - backend always enforces)
  const crawlCheck = canPerformAction(permissions, 'crawl')
  // Note: We don't block the action, just show visual state

  const [discoveryRuns, setDiscoveryRuns] = useState<Array<{
    id: string;
    status: 'running' | 'completed' | 'failed';
    created_at: string;
    completed_at: string | null;
  }>>([])
  const [extractionJobs, setExtractionJobs] = useState<ExtractionJob[]>([])

  const loadCrawlStatus = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Load discovery runs (orchestration layer)
      const discoveryResponse = await api.getDiscoveryRuns(datasetId)
      if (discoveryResponse.data) {
        // Ensure it's always an array
        const runs = Array.isArray(discoveryResponse.data) ? discoveryResponse.data : []
        setDiscoveryRuns(runs)
        
        // Load extraction jobs for the latest running discovery run
        const runningRun = runs.find(run => run.status === 'running')
        if (runningRun) {
          try {
            const extractionResponse = await api.getExtractionJobs({ discoveryRunId: runningRun.id })
            if (extractionResponse.data) {
              setExtractionJobs(extractionResponse.data)
            }
          } catch (err) {
            console.error('Failed to load extraction jobs:', err)
          }
        } else {
          // Load all extraction jobs for this dataset
          try {
            const extractionResponse = await api.getExtractionJobs({ datasetId })
            if (extractionResponse.data) {
              setExtractionJobs(extractionResponse.data)
            }
          } catch (err) {
            console.error('Failed to load extraction jobs:', err)
          }
        }
      }
      
      // Also load crawl jobs for backward compatibility
      const response = await api.getCrawlStatus(datasetId)
      if (response.data) {
        // Ensure it's always an array
        const jobs = Array.isArray(response.data) ? response.data : []
        setCrawlJobs(jobs)
      }
      setMeta(response.meta)
    } catch (err) {
      if (err instanceof NetworkError) {
        setError(err.message)
      } else {
        setError('Failed to load status')
      }
    } finally {
      setLoading(false)
    }
  }, [datasetId])

  const handleStartCrawl = async () => {
    setStarting(true)
    setError(null)

    try {
      // Note: This is actually starting discovery, not crawl
      // The button text should be "Start Discovery" but keeping function name for now
      const response = await api.runCrawl(datasetId)

      if (!response.data) {
        toast({
          title: "Discovery failed to start",
          description: response.meta.gate_reason || "Failed to start discovery",
          variant: response.meta.gated ? "default" : "destructive",
        })
        setMeta(response.meta)
        return
      }

      // Check if response contains discovery_run data
      // The backend now returns discovery_run in the response
      if (response.data && 'id' in response.data) {
        // Optimistically add discovery run
        const optimisticRun = {
          id: (response.data as any).id || `temp-${Date.now()}`,
          status: 'running' as const,
          created_at: new Date().toISOString(),
          completed_at: null,
        }
        setDiscoveryRuns(prev => {
          const safePrev = Array.isArray(prev) ? prev : []
          return [optimisticRun, ...safePrev]
        })
      }

      toast({
        title: "Discovery started",
        description: "Discovery run has been started successfully",
      })

      // Reload status after a short delay to get real data
      setTimeout(() => {
        loadCrawlStatus()
      }, 1000)
    } catch (err) {
      if (err instanceof NetworkError) {
        setError(err.message)
        toast({
          title: "Network error",
          description: err.message,
          variant: "destructive",
        })
      } else {
        setError('Failed to start discovery')
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => {
    loadCrawlStatus()
  }, [loadCrawlStatus])

  // Poll for updates if there's a running discovery run (every 3-5 seconds)
  useEffect(() => {
    // Ensure discoveryRuns is always an array
    const safeDiscoveryRuns = Array.isArray(discoveryRuns) ? discoveryRuns : []
    const hasRunningDiscovery = safeDiscoveryRuns.some(run => run.status === 'running')
    
    if (!hasRunningDiscovery) {
      return // No polling needed
    }
    
    const pollInterval = setInterval(() => {
      loadCrawlStatus()
    }, 4000) // Poll every 4 seconds (between 3-5 seconds)
    
    return () => {
      clearInterval(pollInterval)
    }
  }, [discoveryRuns, loadCrawlStatus])

  // Ensure arrays are always arrays
  const safeDiscoveryRuns = Array.isArray(discoveryRuns) ? discoveryRuns : []
  const safeCrawlJobs = Array.isArray(crawlJobs) ? crawlJobs : []
  const safeExtractionJobs = Array.isArray(extractionJobs) ? extractionJobs : []
  
  const latestJob = safeCrawlJobs.length > 0 ? safeCrawlJobs[0] : null
  const hasRunningJob = safeCrawlJobs.some(job => job.status === 'running' || job.status === 'queued')
  const pagesAllowed = latestJob?.pages_limit || (meta.gated ? 3 : 25)

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Discovery & Crawl Status</CardTitle>
            <CardDescription>
              Monitor discovery runs and website crawling progress
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadCrawlStatus}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={handleStartCrawl}
              disabled={starting || hasRunningJob}
              // Never block action - only visual state
              // Backend will enforce limits
              className={cn(
                "bg-primary hover:bg-primary/90 text-primary-foreground",
                !crawlCheck.allowed && "opacity-50"
              )}
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Discovery
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert className="bg-destructive/10 border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {meta.gated && (
          <Alert className="bg-warning/5 border-warning/20">
            <AlertTitle className="text-foreground">Demo Plan Limits</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Demo plan crawls up to 3 pages per site.
            </AlertDescription>
          </Alert>
        )}

        {meta.gated && <GateBanner meta={meta} />}

        {/* Discovery Runs Section */}
        {safeDiscoveryRuns.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Discovery Runs</h4>
            {safeDiscoveryRuns.map((run) => {
              const StatusIcon = statusConfig[run.status === 'running' ? 'running' : run.status === 'completed' ? 'completed' : 'failed'].icon
              const isRunning = run.status === 'running'
              const runExtractionJobs = safeExtractionJobs.filter(job => {
                // Filter extraction jobs for this discovery run
                // We need to check if the job's business belongs to this discovery run
                // For now, show all extraction jobs if this is the latest run
                return safeDiscoveryRuns[0]?.id === run.id
              })
              const pendingJobs = runExtractionJobs.filter(j => j.status === 'pending' || j.status === 'running').length
              const completedJobs = runExtractionJobs.filter(j => j.status === 'success').length
              const failedJobs = runExtractionJobs.filter(j => j.status === 'failed').length
              const totalJobs = runExtractionJobs.length

              return (
                <div key={run.id} className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn("flex items-center gap-1", statusConfig[run.status === 'running' ? 'running' : run.status === 'completed' ? 'completed' : 'failed'].className)}
                    >
                      <StatusIcon className={cn("w-3 h-3", isRunning && "animate-spin")} />
                      {run.status === 'running' ? 'Running' : run.status === 'completed' ? 'Completed' : 'Failed'}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(run.created_at).toLocaleString()}
                      {run.completed_at && (
                        <> • Completed: {new Date(run.completed_at).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                  
                  {/* Extraction Jobs Summary */}
                  {totalJobs > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="text-xs font-medium text-foreground mb-2">Extraction Jobs</div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Total: {totalJobs}</span>
                        {pendingJobs > 0 && <span className="text-primary">Pending: {pendingJobs}</span>}
                        {completedJobs > 0 && <span className="text-success">Completed: {completedJobs}</span>}
                        {failedJobs > 0 && <span className="text-destructive">Failed: {failedJobs}</span>}
                      </div>
                      {totalJobs > 0 && (
                        <Progress 
                          value={totalJobs > 0 ? ((completedJobs + failedJobs) / totalJobs) * 100 : 0} 
                          className="h-2 mt-2" 
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {loading && safeCrawlJobs.length === 0 && safeDiscoveryRuns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>Loading status...</p>
          </div>
        ) : safeCrawlJobs.length === 0 && safeDiscoveryRuns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No discovery runs or crawl jobs yet</p>
            <p className="text-xs mt-1">Start a discovery or crawl to see status</p>
          </div>
        ) : (
          <div className="space-y-4">
            {safeDiscoveryRuns.length > 0 && (
              <h4 className="text-sm font-medium text-foreground">Crawl Jobs</h4>
            )}
            {/* Always show all jobs, even if partial/incomplete - never hide partial results */}
            {safeCrawlJobs.map((job) => {
              const StatusIcon = statusConfig[job.status].icon
              const isRunning = job.status === 'running' || job.status === 'queued'
              const progress = job.pages_limit > 0 
                ? Math.min((job.pages_crawled / job.pages_limit) * 100, 100)
                : 0

              return (
                <div key={job.id} className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={cn("flex items-center gap-1", statusConfig[job.status].className)}
                      >
                        <StatusIcon className={cn("w-3 h-3", isRunning && "animate-spin")} />
                        {statusConfig[job.status].label}
                      </Badge>
                      {job.website_url && (
                        <span className="text-sm text-muted-foreground truncate max-w-xs">
                          {job.website_url}
                        </span>
                      )}
                    </div>
                    {job.last_error && (
                      <Alert className="bg-destructive/10 border-destructive/20 p-2">
                        <AlertDescription className="text-xs text-destructive">
                          {job.last_error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pages Crawled</span>
                      <span className="font-medium text-foreground">
                        {job.pages_crawled} / {job.pages_limit || pagesAllowed}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {job.started_at && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Started: {new Date(job.started_at).toLocaleString()}
                      </span>
                      {job.completed_at && (
                        <span>
                          Completed: {new Date(job.completed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {job.attempts > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Attempts: {job.attempts}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {meta.total_available > 0 && (
          <div className="text-xs text-center text-muted-foreground pt-2 border-t border-border">
            Showing {meta.total_returned} of {meta.total_available} crawl jobs
          </div>
        )}
      </CardContent>
    </Card>
  )
}
