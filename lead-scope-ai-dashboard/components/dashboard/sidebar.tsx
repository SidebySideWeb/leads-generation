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
  User,
} from "lucide-react"

const sidebarItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Discover Leads", href: "/discover", icon: Search },
  { name: "My Datasets", href: "/datasets", icon: Database },
  // Hidden for MVP - { name: "Refresh Status", href: "/refresh", icon: RefreshCw },
  { name: "Exports", href: "/exports", icon: Download },
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
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
      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/30 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent">
              <User className="h-4 w-4 text-sidebar-accent-foreground" />
            </div>
            <div>
              <p className="text-xs font-medium text-sidebar-foreground">Account Quick View</p>
              <p className="text-[11px] text-sidebar-foreground/70">Manage profile and plan</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href="/settings"
              className="rounded border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              Settings
            </Link>
            <Link
              href="/billing"
              className="rounded border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              Billing
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}
