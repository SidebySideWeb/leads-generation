"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MapPin, Building2, Users, Search, ArrowRight } from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import type { City, ResponseMeta } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"

export default function CitiesPage() {
  const [cities, setCities] = useState<City[]>([])
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
    async function loadCities() {
      try {
        const response = await api.getCities("GR")
        if (response.data) {
          setCities(response.data)
        }
        setMeta(response.meta)
      } catch (error) {
        if (error instanceof NetworkError) {
          setNetworkError(error.message)
        } else {
          setNetworkError('Failed to load cities')
        }
      } finally {
        setLoading(false)
      }
    }

    loadCities()
  }, [])

  const filteredCities = cities.filter((city) =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cities</h1>
          <p className="text-sm text-muted-foreground">
            Browse available cities and their coverage
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/discover">
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {loading ? <Skeleton className="h-8 w-16" /> : cities.length}
                </p>
                <p className="text-sm text-muted-foreground">Cities Available</p>
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
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">
                  {loading ? <Skeleton className="h-8 w-16" /> : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search cities..." 
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

      {/* Cities Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filteredCities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No cities found</p>
          {meta.gated && meta.total_available > 0 && (
            <p className="text-xs mt-2">
              {meta.total_available - meta.total_returned} more cities available with upgrade
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCities.map((city) => (
            <Card key={city.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-card-foreground">{city.name}</CardTitle>
                </div>
                <CardDescription>{city.country || "Greece"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-muted-foreground">Latitude</p>
                    <p className="font-medium text-foreground">
                      {city.latitude != null ? Number(city.latitude).toFixed(4) : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Longitude</p>
                    <p className="font-medium text-foreground">
                      {city.longitude != null ? Number(city.longitude).toFixed(4) : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
