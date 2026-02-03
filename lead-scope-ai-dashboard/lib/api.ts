/**
 * Centralized API client for backend communication
 * Server-safe, uses fetch, throws only on network errors
 * 
 * IMPORTANT: This client works identically regardless of backend storage mode
 * (database or local fallback). All responses are normalized to { data, meta }
 * structure. The UI should never detect or depend on storage mode.
 */

import type { Dataset, Business, CrawlJob, ExportResult, ResponseMeta, Industry, City, User, Subscription, UsageData, Invoice } from './types';

/**
 * API client configuration
 * BACKEND IS THE SINGLE SOURCE OF TRUTH.
 * All API calls go directly to backend: https://api.leadscope.gr
 * 
 * Production: https://api.leadscope.gr
 * Local dev: http://localhost:3000 (backend port)
 */
const getBaseUrl = (): string => {
  // Always use backend URL
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // Default to production backend
  if (typeof window !== 'undefined') {
    // Client-side: use production backend
    return 'https://api.leadscope.gr';
  }
  // Server-side: use local backend in dev, production in prod
  return process.env.NODE_ENV === 'production' 
    ? 'https://api.leadscope.gr'
    : 'http://localhost:3000';
};

/**
 * Network error class for distinguishing network errors from API errors
 */
export class NetworkError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * API client class
 */
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBaseUrl();
  }

  /**
   * Internal request method
   * Throws only on network errors (fetch failures, timeouts)
   * Returns { data, meta } for all responses (data may be null on HTTP errors)
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T | null; meta: ResponseMeta }> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Server-safe: AbortController is available in Node.js 15+
    const controller = typeof AbortController !== 'undefined' 
      ? new AbortController() 
      : null;
    
    const timeout = 30000; // 30 seconds
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (controller) {
      timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    try {
      console.log('[API] Making request to:', url, 'with credentials: include')
      const response = await fetch(url, {
        ...options,
        signal: controller?.signal,
        credentials: 'include', // Always send cookies for auth
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      console.log('[API] Response status:', response.status, response.statusText)

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Handle auth errors - redirect to login
      if (response.status === 401 || response.status === 403) {
        // Only redirect on client side
        if (typeof window !== 'undefined') {
          window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        }
        // Return error response
        return {
          data: (null as unknown) as T,
          meta: {
            plan_id: 'demo',
            gated: false,
            total_available: 0,
            total_returned: 0,
            gate_reason: 'Authentication required',
          },
        };
      }

      // HTTP errors (4xx, 5xx) are not network errors - return them with meta
      if (!response.ok) {
        let errorData: { message?: string; meta?: ResponseMeta; error?: string } = {};
        try {
          errorData = await response.json();
          console.log('[API] Error response:', response.status, errorData);
        } catch (e) {
          // If response is not JSON, create default error structure
          console.error('[API] Failed to parse error response:', e);
          errorData = { 
            message: `HTTP ${response.status}: ${response.statusText}`,
            meta: {
              plan_id: 'demo',
              gated: false,
              total_available: 0,
              total_returned: 0,
            }
          };
        }

        // Return error response with meta
        // Data will be null/undefined, but meta is always present
        // Use gate_reason from meta if available, otherwise use error message
        const errorMeta = errorData.meta || {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };

        return {
          data: (null as unknown) as T,
          meta: errorMeta,
        };
      }

      const json = await response.json();

      // Normalize response structure - backend may return { data, meta } or just data
      // This ensures UI works identically whether backend uses database or local storage
      if (json.data !== undefined && json.meta !== undefined) {
        return {
          data: json.data as T,
          meta: json.meta as ResponseMeta,
        };
      }

      // If backend returns data without meta, wrap it with default meta
      // This normalization ensures consistent UI behavior regardless of storage mode
      return {
        data: json as T,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
        },
      };
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Network errors: fetch failed, timeout, connection refused, etc.
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network request failed', error);
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timeout', error);
      }

      // Re-throw other errors (HTTP errors, etc.)
      throw error;
    }
  }

  /**
   * Discover businesses by industry and city
   * @param input - Discovery input parameters
   * @returns Promise with discovered businesses and metadata
   */
  async discoverBusinesses(input: {
    industryId: string; // UUID
    cityId: string; // UUID
    datasetId?: string;
  }): Promise<{ data: Business[] | null; meta: ResponseMeta }> {
    // Validate input before sending
    if (!input.industryId || !input.cityId) {
      console.error('[API] Invalid discovery input:', input);
      return {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: 'Invalid industryId or cityId: both are required',
        },
      };
    }

    console.log('[API] discoverBusinesses called with:', input);
    console.log('[API] Request body will be:', JSON.stringify(input));
    const result = await this.request<Business[]>('/discovery/businesses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    console.log('[API] discoverBusinesses response:', result);
    return result;
  }

  /**
   * Get a single dataset by ID
   * @param datasetId - Dataset UUID
   * @returns Promise with dataset and metadata
   */
  async getDataset(datasetId: string): Promise<{ data: Dataset | null; meta: ResponseMeta }> {
    // Call backend directly (backend route is /datasets/:id)
    return this.request<Dataset>(`/datasets/${datasetId}`);
  }

  /**
   * Run crawl job for a dataset
   * @param datasetId - Dataset UUID
   * @returns Promise with crawl job and metadata
   */
  async runCrawl(datasetId: string): Promise<{ data: CrawlJob | null; meta: ResponseMeta }> {
    // Call backend directly (backend route is /datasets/:id/crawl)
    return this.request<CrawlJob>(`/datasets/${datasetId}/crawl`, {
      method: 'POST',
    });
  }

  /**
   * Get crawl job status for a dataset
   * @param datasetId - Dataset UUID
   * @returns Promise with crawl job status and metadata
   */
  async getCrawlStatus(datasetId: string): Promise<{ data: CrawlJob[] | null; meta: ResponseMeta }> {
    // Call backend directly (backend route is /datasets/:id/crawl/status)
    return this.request<CrawlJob[]>(`/datasets/${datasetId}/crawl/status`);
  }

  /**
   * Export a dataset
   * @param datasetId - Dataset UUID
   * @param format - Export format ('csv' | 'xlsx')
   * @returns Promise with export result and metadata
   */
  async exportDataset(
    datasetId: string,
    format: 'csv' | 'xlsx'
  ): Promise<{ data: ExportResult | null; meta: ResponseMeta }> {
    // Call backend directly (backend route is /datasets/:id/export)
    return this.request<ExportResult>(`/datasets/${datasetId}/export`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    });
  }

  /**
   * Get all datasets for the current user
   * @returns Promise with datasets array and metadata
   */
  async getDatasets(): Promise<{ data: Dataset[] | null; meta: ResponseMeta }> {
    // Call backend directly (backend route is /datasets, not /api/datasets)
    return this.request<Dataset[]>('/datasets');
  }

  /**
   * Get recent contacts
   * @param limit - Number of contacts to return
   * @returns Promise with recent contacts and metadata
   */
  async getRecentContacts(limit: number = 10): Promise<{ data: Business[] | null; meta: ResponseMeta }> {
    return this.request<Business[]>(`/contacts/recent?limit=${limit}`);
  }

  /**
   * Get dataset results (businesses with crawl results)
   * @param datasetId - Dataset UUID
   * @returns Promise with businesses with crawl results and metadata
   */
  async getDatasetResults(datasetId: string): Promise<{ data: Business[] | null; meta: ResponseMeta }> {
    // Call backend directly (backend route is /datasets/:id/results)
    return this.request<Business[]>(`/datasets/${datasetId}/results`);
  }

  /**
   * Get businesses for a dataset
   * @param datasetId - Dataset UUID
   * @param params - Query parameters
   * @returns Promise with businesses and metadata
   */
  async getBusinesses(
    datasetId: string,
    params?: { page?: number; limit?: number; search?: string }
  ): Promise<{ data: Business[] | null; meta: ResponseMeta }> {
    const queryParams = new URLSearchParams();
    queryParams.set('datasetId', datasetId);
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.search) queryParams.set('search', params.search);

    const query = queryParams.toString();
    return this.request<Business[]>(`/businesses?${query}`);
  }

  /**
   * Get contacts for a business (plan-gated)
   * @param businessId - Business ID
   * @returns Promise with contacts and metadata
   */
  async getContacts(businessId: string): Promise<{ 
    data: { contacts: Array<{ type: 'email' | 'phone'; value: string; source_url: string }> } | null; 
    meta: ResponseMeta 
  }> {
    // Call backend directly (backend route is /contacts)
    return this.request<{ contacts: Array<{ type: 'email' | 'phone'; value: string; source_url: string }> }>(
      `/contacts?businessId=${businessId}`
    );
  }

  /**
   * Preview export (compute rows, apply limits, return watermark)
   * @param datasetId - Dataset UUID
   * @returns Promise with export preview and metadata
   */
  async previewExport(datasetId: string): Promise<{ 
    data: { rows_total: number; rows_to_export: number; watermark_text: string } | null; 
    meta: ResponseMeta 
  }> {
    // Call backend directly (backend route is /exports/preview)
    return this.request<{ rows_total: number; rows_to_export: number; watermark_text: string }>(
      '/exports/preview',
      {
        method: 'POST',
        body: JSON.stringify({ datasetId }),
      }
    );
  }

  /**
   * Run export (generate and download CSV/XLSX)
   * @param datasetId - Dataset UUID
   * @param format - Export format ('csv' | 'xlsx')
   * @returns Promise with export result (file download)
   */
  async runExport(
    datasetId: string,
    format: 'csv' | 'xlsx' = 'csv'
  ): Promise<Response> {
    // Call backend directly (backend route is /exports/run)
    const url = `${this.baseUrl}/exports/run`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ datasetId, format }),
      credentials: 'include', // Always send cookies for auth
    });
    
    // Handle auth errors - redirect to login
    if (response.status === 401 || response.status === 403) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      }
    }
    
    return response;
  }

  /**
   * Trigger crawl for a dataset
   * @param datasetId - Dataset UUID
   * @param options - Crawl options (maxDepth, pagesLimit)
   * @returns Promise with crawl job info and metadata
   */
  async triggerCrawl(
    datasetId: string,
    options?: { maxDepth?: number; pagesLimit?: number }
  ): Promise<{ 
    data: { job_ids: string[]; jobs_created: number; max_depth: number; pages_limit: number; message: string } | null; 
    meta: ResponseMeta 
  }> {
    // Call backend directly (backend route is /crawl)
    return this.request<{ job_ids: string[]; jobs_created: number; max_depth: number; pages_limit: number; message: string }>(
      '/crawl',
      {
        method: 'POST',
        body: JSON.stringify({ 
          datasetId, 
          maxDepth: options?.maxDepth || 2,
          pagesLimit: options?.pagesLimit,
        }),
      }
    );
  }

  /**
   * Get dashboard metrics
   * @returns Promise with dashboard statistics and metadata
   */
  async getDashboardMetrics(): Promise<{ 
    data: { 
      businesses_total: number; 
      businesses_crawled: number; 
      contacts_found: number; 
      exports_this_month: number;
      cities_scanned: number;
      last_refresh: string | null;
    } | null; 
    meta: ResponseMeta 
  }> {
    // Call backend directly (backend route is /dashboard/metrics, not /api/dashboard/metrics)
    return this.request<{ 
      businesses_total: number; 
      businesses_crawled: number; 
      contacts_found: number; 
      exports_this_month: number;
      cities_scanned: number;
      last_refresh: string | null;
    }>('/dashboard/metrics');
  }

  /**
   * Get industries list
   * @returns Promise with industries and metadata
   */
  async getIndustries(): Promise<{ data: Industry[] | null; meta: ResponseMeta }> {
    // Call backend directly
    return this.request<Industry[]>('/api/industries');
  }

  /**
   * Get cities list
   * @param countryCode - Optional country code filter
   * @returns Promise with cities and metadata
   */
  async getCities(countryCode?: string): Promise<{ data: City[] | null; meta: ResponseMeta }> {
    // Call backend directly
    const endpoint = countryCode ? `/api/cities?country=${countryCode}` : '/api/cities';
    return this.request<City[]>(endpoint);
  }

  /**
   * Get exports list
   * @param datasetId - Optional dataset ID filter
   * @returns Promise with exports and metadata
   */
  async getExports(datasetId?: string): Promise<{ data: ExportResult[] | null; meta: ResponseMeta }> {
    // Call backend directly (backend route is /exports, not /api/exports)
    const endpoint = datasetId ? `/exports?dataset=${datasetId}` : '/exports';
    return this.request<ExportResult[]>(endpoint);
  }

  /**
   * Create Stripe checkout session
   * @param planId - Plan ID (snapshot, professional, agency)
   * @param userId - User ID (not used, authenticated user ID is used server-side)
   * @returns Promise with checkout session URL
   */
  async createCheckoutSession(planId: string, userId: string): Promise<{ data: { sessionId: string; url: string } | null; meta: ResponseMeta }> {
    // Call Next.js API route (not backend) - it handles Stripe checkout
    const url = typeof window !== 'undefined' ? '/api/checkout' : `${this.baseUrl}/api/checkout`;
    console.log('[API] Creating checkout session for plan:', planId);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ planId }),
    });

    console.log('[API] Checkout response status:', response.status);

    if (!response.ok) {
      let errorMessage = 'Failed to create checkout session';
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
        console.error('[API] Checkout error:', error);
      } catch (e) {
        // If response is not JSON, use status text
        errorMessage = response.status === 503 
          ? 'Payment processing is not available. Please contact support.'
          : `HTTP ${response.status}: ${response.statusText}`;
      }
      return {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: errorMessage,
        },
      };
    }

    const json = await response.json();
    return {
      data: json,
      meta: {
        plan_id: 'demo',
        gated: false,
        total_available: 1,
        total_returned: 1,
      },
    };
  }

  /**
   * Login with email and password
   */
  async login(
    email: string,
    password: string
  ): Promise<{ data: { token?: string } | null; error?: { message: string } }> {
    try {
      const url = `${this.baseUrl}/api/auth/login`;
      console.log('[API] Login request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      console.log('[API] Login response status:', response.status);
      console.log('[API] Login response headers:', Object.fromEntries(response.headers.entries()));

      const json = await response.json().catch((err) => {
        console.error('[API] Failed to parse JSON response:', err);
        return {};
      });

      if (!response.ok) {
        const message =
          json?.error ||
          json?.message ||
          `Login failed with status ${response.status}`;
        console.error('[API] Login failed:', message);
        return {
          data: null,
          error: { message },
        };
      }

      console.log('[API] Login successful');
      return {
        data: null,
      };
    } catch (error) {
      console.error('[API] Login network error:', error);
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : 'Network error. Please try again.' },
      };
    }
  }

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string
  ): Promise<{ data: { token?: string } | null; error?: { message: string } }> {
    try {
      const url = `${this.baseUrl}/api/auth/register`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          json?.error ||
          json?.message ||
          `Registration failed with status ${response.status}`;
        return {
          data: null,
          error: { message },
        };
      }

      return {
        data: null,
      };
    } catch {
      return {
        data: null,
        error: { message: 'Network error. Please try again.' },
      };
    }
  }

  /**
   * Get current authenticated user (from JWT cookie)
   * Calls Next.js API route which proxies to backend
   */
  async getCurrentUser(): Promise<{ data: User | null; meta: ResponseMeta }> {
    // Call Next.js API route which proxies to backend
    // This is needed because Next.js can read cookies server-side
    const url = typeof window !== 'undefined' ? '/api/auth/me' : `${this.baseUrl}/api/auth/me`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get user' }));
      return {
        data: null,
        meta: {
          plan_id: 'demo',
          gated: false,
          total_available: 0,
          total_returned: 0,
          gate_reason: error.error || 'Failed to get user',
        },
      };
    }

    const json = await response.json();
    return {
      data: json.data || null,
      meta: json.meta || {
        plan_id: 'demo',
        gated: false,
        total_available: 0,
        total_returned: 0,
      },
    };
  }

  /**
   * Get current subscription information
   * @returns Promise with subscription data
   */
  async getSubscription(): Promise<{ data: Subscription | null; meta: ResponseMeta }> {
    // Call Next.js API route which proxies to backend
    const url = typeof window !== 'undefined' ? '/api/billing/subscription' : `${this.baseUrl}/api/billing/subscription`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!response.ok) {
      return { data: null, meta: { plan_id: 'demo', gated: false, total_available: 0, total_returned: 0 } };
    }
    
    const json = await response.json();
    return { data: json.data || null, meta: json.meta || { plan_id: 'demo', gated: false, total_available: 0, total_returned: 0 } };
  }

  /**
   * Get usage data for current user
   * @returns Promise with usage data
   */
  async getUsage(): Promise<{ data: UsageData | null; meta: ResponseMeta }> {
    // Call Next.js API route which proxies to backend
    const url = typeof window !== 'undefined' ? '/api/billing/usage' : `${this.baseUrl}/api/billing/usage`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!response.ok) {
      return { data: null, meta: { plan_id: 'demo', gated: false, total_available: 0, total_returned: 0 } };
    }
    
    const json = await response.json();
    return { data: json.data || null, meta: json.meta || { plan_id: 'demo', gated: false, total_available: 0, total_returned: 0 } };
  }

  /**
   * Get invoice history
   * @returns Promise with invoices array
   */
  async getInvoices(): Promise<{ data: Invoice[] | null; meta: ResponseMeta }> {
    // Call Next.js API route which proxies to backend
    const url = typeof window !== 'undefined' ? '/api/billing/invoices' : `${this.baseUrl}/api/billing/invoices`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    
    if (!response.ok) {
      return { data: null, meta: { plan_id: 'demo', gated: false, total_available: 0, total_returned: 0 } };
    }
    
    const json = await response.json();
    return { data: json.data || null, meta: json.meta || { plan_id: 'demo', gated: false, total_available: 0, total_returned: 0 } };
  }

  /**
   * Get discovery runs for a dataset
   * @param datasetId - Dataset UUID
   * @returns Promise with discovery runs and metadata
   */
  async getDiscoveryRuns(datasetId: string): Promise<{ 
    data: Array<{
      id: string;
      status: 'running' | 'completed' | 'failed';
      created_at: string;
      completed_at: string | null;
    }> | null; 
    meta: ResponseMeta 
  }> {
    // Call backend directly (backend route is /refresh?dataset_id=...)
    return this.request<Array<{
      id: string;
      status: 'running' | 'completed' | 'failed';
      created_at: string;
      completed_at: string | null;
    }>>(`/refresh?dataset_id=${datasetId}`);
  }

  /**
   * Get extraction jobs for a dataset or discovery run
   * @param params - Query parameters (datasetId or discoveryRunId)
   * @returns Promise with extraction jobs and metadata
   */
  async getExtractionJobs(params: {
    datasetId?: string;
    discoveryRunId?: string;
  }): Promise<{ 
    data: Array<{
      id: string;
      business_id: string;
      status: 'pending' | 'running' | 'success' | 'failed';
      error_message: string | null;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
    }> | null; 
    meta: ResponseMeta 
  }> {
    const queryParams = new URLSearchParams();
    if (params.datasetId) queryParams.set('datasetId', params.datasetId);
    if (params.discoveryRunId) queryParams.set('discoveryRunId', params.discoveryRunId);
    
    return this.request<Array<{
      id: string;
      business_id: string;
      status: 'pending' | 'running' | 'success' | 'failed';
      error_message: string | null;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
    }>>(`/extraction-jobs?${queryParams.toString()}`);
  }

  /**
   * Get extraction job statistics for a dataset
   * @param datasetId - Dataset UUID
   * @returns Promise with extraction statistics
   */
  async getExtractionStats(datasetId: string): Promise<{
    data: {
      total: number;
      pending: number;
      running: number;
      success: number;
      failed: number;
    } | null;
    meta: ResponseMeta;
  }> {
    return this.request<{
      total: number;
      pending: number;
      running: number;
      success: number;
      failed: number;
    }>(`/extraction-jobs/stats?datasetId=${datasetId}`);
  }

  /**
   * Get detailed business data including all contacts and social media
   * @param businessId - Business UUID
   * @returns Promise with detailed business data
   */
  async getBusinessDetails(businessId: string): Promise<{
    data: {
      id: string;
      name: string;
      address: string | null;
      postal_code: string | null;
      city: string;
      industry: string;
      google_place_id: string | null;
      website: string | null;
      emails: Array<{
        id: number;
        email: string;
        source_url: string;
        page_type: string;
        found_at: string;
      }>;
      phones: Array<{
        id: number;
        phone: string;
        source_url: string;
        page_type: string;
        found_at: string;
      }>;
      social_media: Record<string, string>;
      extraction_job: {
        id: string;
        status: string;
        error_message: string | null;
        created_at: string;
        started_at: string | null;
        completed_at: string | null;
      } | null;
      created_at: string;
      updated_at: string;
    } | null;
    meta: ResponseMeta;
  }> {
    return this.request<{
      id: string;
      name: string;
      address: string | null;
      postal_code: string | null;
      city: string;
      industry: string;
      google_place_id: string | null;
      website: string | null;
      emails: Array<{
        id: number;
        email: string;
        source_url: string;
        page_type: string;
        found_at: string;
      }>;
      phones: Array<{
        id: number;
        phone: string;
        source_url: string;
        page_type: string;
        found_at: string;
      }>;
      social_media: Record<string, string>;
      extraction_job: {
        id: string;
        status: string;
        error_message: string | null;
        created_at: string;
        started_at: string | null;
        completed_at: string | null;
      } | null;
      created_at: string;
      updated_at: string;
    }>(`/businesses/${businessId}`);
  }

  /**
   * Manually trigger extraction for a business or dataset
   * @param params - businessId or datasetId
   * @returns Promise with extraction job(s) created
   */
  async triggerExtraction(params: {
    businessId?: string;
    datasetId?: string;
  }): Promise<{
    data: {
      id?: string;
      business_id?: string;
      jobs_created?: number;
      jobs?: Array<{
        id: string;
        business_id: string;
        status: string;
      }>;
      message: string;
    } | null;
    meta: ResponseMeta;
  }> {
    return this.request<{
      id?: string;
      business_id?: string;
      jobs_created?: number;
      jobs?: Array<{
        id: string;
        business_id: string;
        status: string;
      }>;
      message: string;
    }>('/extraction-jobs', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get all businesses with detailed contacts for a dataset (optimized batch query)
   * @param datasetId - Dataset UUID
   * @returns Promise with businesses and all their contacts
   */
  async getDatasetContacts(datasetId: string): Promise<{
    data: Array<{
      id: string;
      name: string;
      address: string | null;
      website: string | null;
      emails: Array<{
        id: number;
        email: string;
        source_url: string;
        page_type: string;
        found_at: string;
      }>;
      phones: Array<{
        id: number;
        phone: string;
        source_url: string;
        page_type: string;
        found_at: string;
      }>;
      extraction_job: {
        id: string;
        status: string;
        completed_at: string | null;
      } | null;
    }> | null;
    meta: ResponseMeta;
  }> {
    return this.request<Array<{
      id: string;
      name: string;
      address: string | null;
      website: string | null;
      emails: Array<{
        id: number;
        email: string;
        source_url: string;
        page_type: string;
        found_at: string;
      }>;
      phones: Array<{
        id: number;
        phone: string;
        source_url: string;
        page_type: string;
        found_at: string;
      }>;
      extraction_job: {
        id: string;
        status: string;
        completed_at: string | null;
      } | null;
    }>>(`/businesses/dataset/${datasetId}/contacts`);
  }
}

// Export singleton instance
export const api = new ApiClient();
