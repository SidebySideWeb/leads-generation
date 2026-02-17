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
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select"
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
import { DiscoveryCompletionModal } from "@/components/dashboard/discovery-completion-modal"
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
  const [selectedPrefectures, setSelectedPrefectures] = useState<string[]>([])
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([])
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [prefectures, setPrefectures] = useState<Prefecture[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [searching, setSearching] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [discoveryRunId, setDiscoveryRunId] = useState<string | null>(null)
  const [discoveryDatasetId, setDiscoveryDatasetId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<Business[]>([])
  const [searchMeta, setSearchMeta] = useState<ResponseMeta & { total_count?: number; total_pages?: number }>({
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [polling, setPolling] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [discoveryStatus, setDiscoveryStatus] = useState<'completed' | 'failed'>('completed')
  const [completedDiscoveryRun, setCompletedDiscoveryRun] = useState<{
    runId: string
    datasetId: string
    businessesFound: number
  } | null>(null)
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

  // Load municipalities when prefectures change
  useEffect(() => {
    if (selectedPrefectures.length > 0) {
      async function loadMunicipalities() {
        try {
          // Load municipalities for all selected prefectures
          const allMunicipalities: Municipality[] = []
          for (const prefectureId of selectedPrefectures) {
            const res = await api.getMunicipalities(prefectureId)
            if (res.data) {
              allMunicipalities.push(...res.data)
            }
          }
          setMunicipalities(allMunicipalities)
          
          // Remove municipalities that are no longer in selected prefectures
          setSelectedMunicipalities(prev => 
            prev.filter(munId => 
              allMunicipalities.some(m => m.id === munId)
            )
          )
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
    } else {
      setMunicipalities([])
      setSelectedMunicipalities([])
    }
  }, [selectedPrefectures, toast])

  // Poll for discovery results
  const startPolling = (runId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.getDiscoveryRunResults(runId)

        if (res.data?.status === 'completed') {
          clearInterval(interval)
          setPolling(false)

          // Show completion modal with stored dataset_id
          setCompletedDiscoveryRun({
            runId,
            datasetId: discoveryDatasetId || '',
            businessesFound: res.data.businesses_found || 0,
          })
          setShowCompletionModal(true)

          // Refresh search results from local database (don't trigger another discovery)
          if ((selectedPrefectures.length > 0 || selectedMunicipalities.length > 0) && selectedIndustries.length > 0) {
            try {
              const searchRes = await api.searchBusinesses({
                prefecture_ids: selectedPrefectures.length > 0 ? selectedPrefectures : undefined,
                municipality_ids: selectedMunicipalities.length > 0 ? selectedMunicipalities : undefined,
                industry_ids: selectedIndustries,
                page: 1,
                limit: 50,
              })
              if (searchRes.data) {
                setSearchResults(searchRes.data)
                setSearchMeta(searchRes.meta)
              }
            } catch (error) {
              console.error('Error refreshing search results:', error)
            }
          }
        } else if (res.data?.status === 'failed') {
          clearInterval(interval)
          setPolling(false)

          // Show completion modal with failed status
          setCompletedDiscoveryRun({
            runId,
            datasetId: discoveryDatasetId || '',
            businessesFound: 0,
          })
          setShowCompletionModal(true)
          setDiscoveryStatus('failed')
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 5000) // Poll every 5 seconds

    // Store interval ID for cleanup
    return () => clearInterval(interval)
  }

  // Handle Search - First search local database, then GEMI if no results
  const handleSearch = async () => {
    // Require at least prefecture OR municipality, and at least one industry
    if ((selectedPrefectures.length === 0 && selectedMunicipalities.length === 0) || selectedIndustries.length === 0) {
      toast({
        title: "Selection required",
        description: "Please select at least one prefecture or municipality, and at least one industry",
        variant: "destructive",
      })
      return
    }

    setSearching(true)
    try {
      // Step 1: Search local database first
      const res = await api.searchBusinesses({
        prefecture_ids: selectedPrefectures.length > 0 ? selectedPrefectures : undefined,
        municipality_ids: selectedMunicipalities.length > 0 ? selectedMunicipalities : undefined,
        industry_ids: selectedIndustries,
        page: 1,
        limit: 50,
      })

      const totalCount = res.meta.total_count || (res.data?.length || 0)

      if (totalCount > 0) {
        // Found results in local database
        setSearchResults(res.data || [])
        setSearchMeta(res.meta)
        toast({
          title: "Search completed",
          description: `Found ${totalCount} businesses in local database`,
        })
        setSearching(false)
        return
      }

      // Step 2: No local results - trigger GEMI discovery for each combination
      // For now, we'll trigger discovery for the first municipality/prefecture and industry combination
      // In the future, we could trigger multiple discoveries in parallel
      toast({
        title: "No local results",
        description: "Searching GEMI Registry for fresh data...",
        duration: 3000,
      })

      // Use first selected municipality/prefecture and industry for discovery
      // TODO: Support multiple discoveries in parallel
      const municipalityId = selectedMunicipalities.length > 0 
        ? selectedMunicipalities[0] 
        : (selectedPrefectures.length > 0 ? null : null)
      
      const industryId = selectedIndustries[0]
      
      // Get gemi_id values from selected items
      const selectedMunicipalityObj = municipalityId 
        ? municipalities.find(m => m.id === municipalityId)
        : null
      const selectedIndustryObj = industries.find(i => i.id === industryId)
      
      if (!selectedIndustryObj) {
        throw new Error('Selected industry not found')
      }
      
      // Use gemi_id values (preferred) for GEMI API discovery
      const municipalityGemiId = selectedMunicipalityObj?.gemi_id 
        ? (typeof selectedMunicipalityObj.gemi_id === 'string' 
            ? parseInt(selectedMunicipalityObj.gemi_id, 10) 
            : selectedMunicipalityObj.gemi_id)
        : undefined
      
      const industryGemiId = selectedIndustryObj.gemi_id
        ? (typeof selectedIndustryObj.gemi_id === 'string'
            ? parseInt(selectedIndustryObj.gemi_id, 10)
            : selectedIndustryObj.gemi_id)
        : undefined
      
      const discoveryRes = await api.startGemiDiscovery({
        municipality_gemi_id: municipalityGemiId,
        industry_gemi_id: industryGemiId,
        // Fallback to internal IDs if gemi_id not available
        municipality_id: municipalityGemiId ? undefined : municipalityId || undefined,
        industry_id: industryGemiId ? undefined : industryId,
      })

      if (discoveryRes.data && discoveryRes.data.length > 0) {
        const runId = discoveryRes.data[0].id
        const datasetId = discoveryRes.data[0].dataset_id || ''
        setDiscoveryRunId(runId)
        setDiscoveryDatasetId(datasetId)
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
          title: "Search failed",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        })
      }
    } finally {
      setSearching(false)
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
          {/* Region (Prefecture) Selection - Multi-select */}
          <div className="space-y-2">
            <Label htmlFor="prefecture" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Region (Prefecture) <span className="text-xs text-muted-foreground">(Optional)</span>
            </Label>
            {loadingData ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <MultiSelect
                options={prefectures.map(pref => ({
                  label: pref.descr_en || pref.descr,
                  value: pref.id,
                }))}
                selected={selectedPrefectures}
                onChange={setSelectedPrefectures}
                placeholder="Select one or more regions"
                className="h-11"
              />
            )}
          </div>

          {/* Town (Municipality) Selection - Multi-select, Optional */}
          <div className="space-y-2">
            <Label htmlFor="municipality" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Town (Municipality) <span className="text-xs text-muted-foreground">(Optional)</span>
            </Label>
            {loadingData ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <MultiSelect
                options={municipalities.map(mun => ({
                  label: mun.descr_en || mun.descr,
                  value: mun.id,
                }))}
                selected={selectedMunicipalities}
                onChange={setSelectedMunicipalities}
                placeholder={
                  selectedPrefectures.length > 0
                    ? "Select one or more towns (optional)"
                    : "Select regions first, or select towns directly"
                }
                disabled={false}
                className="h-11"
              />
            )}
            <p className="text-xs text-muted-foreground">
              You can search by prefecture only, or select specific municipalities. At least one prefecture or municipality is required.
            </p>
          </div>

          {/* Industry Selection - Multi-select */}
          <div className="space-y-2">
            <Label htmlFor="industry" className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Industry <span className="text-xs text-muted-foreground">(Required)</span>
            </Label>
            {loadingData ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <MultiSelect
                options={industries.map(industry => ({
                  label: industry.name,
                  value: String(industry.id),
                }))}
                selected={selectedIndustries}
                onChange={setSelectedIndustries}
                placeholder="Select one or more industries"
                className="h-11"
              />
            )}
          </div>

          {/* Info Box */}
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-foreground">Smart Search</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Search first checks your local database. If no results are found, it automatically fetches fresh data from the official GEMI Registry.
            </AlertDescription>
          </Alert>

          {/* Action Button */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              className={cn(
                "w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground",
                !discoveryCheck.allowed && "opacity-50"
              )}
              disabled={
                (selectedPrefectures.length === 0 && selectedMunicipalities.length === 0) || 
                selectedIndustries.length === 0 || 
                searching || 
                polling
              }
              onClick={handleSearch}
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : polling ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Fetching from GEMI...
                </>
              ) : (
                <>
                  <Search className="mr-2 w-4 h-4" />
                  Search
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
              Search is free. GEMI discovery fetches fresh data from the official registry. You only pay when you export data.
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
              Search automatically checks your local database first
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              If no local results are found, it fetches fresh data from GEMI Registry
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              GEMI discovery may take a few minutes due to API rate limits
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Discovery Completion Modal */}
      {completedDiscoveryRun && (
        <DiscoveryCompletionModal
          open={showCompletionModal}
          onOpenChange={setShowCompletionModal}
          discoveryRunId={completedDiscoveryRun.runId}
          datasetId={completedDiscoveryRun.datasetId}
          businessesFound={completedDiscoveryRun.businessesFound}
          status={discoveryStatus}
          onSave={() => {
            toast({
              title: "Dataset saved",
              description: "Your discovery has been saved to the dataset.",
            })
          }}
          onExport={() => {
            toast({
              title: "Redirecting to export",
              description: "Preparing export options...",
            })
          }}
          onAbort={() => {
            toast({
              title: "Dataset aborted",
              description: "The discovery dataset has been aborted.",
              variant: "destructive",
            })
          }}
        />
      )}
    </div>
  )
}
