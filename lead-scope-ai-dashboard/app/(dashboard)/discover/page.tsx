"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Search, Building2, MapPin, Info, CreditCard, Sparkles } from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Industry, City, ResponseMeta } from "@/lib/types"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { usePermissions } from "@/contexts/PermissionsContext"
import { canPerformAction } from "@/lib/permissions"

export default function DiscoverPage() {
  const [selectedIndustry, setSelectedIndustry] = useState("")
  const [selectedCity, setSelectedCity] = useState("")
  const [citySearch, setCitySearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [industries, setIndustries] = useState<Industry[]>([])
  const [industriesMeta, setIndustriesMeta] = useState<ResponseMeta>({
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [cities, setCities] = useState<City[]>([])
  const [citiesMeta, setCitiesMeta] = useState<ResponseMeta>({
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [loadingData, setLoadingData] = useState(true)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const { permissions } = usePermissions()
  
  // Check if discovery is allowed (for UI display only - backend always enforces)
  const discoveryCheck = canPerformAction(permissions, 'dataset')
  // Note: We don't block the action, just show visual state

  // Load industries and cities
  useEffect(() => {
    async function loadData() {
      try {
        const [industriesRes, citiesRes] = await Promise.all([
          api.getIndustries(),
          api.getCities("GR")
        ])

        if (industriesRes.data) {
          setIndustries(industriesRes.data)
        }
        setIndustriesMeta(industriesRes.meta)

        if (citiesRes.data) {
          setCities(citiesRes.data)
        }
        setCitiesMeta(citiesRes.meta)
      } catch (error) {
        if (error instanceof NetworkError) {
          setNetworkError(error.message)
        } else {
          setNetworkError('Failed to load data')
        }
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [])

  const filteredCities = cities.filter((city) =>
    city.name.toLowerCase().includes(citySearch.toLowerCase())
  )

  const handleDiscover = async () => {
    if (!selectedIndustry || !selectedCity) {
      toast({
        title: "Selection required",
        description: "Please select both industry and city",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const response = await api.discoverBusinesses({
        industryId: Number.parseInt(selectedIndustry, 10),
        cityId: Number.parseInt(selectedCity, 10),
      })

      if (!response.data) {
        toast({
          title: "Discovery failed",
          description: response.meta.gate_reason || "Failed to start discovery",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Discovery started",
        description: `Found ${response.data.length} businesses`,
      })
      router.push(`/datasets`)
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Discover Leads</h1>
        <p className="text-sm text-muted-foreground">
          Find new business contacts by selecting your target industry and city
        </p>
      </div>

      {networkError && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{networkError}</p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Search className="w-5 h-5 text-primary" />
            Discovery Parameters
          </CardTitle>
          <CardDescription>
            Configure your search criteria to find relevant business contacts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Industry Selection */}
          <div className="space-y-2">
            <Label htmlFor="industry" className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Industry
            </Label>
            {loadingData ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <>
                {industriesMeta.gated && <GateBanner meta={industriesMeta} />}
                <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                  <SelectTrigger id="industry" className="h-11">
                    <SelectValue placeholder="Select an industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry.id} value={String(industry.id)}>
                        {industry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {industriesMeta.total_available > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Showing {industriesMeta.total_returned} of {industriesMeta.total_available} industries
                  </p>
                )}
              </>
            )}
          </div>

          {/* City Selection with Autocomplete */}
          <div className="space-y-2">
            <Label htmlFor="city" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              City
            </Label>
            {loadingData ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <>
                {citiesMeta.gated && <GateBanner meta={citiesMeta} />}
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger id="city" className="h-11">
                    <SelectValue placeholder="Select a city" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input
                        placeholder="Search cities..."
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    {filteredCities.map((city) => (
                      <SelectItem key={city.id} value={String(city.id)}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {citiesMeta.total_available > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Showing {citiesMeta.total_returned} of {citiesMeta.total_available} cities
                  </p>
                )}
              </>
            )}
          </div>

          {/* Country (Disabled) */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Country</Label>
            <Input
              value="Greece"
              disabled
              className="h-11 bg-muted/50 text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Currently available for Greece only. More countries coming soon.
            </p>
          </div>

          {/* Info Box */}
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-foreground">Discovery creates a static dataset</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Your discovery results will be saved as a snapshot. For monthly updates and change 
              detection, you will need to upgrade to a subscription plan.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              className={cn(
                "flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground",
                !discoveryCheck.allowed && "opacity-50"
              )}
              disabled={!selectedIndustry || !selectedCity || loading}
              onClick={handleDiscover}
              // Never block action - only visual state
              // Backend will enforce limits
            >
              <Sparkles className="mr-2 w-4 h-4" />
              {loading ? "Starting Discovery..." : "Run Discovery"}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            <CreditCard className="inline w-3 h-3 mr-1" />
            Payment confirmation required before discovery starts
          </p>
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-card-foreground">Tips for better results</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Start with a specific industry to get more accurate results
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Larger cities typically have more businesses but also more competition
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Consider upgrading to Professional for monthly refresh and change detection
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
