# Next.js 15.5.6 Upgrade Plan for PornSpot.ai

**Current Version:** Next.js 14.2.30  
**Target Version:** Next.js 15.5.6  
**Date Created:** October 18, 2025  
**Project Type:** Serverless gallery platform with i18n, TanStack Query, and AWS backend

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Breaking Changes Analysis](#breaking-changes-analysis)
3. [Pre-Upgrade Preparation](#pre-upgrade-preparation)
4. [Upgrade Steps](#upgrade-steps)
5. [Code Migration Checklist](#code-migration-checklist)
6. [Testing Strategy](#testing-strategy)
7. [Rollback Plan](#rollback-plan)
8. [Post-Upgrade Optimization](#post-upgrade-optimization)
9. [Risk Assessment](#risk-assessment)
10. [Timeline Estimate](#timeline-estimate)

---

## Executive Summary

### What's Changing

Next.js 15 introduces significant architectural improvements and breaking changes that will affect this project:

- **React 19 Support** (major): Requires React 18.2.0 → 19.x upgrade
- **Async Request APIs** (major): `headers()`, `cookies()`, `params`, `searchParams` become async
- **Turbopack Default** (major): New bundler replaces Webpack in dev mode
- **Enhanced Caching** (moderate): More granular control over fetch caching
- **Image Component Updates** (minor): Alt text now required, improved optimization
- **Middleware Changes** (minor): Enhanced config options

### Project Impact Assessment

| Area                   | Impact Level | Reason                                                |
| ---------------------- | ------------ | ----------------------------------------------------- |
| Root & Locale Layouts  | **HIGH**     | Uses `headers()` synchronously for locale detection   |
| Middleware             | **MEDIUM**   | Uses next-intl middleware, may need updates           |
| Page Components        | **HIGH**     | Dynamic routes use `params` - now async               |
| API Routes             | **LOW**      | Not heavily used (backend is AWS Lambda)              |
| Image Handling         | **LOW**      | Uses `ResponsivePicture` component, not Next.js Image |
| next-intl Integration  | **HIGH**     | Version compatibility critical for i18n               |
| TanStack Query         | **LOW**      | Compatible with React 19                              |
| Testing Infrastructure | **MEDIUM**   | Jest/Playwright may need config updates               |

---

## Breaking Changes Analysis

### 1. Async Request APIs (CRITICAL)

#### Current Usage Pattern (Root Layout)

```typescript
// frontend/src/app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers(); // ❌ BREAKING: Now async
  const locale = headersList.get("x-locale") || defaultLocale;
  // ...
}
```

#### Required Change (Root Layout)

```typescript
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers(); // ✅ Must await
  const locale = headersList.get("x-locale") || defaultLocale;
  // ...
}
```

#### Affected Files

- `/frontend/src/app/layout.tsx` - Uses `headers()` for locale
- `/frontend/src/app/[locale]/layout.tsx` - May use request APIs
- All dynamic route `page.tsx` files with `params` prop
- Any components using `cookies()` directly

### 2. Dynamic Route Params (CRITICAL)

#### Current Pattern

```typescript
// Example: frontend/src/app/[locale]/albums/[albumId]/page.tsx
export default function AlbumPage({ params }: { params: { albumId: string } }) {
  const { albumId } = params; // ❌ BREAKING: params is now async
}
```

#### Required Change

```typescript
export default async function AlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params; // ✅ Must await
}
```

#### Search Pattern to Find All Instances

```bash
# Find all files that use params or searchParams
grep -r "params:" frontend/src/app --include="*.tsx" --include="*.ts"
grep -r "searchParams:" frontend/src/app --include="*.tsx" --include="*.ts"
```

### 3. React 19 Migration

#### Key Changes

- **New APIs**: `use()` hook for reading promises/context
- **Actions**: Server Actions improvements
- **Suspense**: Enhanced error handling
- **Ref Handling**: Refs as props (no more `forwardRef` needed)
- **Hydration**: Improved error messages

#### Project Compatibility

- ✅ **TanStack Query 5.84.1**: Compatible with React 19
- ✅ **Framer Motion 10.16.5**: Compatible with React 19
- ⚠️ **next-intl 4.3.4**: May need upgrade to support Next.js 15 async APIs
- ⚠️ **react-hook-form 7.60.0**: Check for React 19 compatibility
- ⚠️ **@testing-library/react 14.1.2**: May need upgrade for React 19

### 4. Turbopack as Default Dev Bundler

#### What Changes

- Dev mode now uses Turbopack instead of Webpack by default
- Faster cold starts and hot module reloading
- Some Webpack plugins may not be compatible

#### Current Webpack Config

```javascript
// frontend/next.config.js - Lines 90-98
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
  }
  return config;
},
```

#### Action Required

- Test if Turbopack works with current setup
- Keep Webpack config for production builds
- Add fallback flag if needed: `next dev --turbopack=false`

### 5. Experimental Features Migration

#### Current Config

```javascript
experimental: {
  optimizePackageImports: ["lucide-react"],
  outputFileTracingRoot: __dirname,
  externalDir: true,
},
```

#### Next.js 15 Changes

- Some experimental features are now stable
- Check if any need to be promoted out of `experimental`

---

## Pre-Upgrade Preparation

### Phase 1: Documentation & Backup (1 day)

#### 1.1 Create Backup Branch

```bash
git checkout stage
git pull origin stage
git checkout -b nextjs-14-stable-backup
git push origin nextjs-14-stable-backup
```

#### 1.2 Document Current State

```bash
# Capture current versions
npm list react react-dom next next-intl > docs/pre-upgrade-versions.txt

# Capture current build
cd frontend
npm run build > ../docs/pre-upgrade-build.log 2>&1

# Run full test suite
npm run test:all > ../docs/pre-upgrade-tests.log 2>&1
```

#### 1.3 Audit Dependencies

```bash
# Check for React 19 compatibility
npm outdated
npx npm-check-updates
```

### Phase 2: Dependency Analysis (1 day)

#### 2.1 Critical Dependencies Check

Create `/frontend/dependency-compatibility.md`:

```markdown
# Dependency Compatibility Matrix

| Package               | Current | React 19 Ready? | Next.js 15 Ready? | Action             |
| --------------------- | ------- | --------------- | ----------------- | ------------------ |
| next-intl             | 4.3.4   | ⚠️ Check        | ⚠️ Check          | Upgrade to latest  |
| @tanstack/react-query | 5.84.1  | ✅ Yes          | ✅ Yes            | No change needed   |
| react-hook-form       | 7.60.0  | ⚠️ Check        | ✅ Yes            | Test compatibility |
| framer-motion         | 10.16.5 | ⚠️ Check        | ✅ Yes            | May need upgrade   |
| react-dropzone        | 14.2.3  | ⚠️ Check        | ✅ Yes            | Test compatibility |
| @next/third-parties   | 15.5.2  | ✅ Yes          | ✅ Yes            | Already Next.js 15 |
```

#### 2.2 Test Current Functionality

```bash
# Ensure all tests pass before upgrade
cd frontend
npm run test:ci
npm run type-check
npm run lint
npm run build
```

### Phase 3: Code Analysis (2 days)

#### 3.1 Identify All Async Conversions Needed

**Search Commands:**

```bash
# Find all headers() usage
grep -rn "headers()" frontend/src/app

# Find all cookies() usage
grep -rn "cookies()" frontend/src/app

# Find all params usage in pages
grep -rn "params:" frontend/src/app --include="**/page.tsx"

# Find all searchParams usage
grep -rn "searchParams:" frontend/src/app --include="**/page.tsx"

# Find all generateMetadata functions
grep -rn "generateMetadata" frontend/src/app
```

**Expected Files to Modify:**

- `/frontend/src/app/layout.tsx` (root layout)
- `/frontend/src/app/[locale]/layout.tsx` (locale layout)
- `/frontend/src/app/[locale]/albums/[albumId]/page.tsx` (album detail)
- `/frontend/src/app/[locale]/media/[mediaId]/page.tsx` (media detail)
- `/frontend/src/app/[locale]/profile/[username]/page.tsx` (user profile)
- All other dynamic route pages

#### 3.2 Middleware Compatibility

```bash
# Check middleware usage
cat frontend/src/middleware.ts

# Verify next-intl version supports Next.js 15
npm view next-intl versions
```

---

## Upgrade Steps

### Step 1: Create Upgrade Branch (5 minutes)

```bash
git checkout stage
git pull origin stage
git checkout -b upgrade-nextjs-15
```

### Step 2: Upgrade Core Dependencies (30 minutes)

#### 2.1 Upgrade React First

```bash
cd frontend

# Upgrade React to 19.x (RC or stable when available)
npm install react@^19.0.0 react-dom@^19.0.0

# Check for peer dependency warnings
npm install
```

#### 2.2 Upgrade Next.js

```bash
# Upgrade Next.js to 15.5.6
npm install next@15.5.6

# Upgrade next-intl for Next.js 15 compatibility
npm install next-intl@latest

# Upgrade other Next.js packages
npm install @next/third-parties@latest
npm install eslint-config-next@latest
```

#### 2.3 Upgrade Testing Libraries

```bash
# Upgrade testing libraries for React 19
npm install --save-dev @testing-library/react@latest
npm install --save-dev @testing-library/jest-dom@latest
npm install --save-dev jest-environment-jsdom@latest
```

#### 2.4 Check Peer Dependencies

```bash
npm install
npm audit

# Fix any peer dependency issues
npm install --legacy-peer-deps # If needed
```

### Step 3: Update TypeScript Configuration (15 minutes)

#### 3.1 Update `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022", // Update from ES5 to ES2022
    "lib": ["dom", "dom.iterable", "ES2023"], // Update to ES2023
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": "src",
    "paths": {
      "@/*": ["./*"]
    },
    "forceConsistentCasingInFileNames": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": [
    "node_modules",
    "src/mocks",
    "**/*.test.*",
    "**/*.spec.*",
    "__tests__"
  ]
}
```

### Step 4: Update Root Layout (30 minutes)

#### 4.1 Make Root Layout Async

```typescript
// frontend/src/app/layout.tsx
import { Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { headers } from "next/headers";
import { defaultLocale } from "@/i18n";
import { AppErrorBoundary } from "@/components/ErrorBoundaries";
import "./globals.css";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// ✅ Make function async
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ Await headers()
  const headersList = await headers();
  const locale = headersList.get("x-locale") || defaultLocale;

  return (
    <html lang={locale} className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/180.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/16.png" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Script
          src="https://code.jquery.com/jquery-3.7.1.slim.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://mapi.finby.eu/mapi5/Scripts/finby/popup.js"
          strategy="beforeInteractive"
        />
        <GoogleAnalytics gaId="G-PYFTNPNT0E" />
        <AppErrorBoundary context="Root Application">
          <iframe id="TrustPayFrame" title="Finby payment frame"></iframe>
          {children}
        </AppErrorBoundary>
      </body>
    </html>
  );
}
```

### Step 5: Update Locale Layout (45 minutes)

#### 5.1 Update Locale Layout

```bash
# Check current implementation
cat frontend/src/app/[locale]/layout.tsx
```

**Required Changes:**

1. Make layout async
2. Await `params` prop
3. Update `generateMetadata` to await params
4. Ensure all context providers remain client-side

**Pattern:**

```typescript
type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>; // ✅ Now a Promise
};

// ✅ Make async
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>; // ✅ Promise type
}): Promise<Metadata> {
  const { locale } = await params; // ✅ Await params
  const t = await getTranslations({ locale, namespace: "site" });
  // ... rest of metadata
}

// ✅ Make async
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params; // ✅ Await params

  // Get messages for NextIntlClientProvider
  const messages = await getMessages();

  // ... rest of layout
}
```

### Step 6: Update All Dynamic Route Pages (3-4 hours)

#### 6.1 Create Codemod Script

Create `/scripts/convert-pages-to-async.sh`:

```bash
#!/bin/bash

# Script to help identify files that need async conversion
# Run from project root: ./scripts/convert-pages-to-async.sh

echo "Files with params prop (need async conversion):"
grep -rn "params:" frontend/src/app --include="**/page.tsx" | grep -v "Promise"

echo ""
echo "Files with searchParams prop (need async conversion):"
grep -rn "searchParams:" frontend/src/app --include="**/page.tsx" | grep -v "Promise"

echo ""
echo "generateMetadata functions (need async conversion):"
grep -rn "generateMetadata" frontend/src/app --include="**/page.tsx"

echo ""
echo "Total files to update:"
(grep -rl "params:" frontend/src/app --include="**/page.tsx" && \
 grep -rl "searchParams:" frontend/src/app --include="**/page.tsx" && \
 grep -rl "generateMetadata" frontend/src/app --include="**/page.tsx") | sort -u | wc -l
```

#### 6.2 Update Pattern for Each Page

**Before:**

```typescript
// frontend/src/app/[locale]/albums/[albumId]/page.tsx
export default function AlbumPage({
  params,
}: {
  params: { locale: string; albumId: string };
}) {
  const { albumId } = params;
  // ... component logic
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; albumId: string };
}): Promise<Metadata> {
  const { albumId, locale } = params;
  // ... metadata logic
}
```

**After:**

```typescript
// ✅ Updated for Next.js 15
export default async function AlbumPage({
  params,
}: {
  params: Promise<{ locale: string; albumId: string }>;
}) {
  const { albumId } = await params; // ✅ Await params
  // ... component logic (same as before)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; albumId: string }>; // ✅ Promise type
}): Promise<Metadata> {
  const { albumId, locale } = await params; // ✅ Await params
  // ... metadata logic (same as before)
}
```

#### 6.3 Priority Files to Update

**Critical (affects core navigation):**

1. `/frontend/src/app/[locale]/page.tsx` - Homepage
2. `/frontend/src/app/[locale]/albums/[albumId]/page.tsx` - Album detail
3. `/frontend/src/app/[locale]/media/[mediaId]/page.tsx` - Media detail
4. `/frontend/src/app/[locale]/profile/[username]/page.tsx` - User profile

**High Priority (user features):**

1. `/frontend/src/app/[locale]/user/*/page.tsx` - User dashboard pages
2. `/frontend/src/app/[locale]/generate/*/page.tsx` - Generation features
3. `/frontend/src/app/[locale]/admin/*/page.tsx` - Admin pages

**Medium Priority (static/marketing):**

1. `/frontend/src/app/[locale]/pricing/page.tsx`
2. `/frontend/src/app/[locale]/faq/page.tsx`
3. Other static pages

### Step 7: Update Middleware (30 minutes)

#### 7.1 Check next-intl Compatibility

```bash
# Check if next-intl needs updates for Next.js 15
npm view next-intl@latest

# Update if needed
npm install next-intl@latest
```

#### 7.2 Test Middleware Config

The middleware should continue to work, but verify the config matcher:

```typescript
// frontend/src/middleware.ts
export const config = {
  // Matcher ignoring `/_next/`, `/api/`, and static assets
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp|.*\\.ico|.*\\.txt|.*\\.xml|manifest.json).*)",
  ],
};
```

### Step 8: Update next.config.js (30 minutes)

#### 8.1 Review and Update Config

```javascript
// frontend/next.config.js
const path = require("path");
const withNextIntl = require("next-intl/plugin")("./src/i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization - DISABLED to avoid Vercel costs
  images: {
    unoptimized: true,
    domains: [
      "localhost",
      process.env.NEXT_PUBLIC_CDN_URL?.replace("https://", "") ||
        "dpoieeap5d01g.cloudfront.net",
      "cdn.pornspot.ai",
    ],
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

  // Webpack configuration - Keep for production builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },

  // Performance optimizations
  experimental: {
    // ✅ Update: Remove deprecated, add new features
    optimizePackageImports: ["lucide-react", "@tanstack/react-query"],
    outputFileTracingRoot: __dirname,
    externalDir: true,

    // ✅ NEW: React 19 features (if available)
    // reactCompiler: true, // Enable when stable
  },

  transpilePackages: ["shared-types"],

  // ✅ NEW: Enhanced caching (Next.js 15 feature)
  cacheHandler:
    process.env.NODE_ENV === "production"
      ? require.resolve("./cache-handler.js")
      : undefined,
  cacheMaxMemorySize: 50 * 1024 * 1024, // 50 MB

  // ISR configuration
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`;
  },

  // Compression
  compress: true,

  // Power by header
  poweredByHeader: false,

  // ✅ NEW: Turbopack configuration
  turbo: {
    // Configure Turbopack if needed
    rules: {
      // Add custom loader rules if needed
    },
  },
};

module.exports = withNextIntl(nextConfig);
```

### Step 9: Update Testing Configuration (1 hour)

#### 9.1 Update Jest Config

```javascript
// frontend/jest.config.js
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jsdom",
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/__tests__/e2e/",
    "<rootDir>/playwright-report/",
    "<rootDir>/test-results/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/components/(.*)$": "<rootDir>/src/components/$1",
    "^@/lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@/types/(.*)$": "<rootDir>/src/types/$1",
    "^@/hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@/utils/(.*)$": "<rootDir>/src/utils/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/*.test.{js,jsx,ts,tsx}",
    "!src/**/*.spec.{js,jsx,ts,tsx}",
    "!src/**/index.{js,jsx,ts,tsx}",
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  testMatch: [
    "<rootDir>/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}",
  ],
  // ✅ Add React 19 environment options
  testEnvironmentOptions: {
    customExportConditions: ["react-server"],
  },
  transformIgnorePatterns: ["node_modules/(?!(next-intl|@tanstack)/)"],
};

