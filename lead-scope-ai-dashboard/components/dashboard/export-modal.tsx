"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Info, Download, Euro, AlertCircle } from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Dataset } from "@/lib/types"

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataset: Dataset | null
  onComplete?: () => void
  // Optional filters for export
  municipalityId?: string
  industryId?: string
  prefectureId?: string
}

// Export pricing: €0.01 per row
const EXPORT_PRICE_PER_ROW = 0.01
const MAX_EXPORT_ROWS = 1000

export function ExportModal({ 
  open, 
  onOpenChange, 
  dataset, 
  onComplete,
  municipalityId,
  industryId,
  prefectureId,
}: ExportModalProps) {
  const [startRow, setStartRow] = useState(1)
  const [endRow, setEndRow] = useState(100)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const datasetSize = dataset?.businesses || 0

  // Set default end row based on dataset size
  useEffect(() => {
    if (dataset && datasetSize > 0) {
      const defaultEnd = Math.min(100, datasetSize)
      setEndRow(defaultEnd)
      setStartRow(1)
    }
  }, [dataset, datasetSize])

  // Calculate row count and price
  const rowCount = useMemo(() => {
    return Math.max(0, endRow - startRow + 1)
  }, [startRow, endRow])

  const price = useMemo(() => {
    if (rowCount > MAX_EXPORT_ROWS) return null
    return rowCount * EXPORT_PRICE_PER_ROW
  }, [rowCount])

  const isValid = useMemo(() => {
    return (
      startRow >= 1 &&
      endRow >= startRow &&
      rowCount <= MAX_EXPORT_ROWS &&
      rowCount > 0
    )
  }, [startRow, endRow, rowCount])

  const handleExport = async () => {
    if (!isValid) {
      toast({
        title: "Invalid range",
        description: `Please select a valid row range (max ${MAX_EXPORT_ROWS} rows)`,
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Use the new export endpoint with row range
      // Get base URL from environment or use default
      const baseUrl = typeof window !== 'undefined' 
        ? (process.env.NEXT_PUBLIC_API_URL || 'https://api.leadscope.gr')
        : 'https://api.leadscope.gr'
      const url = `${baseUrl}/api/export`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_row: startRow,
          end_row: endRow,
          ...(municipalityId && { municipality_id: municipalityId }),
          ...(industryId && { industry_id: industryId }),
          ...(prefectureId && { prefecture_id: prefectureId }),
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        toast({
          title: "Export failed",
          description: errorData.message || errorData.meta?.gate_reason || "Failed to create export",
          variant: "destructive",
        })
        return
      }

      // Handle blob response (Excel file)
      const blob = await response.blob()
      const url_blob = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url_blob
      link.setAttribute('download', `businesses-export-${Date.now()}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url_blob)

      toast({
        title: "Export completed",
        description: `Exported ${rowCount} businesses (€${price?.toFixed(2)})`,
      })

      onOpenChange(false)
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

  const handleClose = () => {
    if (!loading) {
      setStartRow(1)
      setEndRow(100)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Businesses</DialogTitle>
          <DialogDescription>
            Select a row range to export. Maximum {MAX_EXPORT_ROWS} rows per export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Row Range Selector */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-row">Start Row</Label>
                <Input
                  id="start-row"
                  type="number"
                  min={1}
                  max={datasetSize || 10000}
                  value={startRow}
                  onChange={(e) => {
                    const value = Math.max(1, parseInt(e.target.value) || 1)
                    setStartRow(value)
                    if (value > endRow) {
                      setEndRow(value)
                    }
                  }}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-row">End Row</Label>
                <Input
                  id="end-row"
                  type="number"
                  min={startRow}
                  max={Math.min(startRow + MAX_EXPORT_ROWS - 1, datasetSize || 10000)}
                  value={endRow}
                  onChange={(e) => {
                    const value = Math.min(
                      parseInt(e.target.value) || startRow,
                      startRow + MAX_EXPORT_ROWS - 1,
                      datasetSize || 10000
                    )
                    setEndRow(value)
                  }}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Dataset Info */}
            {dataset && (
              <Alert className="bg-muted/50 border-border">
                <Info className="h-4 w-4 text-muted-foreground" />
                <AlertDescription className="text-sm text-muted-foreground">
                  Dataset contains {datasetSize.toLocaleString()} businesses.
                  {endRow > datasetSize && (
                    <span className="font-medium text-foreground"> Only {datasetSize.toLocaleString()} will be exported.</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Validation Error */}
            {!isValid && rowCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {rowCount > MAX_EXPORT_ROWS
                    ? `Maximum ${MAX_EXPORT_ROWS} rows allowed per export`
                    : "Invalid row range"}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Price Summary */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Row Count:</span>
                <span className="font-medium text-foreground">
                  {rowCount.toLocaleString()} {rowCount === 1 ? 'row' : 'rows'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Price:</span>
                <div className="flex items-center gap-2">
                  <Euro className="w-4 h-4 text-primary" />
                  <span className="text-lg font-bold text-primary">
                    {price !== null ? price.toFixed(2) : '—'}
                  </span>
                </div>
              </div>
              {price !== null && (
                <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                  €{EXPORT_PRICE_PER_ROW.toFixed(2)} per row
                </p>
              )}
            </div>
          </div>

          {/* Info Alert */}
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-muted-foreground">
              The export will be downloaded as an Excel (.xlsx) file with business details including name, address, municipality, industry, website, email, and phone.
            </AlertDescription>
          </Alert>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!isValid || loading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export & Download (€{price?.toFixed(2) || '0.00'})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
