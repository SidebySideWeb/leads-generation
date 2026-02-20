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

interface IndustryGroup {
  id: string
  name: string
  created_at: string
}

export default function DiscoverPage() {
  const [selectedPrefectures, setSelectedPrefectures] = useState<string[]>([])
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([])
  const [selectedIndustryGroups, setSelectedIndustryGroups] = useState<string[]>([])
  const [prefectures, setPrefectures] = useState<Prefecture[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [industryGroups, setIndustryGroups] = useState<IndustryGroup[]>([])
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

  // Load prefectures and industry groups on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [prefecturesRes, industryGroupsRes] = await Promise.all([
          api.getPrefectures(),
          api.getIndustryGroups(),
        ])

        if (prefecturesRes.data) {
          setPrefectures(prefecturesRes.data)
        }

        if (industryGroupsRes.data) {
          setIndustryGroups(industryGroupsRes.data)
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
          
          // Automatically select all municipalities from selected prefectures
          const municipalityIds = allMunicipalities.map(m => m.id)
          setSelectedMunicipalities(municipalityIds)
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
          // Note: For industry groups, we need to fetch industries in the groups first
          // For now, skip the refresh after discovery completion when using industry groups
          // TODO: Implement fetching industries from groups for search
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

  // Handle Search - First search local database, then discovery if no results
  const handleSearch = async () => {
    // Require at least prefecture OR municipality, and at least one industry group
    if ((selectedPrefectures.length === 0 && selectedMunicipalities.length === 0) || selectedIndustryGroups.length === 0) {
      toast({
        title: "Selection required",
        description: "Please select at least one prefecture or municipality, and at least one industry group",
        variant: "destructive",
      })
      return
    }

    setSearching(true)
    try {
      // Step 1: Search local database first
      // For industry groups, we need to fetch all industries in the selected groups
      // For now, skip local search when using industry groups and go straight to discovery
      // TODO: Implement fetching industries from groups for local search
      let res: { data: Business[] | null; meta: ResponseMeta & { total_count?: number } } = {
        data: [],
        meta: { total_count: 0, plan_id: 'demo', gated: false, total_available: 0, total_returned: 0 }
      }
      
      // If we have industry groups, skip local search for now
      // In the future, we can fetch industries from groups and search with those
      if (selectedIndustryGroups.length === 0) {
        res = await api.searchBusinesses({
          prefecture_ids: selectedPrefectures.length > 0 ? selectedPrefectures : undefined,
          municipality_ids: selectedMunicipalities.length > 0 ? selectedMunicipalities : undefined,
          industry_ids: [], // Will be empty when using groups
          page: 1,
          limit: 50,
        })
      }

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

      // Step 2: No local results - trigger discovery for each combination
      // For now, we'll trigger discovery for the first municipality/prefecture and industry combination
      // In the future, we could trigger multiple discoveries in parallel
      toast({
        title: "No local results",
        description: "Searching for fresh data...",
        duration: 3000,
      })

      // Use first selected municipality/prefecture and industry group for discovery
      // TODO: Support multiple discoveries in parallel
      const industryGroupId = selectedIndustryGroups[0]
      
      if (!industryGroupId) {
        throw new Error('Selected industry group not found')
      }
      
      // Support both municipality-level and prefecture-level discovery
      let municipalityId: string | null = null
      let selectedMunicipalityObj: Municipality | null = null
      let prefectureId: string | null = null
      let selectedPrefectureObj: Prefecture | null = null
      
      if (selectedMunicipalities.length > 0) {
        // Use the first selected municipality (preferred - more specific)
        municipalityId = selectedMunicipalities[0]
        selectedMunicipalityObj = municipalities.find(m => m.id === municipalityId) || null
      } else if (selectedPrefectures.length > 0) {
        // If only prefectures selected, use prefecture-level discovery
        prefectureId = selectedPrefectures[0]
        selectedPrefectureObj = prefectures.find(p => p.id === prefectureId) || null
      }
      
      // Validate that we have either a municipality or prefecture
      if (!municipalityId && !prefectureId) {
        throw new Error('Please select at least one prefecture or municipality.')
      }
      
      // Get gemi_id values
      const municipalityGemiId = selectedMunicipalityObj?.gemi_id 
        ? (typeof selectedMunicipalityObj.gemi_id === 'string' 
            ? parseInt(selectedMunicipalityObj.gemi_id, 10) 
            : selectedMunicipalityObj.gemi_id)
        : undefined
      
      const prefectureGemiId = selectedPrefectureObj?.gemi_id
        ? (typeof selectedPrefectureObj.gemi_id === 'string'
            ? parseInt(selectedPrefectureObj.gemi_id, 10)
            : selectedPrefectureObj.gemi_id)
        : undefined
      
      const discoveryRes = await api.startGemiDiscovery({
        // Use municipality if available, otherwise use prefecture
        municipality_gemi_id: municipalityGemiId,
        municipality_id: municipalityGemiId ? undefined : municipalityId || undefined,
        prefecture_gemi_id: prefectureGemiId,
        prefecture_id: prefectureGemiId ? undefined : prefectureId || undefined,
        // Use industry_group_id instead of industry_id
        industry_group_id: industryGroupId,
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
          description: "Fetching businesses from the registry. This may take a few minutes.",
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
        error.message?.includes('processing') ||
        (error.meta?.gate_reason?.includes('processing'))
      
      if (isRateLimit) {
        toast({
          title: "Rate limit reached",
          description: error.message || "The registry is processing requests. Please wait...",
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

          {/* Town (Municipality) Selection - Multi-select, Auto-selected from prefectures */}
          <div className="space-y-2">
            <Label htmlFor="municipality" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Town (Municipality) <span className="text-xs text-muted-foreground">(Auto-selected from prefectures)</span>
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
                    ? "All municipalities from selected prefectures (you can deselect specific ones)"
                    : "Select regions first to see municipalities"
                }
                disabled={selectedPrefectures.length === 0}
                className="h-11"
              />
            )}
            <p className="text-xs text-muted-foreground">
              When you select a prefecture, all municipalities in that prefecture are automatically selected. You can deselect specific municipalities if needed.
            </p>
          </div>

          {/* Industry Group Selection - Multi-select */}
          <div className="space-y-2">
            <Label htmlFor="industry-group" className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Industry Group <span className="text-xs text-muted-foreground">(Required)</span>
            </Label>
            {loadingData ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <MultiSelect
                options={industryGroups.map(group => ({
                  label: group.name,
                  value: group.id,
                }))}
                selected={selectedIndustryGroups}
                onChange={setSelectedIndustryGroups}
                placeholder="Select one or more industry groups"
                className="h-11"
              />
            )}
          </div>

          {/* Info Box */}
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-foreground">Smart Search</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Search first checks your local database. If no results are found, it automatically fetches fresh data from the official registry.
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
                selectedIndustryGroups.length === 0 || 
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
                  Fetching from registry...
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
                Fetching businesses from the registry. This may take a few minutes due to rate limits (8 requests/minute).
              </AlertDescription>
            </Alert>
          )}

          <Alert className="bg-success/5 border-success/20">
            <Info className="h-4 w-4 text-success" />
            <AlertDescription className="text-sm text-muted-foreground">
              Search is free. Discovery fetches fresh data from the official registry. You only pay when you export data.
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
              If no local results are found, it fetches fresh data from the official registry
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              Discovery may take a few minutes due to API rate limits
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
