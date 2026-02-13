# Frontend Refactoring Guide: GEMI Integration

This document outlines the changes needed to update the frontend to work with the new GEMI-backed backend architecture.

## Overview

The frontend needs to be updated to:
1. Use three-level filters: **Region (Prefecture) → Town (Municipality) → Industry**
2. Add a "Search" button that queries local database
3. Add a "Deep Discovery (GEMI)" button that triggers GEMI API fetching
4. Update export modal to use row ranges with pricing
5. Handle GEMI rate limits gracefully

---

## Step 1: Add Backend Metadata Endpoints

**First, we need to add these endpoints to the backend** (if they don't exist):

### `GET /api/metadata/prefectures`
Returns all prefectures from the database.

**Response:**
```json
{
  "data": [
    {
      "id": "pref-1",
      "descr": "ΑΤΤΙΚΗΣ",
      "descr_en": "ATTICA",
      "gemi_id": "1"
    }
  ],
  "meta": {
    "total_available": 56,
    "total_returned": 56
  }
}
```

### `GET /api/metadata/municipalities?prefecture_id={id}`
Returns municipalities, optionally filtered by prefecture.

**Response:**
```json
{
  "data": [
    {
      "id": "mun-1",
      "descr": "ΑΘΗΝΑΙΩΝ",
      "descr_en": "ATHENS",
      "gemi_id": "1",
      "prefecture_id": "pref-1"
    }
  ],
  "meta": {
    "total_available": 333,
    "total_returned": 50
  }
}
```

### `GET /api/metadata/industries`
Returns all industries (can reuse existing `/api/industries` if it returns industries with `gemi_id`).

---

## Step 2: Update API Client

The API client (`lib/api.ts`) has been updated with new methods:

✅ `getPrefectures()` - Fetch all prefectures
✅ `getMunicipalities(prefectureId?)` - Fetch municipalities (optionally filtered)
✅ `searchBusinesses(params)` - Search businesses in local database
✅ `startGemiDiscovery(input)` - Start GEMI discovery
✅ `getDiscoveryRunResults(runId)` - Poll discovery status

---

## Step 3: Refactor Discover Page

### Current Structure
- **Filters**: City + Industry
- **Action**: Single "Run Discovery" button

### New Structure
- **Filters**: Region (Prefecture) → Town (Municipality) → Industry
- **Actions**: 
  - "Search" button (queries local DB)
  - "Deep Discovery (GEMI)" button (fetches from GEMI API)

### Implementation

```typescript
// State management
const [selectedPrefecture, setSelectedPrefecture] = useState("")
const [selectedMunicipality, setSelectedMunicipality] = useState("")
const [selectedIndustry, setSelectedIndustry] = useState("")
const [prefectures, setPrefectures] = useState([])
const [municipalities, setMunicipalities] = useState([])
const [industries, setIndustries] = useState([])
const [searchResults, setSearchResults] = useState([])
const [discoveryRunId, setDiscoveryRunId] = useState<string | null>(null)
const [polling, setPolling] = useState(false)

// Load prefectures on mount
useEffect(() => {
  async function loadPrefectures() {
    const res = await api.getPrefectures()
    if (res.data) {
      setPrefectures(res.data)
    }
  }
  loadPrefectures()
}, [])

// Load municipalities when prefecture changes
useEffect(() => {
  if (selectedPrefecture) {
    async function loadMunicipalities() {
      const res = await api.getMunicipalities(selectedPrefecture)
      if (res.data) {
        setMunicipalities(res.data)
      }
      // Clear municipality selection when prefecture changes
      setSelectedMunicipality("")
    }
    loadMunicipalities()
  } else {
    setMunicipalities([])
    setSelectedMunicipality("")
  }
}, [selectedPrefecture])

// Load industries on mount
useEffect(() => {
  async function loadIndustries() {
    const res = await api.getIndustries()
    if (res.data) {
      setIndustries(res.data)
    }
  }
  loadIndustries()
}, [])

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

  setLoading(true)
  try {
    const res = await api.searchBusinesses({
      municipality_id: selectedMunicipality,
      industry_id: selectedIndustry,
      page: 1,
      limit: 50,
    })
    
    if (res.data) {
      setSearchResults(res.data)
      toast({
        title: "Search completed",
        description: `Found ${res.meta.total_count || res.data.length} businesses`,
      })
    }
  } catch (error) {
    toast({
      title: "Search failed",
      description: error.message,
      variant: "destructive",
    })
  } finally {
    setLoading(false)
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
    // First, we need to get city_id from municipality
    // For now, we'll use the municipality_id directly
    // (Backend will map it)
    
    const res = await api.startGemiDiscovery({
      city_id: selectedMunicipality, // Backend will handle mapping
      industry_id: selectedIndustry,
    })

    if (res.data && res.data.length > 0) {
      const runId = res.data[0].id
      setDiscoveryRunId(runId)
      setPolling(true)
      startPolling(runId)
      
      toast({
        title: "Discovery started",
        description: "Fetching businesses from GEMI Registry. This may take a few minutes.",
      })
    }
  } catch (error) {
    // Handle rate limit
    if (error.response?.status === 429) {
      toast({
        title: "Rate limit reached",
        description: "GEMI Registry is processing requests. Please wait...",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Discovery failed",
        description: error.message,
        variant: "destructive",
      })
    }
  } finally {
    setLoading(false)
  }
}

// Polling function
const startPolling = (runId: string) => {
  const interval = setInterval(async () => {
    try {
      const res = await api.getDiscoveryRunResults(runId)
      
      if (res.data?.status === 'completed') {
        clearInterval(interval)
        setPolling(false)
        
        toast({
          title: "Discovery completed",
          description: `Found ${res.data.businesses_found || 0} businesses`,
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
  
  // Cleanup on unmount
  return () => clearInterval(interval)
}
```

### UI Structure

```tsx
<div className="space-y-6">
  {/* Region (Prefecture) Selection */}
  <div className="space-y-2">
    <Label>Region (Prefecture)</Label>
    <Select 
      value={selectedPrefecture} 
      onValueChange={setSelectedPrefecture}
    >
      <SelectTrigger>
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
  </div>

  {/* Town (Municipality) Selection - Disabled until region selected */}
  <div className="space-y-2">
    <Label>Town (Municipality)</Label>
    <Select 
      value={selectedMunicipality} 
      onValueChange={setSelectedMunicipality}
      disabled={!selectedPrefecture}
    >
      <SelectTrigger>
        <SelectValue placeholder={selectedPrefecture ? "Select a town" : "Select a region first"} />
      </SelectTrigger>
      <SelectContent>
        {municipalities.map((mun) => (
          <SelectItem key={mun.id} value={mun.id}>
            {mun.descr_en || mun.descr}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Industry Selection */}
  <div className="space-y-2">
    <Label>Industry</Label>
    <Select 
      value={selectedIndustry} 
      onValueChange={setSelectedIndustry}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select an industry" />
      </SelectTrigger>
      <SelectContent>
        {industries.map((industry) => (
          <SelectItem key={industry.id} value={industry.id}>
            {industry.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Action Buttons */}
  <div className="flex gap-3">
    <Button
      onClick={handleSearch}
      disabled={!selectedMunicipality || !selectedIndustry || loading}
      variant="outline"
    >
      <Search className="mr-2 w-4 h-4" />
      Search Local Database
    </Button>
    
    <Button
      onClick={handleDeepDiscovery}
      disabled={!selectedMunicipality || !selectedIndustry || loading || polling}
      className="bg-primary"
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

  {/* Search Results Table */}
  {searchResults.length > 0 && (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Search Results</h3>
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
              <TableCell>{business.name}</TableCell>
              <TableCell>{business.ar_gemi || '—'}</TableCell>
              <TableCell>{business.address || '—'}</TableCell>
              <TableCell>
                {business.contacts && business.contacts.length > 0 ? (
                  <div className="flex gap-2">
                    {business.contacts.some(c => c.email) && (
                      <Mail className="w-4 h-4 text-green-500" />
                    )}
                    {business.contacts.some(c => c.phone) && (
                      <Phone className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                ) : business.enriching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="text-muted-foreground">No contacts</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )}
</div>
```

---

## Step 4: Update Export Modal

### Current Structure
- Fixed size options (50, 100, 500, 1000, 2000)
- Refresh options

### New Structure
- Row range selector (Start Row / End Row)
- Real-time price calculation: `(end_row - start_row) * 0.01`
- Max 1000 rows

### Implementation

```typescript
const [startRow, setStartRow] = useState(1)
const [endRow, setEndRow] = useState(100)
const [maxRows] = useState(1000)

const price = useMemo(() => {
  const rowCount = endRow - startRow + 1
  if (rowCount > maxRows) return null
  return rowCount * 0.01
}, [startRow, endRow, maxRows])

const handleExport = async () => {
  if (!dataset) return
  
  const rowCount = endRow - startRow + 1
  if (rowCount > maxRows) {
    toast({
      title: "Export limit exceeded",
      description: `Maximum ${maxRows} rows allowed`,
      variant: "destructive",
    })
    return
  }

  setLoading(true)
  try {
    const response = await fetch(`${api.baseUrl}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        municipality_id: selectedMunicipality,
        industry_id: selectedIndustry,
        start_row: startRow,
        end_row: endRow,
      }),
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Export failed')
    }

    // Handle blob response
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `businesses-export-${Date.now()}.xlsx`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export completed",
      description: `Exported ${rowCount} businesses`,
    })
  } catch (error) {
    toast({
      title: "Export failed",
      description: error.message,
      variant: "destructive",
    })
  } finally {
    setLoading(false)
  }
}
```

### UI Structure

```tsx
<div className="space-y-4">
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label>Start Row</Label>
      <Input
        type="number"
        min={1}
        value={startRow}
        onChange={(e) => setStartRow(Number(e.target.value))}
      />
    </div>
    <div className="space-y-2">
      <Label>End Row</Label>
      <Input
        type="number"
        min={startRow}
        max={startRow + maxRows - 1}
        value={endRow}
        onChange={(e) => setEndRow(Number(e.target.value))}
      />
    </div>
  </div>

  <div className="p-4 rounded-lg border bg-muted/50">
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">Row Count:</span>
      <span className="font-medium">{endRow - startRow + 1} rows</span>
    </div>
    <div className="flex justify-between items-center mt-2">
      <span className="text-sm text-muted-foreground">Price:</span>
      <span className="text-lg font-bold text-primary">
        €{price?.toFixed(2) || '—'}
      </span>
    </div>
    {endRow - startRow + 1 > maxRows && (
      <Alert className="mt-2" variant="destructive">
        <AlertDescription>
          Maximum {maxRows} rows allowed
        </AlertDescription>
      </Alert>
    )}
  </div>

  <Button
    onClick={handleExport}
    disabled={!price || loading}
    className="w-full"
  >
    {loading ? (
      <>
        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
        Exporting...
      </>
    ) : (
      <>
        <Download className="mr-2 w-4 h-4" />
        Export & Download (€{price?.toFixed(2)})
      </>
    )}
  </Button>
