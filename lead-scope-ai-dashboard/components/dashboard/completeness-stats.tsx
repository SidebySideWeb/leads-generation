"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe, Mail, Phone } from "lucide-react"
import { cn } from "@/lib/utils"
import { CompletenessBar, calculateCompletenessScore } from "./completeness-bar"

interface CompletenessStatsProps {
  withWebsitePercent: number
  withEmailPercent: number
  withPhonePercent: number
  totalBusinesses: number
  className?: string
}

export function CompletenessStats({
  withWebsitePercent,
  withEmailPercent,
  withPhonePercent,
  totalBusinesses,
  className,
}: CompletenessStatsProps) {
  const overallScore = calculateCompletenessScore(
    totalBusinesses,
    Math.round((withWebsitePercent / 100) * totalBusinesses),
    Math.round((withEmailPercent / 100) * totalBusinesses),
    Math.round((withPhonePercent / 100) * totalBusinesses)
  )

  const stats = [
    {
      icon: Globe,
      label: "Website",
      percent: withWebsitePercent,
      count: Math.round((withWebsitePercent / 100) * totalBusinesses),
      color: "text-success",
    },
    {
      icon: Mail,
      label: "Email",
      percent: withEmailPercent,
      count: Math.round((withEmailPercent / 100) * totalBusinesses),
      color: "text-primary",
    },
    {
      icon: Phone,
      label: "Phone",
      percent: withPhonePercent,
      count: Math.round((withPhonePercent / 100) * totalBusinesses),
      color: "text-warning",
    },
  ]

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader>
        <CardTitle className="text-card-foreground">Πληρότητα Δεδομένων</CardTitle>
        <CardDescription>
          Ποσοστό επιχειρήσεων με διαθέσιμα στοιχεία
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Completeness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Συνολική Πληρότητα</span>
            <span className={cn(
              "font-medium",
              overallScore < 30 ? "text-warning" :
              overallScore < 70 ? "text-primary" :
              "text-success"
            )}>
              {overallScore.toFixed(0)}%
            </span>
          </div>
          <CompletenessBar score={overallScore} showLabel={false} />
        </div>

        {/* Individual Stats */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="flex items-center justify-center mb-2">
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stat.percent.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stat.count.toLocaleString()} {stat.label === "Website" ? "με website" : stat.label === "Email" ? "με email" : "με phone"}
              </div>
            </div>
          ))}
        </div>

        {/* Progress Bars for Each Stat */}
        <div className="space-y-2 pt-2">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <stat.icon className="w-3 h-3" />
                  {stat.label}
                </span>
                <span className="font-medium text-foreground">{stat.percent.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    stat.percent < 30 ? "bg-warning" :
                    stat.percent < 70 ? "bg-primary" :
                    "bg-success"
                  )}
                  style={{ width: `${Math.min(stat.percent, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
