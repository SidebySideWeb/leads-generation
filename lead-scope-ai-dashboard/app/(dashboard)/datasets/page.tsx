import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Database, Plus, MoreHorizontal, Eye, Download, ArrowUpCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { api } from "@/lib/api"
import { NetworkError } from "@/lib/api"
import type { Dataset, ResponseMeta } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"
import { ExportAction } from "@/components/dashboard/export-action"

const statusConfig = {
  snapshot: {
    label: "Snapshot",
    className: "bg-muted text-muted-foreground border-border",
    description: "One-time export, no updates",
  },
  refreshing: {
    label: "Refreshing Monthly",
    className: "bg-success/10 text-success border-success/20",
    description: "Automatically updated",
  },
  outdated: {
    label: "Outdated",
    className: "bg-warning/10 text-warning border-warning/20",
    description: "Needs refresh",
  },
} as const

export default async function DatasetsPage() {
  let datasets: Dataset[] | null = null
  let meta: ResponseMeta = {
    plan_id: 'demo',
    gated: false,
    total_available: 0,
    total_returned: 0,
  }
  let networkError: string | null = null

  try {
    const response = await api.getDatasets()
    if (response.data) {
      datasets = response.data
    }
    meta = response.meta
  } catch (error) {
    if (error instanceof NetworkError) {
      networkError = error.message
    } else {
      networkError = 'Failed to load datasets'
    }
  }

  const outdatedCount = datasets?.filter((d) => d.refreshStatus === "outdated").length || 0

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Datasets</h1>
          <p className="text-sm text-muted-foreground">
            Manage your discovered business contact datasets
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/(dashboard)/discover">
            <Plus className="mr-2 w-4 h-4" />
            New Discovery
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

      {/* Warning Banner */}
      {outdatedCount > 0 && (
        <Alert className="bg-warning/5 border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-foreground">
            <strong>{outdatedCount} dataset{outdatedCount > 1 ? "s" : ""}</strong> have not been 
            refreshed in over 30 days.{" "}
            <Link href="/(dashboard)/billing" className="text-primary hover:underline">
              Upgrade to Professional
            </Link>{" "}
            for automatic monthly refreshes.
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!datasets || datasets.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Database className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground mb-2">No datasets yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              Run your first discovery to create a dataset of verified business contacts.
            </p>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/(dashboard)/discover">
                <Plus className="mr-2 w-4 h-4" />
                Run First Discovery
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-card-foreground">All Datasets</CardTitle>
                <CardDescription>
                  {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} •{" "}
                  {datasets.reduce((acc, d) => acc + d.businesses, 0).toLocaleString()} total businesses
                </CardDescription>
              </div>
              {meta.total_available > 0 && <MetaInfo meta={meta} />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Dataset Name</TableHead>
                    <TableHead className="text-muted-foreground">Industry</TableHead>
                    <TableHead className="text-muted-foreground">City</TableHead>
                    <TableHead className="text-muted-foreground text-right">Businesses</TableHead>
                    <TableHead className="text-muted-foreground text-right">Contacts</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground">Refresh Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow key={dataset.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/(dashboard)/datasets/${dataset.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {dataset.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{dataset.industry}</TableCell>
                      <TableCell className="text-muted-foreground">{dataset.city}</TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {dataset.businesses.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right">
                        {dataset.contacts.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(dataset.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(statusConfig[dataset.refreshStatus].className)}
                        >
                          {statusConfig[dataset.refreshStatus].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/(dashboard)/datasets/${dataset.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <ExportAction datasetId={dataset.id} format="csv" />
                            <ExportAction datasetId={dataset.id} format="xlsx" />
                            <DropdownMenuSeparator />
                            {dataset.refreshStatus === "snapshot" && (
                              <DropdownMenuItem asChild>
                                <Link href="/(dashboard)/billing">
                                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                                  Upgrade to Refresh
                                </Link>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {meta.gated && meta.total_available > meta.total_returned && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Showing {meta.total_returned} of {meta.total_available} datasets. Upgrade to see all.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