module.exports = createJestConfig(customJestConfig);
```

#### 9.2 Update Jest Setup

```javascript
// frontend/jest.setup.js
import "@testing-library/jest-dom";
import "whatwg-fetch";

// ✅ Mock Next.js navigation for async params
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  })),
  usePathname: jest.fn(() => "/en"),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
}));

// ✅ Mock async headers
jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({
    get: jest.fn((key) => (key === "x-locale" ? "en" : null)),
  })),
  cookies: jest.fn(async () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key) => key,
  useLocale: () => "en",
}));

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
```

#### 9.3 Update Playwright Config

```typescript
// frontend/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./__tests__/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : 2,
  reporter: [
    ["html"],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["junit", { outputFile: "playwright-report/results.xml" }],
  ],
  use: {
    baseURL: process.env["PLAYWRIGHT_BASE_URL"] || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],
  // ✅ Ensure dev server uses new Next.js 15
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 120000,
  },
});
```

---

## Code Migration Checklist

### ✅ Core Layouts

- [ ] `/frontend/src/app/layout.tsx` - Make async, await `headers()`
- [ ] `/frontend/src/app/[locale]/layout.tsx` - Make async, await `params`
- [ ] Update all `generateMetadata` functions to await `params`

### ✅ Dynamic Routes - Albums

- [ ] `/frontend/src/app/[locale]/albums/page.tsx` - Check for `searchParams`
- [ ] `/frontend/src/app/[locale]/albums/[albumId]/page.tsx` - Await `params`
- [ ] `/frontend/src/app/[locale]/albums/[albumId]/edit/page.tsx` - Await `params`

### ✅ Dynamic Routes - Media

- [ ] `/frontend/src/app/[locale]/media/page.tsx` - Check for `searchParams`
- [ ] `/frontend/src/app/[locale]/media/[mediaId]/page.tsx` - Await `params`

### ✅ Dynamic Routes - User

- [ ] `/frontend/src/app/[locale]/profile/[username]/page.tsx` - Await `params`
- [ ] `/frontend/src/app/[locale]/user/dashboard/page.tsx` - Check for `searchParams`
- [ ] `/frontend/src/app/[locale]/user/albums/page.tsx` - Check for `searchParams`
- [ ] `/frontend/src/app/[locale]/user/liked/page.tsx` - Check for `searchParams`
- [ ] `/frontend/src/app/[locale]/user/bookmarks/page.tsx` - Check for `searchParams`

### ✅ Dynamic Routes - Admin

- [ ] `/frontend/src/app/[locale]/admin/users/page.tsx` - Check for `searchParams`
- [ ] `/frontend/src/app/[locale]/admin/albums/page.tsx` - Check for `searchParams`
- [ ] `/frontend/src/app/[locale]/admin/media/page.tsx` - Check for `searchParams`
- [ ] `/frontend/src/app/[locale]/admin/reports/page.tsx` - Check for `searchParams`

### ✅ Dynamic Routes - Generation

- [ ] `/frontend/src/app/[locale]/generate/text-to-image/page.tsx`
- [ ] `/frontend/src/app/[locale]/generate/image-to-video/page.tsx`
- [ ] `/frontend/src/app/[locale]/generate/history/page.tsx`

### ✅ Static Routes

- [ ] `/frontend/src/app/[locale]/pricing/page.tsx`
- [ ] `/frontend/src/app/[locale]/faq/page.tsx`
- [ ] `/frontend/src/app/[locale]/terms/page.tsx`
- [ ] `/frontend/src/app/[locale]/privacy/page.tsx`

### ✅ Configuration Files

- [ ] `frontend/next.config.js` - Add Next.js 15 features
- [ ] `frontend/tsconfig.json` - Update target to ES2022
- [ ] `frontend/jest.config.js` - Add React 19 support
- [ ] `frontend/jest.setup.js` - Mock async APIs
- [ ] `frontend/playwright.config.ts` - Verify compatibility

### ✅ Dependencies

- [ ] Upgrade React to 19.x
- [ ] Upgrade Next.js to 15.5.6
- [ ] Upgrade next-intl to latest compatible version
- [ ] Upgrade @testing-library/react to latest
- [ ] Check react-hook-form compatibility
- [ ] Check framer-motion compatibility
- [ ] Upgrade eslint-config-next

---

## Testing Strategy

### Phase 1: Unit Tests (2 hours)

```bash
cd frontend