</div>
```

---

## Step 5: Error Handling

### GEMI Rate Limit Handling

```typescript
// In API client (api.ts)
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T | null; meta: ResponseMeta }> {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    })

    // Handle rate limit
    if (response.status === 429) {
      return {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: true,
          gate_reason: 'GEMI Registry is processing requests. Please wait...',
          total_available: 0,
          total_returned: 0,
        },
      }
    }

    // ... rest of error handling
  } catch (error) {
    // ... error handling
  }
}

// In components
if (response.meta.gate_reason?.includes('GEMI')) {
  toast({
    title: "Rate limit reached",
    description: "GEMI Registry is processing requests. Please wait...",
    variant: "destructive",
    duration: 10000, // Show for 10 seconds
  })
}
```

---

## Summary of Changes

### Files to Update

1. ✅ `lib/api.ts` - Added new API methods
2. ⏳ `app/(dashboard)/discover/page.tsx` - Refactor to three-level filters
3. ⏳ `components/dashboard/export-modal.tsx` - Update to row range selector
4. ⏳ Backend: Add `/api/metadata/prefectures` and `/api/metadata/municipalities` endpoints

### Key Features

- ✅ Cascading dropdowns (Region → Town)
- ✅ Two action buttons (Search vs Deep Discovery)
- ✅ Polling mechanism for GEMI discovery
- ✅ Row range export with pricing
- ✅ Rate limit error handling
- ✅ Loading states and user feedback

---

## Next Steps

1. **Add backend metadata endpoints** (if not exist)
2. **Update discover page** with new filter structure
3. **Update export modal** with row range selector
4. **Test the complete flow**:
   - Search local database
   - Deep discovery with polling
   - Export with pricing
   - Error handling

---

## Notes

- The backend discovery endpoint expects `city_id`, but we're passing `municipality_id`. The backend should handle the mapping (or we need to add a mapping function).
- The polling interval is 5 seconds, but GEMI API has 7.5s rate limit, so discovery may take longer.
- Export pricing is fixed at €0.01 per row, max 1000 rows = €10.00 maximum.
