'use client'

/**
 * Permissions Context
 * 
 * Provides user permissions to all components.
 * Fetches permissions on mount and stores in state.
 * 
 * UI behavior:
 * - Disable buttons visually if limits exceeded
 * - Never block actions client-side
 * - Always rely on backend response
 */

import React, { createContext, useContext, useEffect, useState } from 'react'
import { fetchPermissions, type MeResponse, type UserPermissions } from '@/lib/permissions'

interface PermissionsContextValue {
  permissions: UserPermissions | null
  user: MeResponse['user'] | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [user, setUser] = useState<MeResponse['user'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPermissions = async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await fetchPermissions()

      if (data) {
        setPermissions(data.permissions)
        setUser(data.user)
      } else {
        setError('Failed to load permissions')
        // Set default demo permissions on error
        setPermissions({
          plan: 'demo',
          max_export_rows: 50,
          max_crawl_pages: 1,
          max_datasets: 1,
          can_refresh: false,
        })
        setUser(null)
      }
    } catch (err) {
      console.error('[PermissionsProvider] Error loading permissions:', err)
      setError('Failed to load permissions')
      // Set default demo permissions on error
      setPermissions({
        plan: 'demo',
        max_export_rows: 50,
        max_crawl_pages: 1,
        max_datasets: 1,
        can_refresh: false,
      })
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetch permissions on mount
    loadPermissions()
  }, [])

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        user,
        loading,
        error,
        refetch: loadPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}

/**
 * Hook to use permissions context
 */
export function usePermissions() {
  const context = useContext(PermissionsContext)

  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider')
  }

  return context
}