# Run unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Check for React 19 deprecation warnings
npm run test:unit 2>&1 | grep -i "deprecated"
```

**Expected Issues:**

- Async `headers()` mocks may need updates
- Component tests using router may need mock updates
- Context providers may need React 19 adjustments

### Phase 2: Type Checking (30 minutes)

```bash
# Check TypeScript errors
npm run type-check

# Look for async-related errors
npm run type-check 2>&1 | grep -i "promise"
```

**Common Errors:**

```text
Type 'Promise<{ locale: string }>' is not assignable to type '{ locale: string }'
```

Fix: Update type definitions and await the promise

### Phase 3: Build Testing (1 hour)

```bash
# Clean build
npm run clean
npm run build

# Check build output
ls -lah .next/

# Test static export (if applicable)
npm run build && npm run start

# Check for warnings
npm run build 2>&1 | grep -i "warning"
```

**Success Criteria:**

- ✅ Build completes without errors
- ✅ No critical warnings about deprecated APIs
- ✅ Bundle size is reasonable (compare with previous build)
- ✅ All routes are generated

### Phase 4: Development Server (1 hour)

```bash
# Start dev server with Turbopack
npm run dev

# If issues, fallback to Webpack
NEXT_DEV_BUNDLER=webpack npm run dev
```

**Manual Tests:**

1. Homepage loads correctly (`/en`, `/de`, etc.)
2. Album detail pages work (`/en/albums/[id]`)
3. Media detail pages work (`/en/media/[id]`)
4. User profile pages work (`/en/profile/[username]`)
5. Admin pages accessible (if logged in as admin)
6. i18n language switching works
7. Navigation between pages is smooth
8. Hot reload works correctly

### Phase 5: Integration Tests (2 hours)

```bash
# Run Playwright tests
npm run test:e2e

