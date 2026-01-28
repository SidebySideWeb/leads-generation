"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Search,
  ArrowRight,
  Utensils,
  Hotel,
  ShoppingBag,
  Scale,
  Stethoscope,
  Monitor,
  HardHat,
  Home,
  GraduationCap,
  Factory,
  Truck,
  Banknote,
  Megaphone,
} from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import type { Industry, ResponseMeta } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "Restaurants": Utensils,
  "Hotels & Accommodation": Hotel,
  "Retail Stores": ShoppingBag,
  "Legal Services": Scale,
  "Healthcare & Medical": Stethoscope,
  "IT Services": Monitor,
  "Construction": HardHat,
  "Real Estate": Home,
  "Education": GraduationCap,
  "Manufacturing": Factory,
  "Transportation": Truck,
  "Financial Services": Banknote,
  "Marketing & Advertising": Megaphone,
}

export default function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>([])
  const [meta, setMeta] = useState<ResponseMeta>({
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [networkError, setNetworkError] = useState<string | null>(null)

  useEffect(() => {
    async function loadIndustries() {
      try {
        const response = await api.getIndustries()
        if (response.data) {
          setIndustries(response.data)
        }
        setMeta(response.meta)
      } catch (error) {
        if (error instanceof NetworkError) {
          setNetworkError(error.message)
        } else {
          setNetworkError('Failed to load industries')
        }
      } finally {
        setLoading(false)
      }
    }

    loadIndustries()
  }, [])

  const filteredIndustries = industries.filter((industry) =>
    industry.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Industries</h1>
          <p className="text-sm text-muted-foreground">
            Browse available industries for lead discovery
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/(dashboard)/discover">
            Start Discovery
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      </div>

      {networkError && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{networkError}</p>
          </CardContent>
        </Card>
      )}

      {meta.gated && <GateBanner meta={meta} />}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {loading ? <Skeleton className="h-8 w-16" /> : industries.length}
                </p>
                <p className="text-sm text-muted-foreground">Industries Available</p>
                {meta.total_available > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {meta.total_returned} of {meta.total_available} returned
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {loading ? <Skeleton className="h-8 w-16" /> : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Total Businesses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search industries..." 
          className="pl-10 h-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {meta.total_available > 0 && (
        <div className="flex justify-end">
          <MetaInfo meta={meta} />
        </div>
      )}

      {/* All Industries */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">All Industries</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filteredIndustries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No industries found</p>
            {meta.gated && meta.total_available > 0 && (
              <p className="text-xs mt-2">
                {meta.total_available - meta.total_returned} more industries available with upgrade
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIndustries.map((industry) => {
              const Icon = iconMap[industry.name] || Building2
              return (
                <Card key={industry.id} className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-card-foreground">{industry.name}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
