"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface DiscoveryRun {
  id: string
  status: 'running' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
}

interface DiscoveryRunsProps {
  discoveryRuns: DiscoveryRun[]
  onRefresh?: () => void
  refreshing?: boolean
}

const statusConfig = {
  running: {
    label: "Running",
    icon: Clock,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-success/10 text-success border-success/20",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
} as const

export function DiscoveryRuns({ discoveryRuns, onRefresh, refreshing = false }: DiscoveryRunsProps) {
  const formatDate = (date: string | null) => {
    if (!date) return "Never"
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDuration = (started: string, completed: string | null) => {
    if (!completed) return "—"
    const start = new Date(started)
    const end = new Date(completed)
    const diffMs = end.getTime() - start.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    
    if (diffSeconds < 60) return `${diffSeconds}s`
    if (diffMinutes < 60) return `${diffMinutes}m ${diffSeconds % 60}s`
    const hours = Math.floor(diffMinutes / 60)
    return `${hours}h ${diffMinutes % 60}m`
  }

  if (discoveryRuns.length === 0) {
    return null
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Discovery Runs</CardTitle>
            <CardDescription>
              History of discovery jobs for this dataset
            </CardDescription>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh discovery runs"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {discoveryRuns.map((run) => {
            const StatusIcon = statusConfig[run.status].icon
            return (
              <div
                key={run.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "flex items-center gap-1.5 shrink-0",
                      statusConfig[run.status].className
                    )}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig[run.status].label}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      Started {formatDate(run.created_at)}
                    </div>
                    {run.completed_at && (
                      <div className="text-xs text-muted-foreground">
                        Completed {formatDate(run.completed_at)} • Duration: {formatDuration(run.created_at, run.completed_at)}
                      </div>
                    )}
                    {run.status === 'running' && (
                      <div className="text-xs text-muted-foreground">
                        In progress...
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0 ml-2">
                  {run.id.substring(0, 8)}...
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
