"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ArrowLeft, Download, Filter, Info, ExternalLink, RefreshCw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, NetworkError } from "@/lib/api"
import type { Dataset, Business } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"
import { ExportButton } from "@/components/dashboard/export-button"
import { CrawlStatus } from "@/components/dashboard/crawl-status"

const statusConfig = {
  active: {
    label: "Active",
    className: "bg-success/10 text-success border-success/20",
  },
  removed: {
    label: "Removed",
    className: "bg-muted text-muted-foreground border-border",
  },
} as const

export default function DatasetDetailPage() {
  const params = useParams()
  const datasetId = params.id as string
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [contactTypeFilter, setContactTypeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [datasetMeta, setDatasetMeta] = useState({
    plan_id: 'demo' as const,
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [businessesMeta, setBusinessesMeta] = useState({
    plan_id: 'demo' as const,
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [loading, setLoading] = useState(true)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    async function loadData() {
      try {
        const [datasetRes, businessesRes] = await Promise.all([
          api.getDataset(datasetId),
          api.getBusinesses(datasetId, { limit: 100 })
        ])

        if (datasetRes.data) {
          setDataset(datasetRes.data)
        }
        setDatasetMeta(datasetRes.meta)

        if (businessesRes.data) {
          setBusinesses(businessesRes.data)
        }
        setBusinessesMeta(businessesRes.meta)
      } catch (error) {
        if (error instanceof NetworkError) {
          setNetworkError(error.message)
        } else {
          setNetworkError('Failed to load dataset details')
          toast({
            title: "Error",
            description: "Failed to load dataset details",
            variant: "destructive",
          })
        }
      } finally {
        setLoading(false)
      }
    }

    if (datasetId) {
      loadData()
    }
  }, [datasetId, toast])

  const filteredBusinesses = businesses.filter((business) => {
    if (statusFilter !== "all" && business.isActive !== (statusFilter === "active")) return false
    if (searchQuery && !business.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (contactTypeFilter === "email" && !business.email) return false
    if (contactTypeFilter === "phone" && !business.phone) return false
    if (contactTypeFilter === "website" && !business.website) return false
    return true
  })

  const activeFilters = [statusFilter !== "all", contactTypeFilter !== "all", searchQuery].filter(Boolean).length

  const formatDate = (date: string | null) => {
    if (!date) return "Never"
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (networkError || !dataset) {
    return (
      <div className="space-y-6">
        <Alert className="bg-destructive/10 border-destructive/20">
          <AlertDescription>
            {networkError || "Dataset not found"}
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/(dashboard)/datasets">Back to Datasets</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/(dashboard)/datasets"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Datasets
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{dataset.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {dataset.industry} • {dataset.city} • Created {formatDate(dataset.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Info className="w-4 h-4 mr-2" />
                    Refresh Info
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium mb-1">Auto-refreshing monthly</p>
                  <p className="text-xs text-muted-foreground">
                    Last refresh: {dataset.lastRefresh ? formatDate(dataset.lastRefresh) : "Never"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ExportButton datasetId={datasetId} />
          </div>
        </div>
      </div>

      {datasetMeta.gated && <GateBanner meta={datasetMeta} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-card-foreground">
              {dataset.businesses.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total Businesses</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-card-foreground">
              {dataset.contacts.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total Contacts</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-card-foreground flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-success" />
              {dataset.refreshStatus === "refreshing" ? "Active" : "Snapshot"}
            </div>
            <p className="text-xs text-muted-foreground">Refresh Status</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-card-foreground">
              {formatDate(dataset.lastRefresh)}
            </div>
            <p className="text-xs text-muted-foreground">Last Verified</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-card-foreground">
              <Filter className="w-4 h-4" />
              Filters
              {activeFilters > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilters} active
                </Badge>
              )}
            </CardTitle>
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("all")
                  setContactTypeFilter("all")
                  setSearchQuery("")
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search" className="text-xs text-muted-foreground">Search</Label>
              <Input
                id="search"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="removed">Removed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Contact Type</Label>
              <Select value={contactTypeFilter} onValueChange={setContactTypeFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="email">Has Email</SelectItem>
                  <SelectItem value="phone">Has Phone</SelectItem>
                  <SelectItem value="website">Has Website</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Last Verified</Label>
              <Select defaultValue="all">
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any time</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {businessesMeta.gated && <GateBanner meta={businessesMeta} />}

      {/* Crawl Status */}
      <CrawlStatus datasetId={datasetId} />

      {/* Data Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Contacts</CardTitle>
              <CardDescription>
                Showing {filteredBusinesses.length} of {businesses.length} contacts
                {businessesMeta.total_available > 0 && ` (${businessesMeta.total_returned} returned, ${businessesMeta.total_available} available)`}
              </CardDescription>
            </div>
            {businessesMeta.total_available > 0 && <MetaInfo meta={businessesMeta} />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Company</TableHead>
                  <TableHead className="text-muted-foreground">Address</TableHead>
                  <TableHead className="text-muted-foreground">Website</TableHead>
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead className="text-muted-foreground">Phone</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Last Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBusinesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No businesses found
                      {businessesMeta.gated && businessesMeta.total_available > 0 && (
                        <div className="mt-2 text-xs">
                          {businessesMeta.total_available - businessesMeta.total_returned} more available with upgrade
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBusinesses.map((business) => (
                    <TableRow key={business.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">
                        {business.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {business.address || "—"}
                      </TableCell>
                      <TableCell>
                        {business.website ? (
                          <a
                            href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {business.website.replace(/^https?:\/\//, "")}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{business.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{business.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(statusConfig[business.isActive ? "active" : "removed"].className)}
                        >
                          {statusConfig[business.isActive ? "active" : "removed"].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(business.lastVerifiedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
