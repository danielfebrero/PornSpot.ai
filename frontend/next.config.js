const path = require("path");
const withNextIntl = require("next-intl/plugin")(
  // This is the default path to your i18n config file
  "./src/i18n.ts"
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization - DISABLED to avoid Vercel costs
  images: {
    unoptimized: true,
    domains: [
      "localhost",
      // Add your CloudFront domain here when deployed
      process.env.NEXT_PUBLIC_CDN_URL?.replace("https://", "") ||
        "dpoieeap5d01g.cloudfront.net",

      "cdn.pornspot.ai",
    ],
    // Removed formats since we're serving unoptimized PNG, MP4, and GIF from CDN
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "pornspot.ai",
      },
      {
        protocol: "https",
        hostname: "cdn.pornspot.ai",
      },
    ],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Image cache headers - 30 days TTL
      {
        source: "/:all*.(png|jpg|jpeg|gif|webp|svg|ico|mp4)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, immutable",
          },
        ],
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
  },

  // Performance optimizations
  experimental: {
    optimizePackageImports: ["lucide-react"],
    outputFileTracingRoot: __dirname,
    // Allow importing from directories outside of the app (monorepo setup)
    externalDir: true,
  },

  // Enable static optimization and ISR
  output: "standalone", // or 'export' for full static export

  // Configure ISR behavior
  generateBuildId: async () => {
    // Use timestamp or commit hash for build ID
    return process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`;
  },

  // Compression
  compress: true,

  // Power by header
  poweredByHeader: false,
};

module.exports = withNextIntl(nextConfig);
