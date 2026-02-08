'use client'

import React from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { TopNav } from "@/components/dashboard/top-nav"
import { PermissionsProvider } from "@/contexts/PermissionsContext"
import { BillingProvider } from "@/contexts/BillingContext"
import { LimitWarningBanner } from "@/components/dashboard/limit-warning-banner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PermissionsProvider>
      <BillingProvider>
        <div className="flex h-screen bg-background">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
          <TopNav />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <LimitWarningBanner />
            {children}
          </main>
          </div>
        </div>
      </BillingProvider>
    </PermissionsProvider>
  )
}
