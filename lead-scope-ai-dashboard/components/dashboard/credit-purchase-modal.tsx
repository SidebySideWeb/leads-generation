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
import { useState } from "react"
import { cn } from "@/lib/utils"

interface CreditPurchaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CREDIT_PACKAGES = [
  {
    id: 'bronze',
    credits: 50,
    price: '€50',
    popular: false,
    bonus: '0%',
    name: 'Bronze',
  },
  {
    id: 'silver',
    credits: 120,
    price: '€100',
    popular: true,
    bonus: '20%',
    name: 'Silver',
    savings: '20% bonus',
  },
  {
    id: 'gold',
    credits: 260,
    price: '€200',
    popular: false,
    bonus: '30%',
    name: 'Gold',
    savings: '30% bonus',
  },
  // Legacy numeric keys for backward compatibility
  {
    id: '50',
    credits: 50,
    price: '€50',
    popular: false,
    bonus: '0%',
    name: 'Bronze',
  },
  {
    id: '120',
    credits: 120,
    price: '€100',
    popular: true,
    bonus: '20%',
    name: 'Silver',
    savings: '20% bonus',
  },
  {
    id: '260',
    credits: 260,
    price: '€200',
    popular: false,
    bonus: '30%',
    name: 'Gold',
    savings: '30% bonus',
  },
]

export function CreditPurchaseModal({ open, onOpenChange }: CreditPurchaseModalProps) {
  const { data, refetch } = useBilling()
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)

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

        <div className="grid gap-4 md:grid-cols-3 py-4">
          {CREDIT_PACKAGES.map((pkg) => (
            <Card
              key={pkg.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary",
                pkg.popular && "border-primary border-2"
              )}
              onClick={() => handlePurchase(pkg.id)}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  Best Value
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{pkg.name || `${pkg.credits.toLocaleString()} Credits`}</CardTitle>
                <CardDescription>{pkg.credits.toLocaleString()} Credits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">{pkg.price}</div>
                  {pkg.savings && (
                    <div className="text-xs text-primary font-medium">{pkg.savings}</div>
                  )}
                  {pkg.bonus && pkg.bonus !== '0%' && (
                    <div className="text-xs text-muted-foreground">Get {pkg.bonus} extra credits</div>
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
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
