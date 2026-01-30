"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, Bell, User as UserIcon, LogOut, Settings, HelpCircle, Compass } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Search,
  Database,
  RefreshCw,
  Download,
  CreditCard,
} from "lucide-react"

const topNavItems = [
  { name: "Cities", href: "/cities" },
  { name: "Industries", href: "/industries" },
  { name: "Exports", href: "/exports" },
  { name: "Billing", href: "/billing" },
  { name: "Account", href: "/settings" },
]

const mobileNavItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Discover Leads", href: "/discover", icon: Search },
  { name: "My Datasets", href: "/datasets", icon: Database },
  { name: "Refresh Status", href: "/refresh", icon: RefreshCw },
  { name: "Exports", href: "/exports", icon: Download },
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function TopNav() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await api.getCurrentUser()
        if (response.data) {
          setUser(response.data)
        }
      } catch (error) {
        console.error('[TopNav] Failed to load user:', error)
      }
    }
    loadUser()
  }, [])

  const userEmail = user?.email || 'Loading...'
  const userPlan = user?.plan || 'demo'
  const planLabel = userPlan === 'pro' ? 'Professional' : userPlan === 'starter' ? 'Starter' : 'Snapshot'

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 lg:px-6 bg-background border-b border-border">
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="w-5 h-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar">
            <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                <Compass className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-sidebar-foreground">LeadScope AI</span>
            </div>
            <nav className="px-3 py-4 space-y-1">
              {mobileNavItems.map((item) => {
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
          </SheetContent>
        </Sheet>

        <nav className="hidden md:flex items-center gap-1">
          {topNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <HelpCircle className="w-5 h-5" />
          <span className="sr-only">Help</span>
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="sr-only">User menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userEmail}</p>
              <p className="text-xs text-muted-foreground">{planLabel} Plan</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing" className="cursor-pointer">
                <CreditCard className="w-4 h-4 mr-2" />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
