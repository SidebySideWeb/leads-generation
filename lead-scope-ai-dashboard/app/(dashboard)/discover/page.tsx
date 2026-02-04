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
import { Search, Building2, MapPin, Info, CreditCard, Sparkles, Globe, Mail, Phone, Loader2 } from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Industry, City, ResponseMeta, Business } from "@/lib/types"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { usePermissions } from "@/contexts/PermissionsContext"
import { canPerformAction } from "@/lib/permissions"
import { CoverageBadge, calculateCoverageLevel } from "@/components/dashboard/coverage-badge"
import { CompletenessStats } from "@/components/dashboard/completeness-stats"
import { ExportCostEstimator } from "@/components/dashboard/export-cost-estimator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CostEstimates } from "@/lib/types"

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
  const [discoveryRunId, setDiscoveryRunId] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<{
    businesses: Business[]
    totalBusinesses: number
    withWebsite: number
    withEmail: number
    withPhone: number
  } | null>(null)
  const [costEstimates, setCostEstimates] = useState<CostEstimates | null>(null)
  const [polling, setPolling] = useState(false)
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

  // Poll for discovery results with cost estimates
  const pollForResults = async (runId: string) => {
    let attempts = 0
    const maxAttempts = 30 // Poll for up to 5 minutes (10s intervals)
    
    const poll = async () => {
      try {
        // First, try to get discovery run results with cost estimates
        const resultsRes = await api.getDiscoveryRunResults(runId)
        if (resultsRes.data && resultsRes.data.status === 'completed' && resultsRes.data.cost_estimates) {
          // Discovery completed with cost estimates
          const estimates = resultsRes.data.cost_estimates
          setCostEstimates(estimates)
          
          // Get datasets to find the one created by this discovery run
          const datasetsRes = await api.getDatasets()
          if (datasetsRes.data && datasetsRes.data.length > 0) {
            // Find the most recent dataset (should be the one just created)
            const latestDataset = datasetsRes.data[0]
            
            // Get sample businesses from this dataset
            const businessesRes = await api.getBusinesses(latestDataset.id, { limit: 10 })
            if (businessesRes.data && businessesRes.data.length > 0) {
              const businesses = businessesRes.data
              
              setPreviewData({
                businesses: businesses.slice(0, 10), // Sample of 10
                totalBusinesses: estimates.estimatedBusinesses,
                withWebsite: Math.round((estimates.completenessStats.withWebsitePercent / 100) * estimates.estimatedBusinesses),
                withEmail: Math.round((estimates.completenessStats.withEmailPercent / 100) * estimates.estimatedBusinesses),
                withPhone: Math.round((estimates.completenessStats.withPhonePercent / 100) * estimates.estimatedBusinesses),
              })
            } else {
              // No businesses yet, but we have estimates
              setPreviewData({
                businesses: [],
                totalBusinesses: estimates.estimatedBusinesses,
                withWebsite: Math.round((estimates.completenessStats.withWebsitePercent / 100) * estimates.estimatedBusinesses),
                withEmail: Math.round((estimates.completenessStats.withEmailPercent / 100) * estimates.estimatedBusinesses),
                withPhone: Math.round((estimates.completenessStats.withPhonePercent / 100) * estimates.estimatedBusinesses),
              })
            }
          }
          
          setPolling(false)
          return
        }
        
        // Still running or not completed yet
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000) // Poll every 10 seconds
        } else {
          setPolling(false)
          toast({
            title: "Discovery taking longer than expected",
            description: "Results will be available in your datasets shortly.",
          })
        }
      } catch (error) {
        console.error('[Discover] Error polling for results:', error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000)
        } else {
          setPolling(false)
        }
      }
    }
    
    // Start polling after initial delay
    setTimeout(poll, 5000)
  }

  const handleDiscover = async () => {
    if (!selectedIndustry || !selectedCity) {
      toast({
        title: "Selection required",
        description: "Please select both industry and city",
        variant: "destructive",
      })
      return
    }

    // Validate that we have selected values
    if (!selectedIndustry || !selectedCity) {
      toast({
        title: "Invalid selection",
        description: "Please select valid industry and city",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      // Both industries and cities use UUIDs (strings)
      console.log('[Discover] Sending discovery request:', { industryId: selectedIndustry, cityId: selectedCity })
      const response = await api.discoverBusinesses({
        industryId: selectedIndustry, // UUID string
        cityId: selectedCity, // UUID string
      })

      // Check for errors first
      console.log('[Discover] ===== PROCESSING DISCOVERY RESPONSE =====');
      console.log('[Discover] Full response object:', JSON.stringify(response, null, 2));
      console.log('[Discover] response.data:', response.data);
      console.log('[Discover] response.data type:', typeof response.data);
      console.log('[Discover] response.data is array?', Array.isArray(response.data));
      console.log('[Discover] response.data length:', Array.isArray(response.data) ? response.data.length : 'N/A');
      console.log('[Discover] response.meta:', response.meta);
      
      if (!response.data) {
        const errorMessage = response.meta.gate_reason || response.meta.message || "Failed to start discovery"
        console.error('[Discover] Discovery failed - no data:', errorMessage, response.meta)
        toast({
          title: "Discovery failed",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      // Discovery is running asynchronously - response.data contains discovery run info
      const discoveryRun = Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : null
      console.log('[Discover] Extracted discoveryRun:', discoveryRun);
      console.log('[Discover] discoveryRun has id?', discoveryRun && typeof discoveryRun === 'object' && 'id' in discoveryRun);
      
      if (discoveryRun && typeof discoveryRun === 'object' && 'id' in discoveryRun) {
        console.log('[Discover] Setting discoveryRunId and starting polling:', (discoveryRun as any).id);
        setDiscoveryRunId((discoveryRun as any).id)
        // Start polling for results
        setPolling(true)
        pollForResults((discoveryRun as any).id)
      } else {
        console.warn('[Discover] discoveryRun is invalid:', discoveryRun);
      }
      
      toast({
        title: "Discovery started",
        description: response.meta.message || "Finding businesses based on your criteria. This may take a few moments.",
      })
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
            <AlertTitle className="text-foreground">Grid-Based Discovery</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="underline cursor-help">
                      Η ανακάλυψη γίνεται με πολλαπλά σημεία κάλυψης της πόλης για μέγιστο αποτέλεσμα.
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">
                      Χρησιμοποιούμε grid-based discovery με overlapping points για να εξασφαλίσουμε 
                      καλή κάλυψη. Δεν πρόκειται για επίσημο μητρώο - η κάλυψη διαφέρει ανά πόλη και κλάδο.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

          <Alert className="bg-success/5 border-success/20">
            <Info className="h-4 w-4 text-success" />
            <AlertDescription className="text-sm text-muted-foreground">
              Η ανακάλυψη είναι δωρεάν. Πληρώνετε μόνο όταν επιλέξετε να εξάγετε δεδομένα.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Preview State */}
      {(discoveryRunId || previewData || costEstimates) && (
        <>
          {/* Loading State */}
          {polling && !previewData && !costEstimates && (
            <Card className="bg-card border-border">
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-3 text-sm text-muted-foreground">
                  Αναζήτηση επιχειρήσεων με grid-based discovery...
                </span>
              </CardContent>
            </Card>
          )}

          {/* Results Preview */}
          {(previewData || costEstimates) && (
            <>
              {/* Preview Section */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Προεπισκόπηση Αποτελεσμάτων</CardTitle>
                  <CardDescription>
                    {costEstimates 
                      ? `~${costEstimates.estimatedBusinesses.toLocaleString()} επιχειρήσεις βρέθηκαν`
                      : "Αναζήτηση επιχειρήσεων..."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Estimated Businesses & Coverage */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-3xl font-bold text-foreground">
                        {costEstimates ? `~${costEstimates.estimatedBusinesses.toLocaleString()}` : previewData?.totalBusinesses.toLocaleString() || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Επιχειρήσεις</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50 flex items-center justify-center">
                      <CoverageBadge 
                        level={costEstimates 
                          ? calculateCoverageLevel(costEstimates.estimatedBusinesses / 100)
                          : previewData 
                            ? calculateCoverageLevel(previewData.totalBusinesses / 100)
                            : "MEDIUM"
                        } 
                        showTooltip={true}
                      />
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Κάλυψη</div>
                      <div className="text-xs text-muted-foreground">
                        Grid-based discovery
                      </div>
                    </div>
                  </div>

                  {/* Sample Businesses */}
                  {previewData && previewData.businesses.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground">Δείγμα Επιχειρήσεων</h4>
                      <div className="space-y-2">
                        {previewData.businesses.slice(0, 10).map((business, idx) => (
                          <div 
                            key={business.id || idx} 
                            className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm text-foreground">{business.name}</div>
                              {business.address && (
                                <div className="text-xs text-muted-foreground mt-1">{business.address}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {business.website && (
                                <Globe className="w-4 h-4 text-muted-foreground" />
                              )}
                              {business.email && (
                                <Mail className="w-4 h-4 text-muted-foreground" />
                              )}
                              {business.phone && (
                                <Phone className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completeness Stats */}
              {costEstimates && (
                <CompletenessStats
                  withWebsitePercent={costEstimates.completenessStats.withWebsitePercent}
                  withEmailPercent={costEstimates.completenessStats.withEmailPercent}
                  withPhonePercent={costEstimates.completenessStats.withPhonePercent}
                  totalBusinesses={costEstimates.estimatedBusinesses}
                />
              )}

              {/* Cost Estimator */}
              {costEstimates && (
                <ExportCostEstimator costEstimates={costEstimates} />
              )}

              {/* CTAs */}
              {(previewData || costEstimates) && (
                <Card className="bg-card border-border">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => router.push('/datasets')}
                      >
                        Αποθήκευση Dataset
                      </Button>
                      <Button 
                        variant="outline"
                        className="flex-1"
                        onClick={() => router.push('/exports')}
                      >
                        Συνέχεια στο Export
                      </Button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Η ανακάλυψη είναι δωρεάν. Πληρώνετε μόνο όταν επιλέξετε να εξάγετε δεδομένα.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
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
