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
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    timeout: 30000,
  },
  features: {
    enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  },
} as const;
