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
import { Loader2, Info, Download, AlertCircle, Database, FileSpreadsheet } from "lucide-react"
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
        let errorMessage = 'Failed to create export'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorData.gate_reason || errorMessage
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      let result: any = {}
      try {
        result = await response.json()
      } catch (e) {
        // If response is not JSON, that's okay - export was created
        console.log('Export response is not JSON, assuming success')
      }
      
      toast({
        title: "Export started",
        description: result.message || "Your export is being processed. You'll be notified when it's ready.",
      })

      onOpenChange(false)
      if (onComplete) {
        onComplete()
      }
    } catch (error) {
      console.error('Export error:', error)
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Create Export</DialogTitle>
              <DialogDescription className="text-sm">
                Export your dataset in your preferred format
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Dataset Selector */}
          <div className="space-y-3">
            <Label htmlFor="dataset-select" className="text-sm font-medium text-foreground">
              Select Dataset
            </Label>
            {loadingDatasets ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border border-border bg-muted/30">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading datasets...
              </div>
            ) : datasets.length > 0 ? (
              <Select
                value={selectedDatasetId}
                onValueChange={setSelectedDatasetId}
                disabled={loading || loadingDatasets}
              >
                <SelectTrigger id="dataset-select" className="h-12">
                  <SelectValue placeholder="Select a dataset">
                    {selectedDataset ? (
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                          <Database className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-foreground">{selectedDataset.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {selectedDataset.city} • {selectedDataset.industry}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {selectedDataset.businesses.toLocaleString()} businesses
                        </div>
                      </div>
                    ) : (
                      "Select a dataset"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id} className="py-3">
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                          <Database className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">{ds.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {ds.city} • {ds.industry}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {ds.businesses.toLocaleString()} businesses
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Alert className="bg-muted/50 border-border">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <AlertDescription className="text-sm text-muted-foreground">
                  No datasets available. Please create a dataset first.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Format Selector */}
          {selectedDataset && (
            <div className="space-y-3">
              <Label htmlFor="format-select" className="text-sm font-medium text-foreground">
                Export Format
              </Label>
              <Select
                value={format}
                onValueChange={(value) => setFormat(value as 'csv' | 'xlsx')}
                disabled={loading || loadingDatasets}
              >
                <SelectTrigger id="format-select" className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx" className="py-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-primary" />
                      <div>
                        <div className="font-medium">Excel (.xlsx)</div>
                        <div className="text-xs text-muted-foreground">Recommended for large datasets</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="csv" className="py-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-primary" />
                      <div>
                        <div className="font-medium">CSV (.csv)</div>
                        <div className="text-xs text-muted-foreground">Compatible with all spreadsheet apps</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dataset Summary */}
          {selectedDataset && (
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Dataset</span>
                <span className="font-medium text-foreground">{selectedDataset.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Location</span>
                <span className="font-medium text-foreground">{selectedDataset.city}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Industry</span>
                <span className="font-medium text-foreground">{selectedDataset.industry}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Businesses</span>
                  <span className="text-lg font-bold text-primary">
                    {datasetSize.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info Alert */}
          {selectedDataset && (
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm text-muted-foreground">
                The export will be processed in the background. You'll receive a notification when it's ready to download.
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
