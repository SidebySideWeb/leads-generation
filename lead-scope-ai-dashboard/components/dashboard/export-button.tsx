"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { Dataset } from "@/lib/types"
import { usePermissions } from "@/contexts/PermissionsContext"
import { canPerformAction } from "@/lib/permissions"
import { ExportModal } from "./export-modal"

interface ExportButtonProps {
  datasetId: string
  dataset?: Dataset | null
  onExportComplete?: () => void
  discoveryRuns?: Array<{
    id: string;
    status: 'running' | 'completed' | 'failed';
    created_at: string;
    completed_at: string | null;
  }>
}

export function ExportButton({ datasetId, dataset: datasetProp, onExportComplete, discoveryRuns = [] }: ExportButtonProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [dataset, setDataset] = useState<Dataset | null>(datasetProp || null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { permissions } = usePermissions()
  
  // Check if export is allowed (for UI display only - backend always enforces)
  const exportCheck = canPerformAction(permissions, 'export')
  
  // Check if latest discovery run is completed
  // Export is disabled if latest discovery_run.status !== 'completed'
  // Ensure discoveryRuns is always an array
  const safeDiscoveryRuns = Array.isArray(discoveryRuns) ? discoveryRuns : []
  const latestDiscoveryRun = safeDiscoveryRuns.length > 0 ? safeDiscoveryRuns[0] : null
  const isDiscoveryCompleted = latestDiscoveryRun?.status === 'completed'
  const isDiscoveryRunning = latestDiscoveryRun?.status === 'running'
  const exportDisabled = loading || !isDiscoveryCompleted || (latestDiscoveryRun && isDiscoveryRunning)
  
  // Fetch dataset if not provided
  useEffect(() => {
    if (!datasetProp && datasetId) {
      setLoading(true)
      api.getDataset(datasetId).then(res => {
        if (res.data) {
          setDataset(res.data)
        }
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    }
  }, [datasetId, datasetProp])

  const handleClick = () => {
    // Prevent export if discovery is not completed
    if (!isDiscoveryCompleted && latestDiscoveryRun) {
      toast({
        title: "Export unavailable",
        description: "Please wait for the discovery run to complete before exporting",
        variant: "default",
      })
      return
    }
    
    if (!dataset) {
      toast({
        title: "Loading dataset",
        description: "Please wait while we load the dataset information",
        variant: "default",
      })
      return
    }
    
    setModalOpen(true)
  }

  return (
    <>
      <Button 
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
        disabled={exportDisabled || loading}
        onClick={handleClick}
        title={!isDiscoveryCompleted && latestDiscoveryRun ? "Wait for discovery to complete" : undefined}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export
          </>
        )}
      </Button>

      <ExportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        dataset={dataset}
        onComplete={() => {
          if (onExportComplete) {
            onExportComplete()
          }
        }}
      />
    </>
  )
}
