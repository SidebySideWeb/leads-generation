"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Clock } from "lucide-react"

interface FreshnessTagProps {
  lastUpdatedAt: string | null
  className?: string
}

/**
 * Calculate freshness status based on last update time
 */
function getFreshnessStatus(lastUpdatedAt: string | null): {
  label: string
  className: string
  isStale: boolean
} {
  if (!lastUpdatedAt) {
    return {
      label: "Δεν έχει ενημερωθεί",
      className: "bg-muted text-muted-foreground border-border",
      isStale: true,
    }
  }

  const now = new Date()
  const updated = new Date(lastUpdatedAt)
  const daysDiff = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff < 7) {
    return {
      label: "Πρόσφατα ενημερωμένο",
      className: "bg-success/10 text-success border-success/20",
      isStale: false,
    }
  }

  if (daysDiff < 30) {
    return {
      label: "Ενημερωμένο",
      className: "bg-primary/10 text-primary border-primary/20",
      isStale: false,
    }
  }

  if (daysDiff < 90) {
    return {
      label: "Παλαιότερα δεδομένα",
      className: "bg-warning/10 text-warning border-warning/20",
      isStale: true,
    }
  }

  return {
    label: "Πολύ παλαιά δεδομένα",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    isStale: true,
  }
}

function formatRelativeTime(lastUpdatedAt: string): string {
  const now = new Date()
  const updated = new Date(lastUpdatedAt)
  const daysDiff = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff === 0) return "Σήμερα"
  if (daysDiff === 1) return "Χθες"
  if (daysDiff < 7) return `πριν ${daysDiff} ημέρες`
  if (daysDiff < 30) return `πριν ${Math.floor(daysDiff / 7)} εβδομάδες`
  if (daysDiff < 365) return `πριν ${Math.floor(daysDiff / 30)} μήνες`
  return `πριν ${Math.floor(daysDiff / 365)} χρόνια`
}

export function FreshnessTag({ lastUpdatedAt, className }: FreshnessTagProps) {
  const status = getFreshnessStatus(lastUpdatedAt)

  return (
    <Badge variant="outline" className={cn(status.className, className)}>
      <Clock className="w-3 h-3 mr-1" />
      {lastUpdatedAt ? (
        <span>
          {status.label} ({formatRelativeTime(lastUpdatedAt)})
        </span>
      ) : (
        <span>{status.label}</span>
      )}
    </Badge>
  )
}
