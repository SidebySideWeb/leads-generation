"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info, Euro, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CostEstimates } from "@/lib/types"

interface ExportCostEstimatorProps {
  costEstimates: CostEstimates
  className?: string
}

export function ExportCostEstimator({ costEstimates, className }: ExportCostEstimatorProps) {
  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader>
        <CardTitle className="text-card-foreground flex items-center gap-2">
          <Euro className="w-5 h-5 text-primary" />
          Εκτίμηση Κόστους
        </CardTitle>
        <CardDescription>
          Εκτίμηση κόστους — δεν γίνεται χρέωση στο discovery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Estimates */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Εκτίμηση Export</h4>
          <div className="space-y-2">
            {costEstimates.exportEstimates.map((estimate) => (
              <div
                key={estimate.size}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {estimate.size.toLocaleString()} επιχειρήσεις
                  </span>
                  {estimate.size === costEstimates.estimatedBusinesses && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                      Όλες
                    </Badge>
                  )}
                </div>
                <span className="font-bold text-foreground">€{estimate.priceEUR}</span>
              </div>
            ))}
            {costEstimates.exportEstimates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Δεν υπάρχουν διαθέσιμα tiers για {costEstimates.estimatedBusinesses} επιχειρήσεις
              </p>
            )}
          </div>
        </div>

        {/* Refresh Estimates */}
        <div className="space-y-3 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Προαιρετικό Refresh
          </h4>
          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Ελλιπή στοιχεία</span>
                <span className="text-sm text-muted-foreground">
                  €{costEstimates.refreshEstimates.incompleteOnly.pricePerBusinessEUR.toFixed(2)} / επιχείρηση
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Ενημέρωση μόνο για επιχειρήσεις που λείπουν website/email/phone
                </span>
                <span className="font-bold text-foreground">
                  €{costEstimates.refreshEstimates.incompleteOnly.estimatedTotalEUR.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Πλήρες refresh</span>
                <span className="text-sm text-muted-foreground">
                  €{costEstimates.refreshEstimates.fullRefresh.pricePerBusinessEUR.toFixed(2)} / επιχείρηση
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Ενημέρωση όλων των επιχειρήσεων
                </span>
                <span className="font-bold text-foreground">
                  €{costEstimates.refreshEstimates.fullRefresh.estimatedTotalEUR.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-muted-foreground">
            Η ανακάλυψη είναι δωρεάν. Πληρώνετε μόνο όταν επιλέξετε να εξάγετε δεδομένα.
            Οι τιμές είναι εκτιμήσεις και μπορεί να διαφέρουν κατά την εξαγωγή.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
