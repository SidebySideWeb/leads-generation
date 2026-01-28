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
 */
const getBaseUrl = (): string => {
  // NEXT_PUBLIC_ env vars are available in both server and client
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // Default API URL (not related to storage mode - just URL fallback)
  return typeof window === 'undefined' 
    ? 'http://localhost:3000/api' 
    : '/api';
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
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
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
   * Get dashboard statistics
   * @returns Promise with dashboard stats and metadata
   */
  async getDashboardStats(): Promise<{ data: { totalBusinesses: number; activeContacts: number; citiesScanned: number; lastRefresh: string | null } | null; meta: ResponseMeta }> {
    return this.request<{ totalBusinesses: number; activeContacts: number; citiesScanned: number; lastRefresh: string | null }>('/dashboard/stats');
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
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.search) queryParams.set('search', params.search);

    const query = queryParams.toString();
    return this.request<Business[]>(`/datasets/${datasetId}/businesses${query ? `?${query}` : ''}`);
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
   * Thin client helper; actual auth logic lives on the backend.
   */
  async login(
    email: string,
    password: string
  ): Promise<{ data: { token?: string } | null; error?: { message: string } }> {
    try {
      const url = `${this.baseUrl.replace(/\/api$/, '')}/api/auth/login`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      const token = json.token ?? json.data?.token;
      return {
        data: token ? { token } : null,
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
   * Mirrors the login helper shape.
   */
  async register(
    email: string,
    password: string
  ): Promise<{ data: { token?: string } | null; error?: { message: string } }> {
    try {
      const url = `${this.baseUrl.replace(/\/api$/, '')}/api/auth/register`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      const token = json.token ?? json.data?.token;
      return {
        data: token ? { token } : null,
      };
    } catch {
      return {
        data: null,
        error: { message: 'Network error. Please try again.' },
      };
    }
  }

  /**
   * Get current authenticated user (from JWT cookie via API route)
   */
  async getCurrentUser(): Promise<{ data: User | null; meta: ResponseMeta }> {
    return this.request<User>('/auth/user');
  }
}

// Export singleton instance
export const api = new ApiClient();
