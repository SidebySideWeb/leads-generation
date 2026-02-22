"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useBilling } from "@/contexts/BillingContext"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Zap, Check } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface CreditPurchaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface CreditPackage {
  id: string
  productId: string
  name: string
  priceEUR: number
  credits: number
  bonus: string
}

export function CreditPurchaseModal({ open, onOpenChange }: CreditPurchaseModalProps) {
  const { data, refetch } = useBilling()
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [packagesLoading, setPackagesLoading] = useState(true)

  // Fetch credit packages from API
  useEffect(() => {
    if (open) {
      fetchPackages()
    }
  }, [open])

  const fetchPackages = async () => {
    setPackagesLoading(true)
    try {
      const response = await api.getCreditPackages()
      if (response.data?.packages) {
        setPackages(response.data.packages)
      } else {
        toast({
          title: "Error",
          description: "Failed to load credit packages",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load credit packages",
        variant: "destructive",
      })
    } finally {
      setPackagesLoading(false)
    }
  }

  const handlePurchase = async (packageId: string) => {
    setLoading(packageId)
    try {
      const response = await api.buyCredits(packageId)
      if (response.data?.url) {
        window.location.href = response.data.url
      } else {
        toast({
          title: "Error",
          description: "Failed to create checkout session",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to purchase credits",
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  // Determine which package is "popular" (middle one, or best value)
  const getPopularPackageId = () => {
    if (packages.length === 0) return null
    // Mark the middle package as popular, or the one with best value (highest credits/price ratio)
    if (packages.length === 3) {
      return packages[1].id // Middle package
    }
    // Find package with best value
    const bestValue = packages.reduce((best, pkg) => {
      const value = pkg.credits / pkg.priceEUR
      const bestValue = best.credits / best.priceEUR
      return value > bestValue ? pkg : best
    }, packages[0])
    return bestValue.id
  }

  const popularPackageId = getPopularPackageId()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Purchase Credits
          </DialogTitle>
          <DialogDescription>
            Buy additional credits to continue using the platform. Credits never expire.
          </DialogDescription>
        </DialogHeader>

        {packagesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No credit packages available
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3 py-4">
            {packages.map((pkg) => {
              const isPopular = pkg.id === popularPackageId
              const hasBonus = pkg.bonus !== '0%'
              
              return (
                <Card
                  key={pkg.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary relative",
                    isPopular && "border-primary border-2"
                  )}
                  onClick={() => handlePurchase(pkg.id)}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full z-10">
                      Best Value
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-2xl">{pkg.name || `${pkg.credits.toLocaleString()} Credits`}</CardTitle>
                    <CardDescription>{pkg.credits.toLocaleString()} Credits</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">€{pkg.priceEUR.toLocaleString()}</div>
                      {hasBonus && (
                        <>
                          <div className="text-xs text-primary font-medium">{pkg.bonus} bonus</div>
                          <div className="text-xs text-muted-foreground">Get {pkg.bonus} extra credits</div>
                        </>
                      )}
                      <Button
                        className="w-full"
                        disabled={loading === pkg.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePurchase(pkg.id)
                        }}
                      >
                        {loading === pkg.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Purchase
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
