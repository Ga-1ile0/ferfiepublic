import { join } from 'path';
import type { NextConfig } from 'next';
import nextPWA from 'next-pwa';

// Determine if we're in production to disable PWA in development
const isProd = process.env.NODE_ENV === 'production';

// Configure next-pwa with TypeScript support
const withPWA = nextPWA({
  dest: 'public', // Service worker and assets go into /public
  register: true, // Auto-register the service worker
  skipWaiting: true, // Activate SW immediately on update
  disable: !isProd, // Disable in development
  // runtimeCaching: [ ... ], // Optional: add custom caching strategies
});

const nextConfig = withPWA({
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
});

export default nextConfig;
