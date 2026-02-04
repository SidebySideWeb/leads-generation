"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Info, CheckCircle, CreditCard, Euro } from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Dataset } from "@/lib/types"

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataset: Dataset | null
  onComplete?: () => void
}

type ExportSize = 50 | 100 | 500 | 1000 | 2000
type RefreshOption = "none" | "incomplete" | "full"

// Export pricing tiers (EUR) - matches backend pricing.ts
const EXPORT_PRICING: Record<ExportSize, number> = {
  50: 9,
  100: 15,
  500: 49,
  1000: 79,
  2000: 129,
}

// Refresh pricing (EUR per business) - matches backend pricing.ts
const REFRESH_PRICING = {
  incompleteOnly: 0.05, // Refresh only businesses missing website/email/phone
  fullRefresh: 0.03,    // Refresh all businesses (bulk discount)
} as const

// Default incomplete rate (30% of businesses are missing data)
const DEFAULT_INCOMPLETE_RATE = 0.3

export function ExportModal({ open, onOpenChange, dataset, onComplete }: ExportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedSize, setSelectedSize] = useState<ExportSize>(100)
  const [refreshOption, setRefreshOption] = useState<RefreshOption>("none")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const exportSizes: ExportSize[] = [50, 100, 500, 1000, 2000]
  const datasetSize = dataset?.businesses || 0

  // Calculate recommended size (closest to dataset size, but not larger)
  const recommendedSize = useMemo(() => {
    const availableSizes = exportSizes.filter(size => size <= datasetSize)
    if (availableSizes.length === 0) return exportSizes[0]
    
    // Find the size closest to dataset size
    return availableSizes.reduce((prev, curr) => {
      return Math.abs(curr - datasetSize) < Math.abs(prev - datasetSize) ? curr : prev
    })
  }, [datasetSize])

  // Set recommended size on mount or when dataset changes
  useEffect(() => {
    if (dataset && recommendedSize) {
      setSelectedSize(recommendedSize)
    }
  }, [dataset, recommendedSize])

  // Calculate export price
  const exportPrice = useMemo(() => {
    return EXPORT_PRICING[selectedSize] || 0
  }, [selectedSize])

  // Calculate affected businesses count for refresh
  const affectedBusinesses = useMemo(() => {
    if (refreshOption === "none") return 0
    if (refreshOption === "incomplete") {
      // Estimate incomplete businesses (30% default)
      return Math.ceil(selectedSize * DEFAULT_INCOMPLETE_RATE)
    }
    // Full refresh affects all selected businesses
    return selectedSize
  }, [refreshOption, selectedSize])

  // Calculate refresh cost
  const refreshCost = useMemo(() => {
    if (refreshOption === "none") return 0
    if (refreshOption === "incomplete") {
      return Math.round(affectedBusinesses * REFRESH_PRICING.incompleteOnly * 100) / 100
    }
    // Full refresh
    return Math.round(affectedBusinesses * REFRESH_PRICING.fullRefresh * 100) / 100
  }, [refreshOption, affectedBusinesses])

  // Calculate total price
  const totalPrice = useMemo(() => {
    return exportPrice + refreshCost
  }, [exportPrice, refreshCost])

  const handleNext = () => {
    if (step === 1) {
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
    } else if (step === 3) {
      setStep(2)
    }
  }

  const handleExport = async () => {
    if (!dataset) return

    setLoading(true)
    try {
      // Send export request with size and refresh options
      // Note: Backend may not fully support these parameters yet, but frontend is ready
      const response = await api.runExport(dataset.id, 'csv', {
        size: selectedSize,
        refresh: refreshOption,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        toast({
          title: "Export failed",
          description: errorData.message || errorData.meta?.gate_reason || "Failed to create export",
          variant: "destructive",
        })
        return
      }

      // Handle file download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${dataset.id}-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export created",
        description: `Your export of ${selectedSize} businesses has been downloaded`,
      })

      onOpenChange(false)
      if (onComplete) {
        onComplete()
      }
    } catch (error) {
      if (error instanceof NetworkError) {
        toast({
          title: "Network error",
          description: error.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setStep(1)
      setSelectedSize(recommendedSize)
      setRefreshOption("none")
      onOpenChange(false)
    }
  }

  const isSizeDisabled = (size: ExportSize) => {
    return size > datasetSize
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Εξαγωγή Dataset</DialogTitle>
          <DialogDescription>
            {step === 1 && "Επιλέξτε τον αριθμό επιχειρήσεων για εξαγωγή"}
            {step === 2 && "Επιλέξτε επιλογές ανανέωσης δεδομένων"}
            {step === 3 && "Σύνοψη κόστους και επιβεβαίωση"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Export Size */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Μέγεθος Εξαγωγής</Label>
                <RadioGroup 
                  value={String(selectedSize)} 
                  onValueChange={(v) => setSelectedSize(Number(v) as ExportSize)}
                >
                  <div className="grid grid-cols-2 gap-3">
                    {exportSizes.map((size) => {
                      const disabled = isSizeDisabled(size)
                      const isRecommended = size === recommendedSize && !disabled
                      
                      return (
                        <div key={size}>
                          <RadioGroupItem 
                            value={String(size)} 
                            id={`size-${size}`} 
                            className="peer sr-only" 
                            disabled={disabled}
                          />
                          <Label
                            htmlFor={`size-${size}`}
                            className={cn(
                              "flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all relative",
                              "hover:bg-muted/50",
                              disabled && "opacity-50 cursor-not-allowed",
                              selectedSize === size && !disabled
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card",
                              isRecommended && "ring-2 ring-primary/20"
                            )}
                          >
                            {isRecommended && (
                              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                                Προτεινόμενο
                              </span>
                            )}
                            <span className="text-2xl font-bold text-foreground">{size.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground mt-1">επιχειρήσεις</span>
                            {disabled && (
                              <span className="text-xs text-muted-foreground mt-1">(Διαθέσιμες: {datasetSize})</span>
                            )}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </RadioGroup>
              </div>

              {dataset && (
                <Alert className="bg-muted/50 border-border">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <AlertDescription className="text-sm text-muted-foreground">
                    Το dataset περιέχει {dataset.businesses.toLocaleString()} επιχειρήσεις.
                    {selectedSize > dataset.businesses && (
                      <span className="font-medium text-foreground"> Μόνο {dataset.businesses.toLocaleString()} θα εξαχθούν.</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 2: Data Refresh */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Ανανέωση Δεδομένων</Label>
                <RadioGroup 
                  value={refreshOption} 
                  onValueChange={(v) => setRefreshOption(v as RefreshOption)}
                >
                  <div className="space-y-3">
                    {/* No Refresh */}
                    <div>
                      <RadioGroupItem value="none" id="refresh-none" className="peer sr-only" />
                      <Label
                        htmlFor="refresh-none"
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                          "hover:bg-muted/50",
                          refreshOption === "none"
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card"
                        )}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-foreground">⭕ Χωρίς refresh</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Χρήση των υπαρχόντων δεδομένων της βάσης
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Κόστος refresh: €0.00
                          </div>
                        </div>
                        {refreshOption === "none" && (
                          <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                        )}
                      </Label>
                    </div>

                    {/* Incomplete Only */}
                    <div>
                      <RadioGroupItem value="incomplete" id="refresh-incomplete" className="peer sr-only" />
                      <Label
                        htmlFor="refresh-incomplete"
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                          "hover:bg-muted/50",
                          refreshOption === "incomplete"
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card"
                        )}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-foreground">⭕ Refresh μόνο ελλιπή στοιχεία</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Ενημέρωση μόνο όπου λείπει email ή τηλέφωνο
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Επηρεαζόμενες επιχειρήσεις: ~{affectedBusinesses.toLocaleString()}
                          </div>
                          <div className="text-xs font-medium text-foreground mt-1">
                            Κόστος refresh: €{refreshCost.toFixed(2)}
                          </div>
                        </div>
                        {refreshOption === "incomplete" && (
                          <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                        )}
                      </Label>
                    </div>

                    {/* Full Refresh */}
                    <div>
                      <RadioGroupItem value="full" id="refresh-full" className="peer sr-only" />
                      <Label
                        htmlFor="refresh-full"
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                          "hover:bg-muted/50",
                          refreshOption === "full"
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card"
                        )}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-foreground">⭕ Πλήρες refresh</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Επανέλεγχος όλων των επιχειρήσεων
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Επηρεαζόμενες επιχειρήσεις: {affectedBusinesses.toLocaleString()}
                          </div>
                          <div className="text-xs font-medium text-foreground mt-1">
                            Κόστος refresh: €{refreshCost.toFixed(2)}
                          </div>
                        </div>
                        {refreshOption === "full" && (
                          <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                        )}
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Refresh Explanation */}
              <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm text-muted-foreground">
                  Το refresh εφαρμόζεται μόνο όπου χρειάζεται και δεν επαναλαμβάνει περιττές ενέργειες.
                </AlertDescription>
              </Alert>

              {/* Transparency Note */}
              <Alert className="bg-muted/50 border-border">
                <Info className="h-4 w-4 text-muted-foreground" />
                <AlertDescription className="text-sm text-muted-foreground">
                  Τα δεδομένα βασίζονται σε δημόσιες καταχωρήσεις και επίσημα websites. Η πληρότητα διαφέρει ανά επιχείρηση.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 3: Cost Summary */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Σύνοψη Κόστους</Label>
                
                <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
                  {/* Export Size Cost */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">
                        Εξαγωγή {selectedSize.toLocaleString()} επιχειρήσεων
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Μέγεθος εξαγωγής
                      </div>
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      €{exportPrice.toFixed(2)}
                    </div>
                  </div>

                  {/* Refresh Cost */}
                  {refreshOption !== "none" && (
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div>
                        <div className="font-medium text-foreground">
                          {refreshOption === "incomplete" 
                            ? `Refresh ελλιπών στοιχείων (${affectedBusinesses.toLocaleString()} επιχειρήσεις)`
                            : `Πλήρες refresh (${affectedBusinesses.toLocaleString()} επιχειρήσεις)`
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {refreshOption === "incomplete" 
                            ? "Ενημέρωση μόνο ελλιπών στοιχείων"
                            : "Επανέλεγχος όλων των επιχειρήσεων"
                          }
                        </div>
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        €{refreshCost.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between pt-3 border-t-2 border-primary">
                    <div className="text-lg font-bold text-foreground">
                      Σύνολο
                    </div>
                    <div className="flex items-center gap-2">
                      <Euro className="w-5 h-5 text-primary" />
                      <span className="text-2xl font-bold text-primary">
                        {totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Confirmation Note */}
                <Alert className="bg-primary/5 border-primary/20">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm text-muted-foreground">
                    Η χρέωση θα γίνει άμεσα με την ολοκλήρωση του export.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={handleBack} disabled={loading}>
                  Πίσω
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Ακύρωση
              </Button>
              {step < 3 ? (
                <Button onClick={handleNext} disabled={loading || !selectedSize}>
                  Επόμενο
                </Button>
              ) : (
                <Button 
                  onClick={handleExport} 
                  disabled={loading || !selectedSize} 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Εξαγωγή...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Εξαγωγή & Πληρωμή
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