# Run in UI mode for debugging
npm run test:e2e:ui

# Run specific test file
npx playwright test __tests__/e2e/homepage.spec.ts
```

**Critical Test Scenarios:**

- [ ] Homepage renders with correct locale
- [ ] Album gallery loads and displays media
- [ ] User can navigate to album detail
- [ ] Media lightbox opens correctly
- [ ] User authentication flow works
- [ ] Admin login and dashboard access
- [ ] Language switcher functions
- [ ] Mobile navigation works

### Phase 6: Performance Testing (1 hour)

```bash
# Build production version
npm run build

# Start production server
npm run start

# Test with Lighthouse (in browser DevTools)
# Or use CLI:
npx lighthouse http://localhost:3000/en --view
```

**Metrics to Compare (Before vs After):**

- Performance score
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Total Blocking Time (TBT)
- Cumulative Layout Shift (CLS)
- Bundle size

### Phase 7: Browser Compatibility Testing (1 hour)

**Test in:**

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile Chrome (iOS & Android)
- Mobile Safari (iOS)

**Test Scenarios:**

- Homepage rendering
- Album browsing
- Media viewing
- User interactions (like, bookmark)
- Forms (login, registration)
- Admin features

---

## Rollback Plan

### If Critical Issues Found

#### Option 1: Quick Rollback (15 minutes)

```bash
# Switch back to backup branch
git checkout nextjs-14-stable-backup

