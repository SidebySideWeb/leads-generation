/**
 * Centralized API client for backend communication
 * Server-safe, uses fetch, throws only on network errors
 * 
 * IMPORTANT: This client works identically regardless of backend storage mode
 * (database or local fallback). All responses are normalized to { data, meta }
 * structure. The UI should never detect or depend on storage mode.
 */

import type { Dataset, Business, CrawlJob, ExportResult, ResponseMeta, Industry, City, User } from './types';

/**
 * API client configuration
 * Server-safe: uses process.env (available in both server and client in Next.js)
 * 
 * Production: https://api.leadscope.gr
 * Local dev: http://localhost:3000 (fallback)
 */
const getBaseUrl = (): string => {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://localhost:3000';
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
      const response = await fetch(url, {
        ...options,
        signal: controller?.signal,
        credentials: 'include', // Always send cookies for auth
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

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
        let errorData: { message?: string; meta?: ResponseMeta } = {};
        try {
          errorData = await response.json();
        } catch {
          // If response is not JSON, create default error structure
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
        return {
          data: (null as unknown) as T,
          meta: errorData.meta || {
            plan_id: 'demo',
            gated: false,
            total_available: 0,
            total_returned: 0,
          },
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
    industryId: number;
    cityId: number;
    datasetId?: string;
  }): Promise<{ data: Business[] | null; meta: ResponseMeta }> {
    return this.request<Business[]>('/discovery/businesses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Get a single dataset by ID
   * @param datasetId - Dataset UUID
   * @returns Promise with dataset and metadata
   */
  async getDataset(datasetId: string): Promise<{ data: Dataset | null; meta: ResponseMeta }> {
    return this.request<Dataset>(`/datasets/${datasetId}`);
  }

  /**
   * Run crawl job for a dataset
   * @param datasetId - Dataset UUID
   * @returns Promise with crawl job and metadata
   */
  async runCrawl(datasetId: string): Promise<{ data: CrawlJob | null; meta: ResponseMeta }> {
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
    return this.request<Industry[]>('/industries');
  }

  /**
   * Get cities list
   * @param countryCode - Optional country code filter
   * @returns Promise with cities and metadata
   */
  async getCities(countryCode?: string): Promise<{ data: City[] | null; meta: ResponseMeta }> {
    const endpoint = countryCode ? `/cities?country=${countryCode}` : '/cities';
    return this.request<City[]>(endpoint);
  }

  /**
   * Get exports list
   * @param datasetId - Optional dataset ID filter
   * @returns Promise with exports and metadata
   */
  async getExports(datasetId?: string): Promise<{ data: ExportResult[] | null; meta: ResponseMeta }> {
    const endpoint = datasetId ? `/exports?dataset=${datasetId}` : '/exports';
    return this.request<ExportResult[]>(endpoint);
  }

  /**
   * Create Stripe checkout session
   * @param planId - Plan ID (snapshot, professional, agency)
   * @param userId - User ID
   * @returns Promise with checkout session URL
   */
  async createCheckoutSession(planId: string, userId: string): Promise<{ data: { sessionId: string; url: string } | null; meta: ResponseMeta }> {
    // Base URL already includes `/api`, so the endpoint here is `/checkout`
    return this.request<{ sessionId: string; url: string }>('/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId, userId }),
    });
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
          `Login failed with status ${response.status}`;
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
   */
  async getCurrentUser(): Promise<{ data: User | null; meta: ResponseMeta }> {
    return this.request<User>('/api/auth/me');
  }
}

// Export singleton instance
export const api = new ApiClient();
