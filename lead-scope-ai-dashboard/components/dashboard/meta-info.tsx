/**
 * Component to display response metadata (total_returned / total_available)
 */

import { Badge } from "@/components/ui/badge"
import type { ResponseMeta } from "@/lib/types"

interface MetaInfoProps {
  meta: ResponseMeta
  className?: string
}

export function MetaInfo({ meta, className }: MetaInfoProps) {
  if (meta.total_available === 0 && meta.total_returned === 0) {
    return null
  }

  const percentage = meta.total_available > 0
    ? Math.round((meta.total_returned / meta.total_available) * 100)
    : 0

  return (
    <div className={className}>
      <Badge variant="outline" className="text-xs">
        Showing {meta.total_returned.toLocaleString()} of {meta.total_available.toLocaleString()}
        {meta.gated && percentage < 100 && ` (${percentage}%)`}
      </Badge>
    </div>
  )
}