# Reinstall dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build

# Deploy previous version
# (Follow normal deployment process)
```

#### Option 2: Cherry-Pick Fixes (1-2 hours)

```bash
# Stay on upgrade branch
git checkout upgrade-nextjs-15

# Identify problematic commits
git log --oneline

# Revert specific commits
git revert <commit-hash>

# Or reset to specific commit
git reset --hard <commit-hash>

# Test again
npm run build
npm run test:all
```

#### Option 3: Fix Forward (2-4 hours)

If issues are minor, fix them on the upgrade branch:

```bash
# Common fixes needed:
# 1. Missing async/await
# 2. Type definition errors
# 3. Dependency version conflicts

# Test each fix
npm run type-check
npm run test:unit
npm run build
```

### Rollback Checklist

- [ ] Notify team of rollback
- [ ] Switch to backup branch
- [ ] Reinstall dependencies
- [ ] Verify build succeeds
- [ ] Run critical tests
- [ ] Deploy to staging
- [ ] Verify staging environment
- [ ] Update documentation with learnings
- [ ] Create GitHub issue with root cause analysis

---

## Post-Upgrade Optimization

### Phase 1: Performance Tuning (1 day)

#### 1.1 Leverage New Caching Features

```typescript
// Use enhanced fetch caching in Next.js 15
export async function fetchAlbums() {
  const res = await fetch(`${API_URL}/albums`, {
    next: {
      revalidate: 3600, // ISR with 1 hour
      tags: ["albums"], // For on-demand revalidation
    },
  });
  return res.json();
}

