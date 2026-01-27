"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { ResponseMeta } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"

interface RecentContact {
  id: string
  name: string
  city: string
  industry: string
  email: string | null
  phone: string | null
  website: string | null
  lastVerifiedAt: string | null
}

interface RecentContactsTableProps {
  contacts: RecentContact[] | null
  meta: ResponseMeta
}

const statusConfig = {
  new: {
    label: "New",
    className: "bg-success/10 text-success hover:bg-success/20 border-success/20",
  },
  updated: {
    label: "Updated",
    className: "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20",
  },
  verified: {
    label: "Verified",
    className: "bg-muted text-muted-foreground hover:bg-muted/80 border-border",
  },
} as const

function getContactType(email: string | null, phone: string | null, website: string | null): string {
  const types: string[] = []
  if (email) types.push("Email")
  if (phone) types.push("Phone")
  if (website) types.push("Website")
  return types.join(" + ") || "No contact"
}

function getStatus(lastVerifiedAt: string | null): keyof typeof statusConfig {
  if (!lastVerifiedAt) return "verified"
  const daysAgo = Math.floor((Date.now() - new Date(lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24))
  if (daysAgo < 7) return "new"
  if (daysAgo < 30) return "updated"
  return "verified"
}

export function RecentContactsTable({ contacts, meta }: RecentContactsTableProps) {
  if (!contacts) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No recent contacts found</p>
        {meta.gated && meta.total_available > 0 && (
          <p className="text-xs mt-2">
            {meta.total_available - meta.total_returned} more contacts available with upgrade
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Company</TableHead>
            <TableHead className="text-muted-foreground">City</TableHead>
            <TableHead className="text-muted-foreground">Industry</TableHead>
            <TableHead className="text-muted-foreground">Contact Type</TableHead>
            <TableHead className="text-muted-foreground">Last Verified</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const status = getStatus(contact.lastVerifiedAt)
            const contactType = getContactType(contact.email, contact.phone, contact.website)
            const lastVerified = contact.lastVerifiedAt
              ? new Date(contact.lastVerifiedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Never"

            return (
              <TableRow key={contact.id} className="border-border hover:bg-muted/50">
                <TableCell className="font-medium text-foreground">{contact.name}</TableCell>
                <TableCell className="text-muted-foreground">{contact.city}</TableCell>
                <TableCell className="text-muted-foreground">{contact.industry}</TableCell>
                <TableCell className="text-muted-foreground">{contactType}</TableCell>
                <TableCell className="text-muted-foreground">{lastVerified}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(statusConfig[status].className)}
                  >
                    {statusConfig[status].label}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {meta.gated && meta.total_available > meta.total_returned && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Showing {meta.total_returned} of {meta.total_available} contacts. Upgrade to see all.
        </div>
      )}
    </div>
  )
}
