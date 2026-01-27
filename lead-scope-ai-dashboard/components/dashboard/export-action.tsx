"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/contexts/PermissionsContext"
import { canPerformAction } from "@/lib/permissions"

interface ExportActionProps {
  datasetId: string
  format: 'csv' | 'xlsx'
  onComplete?: () => void
}

export function ExportAction({ datasetId, format, onComplete }: ExportActionProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { permissions } = usePermissions()
  
  // Check if export is allowed (for UI display only - backend always enforces)
  const exportCheck = canPerformAction(permissions, 'export')
  // Note: We don't block the action, just show visual state

  const handleExport = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    setLoading(true)

    try {
      const response = await api.exportDataset(datasetId, format)

      if (!response.data) {
        toast({
          title: "Export failed",
          description: response.meta.gate_reason || "Failed to create export",
          variant: response.meta.gated ? "default" : "destructive",
        })
        return
      }

      // Use rows_returned and rows_total from data if available, fallback to meta
      const rowsReturned = response.data.rows_returned ?? response.meta.total_returned;
      const rowsTotal = response.data.rows_total ?? response.meta.total_available;
      
      const message = response.meta.gated
        ? `Showing ${rowsReturned.toLocaleString()} of ${rowsTotal.toLocaleString()} leads (limited). ${response.data.total_rows.toLocaleString()} rows exported.`
        : `Showing ${rowsReturned.toLocaleString()} of ${rowsTotal.toLocaleString()} leads. ${response.data.total_rows.toLocaleString()} rows exported.`

      toast({
        title: "Export created",
        description: message,
        variant: response.meta.gated ? "default" : "default",
      })

      // Always allow download, even when gated
      if (response.data.download_url) {
        // Auto-download if URL is available (never blocked)
        window.open(response.data.download_url, '_blank')
      }
      
      // Show banner if gated
      if (response.meta.gated && response.meta.upgrade_hint) {
        toast({
          title: "Limited Export",
          description: response.meta.upgrade_hint,
          variant: "default",
          duration: 5000,
        })
      }

      // Navigate to exports page to see the result
      router.push('/(dashboard)/exports')

      if (onComplete) {
        onComplete()
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

  const Icon = format === 'csv' ? FileText : FileSpreadsheet
  const label = format === 'csv' ? 'Export as CSV' : 'Export as XLSX'

  return (
    <DropdownMenuItem 
      onClick={handleExport}
      disabled={loading}
      // Never block action - only visual state
      // Backend will enforce limits
      className={exportCheck.allowed ? "cursor-pointer" : "cursor-pointer opacity-50"}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Icon className="w-4 h-4 mr-2" />
          {label}
        </>
      )}
    </DropdownMenuItem>
  )
}