// On-demand revalidation
import { revalidateTag } from "next/cache";

export async function updateAlbum() {
  // ... update logic
  revalidateTag("albums"); // Revalidate all album caches
}
```

#### 1.2 Optimize Bundle Size

```bash
# Analyze bundle
npm run build
npx @next/bundle-analyzer

# Check for duplicate dependencies
npx depcheck

# Update to use dynamic imports where possible
```

#### 1.3 Enable Partial Prerendering (When Stable)

```javascript
// frontend/next.config.js
experimental: {
  ppr: true, // Partial Prerendering (experimental)
}
```

### Phase 2: React 19 Features (2 days)

#### 2.1 Adopt `use()` Hook

Replace manual promise handling with the new `use()` hook:

```typescript
// Before
const AlbumPage = async ({ params }) => {
  const { albumId } = await params;
  // ...
};

// After (when components can be async)
import { use } from "react";

const AlbumPage = ({ params }) => {
  const { albumId } = use(params); // use() hook unwraps promise
  // ...
};
```

#### 2.2 Remove `forwardRef` (If Used)

React 19 allows refs as props:

```typescript
// Before
const MyInput = forwardRef((props, ref) => {
  return <input ref={ref} {...props} />;
});

// After (React 19)
const MyInput = ({ ref, ...props }) => {
  return <input ref={ref} {...props} />;
};
```

#### 2.3 Use Server Actions More Effectively

```typescript
// Use Server Actions for form submissions
"use server";

