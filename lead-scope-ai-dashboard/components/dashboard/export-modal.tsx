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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Info, Download, Euro, AlertCircle, Database } from "lucide-react"
import { api, NetworkError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Dataset } from "@/lib/types"

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataset?: Dataset | null // Pre-selected dataset (optional)
  datasets?: Dataset[] // List of all available datasets
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
  dataset: initialDataset,
  datasets: availableDatasets = [],
  onComplete,
  municipalityId,
  industryId,
  prefectureId,
}: ExportModalProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(initialDataset?.id || '')
  const [startRow, setStartRow] = useState(1)
  const [endRow, setEndRow] = useState(100)
  const [loading, setLoading] = useState(false)
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [datasets, setDatasets] = useState<Dataset[]>(availableDatasets)
  const { toast } = useToast()

  // Load datasets if not provided
  useEffect(() => {
    if (open && datasets.length === 0) {
      loadDatasets()
    }
  }, [open])

  // Set initial dataset when modal opens
  useEffect(() => {
    if (open) {
      if (initialDataset) {
        setSelectedDatasetId(initialDataset.id)
      } else if (datasets.length > 0) {
        setSelectedDatasetId(datasets[0].id)
      }
    }
  }, [open, initialDataset, datasets])

  const loadDatasets = async () => {
    try {
      setLoadingDatasets(true)
      const response = await api.getDatasets()
      if (response.data) {
        setDatasets(response.data)
        if (response.data.length > 0 && !selectedDatasetId) {
          setSelectedDatasetId(response.data[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load datasets:', error)
      toast({
        title: "Error",
        description: "Failed to load datasets",
        variant: "destructive",
      })
    } finally {
      setLoadingDatasets(false)
    }
  }

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId)
  const datasetSize = selectedDataset?.businesses || 0

  // Set default end row based on dataset size
  useEffect(() => {
    if (selectedDataset && datasetSize > 0) {
      const defaultEnd = Math.min(100, datasetSize)
      setEndRow(defaultEnd)
      setStartRow(1)
    }
  }, [selectedDataset, datasetSize])

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
    if (!selectedDatasetId) {
      toast({
        title: "No dataset selected",
        description: "Please select a dataset to export",
        variant: "destructive",
      })
      return
    }

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
      // Use the runExport endpoint which creates an async export job
      const response = await api.runExport(selectedDatasetId, 'xlsx')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to create export')
      }

      const result = await response.json()
      
      toast({
        title: "Export started",
        description: result.message || "Your export is being processed. You'll be notified when it's ready.",
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
          description: error instanceof Error ? error.message : "An unexpected error occurred",
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
          {/* Dataset Selector */}
          {datasets.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="dataset-select">Select Dataset</Label>
              <Select
                value={selectedDatasetId}
                onValueChange={setSelectedDatasetId}
                disabled={loading || loadingDatasets}
              >
                <SelectTrigger id="dataset-select">
                  <SelectValue placeholder="Select a dataset">
                    {selectedDataset ? (
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        <span>{selectedDataset.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({selectedDataset.businesses.toLocaleString()} businesses)
                        </span>
                      </div>
                    ) : (
                      "Select a dataset"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        <span>{ds.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({ds.businesses.toLocaleString()} businesses)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {loadingDatasets && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading datasets...
            </div>
          )}

          {/* Row Range Selector */}
          {selectedDataset && (
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
                {selectedDataset && (
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
            )}

          {/* Price Summary - Only show if row range is used */}
          {selectedDataset && (
            <>
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
                  The export will be processed in the background. You'll be able to download it from the exports page when ready.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!selectedDatasetId || !isValid || loading || loadingDatasets}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Export...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Create Export
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
