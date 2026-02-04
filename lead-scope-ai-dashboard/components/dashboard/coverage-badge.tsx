"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type CoverageLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH"

interface CoverageBadgeProps {
  level: CoverageLevel
  showTooltip?: boolean
  className?: string
}

const coverageConfig: Record<CoverageLevel, { label: string; className: string; description: string }> = {
  LOW: {
    label: "Χαμηλή κάλυψη",
    className: "bg-warning/10 text-warning border-warning/20",
    description: "Λίγες επιχειρήσεις βρέθηκαν. Η κάλυψη μπορεί να είναι ελλιπής.",
  },
  MEDIUM: {
    label: "Μέτρια κάλυψη",
    className: "bg-primary/10 text-primary border-primary/20",
    description: "Μέτρια κάλυψη. Μπορεί να λείπουν κάποιες επιχειρήσεις.",
  },
  HIGH: {
    label: "Καλή κάλυψη",
    className: "bg-success/10 text-success border-success/20",
    description: "Καλή κάλυψη της πόλης. Οι περισσότερες επιχειρήσεις εντοπίστηκαν.",
  },
  VERY_HIGH: {
    label: "Πολύ καλή κάλυψη",
    className: "bg-success/20 text-success border-success/30",
    description: "Πολύ καλή κάλυψη. Σχεδόν όλες οι επιχειρήσεις εντοπίστηκαν.",
  },
}

/**
 * Calculate coverage level based on businesses per grid point
 */
export function calculateCoverageLevel(businessesPerPoint: number): CoverageLevel {
  if (businessesPerPoint < 0.5) return "LOW"
  if (businessesPerPoint < 1.0) return "MEDIUM"
  if (businessesPerPoint < 2.0) return "HIGH"
  return "VERY_HIGH"
}

export function CoverageBadge({ level, showTooltip = true, className }: CoverageBadgeProps) {
  const config = coverageConfig[level]

  const badge = (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1">
            {badge}
            <Info className="w-3 h-3 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