export async function createAlbum(formData: FormData) {
  const title = formData.get("title");
  // ... create album logic
  revalidatePath("/albums");
}
```

### Phase 3: Turbopack Optimization (1 day)

#### 3.1 Profile Build Times

```bash
# Compare Webpack vs Turbopack build times
time npm run build  # Production (Webpack)
time npm run dev    # Development (Turbopack)
```

#### 3.2 Migrate Custom Webpack Plugins

If you have custom Webpack plugins, migrate to Turbopack alternatives:

```javascript
// frontend/next.config.js
turbo: {
  rules: {
    '*.svg': {
      loaders: ['@svgr/webpack'],
      as: '*.js',
    },
  },
},
```

### Phase 4: Documentation Updates (1 day)

#### 4.1 Update `/docs/FRONTEND_ARCHITECTURE.md`

Add section on Next.js 15 patterns:

```markdown
## Next.js 15 Patterns

### Async Request APIs

All `headers()`, `cookies()`, `params`, and `searchParams` are now async.

### Component Structure

- Server Components: Default, async allowed
- Client Components: Marked with `'use client'`, synchronous
- Mixed: Server components can render client components as children

### Migration Guide

See `/docs/NEXTJS_15_UPGRADE_PLAN.md` for full upgrade details.
```

#### 4.2 Update `/docs/LOCAL_DEVELOPMENT.md`

````markdown
## Development with Next.js 15

### Turbopack

Development server now uses Turbopack by default for faster HMR.

To use Webpack instead:

```bash
NEXT_DEV_BUNDLER=webpack npm run dev
```
````

### React 19

The project uses React 19, which includes new features like the `use()` hook.

#### 4.3 Create Migration Guide

Create `/docs/NEXTJS_15_MIGRATION.md` documenting:

- Breaking changes encountered
- Solutions implemented
- Lessons learned
- Best practices for future updates

---

## Risk Assessment

### High Risk Areas

| Risk                                    | Likelihood | Impact | Mitigation                               |
| --------------------------------------- | ---------- | ------ | ---------------------------------------- |
| next-intl incompatibility               | Medium     | High   | Test thoroughly, have fallback plan      |
| Async params breaking client components | High       | High   | Careful code review, extensive testing   |
| React 19 breaking hooks                 | Medium     | High   | Test all custom hooks, TanStack Query    |
| Turbopack build issues                  | Low        | Medium | Keep Webpack as fallback                 |
| Performance regression                  | Low        | High   | Benchmark before/after, lighthouse tests |
| TypeScript errors                       | High       | Medium | Incremental migration, type checking     |

### Medium Risk Areas

| Risk                                | Likelihood | Impact | Mitigation                         |
| ----------------------------------- | ---------- | ------ | ---------------------------------- |
| Testing infrastructure breaks       | Medium     | Medium | Update test configs early          |
| ESLint configuration issues         | Medium     | Low    | Update eslint-config-next          |
| Development workflow disruption     | Medium     | Medium | Clear documentation, team training |
| Third-party library incompatibility | Low        | Medium | Check compatibility matrix         |

### Low Risk Areas

| Risk                   | Likelihood | Impact | Mitigation                             |
| ---------------------- | ---------- | ------ | -------------------------------------- |
| Image component issues | Low        | Low    | Already using ResponsivePicture        |
| API routes breaking    | Low        | Low    | Backend is AWS Lambda, not Next.js API |
| Metadata generation    | Low        | Medium | Standard pattern, well documented      |

### Risk Mitigation Strategy

1. **Incremental Migration**: Do NOT upgrade everything at once
2. **Feature Branch**: Use dedicated branch with regular backups
3. **Staging Environment**: Deploy to staging before production
4. **Monitoring**: Set up error tracking in staging
5. **Rollback Plan**: Have clear rollback procedure (see above)
6. **Team Communication**: Daily updates during upgrade
7. **Documentation**: Document every issue and solution

---

## Timeline Estimate

### Total Time: 7-10 Days

#### Phase 1: Preparation (Days 1-2)

- **Day 1**: Audit dependencies, create backups, document current state
- **Day 2**: Code analysis, create migration checklist

#### Phase 2: Upgrade (Days 3-5)

- **Day 3**: Upgrade dependencies, update configurations
- **Day 4**: Migrate layouts and critical routes
- **Day 5**: Complete all route migrations, fix TypeScript errors

#### Phase 3: Testing (Days 6-7)

- **Day 6**: Unit tests, build tests, development server testing
- **Day 7**: Integration tests, E2E tests, manual QA

#### Phase 4: Optimization (Days 8-9)

- **Day 8**: Performance optimization, bundle analysis
- **Day 9**: React 19 feature adoption, Turbopack tuning

#### Phase 5: Documentation & Deployment (Day 10)

- **Day 10**: Update documentation, deploy to staging, final review

### Parallel Work Opportunities

If multiple developers available:

- **Developer 1**: Core layouts and critical routes
- **Developer 2**: User feature routes
- **Developer 3**: Admin routes and testing infrastructure
- **Developer 4**: Documentation and migration guides

---

## Quick Reference Commands

### Installation

```bash
# Upgrade core packages
npm install next@15.5.6 react@^19.0.0 react-dom@^19.0.0

