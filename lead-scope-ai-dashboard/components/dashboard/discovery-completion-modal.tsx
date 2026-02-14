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
import { CheckCircle, Download, Save, X, Database, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface DiscoveryCompletionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  discoveryRunId: string
  datasetId: string
  businessesFound: number
  status?: 'completed' | 'failed'
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
  status = 'completed',
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

  const isSuccess = status === 'completed'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex items-center justify-center w-16 h-16 rounded-full flex-shrink-0",
              isSuccess ? "bg-success/10" : "bg-destructive/10"
            )}>
              {isSuccess ? (
                <CheckCircle className="w-8 h-8 text-success" />
              ) : (
                <X className="w-8 h-8 text-destructive" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className={cn(
                "text-xl mb-2",
                isSuccess ? "text-success" : "text-destructive"
              )}>
                {isSuccess ? "Discovery Completed!" : "Discovery Failed"}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                {isSuccess ? (
                  <>
                    Successfully discovered <strong className="text-foreground font-semibold">{businessesFound.toLocaleString()}</strong> businesses
                  </>
                ) : (
                  "The discovery process encountered an error. Please try again or contact support."
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        {isSuccess && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Database className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Dataset Ready</p>
                <p className="text-xs text-muted-foreground">
                  Your dataset has been saved and is ready to use
                </p>
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                {businessesFound.toLocaleString()} businesses
              </Badge>
            </div>
            
            <div className="pt-2">
              <p className="text-sm font-medium text-foreground mb-3">
                What would you like to do next?
              </p>
              <div className="space-y-2">
                <Button
                  variant="default"
                  onClick={handleSave}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground justify-start"
                >
                  <Save className="mr-2 w-4 h-4" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Save Dataset</div>
                    <div className="text-xs opacity-90">View and manage your dataset</div>
                  </div>
                </Button>
                <Button
                  variant="default"
                  onClick={handleExport}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground justify-start"
                >
                  <Download className="mr-2 w-4 h-4" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Proceed to Export</div>
                    <div className="text-xs opacity-90">Export data as CSV or Excel</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAbort}
                  className="w-full justify-start"
                >
                  <X className="mr-2 w-4 h-4" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Close</div>
                    <div className="text-xs opacity-70">Dismiss this dialog</div>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isSuccess && (
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleAbort}
              className="w-full sm:w-auto"
            >
              Dismiss
            </Button>
            <Button
              variant="default"
              onClick={() => {
                onOpenChange(false)
                router.push('/discover')
              }}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            >
              <Sparkles className="mr-2 w-4 h-4" />
              Try Again
            </Button>
          </DialogFooter>
        )}

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Discovery Run ID: <span className="font-mono">{discoveryRunId.substring(0, 8)}...</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
