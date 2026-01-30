/**
 * Gate banner component for displaying upgrade hints when data is gated
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowUpCircle } from "lucide-react"
import Link from "next/link"
import type { ResponseMeta } from "@/lib/types"

interface GateBannerProps {
  meta: ResponseMeta
}

export function GateBanner({ meta }: GateBannerProps) {
  if (!meta.gated) {
    return null
  }

  return (
    <Alert className="bg-warning/5 border-warning/20">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-foreground">Limited Access</AlertTitle>
      <AlertDescription className="text-muted-foreground space-y-2">
        {meta.gate_reason && <p>{meta.gate_reason}</p>}
        {meta.upgrade_hint && <p>{meta.upgrade_hint}</p>}
        <Button asChild size="sm" className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/billing">
            <ArrowUpCircle className="mr-2 w-4 h-4" />
            Upgrade Plan
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
