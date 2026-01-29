/**
 * Application configuration
 * 
 * Production backend: https://api.leadscope.gr
 * Local dev: http://localhost:3000
 */

export const config = {
  app: {
    name: 'LeadScope AI',
    description: 'Business Contact Intelligence for Europe',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  api: {
    // NEXT_PUBLIC_API_BASE_URL should be set to https://api.leadscope.gr in production
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
    timeout: 30000, // 30 seconds
  },
  features: {
    enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  },
} as const;
