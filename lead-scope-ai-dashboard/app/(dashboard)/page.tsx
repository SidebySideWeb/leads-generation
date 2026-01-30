import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, MapPin, Clock, ArrowUpRight, ExternalLink } from "lucide-react"
import { DashboardChart } from "@/components/dashboard/dashboard-chart"
import { RecentContactsTable } from "@/components/dashboard/recent-contacts-table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { api } from "@/lib/api"
import { NetworkError } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { GateBanner } from "@/components/dashboard/gate-banner"
import { MetaInfo } from "@/components/dashboard/meta-info"
import { getCurrentUser } from "@/lib/auth-server"
import type { ResponseMeta } from "@/lib/types"

interface StatCardProps {
  title: string
  value: string | number
  description: string
  icon: React.ComponentType<{ className?: string }>
}

function StatCard({ title, value, description, icon: Icon }: StatCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-card-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  // Get current user and plan from JWT token
  const user = await getCurrentUser()
  const userPlan = user?.plan || 'demo'

  let stats: { totalBusinesses: number; activeContacts: number; citiesScanned: number; lastRefresh: string | null } | null = null
  let statsMeta: ResponseMeta | null = null
  let recentContacts: Array<{ id: string; name: string; city: string; industry: string; email: string | null; phone: string | null; website: string | null; lastVerifiedAt: string | null }> | null = null
  let contactsMeta: ResponseMeta | null = null
  let networkError: string | null = null

  try {
    const [statsResponse, contactsResponse] = await Promise.all([
      api.getDashboardMetrics(),
      api.getRecentContacts(5),
    ])

    if (statsResponse.data) {
      // Map API response (snake_case) to expected format (camelCase)
      stats = {
        totalBusinesses: statsResponse.data.businesses_total,
        activeContacts: statsResponse.data.contacts_found,
        citiesScanned: statsResponse.data.cities_scanned || 0,
        lastRefresh: statsResponse.data.last_refresh,
      }
    }
    statsMeta = statsResponse.meta

    if (contactsResponse.data) {
      recentContacts = contactsResponse.data.map(b => ({
        id: b.id,
        name: b.name,
        city: b.city,
        industry: b.industry,
        email: b.email,
        phone: b.phone,
        website: b.website,
        lastVerifiedAt: b.lastVerifiedAt,
      }))
    }
    contactsMeta = contactsResponse.meta
  } catch (error) {
    if (error instanceof NetworkError) {
      networkError = error.message
    } else {
      networkError = 'Failed to load dashboard data'
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatDate = (date: string | null) => {
    if (!date) return "Never"
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your business contact intelligence
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/discover">
            Discover new leads
            <ArrowUpRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      </div>

      {networkError && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{networkError}</p>
          </CardContent>
        </Card>
      )}

      {statsMeta?.gated && <GateBanner meta={statsMeta} />}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {!stats || !statsMeta ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total Businesses"
              value={formatNumber(stats.totalBusinesses)}
              description={`${statsMeta.total_returned.toLocaleString()} returned`}
              icon={Building2}
            />
            <StatCard
              title="Active Contacts"
              value={formatNumber(stats.activeContacts)}
              description={`${statsMeta.total_returned.toLocaleString()} returned`}
              icon={Users}
            />
            <StatCard
              title="Cities Scanned"
              value={formatNumber(stats.citiesScanned)}
              description="Cities covered"
              icon={MapPin}
            />
            <StatCard
              title="Last Refresh"
              value={formatDate(stats.lastRefresh)}
              description={stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleDateString() : ""}
              icon={Clock}
            />
          </>
        )}
      </div>

      {statsMeta && statsMeta.total_available > 0 && (
        <MetaInfo meta={statsMeta} className="flex justify-end" />
      )}

      {/* Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Contacts Overview</CardTitle>
          <CardDescription>
            Contacts added vs removed over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardChart />
        </CardContent>
      </Card>

      {/* Recent Contacts Table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Latest Verified Contacts</CardTitle>
            <CardDescription>
              Recently discovered and verified business contacts
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {contactsMeta && contactsMeta.total_available > 0 && <MetaInfo meta={contactsMeta} />}
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link href="/datasets">
                View all
                <ExternalLink className="ml-1 w-3 h-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contactsMeta?.gated && contactsMeta && <GateBanner meta={contactsMeta} />}
          <RecentContactsTable contacts={recentContacts} meta={
            contactsMeta || { plan_id: 'demo', gated: false, total_available: 0, total_returned: 0 }
          } />
        </CardContent>
      </Card>
    </div>
  )
}
