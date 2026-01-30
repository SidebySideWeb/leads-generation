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
import type { ResponseMeta } from "@/lib/types"
import { usePermissions } from "@/contexts/PermissionsContext"
import { canPerformAction } from "@/lib/permissions"

interface ExportButtonProps {
  datasetId: string
  onExportComplete?: () => void
  discoveryRuns?: Array<{
    id: string;
    status: 'running' | 'completed' | 'failed';
    created_at: string;
    completed_at: string | null;
  }>
}

export function ExportButton({ datasetId, onExportComplete, discoveryRuns = [] }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { permissions } = usePermissions()
  
  // Check if export is allowed (for UI display only - backend always enforces)
  const exportCheck = canPerformAction(permissions, 'export')
  
  // Check if latest discovery run is completed
  // Export is disabled if latest discovery_run.status !== 'completed'
  const latestDiscoveryRun = discoveryRuns.length > 0 ? discoveryRuns[0] : null
  const isDiscoveryCompleted = latestDiscoveryRun?.status === 'completed'
  const isDiscoveryRunning = latestDiscoveryRun?.status === 'running'
  const exportDisabled = loading || !isDiscoveryCompleted || (latestDiscoveryRun && isDiscoveryRunning)
  
  // Note: We don't block the action, just show visual state

  const handleExport = async (format: 'csv' | 'xlsx') => {
    // Prevent export if discovery is not completed
    if (!isDiscoveryCompleted && latestDiscoveryRun) {
      toast({
        title: "Export unavailable",
        description: "Please wait for the discovery run to complete before exporting",
        variant: "default",
      })
      return
    }
    
    setLoading(true)

    try {
      // Use runExport for direct file download from backend
      const response = await api.runExport(datasetId, format)
      
      // Check if response is OK
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        toast({
          title: "Export failed",
          description: errorData.message || errorData.meta?.gate_reason || `HTTP ${response.status}: ${response.statusText}`,
          variant: "destructive",
        })
        setLoading(false)
        return
      }
      
      // Handle file download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${datasetId}-${Date.now()}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Export downloaded",
        description: `Your ${format.toUpperCase()} file has been downloaded`,
      })
      
      if (onExportComplete) {
        onExportComplete()
      }
      
      setLoading(false)
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
            disabled={exportDisabled}
            title={!isDiscoveryCompleted && latestDiscoveryRun ? "Wait for discovery to complete" : undefined}
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
            disabled={exportDisabled}
            className="cursor-pointer"
            title={!isDiscoveryCompleted && latestDiscoveryRun ? "Wait for discovery to complete" : undefined}
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
            disabled={exportDisabled}
            className="cursor-pointer"
            title={!isDiscoveryCompleted && latestDiscoveryRun ? "Wait for discovery to complete" : undefined}
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

    </div>
  )
}
