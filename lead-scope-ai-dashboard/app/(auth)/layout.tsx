import React from "react"
import Link from "next/link"
import { Compass } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-card border-r border-border flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <Compass className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">LeadScope AI</span>
        </Link>
        
        <div className="space-y-6">
          <blockquote className="text-2xl font-medium text-foreground leading-relaxed">
            "LeadScope AI helped us find over 2,000 verified restaurant contacts in Athens within minutes. 
            The data freshness tracking is invaluable."
          </blockquote>
          <div>
            <p className="font-medium text-foreground">Maria Papadopoulos</p>
            <p className="text-sm text-muted-foreground">Head of Sales, FoodTech Solutions</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Business Contact Intelligence for Europe
        </p>
      </div>

      {/* Right side - auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
