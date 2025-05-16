
import { join } from 'path';
import type { NextConfig } from 'next';
import nextPWA from 'next-pwa';

// Determine if we're in production to disable PWA in development
const isProd = process.env.NODE_ENV === 'production';

// Configure next-pwa with TypeScript support
const withPWA = nextPWA({
  dest: 'public',          // Service worker and assets go into /public
  register: true,          // Auto-register the service worker
  skipWaiting: true,       // Activate SW immediately on update
  disable: !isProd,        // Disable in development
  // runtimeCaching: [ ... ], // Optional: add custom caching strategies
});

const nextConfig = withPWA({

});

export default nextConfig;
