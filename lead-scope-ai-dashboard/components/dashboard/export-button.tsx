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
}

export function ExportButton({ datasetId, onExportComplete }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { permissions } = usePermissions()
  
  // Check if export is allowed (for UI display only - backend always enforces)
  const exportCheck = canPerformAction(permissions, 'export')
  // Note: We don't block the action, just show visual state

  const handleExport = async (format: 'csv' | 'xlsx') => {
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

    </div>
  )
}
