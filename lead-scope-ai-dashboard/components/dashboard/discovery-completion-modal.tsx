"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle, Download, Save, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface DiscoveryCompletionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  discoveryRunId: string
  datasetId: string
  businessesFound: number
  onSave?: () => void
  onExport?: () => void
  onAbort?: () => void
}

export function DiscoveryCompletionModal({
  open,
  onOpenChange,
  discoveryRunId,
  datasetId,
  businessesFound,
  onSave,
  onExport,
  onAbort,
}: DiscoveryCompletionModalProps) {
  const router = useRouter()

  const handleSave = () => {
    onSave?.()
    onOpenChange(false)
    // Navigate to dataset page
    router.push(`/datasets/${datasetId}`)
  }

  const handleExport = () => {
    onExport?.()
    onOpenChange(false)
    // Navigate to dataset page with export intent
    router.push(`/datasets/${datasetId}?export=true`)
  }

  const handleAbort = () => {
    onAbort?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success/10">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <DialogTitle className="text-foreground">Discovery Completed!</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Found {businessesFound.toLocaleString()} businesses
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            What would you like to do next?
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleAbort}
            className="w-full sm:w-auto"
          >
            <X className="mr-2 w-4 h-4" />
            Abort Dataset
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
          >
            <Save className="mr-2 w-4 h-4" />
            Save Dataset
          </Button>
          <Button
            variant="default"
            onClick={handleExport}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
          >
            <Download className="mr-2 w-4 h-4" />
            Proceed to Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
