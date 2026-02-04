"use client"

import { cn } from "@/lib/utils"

interface CompletenessBarProps {
  score: number // 0-100
  showLabel?: boolean
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
}

export function CompletenessBar({ score, showLabel = true, className, size = "md" }: CompletenessBarProps) {
  const clampedScore = Math.max(0, Math.min(100, score))
  
  const getColorClass = (score: number) => {
    if (score < 30) return "bg-warning"
    if (score < 70) return "bg-primary"
    return "bg-success"
  }

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Πληρότητα δεδομένων</span>
          <span className={cn(
            "font-medium",
            clampedScore < 30 ? "text-warning" :
            clampedScore < 70 ? "text-primary" :
            "text-success"
          )}>
            {clampedScore.toFixed(0)}%
          </span>
        </div>
      )}
      <div className={cn("relative w-full overflow-hidden rounded-full bg-muted", sizeClasses[size])}>
        <div
          className={cn(
            "h-full transition-all",
            getColorClass(clampedScore)
          )}
          style={{ width: `${clampedScore}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Calculate completeness score from business data
 */
export function calculateCompletenessScore(
  totalBusinesses: number,
  withWebsite: number,
  withEmail: number,
  withPhone: number
): number {
  if (totalBusinesses === 0) return 0
  
  // Weight: website (30%), email (40%), phone (30%)
  const websiteScore = (withWebsite / totalBusinesses) * 30
  const emailScore = (withEmail / totalBusinesses) * 40
  const phoneScore = (withPhone / totalBusinesses) * 30
  
  return websiteScore + emailScore + phoneScore
}
