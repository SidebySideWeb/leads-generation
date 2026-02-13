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
import { Search, Building2, MapPin, Info, Sparkles, Globe, Mail, Phone, Loader2 } from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Industry, ResponseMeta, Business } from "@/lib/types"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { usePermissions } from "@/contexts/PermissionsContext"
import { canPerformAction } from "@/lib/permissions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Prefecture {
  id: string
  descr: string
  descr_en: string
  gemi_id: string
}

interface Municipality {
  id: string
  descr: string
  descr_en: string
  gemi_id: string
  prefecture_id: string
}

export default function DiscoverPage() {
  const [selectedPrefecture, setSelectedPrefecture] = useState("")
  const [selectedMunicipality, setSelectedMunicipality] = useState("")
  const [selectedIndustry, setSelectedIndustry] = useState("")
  const [prefectures, setPrefectures] = useState<Prefecture[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [discoveryRunId, setDiscoveryRunId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<Business[]>([])
  const [searchMeta, setSearchMeta] = useState<ResponseMeta & { total_count?: number; total_pages?: number }>({
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [polling, setPolling] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { permissions } = usePermissions()

  // Check if discovery is allowed (for UI display only - backend always enforces)
  const discoveryCheck = canPerformAction(permissions, 'dataset')

  // Load prefectures and industries on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [prefecturesRes, industriesRes] = await Promise.all([
          api.getPrefectures(),
          api.getIndustries(),
        ])

        if (prefecturesRes.data) {
          setPrefectures(prefecturesRes.data)
        }

        if (industriesRes.data) {
          setIndustries(industriesRes.data)
        }
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

  // Load municipalities when prefecture changes
  useEffect(() => {
    if (selectedPrefecture) {
      async function loadMunicipalities() {
        try {
          const res = await api.getMunicipalities(selectedPrefecture)
          if (res.data) {
            setMunicipalities(res.data)
          }
        } catch (error) {
          console.error('Error loading municipalities:', error)
          toast({
            title: "Error",
            description: "Failed to load municipalities",
            variant: "destructive",
          })
        }
      }
      loadMunicipalities()
      // Clear municipality selection when prefecture changes
      setSelectedMunicipality("")
    } else {
      setMunicipalities([])
      setSelectedMunicipality("")
    }
  }, [selectedPrefecture, toast])

  // Poll for discovery results
  const startPolling = (runId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.getDiscoveryRunResults(runId)

        if (res.data?.status === 'completed') {
          clearInterval(interval)
          setPolling(false)

          toast({
            title: "Discovery completed",
            description: `Found ${res.data.businesses_found || 0} businesses. Refreshing search results...`,
          })

          // Refresh search results
          handleSearch()
        } else if (res.data?.status === 'failed') {
          clearInterval(interval)
          setPolling(false)

          toast({
            title: "Discovery failed",
            description: "The discovery process encountered an error.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 5000) // Poll every 5 seconds

    // Store interval ID for cleanup
    return () => clearInterval(interval)
  }

  // Handle Search (local database)
  const handleSearch = async () => {
    if (!selectedMunicipality || !selectedIndustry) {
      toast({
        title: "Selection required",
        description: "Please select municipality and industry",
        variant: "destructive",
      })
      return
    }

    setSearching(true)
    try {
      const res = await api.searchBusinesses({
        municipality_id: selectedMunicipality,
        industry_id: selectedIndustry,
        page: 1,
        limit: 50,
      })

      if (res.data) {
        setSearchResults(res.data)
        setSearchMeta(res.meta)
        toast({
          title: "Search completed",
          description: `Found ${res.meta.total_count || res.data.length} businesses`,
        })
      } else {
        setSearchResults([])
        toast({
          title: "No results",
          description: "No businesses found matching your criteria",
        })
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
          title: "Search failed",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      }
    } finally {
      setSearching(false)
    }
  }

  // Handle Deep Discovery (GEMI API)
  const handleDeepDiscovery = async () => {
    if (!selectedMunicipality || !selectedIndustry) {
      toast({
        title: "Selection required",
        description: "Please select municipality and industry",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Get gemi_id values from selected items
      const selectedMunicipalityObj = municipalities.find(m => m.id === selectedMunicipality)
      const selectedIndustryObj = industries.find(i => i.id === selectedIndustry)
      
      if (!selectedMunicipalityObj || !selectedIndustryObj) {
        throw new Error('Selected municipality or industry not found')
      }
      
      // Use gemi_id values (preferred) for GEMI API discovery
      const municipalityGemiId = selectedMunicipalityObj.gemi_id 
        ? (typeof selectedMunicipalityObj.gemi_id === 'string' 
            ? parseInt(selectedMunicipalityObj.gemi_id, 10) 
            : selectedMunicipalityObj.gemi_id)
        : undefined
      
      const industryGemiId = selectedIndustryObj.gemi_id
        ? (typeof selectedIndustryObj.gemi_id === 'string'
            ? parseInt(selectedIndustryObj.gemi_id, 10)
            : selectedIndustryObj.gemi_id)
        : undefined
      
      const res = await api.startGemiDiscovery({
        municipality_gemi_id: municipalityGemiId,
        industry_gemi_id: industryGemiId,
        // Fallback to internal IDs if gemi_id not available
        municipality_id: municipalityGemiId ? undefined : selectedMunicipality,
        industry_id: industryGemiId ? undefined : selectedIndustry,
      })

      if (res.data && res.data.length > 0) {
        const runId = res.data[0].id
        setDiscoveryRunId(runId)
        setPolling(true)
        startPolling(runId)

        toast({
          title: "Discovery started",
          description: "Fetching businesses from GEMI Registry. This may take a few minutes.",
          duration: 10000,
        })
      } else {
        throw new Error('No discovery run ID returned')
      }
    } catch (error: any) {
      // Handle rate limit - check both response status and meta gate_reason
      const isRateLimit = 
        error.response?.status === 429 || 
        error.message?.includes('rate limit') || 
        error.message?.includes('GEMI') ||
        error.message?.includes('processing') ||
        (error.meta?.gate_reason?.includes('GEMI') || error.meta?.gate_reason?.includes('processing'))
      
      if (isRateLimit) {
        toast({
          title: "Rate limit reached",
          description: error.message || "GEMI Registry is processing requests. Please wait...",
          variant: "destructive",
          duration: 10000,
        })
      } else if (error instanceof NetworkError) {
        toast({
          title: "Network error",
          description: error.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Discovery failed",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Discover Leads</h1>
        <p className="text-sm text-muted-foreground">
          Find new business contacts by selecting region, town, and industry
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
          {/* Region (Prefecture) Selection */}
          <div className="space-y-2">
            <Label htmlFor="prefecture" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Region (Prefecture)
            </Label>
            {loadingData ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <Select value={selectedPrefecture} onValueChange={setSelectedPrefecture}>
                <SelectTrigger id="prefecture" className="h-11">
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {prefectures.map((pref) => (
                    <SelectItem key={pref.id} value={pref.id}>
                      {pref.descr_en || pref.descr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Town (Municipality) Selection - Disabled until region selected */}
          <div className="space-y-2">
            <Label htmlFor="municipality" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Town (Municipality)
            </Label>
            {loadingData ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <Select
                value={selectedMunicipality}
                onValueChange={setSelectedMunicipality}
                disabled={!selectedPrefecture}
              >
                <SelectTrigger id="municipality" className="h-11">
                  <SelectValue
                    placeholder={
                      selectedPrefecture
                        ? "Select a town"
                        : "Select a region first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {municipalities.map((mun) => (
                    <SelectItem key={mun.id} value={mun.id}>
                      {mun.descr_en || mun.descr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!selectedPrefecture && (
              <p className="text-xs text-muted-foreground">
                Please select a region first to enable town selection
              </p>
            )}
          </div>

          {/* Industry Selection */}
          <div className="space-y-2">
            <Label htmlFor="industry" className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Industry
            </Label>
            {loadingData ? (
              <Skeleton className="h-11 w-full" />
            ) : (
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
            )}
          </div>

          {/* Info Box */}
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-foreground">GEMI Registry Integration</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Search uses your local database. Deep Discovery fetches fresh data from the official GEMI Registry.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              className={cn(
                "flex-1 h-11",
                !discoveryCheck.allowed && "opacity-50"
              )}
              disabled={!selectedMunicipality || !selectedIndustry || searching || loading}
              onClick={handleSearch}
            >
              <Search className="mr-2 w-4 h-4" />
              {searching ? "Searching..." : "Search Local Database"}
            </Button>

            <Button
              className={cn(
                "flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground",
                !discoveryCheck.allowed && "opacity-50"
              )}
              disabled={!selectedMunicipality || !selectedIndustry || loading || polling}
              onClick={handleDeepDiscovery}
            >
              {polling ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Fetching from GEMI...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 w-4 h-4" />
                  Deep Discovery (GEMI)
                </>
              )}
            </Button>
          </div>

          {/* Polling Status */}
          {polling && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Fetching businesses from GEMI Registry. This may take a few minutes due to rate limits (8 requests/minute).
              </AlertDescription>
            </Alert>
          )}

          <Alert className="bg-success/5 border-success/20">
            <Info className="h-4 w-4 text-success" />
            <AlertDescription className="text-sm text-muted-foreground">
              Search is free. Deep Discovery fetches fresh data from GEMI Registry. You only pay when you export data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Search Results Table */}
      {searchResults.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Search Results</CardTitle>
            <CardDescription>
              {searchMeta.total_count || searchResults.length} businesses found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>AR GEMI</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contact Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((business) => (
                  <TableRow key={business.id}>
                    <TableCell className="font-medium">{business.name}</TableCell>
                    <TableCell>
                      {(business as any).ar_gemi || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {business.address || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {business.email && (
                          <div title="Has email">
                            <Mail className="w-4 h-4 text-green-500" />
                          </div>
                        )}
                        {business.phone && (
                          <div title="Has phone">
                            <Phone className="w-4 h-4 text-green-500" />
                          </div>
                        )}
                        {business.website && (
                          <div title="Has website">
                            <Globe className="w-4 h-4 text-blue-500" />
                          </div>
                        )}
                        {!business.email && !business.phone && (
                          <span className="text-xs text-muted-foreground">No contacts</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {searchMeta.total_count && searchMeta.total_count > searchResults.length && (
              <div className="mt-4 text-sm text-muted-foreground text-center">
                Showing {searchResults.length} of {searchMeta.total_count} businesses
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tips Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-card-foreground">Tips for better results</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Use "Search" to quickly find businesses already in your database
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Use "Deep Discovery" to fetch fresh data from the official GEMI Registry
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Deep Discovery may take a few minutes due to API rate limits
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
