"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Download, ExternalLink, Mail, Phone, Globe, Calendar, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, NetworkError } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"

interface BusinessContact {
  id: string
  name: string
  address: string | null
  website: string | null
  emails: Array<{
    id: number
    email: string
    source_url: string
    page_type: string
    found_at: string
  }>
  phones: Array<{
    id: number
    phone: string
    source_url: string
    page_type: string
    found_at: string
  }>
  extraction_job: {
    id: string
    status: string
    completed_at: string | null
  } | null
}

export default function DatasetContactsPage() {
  const params = useParams()
  const router = useRouter()
  const datasetId = params.id as string
  const [loading, setLoading] = useState(true)
  const [businesses, setBusinesses] = useState<BusinessContact[]>([])
  const [meta, setMeta] = useState({
    plan_id: 'demo' as const,
    gated: false,
    total_available: 0,
    total_returned: 0,
  })
  const [networkError, setNetworkError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    async function loadContacts() {
      try {
        setLoading(true)
        setNetworkError(null)

        // Use optimized batch endpoint for contacts
        const contactsRes = await api.getDatasetContacts(datasetId)
        
        if (!contactsRes.data) {
          setNetworkError('No contacts found')
          return
        }

        setBusinesses(contactsRes.data)
        setMeta(contactsRes.meta)
      } catch (error) {
        if (error instanceof NetworkError) {
          setNetworkError(error.message)
        } else {
          setNetworkError('Failed to load contacts')
        }
        toast({
          title: "Error",
          description: "Failed to load business contacts",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (datasetId) {
      loadContacts()
    }
  }, [datasetId, toast])

  const formatDate = (date: string | null) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getLatestExtractionDate = (business: BusinessContact) => {
    const allDates: string[] = []
    
    business.emails.forEach(e => allDates.push(e.found_at))
    business.phones.forEach(p => allDates.push(p.found_at))
    if (business.extraction_job?.completed_at) {
      allDates.push(business.extraction_job.completed_at)
    }
    
    if (allDates.length === 0) return null
    
    return allDates.sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    )[0]
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (networkError) {
    return (
      <div className="space-y-6">
        <Alert className="bg-destructive/10 border-destructive/20">
          <AlertDescription>{networkError}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href={`/datasets/${datasetId}`}>Back to Dataset</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href={`/datasets/${datasetId}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dataset
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Business Contacts</h1>
            <p className="text-sm text-muted-foreground">
              Detailed contact information extracted for each business
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {meta.gated && <GateBanner meta={meta} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-card-foreground">
              {businesses.length.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total Businesses</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-card-foreground">
              {businesses.reduce((sum, b) => sum + b.emails.length, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total Emails</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-card-foreground">
              {businesses.reduce((sum, b) => sum + b.phones.length, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total Phones</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-card-foreground">
              {businesses.filter(b => b.website).length.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">With Website</p>
          </CardContent>
        </Card>
      </div>

      {/* Contacts Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Extracted Contacts</CardTitle>
              <CardDescription>
                Showing {businesses.length} businesses with extracted contact details
              </CardDescription>
            </div>
            {meta.total_available > 0 && <MetaInfo meta={meta} />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Business Name</TableHead>
                  <TableHead className="text-muted-foreground">Address</TableHead>
                  <TableHead className="text-muted-foreground">Website</TableHead>
                  <TableHead className="text-muted-foreground">Emails</TableHead>
                  <TableHead className="text-muted-foreground">Phone Numbers</TableHead>
                  <TableHead className="text-muted-foreground">Date Extracted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No contacts found
                    </TableCell>
                  </TableRow>
                ) : (
                  businesses.map((business) => {
                    const latestExtractionDate = getLatestExtractionDate(business)
                    return (
                      <TableRow key={business.id} className="border-border hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">
                          {business.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {business.address || "—"}
                        </TableCell>
                        <TableCell>
                          {business.website ? (
                            <a
                              href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <Globe className="w-3 h-3" />
                              {business.website.replace(/^https?:\/\//, "").substring(0, 30)}
                              {business.website.length > 30 && "..."}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {business.emails.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {business.emails.slice(0, 3).map((email) => (
                                <a
                                  key={email.id}
                                  href={`mailto:${email.email}`}
                                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                                  title={`Found on: ${email.source_url} (${email.page_type})`}
                                >
                                  <Mail className="w-3 h-3" />
                                  {email.email}
                                </a>
                              ))}
                              {business.emails.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{business.emails.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {business.phones.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {business.phones.slice(0, 3).map((phone) => (
                                <a
                                  key={phone.id}
                                  href={`tel:${phone.phone}`}
                                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                                  title={`Found on: ${phone.source_url} (${phone.page_type})`}
                                >
                                  <Phone className="w-3 h-3" />
                                  {phone.phone}
                                </a>
                              ))}
                              {business.phones.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{business.phones.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {latestExtractionDate ? (
                              <span className="text-sm">
                                {formatDate(latestExtractionDate)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">Not extracted</span>
                            )}
                          </div>
                          {business.extraction_job && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "mt-1 text-xs",
                                business.extraction_job.status === 'success'
                                  ? "bg-success/10 text-success border-success/20"
                                  : business.extraction_job.status === 'failed'
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {business.extraction_job.status}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
