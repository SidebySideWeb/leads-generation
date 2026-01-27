"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Search,
  Database,
  RefreshCw,
  Download,
  CreditCard,
  Settings,
  Compass,
} from "lucide-react"

const sidebarItems = [
  { name: "Dashboard", href: "/(dashboard)", icon: LayoutDashboard },
  { name: "Discover Leads", href: "/(dashboard)/discover", icon: Search },
  { name: "My Datasets", href: "/(dashboard)/datasets", icon: Database },
  { name: "Refresh Status", href: "/(dashboard)/refresh", icon: RefreshCw },
  { name: "Exports", href: "/(dashboard)/exports", icon: Download },
  { name: "Billing", href: "/(dashboard)/billing", icon: CreditCard },
  { name: "Settings", href: "/(dashboard)/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
          <Compass className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-sidebar-foreground">LeadScope AI</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="px-3 py-3 rounded-lg bg-sidebar-accent/50">
          <p className="text-xs text-muted-foreground mb-1">Current Plan</p>
          <p className="text-sm font-medium text-sidebar-foreground">Snapshot</p>
          <Link
            href="/(dashboard)/billing"
            className="text-xs text-primary hover:underline"
          >
            Upgrade to Professional
          </Link>
        </div>
      </div>
    </aside>
  )
}
