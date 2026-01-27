"use client"

import { useState, useEffect } from "react"
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
import type { CrawlJob, ResponseMeta } from "@/lib/types"
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

  const loadCrawlStatus = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.getCrawlStatus(datasetId)
      
      if (response.data) {
        setCrawlJobs(response.data)
      }
      setMeta(response.meta)
    } catch (err) {
      if (err instanceof NetworkError) {
        setError(err.message)
      } else {
        setError('Failed to load crawl status')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleStartCrawl = async () => {
    setStarting(true)
    setError(null)

    try {
      const response = await api.runCrawl(datasetId)

      if (!response.data) {
        toast({
          title: "Crawl failed to start",
          description: response.meta.gate_reason || "Failed to start crawl job",
          variant: response.meta.gated ? "default" : "destructive",
        })
        setMeta(response.meta)
        return
      }

      toast({
        title: "Crawl started",
        description: "Crawl job has been queued successfully",
      })

      // Reload status after a short delay
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
        setError('Failed to start crawl')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId])

  const latestJob = crawlJobs.length > 0 ? crawlJobs[0] : null
  const hasRunningJob = crawlJobs.some(job => job.status === 'running' || job.status === 'queued')
  const pagesAllowed = latestJob?.pages_limit || (meta.gated ? 3 : 25)

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Crawl Status</CardTitle>
            <CardDescription>
              Monitor website crawling progress and page limits
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
                  Start Crawl
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

        {loading && crawlJobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>Loading crawl status...</p>
          </div>
        ) : crawlJobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No crawl jobs yet</p>
            <p className="text-xs mt-1">Click "Start Crawl" to begin crawling websites</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Always show all jobs, even if partial/incomplete - never hide partial results */}
            {crawlJobs.map((job) => {
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
