/**
 * Shared TypeScript types for the application
 * These types mirror backend API responses
 */

// Canonical plan identifier shared across the frontend
export type PlanId = 'demo' | 'starter' | 'pro' | 'snapshot' | 'professional' | 'agency';

export interface User {
  id: string;
  email: string;
  plan: PlanId;
  name?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Response metadata included in paginated/list responses
 * 
 * IMPORTANT: This meta structure is storage-agnostic. The UI works identically
 * whether the backend uses database or local fallback storage. All UI decisions
 * should be based on this meta, never on storage mode detection.
 */
export interface ResponseMeta {
  plan_id: PlanId;
  gated: boolean;
  gate_reason?: string;
  total_available: number;
  total_returned: number;
  upgrade_hint?: string;
}

/**
 * Dataset type matching backend response
 */
export interface Dataset {
  id: string;
  name: string;
  industry: string;
  city: string;
  businesses: number;
  contacts: number;
  createdAt: string;
  refreshStatus: 'snapshot' | 'refreshing' | 'outdated';
  lastRefresh: string | null;
}

/**
 * Business type matching backend response
 */
export interface Business {
  id: string;
  name: string;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string;
  industry: string;
  lastVerifiedAt: string | null;
  isActive: boolean;
  // Optional crawl summary (from dataset results endpoint)
  crawl?: {
    status: 'not_crawled' | 'partial' | 'completed';
    emailsCount: number;
    phonesCount: number;
    socialCount: number;
    finishedAt: string | null;
    pagesVisited: number;
  };
}

/**
 * CrawlJob type matching backend response
 */
export interface CrawlJob {
  id: string;
  business_id: string;
  website_url: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  pages_crawled: number;
  pages_limit: number;
  started_at: string | null;
  completed_at: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ExportResult type matching backend response
 * Enhanced with rows_returned, rows_total, gated, upgrade_hint
 */
export interface ExportResult {
  id: string;
  dataset_id: string;
  format: 'csv' | 'xlsx';
  tier: 'starter' | 'pro' | 'agency';
  total_rows: number;
  rows_returned: number; // Rows actually exported (may be limited)
  rows_total: number; // Total rows available
  file_path: string;
  download_url: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface Contact {
  id: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  businessId: string;
  businessName: string;
  sourceUrl: string;
  firstSeenAt: string;
  lastVerifiedAt: string;
  isActive: boolean;
}

/**
 * Legacy Export type (camelCase) - kept for backward compatibility
 * Use ExportResult for new code
 */
export interface Export {
  id: string;
  datasetId: string;
  format: 'csv' | 'xlsx';
  tier: 'starter' | 'pro' | 'agency';
  totalRows: number;
  filePath: string;
  downloadUrl: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface Industry {
  id: number;
  name: string;
}

export interface City {
  id: number;
  name: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface DashboardStats {
  totalBusinesses: number;
  activeContacts: number;
  citiesScanned: number;
  lastRefresh: string | null;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  error?: ApiError;
}

/**
 * Paginated API response with metadata
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: ResponseMeta;
}

/**
 * Subscription information
 */
export interface Subscription {
  id: string;
  user_id: string;
  plan: PlanId;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Usage tracking data
 */
export interface UsageData {
  user_id: string;
  month_year: string;
  exports_this_month: number;
  crawls_this_month: number;
  datasets_created_this_month: number;
  updated_at: string;
}

/**
 * Invoice information
 */
export interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'void';
  download_url: string | null;
  stripe_invoice_id: string | null;
}