# Upgrade next-intl
npm install next-intl@latest

# Upgrade testing libraries
npm install --save-dev @testing-library/react@latest
```

### Testing

```bash
# Full test suite
npm run test:all

# Type checking
npm run type-check

# Build test
npm run build

# E2E tests
npm run test:e2e
```

### Development

```bash
# Dev with Turbopack (default)
npm run dev

# Dev with Webpack
NEXT_DEV_BUNDLER=webpack npm run dev

# Production test
npm run build && npm run start
```

### Debugging

```bash
# Verbose Next.js output
NEXT_DEBUG=1 npm run dev

# React DevTools profiling
NODE_ENV=development npm run build

# Bundle analysis
npx @next/bundle-analyzer
```

---

## Success Criteria

### ✅ Upgrade Complete When

1. **All builds pass**

   - ✅ `npm run build` succeeds without errors
   - ✅ No critical warnings in build output
   - ✅ Bundle size is acceptable

2. **All tests pass**

   - ✅ Unit tests: `npm run test:unit`
   - ✅ Type checking: `npm run type-check`
   - ✅ Linting: `npm run lint`
   - ✅ E2E tests: `npm run test:e2e`

3. **Core functionality works**

   - ✅ Homepage renders correctly in all locales
   - ✅ Album browsing and detail pages work
   - ✅ Media viewing and lightbox work
   - ✅ User authentication flow works
   - ✅ Admin features accessible
   - ✅ Language switching works

4. **Performance is maintained**

   - ✅ Lighthouse score ≥ previous version
   - ✅ No significant bundle size increase
   - ✅ Page load times are comparable or better

5. **No regressions**

   - ✅ All existing features work as before
   - ✅ No new console errors or warnings
   - ✅ Mobile experience is maintained

6. **Documentation updated**
   - ✅ `/docs/FRONTEND_ARCHITECTURE.md` updated
   - ✅ `/docs/LOCAL_DEVELOPMENT.md` updated
   - ✅ Migration guide created
   - ✅ Team trained on new patterns

---

## Next Steps After Upgrade

1. **Monitor Production**

   - Set up error tracking (Sentry, LogRocket)
   - Monitor performance metrics
   - Watch for user-reported issues

2. **Adopt New Features**

   - Gradually adopt React 19 features
   - Optimize with new caching strategies
   - Explore Partial Prerendering

3. **Clean Up**

   - Remove deprecated code
   - Update dependencies to latest compatible versions
   - Archive old documentation

4. **Share Learnings**
   - Write blog post about migration
   - Update team wiki
   - Create presentation for team

---

## Resources

### Official Documentation

- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [TanStack Query React 19 Guide](https://tanstack.com/query/latest/docs/framework/react/guides/react-19)

### Community Resources

- [Next.js GitHub Discussions](https://github.com/vercel/next.js/discussions)
- [Next.js Discord](https://discord.gg/nextjs)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/next.js)

### Internal Resources

- [PornSpot.ai Frontend Architecture](/docs/FRONTEND_ARCHITECTURE.md)
- [PornSpot.ai Local Development](/docs/LOCAL_DEVELOPMENT.md)
- [PornSpot.ai Testing Guide](/docs/TESTING.md)

---

**Document Version:** 1.0  
**Last Updated:** October 18, 2025  
**Author:** GitHub Copilot  
**Status:** Ready for Review
