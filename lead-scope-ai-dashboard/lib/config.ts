/**
 * Application configuration
 */

export const config = {
  app: {
    name: 'LeadScope AI',
    description: 'Business Contact Intelligence for Europe',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    timeout: 30000, // 30 seconds
  },
  features: {
    enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  },
} as const;
