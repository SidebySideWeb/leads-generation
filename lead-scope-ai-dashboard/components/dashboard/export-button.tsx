"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { GateBanner } from "@/components/dashboard/gate-banner"
import type { ResponseMeta } from "@/lib/types"
import { usePermissions } from "@/contexts/PermissionsContext"
import { canPerformAction } from "@/lib/permissions"

interface ExportButtonProps {
  datasetId: string
  onExportComplete?: (exportResult: { id: string; download_url: string | null; total_rows: number; meta: ResponseMeta }) => void
}

export function ExportButton({ datasetId, onExportComplete }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [exportResult, setExportResult] = useState<{
    id: string
    download_url: string | null
    total_rows: number
    meta: ResponseMeta
  } | null>(null)
  const { toast } = useToast()
  const { permissions } = usePermissions()
  
  // Check if export is allowed (for UI display only - backend always enforces)
  const exportCheck = canPerformAction(permissions, 'export')
  // Note: We don't block the action, just show visual state

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setLoading(true)
    setExportResult(null)

    try {
      const response = await api.exportDataset(datasetId, format)

      if (!response.data) {
        toast({
          title: "Export failed",
          description: response.meta.gate_reason || "Failed to create export",
          variant: "destructive",
        })
        setExportResult({
          id: '',
          download_url: null,
          total_rows: 0,
          meta: response.meta,
        })
        return
      }

      setExportResult({
        id: response.data.id,
        download_url: response.data.download_url,
        total_rows: response.data.total_rows,
        meta: {
          ...response.meta,
          // Ensure meta has rows info from data if available
          total_returned: response.data.rows_returned ?? response.meta.total_returned,
          total_available: response.data.rows_total ?? response.meta.total_available,
          gated: response.data.rows_returned !== undefined && response.data.rows_total !== undefined
            ? response.data.rows_returned < response.data.rows_total
            : response.meta.gated,
          upgrade_hint: response.meta.upgrade_hint,
        },
      })

      // Use rows_returned and rows_total from data if available, fallback to meta
      const rowsReturned = response.data.rows_returned ?? response.meta.total_returned;
      const rowsTotal = response.data.rows_total ?? response.meta.total_available;
      
      const message = response.meta.gated
        ? `Showing ${rowsReturned.toLocaleString()} of ${rowsTotal.toLocaleString()} leads (limited). ${response.data.total_rows.toLocaleString()} rows exported.`
        : `Showing ${rowsReturned.toLocaleString()} of ${rowsTotal.toLocaleString()} leads. ${response.data.total_rows.toLocaleString()} rows exported.`

      toast({
        title: "Export created",
        description: message,
      })

      if (onExportComplete) {
        onExportComplete({
          id: response.data.id,
          download_url: response.data.download_url,
          total_rows: response.data.total_rows,
          meta: response.meta,
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
    <div className="space-y-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={loading}
            // Never block action - only visual state
            // Backend will enforce limits
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => handleExport('csv')}
            disabled={loading}
            className="cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Export as CSV
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleExport('xlsx')}
            disabled={loading}
            className="cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as XLSX
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {exportResult && (
        <div className="space-y-2">
          {/* Always show download button if URL is available, even when gated */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-foreground">
                Showing {exportResult.meta.total_returned.toLocaleString()} of {exportResult.meta.total_available.toLocaleString()} leads
                {exportResult.meta.gated && (
                  <span className="ml-2 text-xs text-warning font-medium">(Limited)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {exportResult.total_rows.toLocaleString()} rows exported
              </p>
            </div>
            {exportResult.download_url && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="ml-4"
              >
                <a href={exportResult.download_url} download target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </a>
              </Button>
            )}
          </div>

          {/* Show warning banner and upgrade CTA when gated - never blocks download */}
          {exportResult.meta.gated && (
            <>
              <Alert className="bg-warning/10 border-warning/30">
                <AlertTitle className="text-foreground font-semibold flex items-center gap-2">
                  <span>⚠️ Limited Export</span>
                </AlertTitle>
                <AlertDescription className="text-muted-foreground space-y-2 mt-2">
                  <p>
                    {exportResult.meta.gate_reason || 
                     `This export contains ${exportResult.meta.total_returned.toLocaleString()} of ${exportResult.meta.total_available.toLocaleString()} available rows.`}
                  </p>
                  {exportResult.meta.upgrade_hint && (
                    <p className="font-medium text-foreground">{exportResult.meta.upgrade_hint}</p>
                  )}
                </AlertDescription>
              </Alert>
              <GateBanner meta={exportResult.meta} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
