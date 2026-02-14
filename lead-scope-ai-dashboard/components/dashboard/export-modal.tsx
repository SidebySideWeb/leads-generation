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

// Note: Exports now export the entire dataset, no row range selection

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
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx')
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

  const isValid = useMemo(() => {
    return !!selectedDatasetId && !!selectedDataset
  }, [selectedDatasetId, selectedDataset])

  const handleExport = async () => {
    if (!selectedDatasetId) {
      toast({
        title: "No dataset selected",
        description: "Please select a dataset to export",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Use the runExport endpoint which creates an async export job
      const response = await api.runExport(selectedDatasetId, format)
      
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
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Export</DialogTitle>
          <DialogDescription>
            Select a dataset and format to create an export. The export will include all businesses in the dataset.
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

          {/* Format Selector */}
          {selectedDataset && (
            <div className="space-y-2">
              <Label htmlFor="format-select">Export Format</Label>
              <Select
                value={format}
                onValueChange={(value) => setFormat(value as 'csv' | 'xlsx')}
                disabled={loading || loadingDatasets}
              >
                <SelectTrigger id="format-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dataset Info */}
          {selectedDataset && (
            <Alert className="bg-muted/50 border-border">
              <Info className="h-4 w-4 text-muted-foreground" />
              <AlertDescription className="text-sm text-muted-foreground">
                This export will include all <strong className="text-foreground">{datasetSize.toLocaleString()} businesses</strong> from the selected dataset.
              </AlertDescription>
            </Alert>
          )}

          {/* Info Alert */}
          {selectedDataset && (
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm text-muted-foreground">
                The export will be processed in the background. You'll be able to download it from the exports page when ready.
              </AlertDescription>
            </Alert>
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
