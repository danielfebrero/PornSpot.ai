# PornSpot.ai

A premium adult content gallery platform for creators and enthusiasts. Built with modern serverless architecture using AWS services and Next.js, featuring high-performance media delivery, secure content management, and responsive design optimized for adult entertainment content.

## Product Overview (Non-Technical)

PornSpot.ai is a premium destination to discover, generate, and curate adult AI visuals with a clean, fast, mobile-first experience. It is designed for two audiences:

- Creators: organize your work into albums, manage visibility, and progressively access pro-grade generation controls.
- Enthusiasts: browse, like, bookmark, and comment on high-quality content with smooth, app-like performance.

### Who It’s For

- Creators and artists who want a safe, privacy-conscious place to showcase AI artwork and short AI videos
- Enthusiasts who value an elegant UI, fast delivery via CDN, and clear safety boundaries for adult content
- Emerging professionals who need a frictionless way to try pro controls (negative prompts, LoRAs, bulk runs) and later scale

### What You Can Do

- Generate AI images and videos with simple presets or advanced controls
- Create albums, set visibility (public/private), and share
- Engage with content: like, bookmark, comment, and track view counts
- Discover content with an instant “Random” experience and curated feeds
- Enjoy a polished dark theme that feels great on mobile, tablet, and desktop

### Plans & Pricing (Summary)

- **Starter**: $9/month or $90/year (17% savings) - 200 images per month for casual users
- **Unlimited**: $20/month or $200/year (17% savings) - Unlimited images with priority generation
- **Pro**: $30/month or $300/year (17% savings) - Advanced controls with LoRAs, bulk generation, custom sizes, and private content
- **Video Credits**: Purchase video generation seconds on-demand
  - $0.89 per 5 seconds (up to 95 seconds)
  - $0.79 per 5 seconds (96-499 seconds)
  - $0.69 per 5 seconds (500+ seconds)
  - Payments processed via Visa/Mastercard through TrustPay
  - Production rollout target: October 6, 2025

Note: Payment availability may differ by environment during rollout windows.

### Trust, Safety & Compliance (18+)

- 18+ only: age verification and cookie consent flows are implemented
- Strict moderation: prompts and content are moderated; illegal content is banned
- Absolutely prohibited:
  - Any depiction involving minors (real, simulated, stylistic, or implied)
  - Non-consensual acts, sexual violence, exploitation, bestiality
  - Illegal activity or content that violates applicable law
- Consent & privacy: content that invades privacy or depicts real people without consent is not allowed
- Reporting & removal: clear pathways exist for reporting content for review and removal
- Data handling: minimal, purpose-bound data practices with performance and privacy in mind

For full legal terms and privacy details, refer to the website’s Terms and Privacy links in the footer (jurisdiction-dependent).

### Positioning

PornSpot.ai positions itself as the premium, safety-first adult AI platform that balances creative freedom with responsibility:

- Premium UX: modern, elegant interface with a fast CDN-backed experience
- Privacy-first: local environment modes and sensible data handling
- Safety-first: visible and enforced boundaries for prohibited content
- For creators: organization, visibility controls, and professional generation features
- For enthusiasts: smooth discovery, interactive engagement, and quality over noise
- Global-ready: designed for internationalization and responsive design

### PornSpotCoin (PSC) in Simple Terms

- What it is: a planned utility token for the PornSpot.ai ecosystem
- Use cases:
  - Pay for Pro subscriptions or a lifetime Pro upgrade
  - Earn rewards for engagement when the program is active (budget-based, variable rates)
- Dynamics:
  - Lifetime Pro purchases burn tokens (deflationary mechanic)
  - Off-chain balances tracked in-app; withdrawals to wallets supported
- Status & disclaimers:
  - PSC design is evolving; technical and economic details may change
  - Not investment advice; availability depends on legal/regulatory approvals
  - See the detailed principles document for the current thinking: [`docs/PORNSPOTCOIN_MAIN_PRINCIPLES.md`](docs/PORNSPOTCOIN_MAIN_PRINCIPLES.md)

### Business Model & Revenue

**Revenue Streams:**

- **Subscription Plans**: Recurring monthly/annual revenue from Starter, Unlimited, and Pro tiers
- **Video Credits**: Pay-per-use model for I2V generation with volume discounts
- **PornSpotCoin (PSC)**: Future utility token economy with burn mechanisms on lifetime upgrades
- **Enterprise/Creator Partnerships**: Custom solutions for high-volume creators (planned)

**Unit Economics:**

- **Customer Acquisition**: Freemium funnel drives trial-to-paid conversion
- **Retention Strategy**: Value ladder from Free → Starter → Unlimited → Pro encourages upgrades
- **Margin Profile**: Serverless architecture keeps variable costs low; CDN and compute are primary cost centers
- **Monetization Timeline**: New users typically upgrade within first 30-90 days based on generation needs

**Market Positioning:**

- **Target Segments**:
  - Amateur AI creators (Starter/Unlimited) - largest segment
  - Professional AI artists (Pro) - highest ARPU
  - Content consumers (Free + optional video credits) - engagement driver
- **Competitive Advantage**:
  - Premium UX vs. technical/developer-focused alternatives
  - Integrated creation-to-curation workflow vs. generation-only tools
  - Safety-first positioning vs. unmoderated platforms
  - Mobile-optimized experience vs. desktop-only competitors

**Growth Strategy:**

- **User Acquisition**: SEO, content marketing, creator partnerships, community building
- **Engagement**: Gamification, social features, quality curation, regular feature releases
- **Retention**: Progressive disclosure of features, usage-based upgrade prompts, community building
- **Expansion**: International markets, API access, white-label opportunities

### Quick Links

- Website: [pornspot.ai](https://www.pornspot.ai)
- Pricing: [pornspot.ai/pricing](https://www.pornspot.ai/pricing)
- FAQ: [pornspot.ai/faq](https://www.pornspot.ai/faq)
- Generate: [pornspot.ai/generate](https://www.pornspot.ai/generate)
- Discover: [pornspot.ai/discover](https://www.pornspot.ai/discover)

## Environments & Branching

- **Environments**: `stage` (pre-production smoke testing) and `prod` (live traffic).
- **Primary branches**: `stage` tracks the stage environment, while `master` mirrors production.
- Feature branches should target `stage`; promotion to `master` happens after stage validation.

## Architecture

- **Frontend**: Next.js 15.5.6 with TypeScript and Tailwind CSS
- **Backend**: AWS Lambda functions with TypeScript (Node.js 20.x)
- **Database**: DynamoDB with single-table design
- **Storage**: S3 with CloudFront CDN
- **Video Processing**: WAN2.2 I2V stack for AI video generation
- **Infrastructure**: AWS SAM (Serverless Application Model)

## Features

### Content Management

- 🎨 **Album Management**: Create and organize artwork into beautiful albums
- 📸 **Media Upload**: High-quality image uploads with automatic optimization
- 🌐 **CDN Delivery**: Fast global content delivery via CloudFront
- 🔒 **Privacy Controls**: Public and private album settings

### AI Image Generation

- 🤖 **AI-Powered Generation**: Advanced AI image generation with prompt support
- ⭐ **Negative Prompts**: Pro users can specify what to exclude from generated images
- 🔧 **LoRA Models**: Customizable AI models for specialized content (Pro only)
- 🛠️ **Bulk Generation**: Generate multiple variations at once (Pro only)
- 📐 **Custom Sizes**: Control exact image dimensions (Pro only)
- 🎚️ **Plan-Based Limits**:
- **Free**: 30 images/month, 1 image/day
- **Starter**: 200 images/month and day
- **Unlimited & Pro**: Unlimited images with priority generation
- 🎥 **Video Generation**: Transform images into animated videos (all plans with credits)

### AI Video Generation (I2V)

- 🎬 **WAN2.2 Technology**: Advanced AI video generation from static images
- 🎭 **Motion Control**: Precise control over actions, lighting, and pacing
- 🎪 **LoRA Triggers**: Specialized motion LoRAs for specific adult scenarios
- ⏱️ **Flexible Lengths**: 5-30 second videos with customizable duration
- 🎛️ **Advanced Settings**: Flow shift, inference steps, and CFG scale controls
- 💎 **Pro Features**: Private video generation and enhanced motion quality

### Administration & Authentication

- �👤 **Admin Panel**: Secure admin interface for content management
- 🔐 **User Authentication**: Secure authentication with plan-based permissions
- 📊 **Usage Tracking**: Monitor generation limits and subscription status
- 🏷️ **Role Management**: User, admin, and moderator role system

### Technical Features

- 📱 **Responsive Design**: Beautiful dark theme that works on all devices
- ⚡ **Serverless**: Scalable and cost-effective serverless architecture

### Content Moderation & Safety

- 🛡️ **Multi-Layer Moderation**: Automated and manual content review systems
- 🚫 **Prompt Filtering**: Real-time prompt analysis to block prohibited content before generation
- ⚠️ **Content Flagging**: User reporting system with priority review queues
- 🔍 **AI Content Detection**: Automated scanning for policy violations
- 👁️ **Manual Review**: Dedicated moderation team for flagged content
- 📋 **Moderation Dashboard**: Admin tools for reviewing, approving, or removing content
- 🔨 **Enforcement Actions**: Warning system, content removal, account suspension, and permanent bans
- 📊 **Transparency Reports**: Regular reporting on moderation actions and trends
- 🔐 **Age Verification**: Mandatory 18+ verification with cookie consent
- 🌍 **Compliance**: Adherence to international content regulations and local laws
- 📝 **Appeal Process**: Users can appeal moderation decisions for review
- 🔄 **Continuous Improvement**: Machine learning models updated based on moderation feedback

**Prohibited Content:**

- Any depiction of minors (real, simulated, or implied)
- Non-consensual acts or sexual violence
- Exploitation, bestiality, or illegal activities
- Real people depicted without consent
- Content that violates privacy or applicable law

### Analytics & Insights

- 📊 **Creator Dashboard**: Comprehensive analytics for content creators
- 👁️ **View Tracking**: Detailed view counts and engagement metrics per media/album
- 💖 **Engagement Analytics**: Track likes, bookmarks, comments, and shares
- 📈 **Growth Metrics**: Monitor follower growth and content reach over time
- 🎯 **Audience Insights**: Understand who engages with your content
- 🔥 **Trending Content**: Identify your most popular posts and optimal posting times
- 💰 **Revenue Analytics**: Track PSC earnings and subscription metrics (for creators)
- 🎨 **Generation Statistics**: Monitor AI generation usage, costs, and patterns
- 📅 **Historical Data**: Access long-term trends and comparative analysis
- 🎪 **LoRA Performance**: See which LoRA models drive the most engagement
- 🌍 **Geographic Insights**: Understand where your audience is located
- 🔔 **Real-time Notifications**: Get alerts for milestones and engagement spikes

**For Platform Admins:**

- 🎛️ **System-wide Analytics**: Platform health, usage patterns, and growth metrics
- 💵 **Revenue Tracking**: Subscription conversions, PSC economy, and financial KPIs
- 🚀 **Performance Monitoring**: API response times, error rates, and system capacity
- 🔍 **Content Insights**: Popular tags, trending content, and content quality metrics
- 👥 **User Behavior**: Registration funnels, retention cohorts, and churn analysis

### Social & Discovery

- 🔍 **Smart Discovery**: AI-powered content recommendations based on preferences and behavior
- 🎲 **Random Explore**: Serendipitous discovery with instant "Random" button for surprise content
- 🔥 **Trending Feed**: Curated feed of popular and trending content across the platform
- 👥 **Following System**: Follow favorite creators and get personalized content feeds
- 🔔 **Activity Notifications**: Real-time alerts for likes, comments, new followers, and mentions
- 💬 **Comments & Discussions**: Engage with creators and community through threaded comments
- 💖 **Like & Bookmark**: Quick engagement actions with organized bookmark collections
- 🏷️ **Tag-based Discovery**: Explore content by tags, styles, models, and categories
- 📱 **Social Sharing**: Share content to external platforms (with privacy controls)
- 🎭 **Creator Profiles**: Showcase portfolios with customizable profiles and bios
- 🌟 **Featured Content**: Curated selections highlighting exceptional work
- 🔐 **Privacy Controls**: Granular control over who can see, comment, and interact with content
- 📊 **Leaderboards**: Top creators, most liked content, and community achievements
- 🎯 **Personalized Feeds**: Machine learning-driven content curation based on engagement
- 🎪 **Collections**: Curate and share themed collections of favorite content
- 🔗 **Cross-references**: Discover related content and similar styles

**Community Features:**

- 👨‍👩‍👧‍👦 **User Interaction**: Rich social graph with follows, blocks, and mutes
- 🏆 **Achievements**: Gamification with badges and milestones for engagement
- 💎 **PSC Rewards**: Earn tokens through quality contributions and engagement
- 🎨 **Challenges & Events**: Community contests and themed generation events
- 📢 **Announcements**: Platform updates and creator spotlights

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js 20.x** and npm 10+
- **Docker** and **Docker Compose** (for LocalStack)
- **Git** (latest version)
- **AWS CLI** configured with appropriate permissions
- **AWS SAM CLI** installed
- **Python 3.x** (required for AWS SAM)

### Verification Commands

```bash
node --version    # Should be 20+
npm --version     # Should be 10+
docker --version
docker-compose --version
git --version
aws --version
sam --version
python3 --version
```

### Installation Links

- [Node.js](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [AWS CLI](https://aws.amazon.com/cli/)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/danielfebrero/PornSpot.ai.git
cd PornSpot.ai
```

### 2. Install Dependencies

Install dependencies in the correct order for this monorepo:

```bash
# 1. Install root monorepo dependencies
npm install

# 2. Install all workspace dependencies
npm run install:all

# 3. Install scripts dependencies
cd scripts && npm install && cd ..
```

> **Note**: Always use `npm run install:all` instead of manually installing workspace dependencies. This ensures all workspaces (backend and frontend) are installed correctly.

## Environment Setup

The project uses a modular environment setup, with separate configurations for the frontend, backend, and scripts.

### 1. Frontend Setup

Create a local environment file for the frontend by copying the example:

```bash
cp frontend/.env.example frontend/.env.local
```

Then, fill in the required variables in `frontend/.env.local`.

### 2. Backend Deployment Parameters

The backend runs only in deployed environments. Environment configuration is handled via SAM parameter overrides (`samconfig.toml`) and AWS resources. A local `.env.local.json` is **not required** unless you are reviving the deprecated SAM/LocalStack workflow.

If you need to inspect the legacy file for reference:

```bash
cp backend/.env.example.json backend/.env.local.json  # Optional, legacy only
```

### 3. Scripts Setup (Optional)

Scripts that interact with LocalStack are currently paused. If you are working on restoring them, you can copy the example file:

```bash
cp scripts/.env.example scripts/.env.local
```

Otherwise, this step can be skipped.

### 4. AWS Credentials

Ensure your AWS CLI is configured, as some scripts and local services rely on it:

```bash
aws configure
```

> **Detailed Configuration**: See [`docs/ENVIRONMENT_CONFIGURATION.md`](docs/ENVIRONMENT_CONFIGURATION.md) for a complete guide to all environment variables.

## Local Development

Only the frontend supports local development today. The backend must run in a deployed environment (stage or prod).

### Frontend Workflow

- Ensure dependencies are installed (`npm install` followed by `npm run install:all`).
- Duplicate `frontend/.env.example` into `frontend/.env.local` and point `NEXT_PUBLIC_API_BASE_URL` at the desired remote backend (stage or prod).
- Start the frontend server:

```bash
npm run dev:frontend
```

The frontend is available at <http://localhost:3000> and proxies API calls to the configured remote backend.

### Backend Access

> Local backend development via SAM/LocalStack is currently **not supported**. Use the shared stage environment for testing server interactions or deploy to prod when releasing.

- To validate backend changes, deploy to `stage` and test against that environment.
- Scripts under `scripts/` (for LocalStack, SAM, etc.) remain in the repository but are considered deprecated until local backend support returns.

## Development Workflow

### Backend Development

- Lambda functions live in [`backend/functions/`](backend/functions/).
- Shared utilities reside in [`backend/shared/`](backend/shared/).
- Validate changes by deploying to the stage environment (`npm run deploy:backend:stage`).
- Local SAM/LocalStack flows are archived and not part of the active workflow.

### Frontend Development

- Components in [`frontend/src/components/`](frontend/src/components/)
- Pages in [`frontend/src/app/`](frontend/src/app/)
- Hot Module Replacement (HMR) enabled - changes reflect automatically

### Available Scripts

```bash
# Development
npm run dev:frontend         # Start frontend dev server

# Backend deployment
npm run deploy:backend:stage # Deploy backend to stage
npm run deploy:backend:prod  # Deploy backend to prod

# Building
npm run build               # Build both projects
npm run build:backend       # Build backend only
npm run build:frontend      # Build frontend only

# Linting
npm run lint               # Lint all projects
npm run lint:fix           # Fix linting issues

# Type checking
npm run type-check         # Run TypeScript checks across workspaces

# Utilities (legacy)
# npm run db:setup         # Local DynamoDB setup via LocalStack (deprecated)
# npm run local:init       # Local AWS resource bootstrap (deprecated)
```

## Testing

⚠️ Automated testing is **not supported** yet. The command stubs remain in `package.json`, but they are intentionally disabled while the new infrastructure is designed.

- Do **not** run `npm run test*` scripts; they will fail.
- Use linting and type-checking as the current safety net: `npm run lint` and `npm run type-check`.
- All coverage reports and CI test gates are paused until the new solution ships.
- Outdated testing docs are kept for reference but do not reflect the current workflow.

## Deployment

The platform currently deploys to two environments: **stage** (pre-production) and **prod** (live).

### Prerequisites for Deployment

- Completed installation and environment setup
- AWS CLI configured with deployment permissions
- Environment-specific configuration files

### Backend Deployment

1. **Deploy to stage**

   ```bash
   npm run deploy:backend:stage
   ```

1. **Deploy to prod**

   ```bash
   npm run deploy:backend:prod
   ```

The deployment scripts set the `ENVIRONMENT` variable under the hood and run `./scripts/deploy-backend.sh`.

### Frontend Deployment

```bash
cd frontend
npm run build
vercel --prod
```

- Use a Vercel preview for stage validation.
- Promote the same build to production with `vercel --prod` once verified.

For detailed deployment instructions, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Project Structure

```text
PornSpot.ai/
│
├── 📂 .github/                          # GitHub configuration
│   ├── chatmodes/                       # Chat mode configurations
│   ├── copilot-instructions.md          # GitHub Copilot instructions
│   ├── instructions/                    # Development instructions
│   ├── web-agent/                       # Web agent configurations
│   └── workflows/                       # GitHub Actions workflows
│
├── 📂 .husky/                           # Git hooks
├── 📂 .kiro/                            # Kiro configurations
├── 📂 .vscode/                          # VS Code workspace settings
├── 📂 .aws-sam/                         # SAM build artifacts
│
├── 📂 backend/                          # AWS Lambda Backend (Node.js 20.x)
│   ├── 📂 functions/                    # Lambda function handlers
│   │   ├── ConfigureS3Notification/     # S3 event configuration
│   │   ├── admin/                       # Admin management functions
│   │   ├── albums/                      # Album CRUD operations
│   │   ├── analytics/                   # Analytics & insights
│   │   ├── config/                      # Configuration handlers
│   │   ├── content/                     # Content management
│   │   ├── discover/                    # Content discovery
│   │   ├── finby/                       # Finby integration
│   │   ├── generation/                  # AI image/video generation
│   │   ├── media/                       # Media upload/processing
│   │   ├── moderator/                   # Moderation functions
│   │   ├── psc/                         # PornSpotCoin operations
│   │   ├── scheduled-emails/            # Email notifications
│   │   ├── scheduled-jobs/              # Cron jobs
│   │   ├── trustpay/                    # Payment processing
│   │   ├── user/                        # User management
│   │   └── websocket/                   # WebSocket API
│   │
│   ├── 📂 shared/                       # Shared backend utilities
│   │   ├── auth/                        # Authentication middleware
│   │   ├── email_templates/             # Email HTML templates
│   │   ├── instructions/                # AI instruction sets
│   │   ├── services/                    # Shared services
│   │   │   ├── comfyui-client.ts        # ComfyUI integration
│   │   │   ├── comfyui-connection-pool.ts
│   │   │   ├── generation-queue.ts      # Generation job queue
│   │   │   ├── openrouter-chat.ts       # OpenRouter AI chat
│   │   │   ├── prompt-processing.ts     # Prompt validation
│   │   │   ├── pscRateSnapshotService.ts # PSC rate tracking
│   │   │   ├── s3-storage.ts            # S3 operations
│   │   │   └── simple-rate-limiting.ts  # Rate limiting
│   │   ├── shared-types/                # Copied from root /shared-types
│   │   ├── templates/                   # Code/config templates
│   │   ├── utils/                       # Utility functions
│   │   │   ├── analytics.ts             # Analytics helpers
│   │   │   ├── authorizer.ts            # Lambda authorizer
│   │   │   ├── avatar-thumbnail.ts      # Avatar processing
│   │   │   ├── counter.ts               # View counter
│   │   │   ├── cover-thumbnail.ts       # Cover image processing
│   │   │   ├── dynamodb.ts              # DynamoDB service
│   │   │   ├── dynamodb-discover.ts     # Discovery queries
│   │   │   ├── dynamodb-following-feed.ts # Feed queries
│   │   │   ├── email.ts                 # Email service (SES)
│   │   │   ├── emailTemplates.ts        # Email template loader
│   │   │   ├── finby.ts                 # Finby utilities
│   │   │   ├── i2v-loras-selection.ts   # I2V LoRA selection
│   │   │   ├── ip-extraction.ts         # IP address extraction
│   │   │   ├── lambda-handler.ts        # Lambda wrapper utilities
│   │   │   ├── media-entity.ts          # Media entity helpers
│   │   │   ├── media.ts                 # Media utilities
│   │   │   ├── notification-email-helpers.ts
│   │   │   ├── oauth-user.ts            # OAuth user handling
│   │   │   ├── order-items.ts           # Ordering utilities
│   │   │   ├── pagination.ts            # Pagination helpers
│   │   │   ├── parameters.ts            # Parameter extraction
│   │   │   ├── permissions.json         # Plan/role definitions
│   │   │   ├── permissions.ts           # Permission checks
│   │   │   ├── plan.ts                  # Subscription plan logic
│   │   │   ├── prompt-settings-generator.ts
│   │   │   ├── psc-integration.ts       # PSC economy integration
│   │   │   ├── psc-payout.ts            # PSC reward payouts
│   │   │   ├── psc-transactions.ts      # PSC transaction handling
│   │   │   ├── response.ts              # Response utilities
│   │   │   ├── revalidation.ts          # ISR revalidation
│   │   │   ├── s3.ts                    # S3 client
│   │   │   ├── session.ts               # Session management
│   │   │   ├── thumbnail.ts             # Thumbnail generation
│   │   │   ├── trustpay.ts              # TrustPay integration
│   │   │   ├── user-auth.ts             # User authentication
│   │   │   ├── user.ts                  # User utilities
│   │   │   ├── username-generator.ts    # Random username generation
│   │   │   ├── validation.ts            # Input validation
│   │   │   ├── websocket-ip-analysis.ts # WebSocket IP tracking
│   │   │   └── workflow-nodes.ts        # ComfyUI workflow nodes
│   │   └── index.ts                     # Shared exports
│   │
│   ├── 📂 __tests__/                    # Backend tests (legacy/disabled)
│   ├── 📂 coverage/                     # Test coverage reports
│   ├── 📂 dist/                         # Compiled JavaScript output
│   ├── Dockerfile                       # Lambda container image
│   ├── build-docker-lambdas.sh          # Docker build script
│   ├── jest.config.js                   # Jest configuration
│   ├── package.json                     # Backend dependencies
│   └── tsconfig.json                    # TypeScript config
│
├── 📂 frontend/                         # Next.js 15 Frontend
│   ├── 📂 src/
│   │   ├── 📂 app/                      # Next.js App Router
│   │   │   ├── 📂 [locale]/             # Internationalized routes
│   │   │   │   ├── admin/               # Admin dashboard pages
│   │   │   │   ├── albums/              # Album pages
│   │   │   │   ├── auth/                # Authentication pages
│   │   │   │   ├── faq/                 # FAQ page
│   │   │   │   ├── generate/            # AI generation interface
│   │   │   │   ├── i2v/                 # Image-to-Video pages
│   │   │   │   ├── media/               # Media detail pages
│   │   │   │   ├── our-friends/         # Partners page
│   │   │   │   ├── payment/             # Payment pages
│   │   │   │   ├── pornspotcoin/        # PSC pages
│   │   │   │   ├── pricing/             # Pricing page
│   │   │   │   ├── privacy/             # Privacy policy
│   │   │   │   ├── profile/             # User profile
│   │   │   │   ├── random/              # Random content page
│   │   │   │   ├── settings/            # User settings
│   │   │   │   ├── terms/               # Terms of service
│   │   │   │   ├── user/                # User pages
│   │   │   │   ├── layout.tsx           # Locale-specific layout
│   │   │   │   └── page.tsx             # Home page
│   │   │   ├── api/                     # API route handlers
│   │   │   ├── globals.css              # Global styles
│   │   │   ├── layout.tsx               # Root layout
│   │   │   ├── page.tsx                 # Root redirect
│   │   │   └── sitemap.ts               # Sitemap generation
│   │   │
│   │   ├── 📂 components/               # React components
│   │   │   ├── admin/                   # Admin components
│   │   │   ├── age-gate/                # Age verification
│   │   │   ├── albums/                  # Album components
│   │   │   ├── i2v/                     # I2V components
│   │   │   ├── layouts/                 # Layout components
│   │   │   ├── pornspotcoin/            # PSC components
│   │   │   ├── profile/                 # Profile components
│   │   │   ├── ui/                      # Reusable UI components
│   │   │   │   ├── AlertDialog.tsx      # Confirmation dialogs
│   │   │   │   ├── Avatar.tsx           # User avatars
│   │   │   │   ├── Badge.tsx            # Badges
│   │   │   │   ├── Button.tsx           # Buttons
│   │   │   │   ├── Card.tsx             # Cards
│   │   │   │   ├── Comment.tsx          # Comment component
│   │   │   │   ├── CommentCard.tsx      # Comment card
│   │   │   │   ├── Comments.tsx         # Comments section
│   │   │   │   ├── ConfirmDialog.tsx    # Confirmation dialog
│   │   │   │   ├── ContentCard.tsx      # Content card
│   │   │   │   ├── DesktopNavigation.tsx # Desktop nav
│   │   │   │   ├── EditTitleDialog.tsx  # Title editor
│   │   │   │   ├── GenerationProgressCard.tsx
│   │   │   │   ├── GradientTextarea.tsx # Styled textarea
│   │   │   │   ├── HorizontalScroll.tsx # Horizontal scroll
│   │   │   │   ├── Input.tsx            # Input fields
│   │   │   │   ├── InvitationWall.tsx   # Invitation gate
│   │   │   │   ├── Label.tsx            # Labels
│   │   │   │   ├── Lightbox.tsx         # Image lightbox
│   │   │   │   ├── LocaleLink.tsx       # I18n-aware links
│   │   │   │   ├── MagicText.tsx        # Animated text
│   │   │   │   ├── MediaPlayer.tsx      # Video player
│   │   │   │   ├── MobileNavigation.tsx # Mobile nav
│   │   │   │   ├── NavigationLoadingOverlay.tsx
│   │   │   │   ├── NavigationSkeletons.tsx
│   │   │   │   ├── NotificationButton.tsx
│   │   │   │   ├── Progress.tsx         # Progress bars
│   │   │   │   ├── ResponsivePicture.tsx # Responsive images
│   │   │   │   ├── Select.tsx           # Dropdowns
│   │   │   │   ├── ShareDropdown.tsx    # Share menu
│   │   │   │   ├── Skeleton.tsx         # Loading skeletons
│   │   │   │   ├── Slider.tsx           # Range sliders
│   │   │   │   ├── SortTabs.tsx         # Sort tabs
│   │   │   │   ├── Switch.tsx           # Toggle switches
│   │   │   │   ├── Tag.tsx              # Tags
│   │   │   │   ├── TagManager.tsx       # Tag management
│   │   │   │   ├── TemporaryTooltip.tsx # Tooltips
│   │   │   │   ├── Textarea.tsx         # Text areas
│   │   │   │   ├── Tooltip.tsx          # Tooltips
│   │   │   │   ├── ViewCount.tsx        # View counter
│   │   │   │   ├── ViewTracker.tsx      # View tracking
│   │   │   │   ├── VirtualizedCommentsList.tsx
│   │   │   │   └── VirtualizedGrid.tsx  # Virtualized grid
│   │   │   ├── user/                    # User components
│   │   │   └── [various client components]
│   │   │
│   │   ├── 📂 contexts/                 # React contexts
│   │   │   ├── AdminContext.tsx         # Admin state
│   │   │   ├── DeviceContext.tsx        # Device detection
│   │   │   ├── GenerationContext.tsx    # Generation state
│   │   │   ├── InvitationContext.tsx    # Invitation system
│   │   │   ├── NavigationLoadingContext.tsx
│   │   │   ├── PermissionsContext.tsx   # User permissions
│   │   │   ├── PrefetchContext.tsx      # Prefetch management
│   │   │   ├── ReturnUrlContext.tsx     # Return URL tracking
│   │   │   ├── ScrollRestorationContext.tsx
│   │   │   ├── UserContext.tsx          # User state
│   │   │   └── WebSocketContext.tsx     # WebSocket connection
│   │   │
│   │   ├── 📂 hooks/                    # Custom React hooks
│   │   │   ├── admin/                   # Admin hooks
│   │   │   ├── queries/                 # TanStack Query hooks
│   │   │   ├── useAdvancedGestures.ts   # Gesture handling
│   │   │   ├── useAuthRedirect.ts       # Auth redirects
│   │   │   ├── useContainerDimensions.ts # Container sizing
│   │   │   ├── useDateUtils.ts          # Date utilities
│   │   │   ├── useDocumentHeadAndMeta.ts # Meta tags
│   │   │   ├── useDocumentTitle.ts      # Document title
│   │   │   ├── useGoogleAuth.ts         # Google OAuth
│   │   │   ├── useIntersectionObserver.ts # Intersection observer
│   │   │   ├── useLightboxPreloader.ts  # Image preloading
│   │   │   ├── useScrollRestoration.ts  # Scroll position
│   │   │   ├── useSleepPrevention.ts    # Screen wake lock
│   │   │   ├── useSwipeGesture.ts       # Swipe gestures
│   │   │   ├── useTemporaryTooltip.ts   # Tooltip state
│   │   │   ├── useUserPermissions.ts    # Permission checks
│   │   │   └── useUsernameAvailability.ts
│   │   │
│   │   ├── 📂 lib/                      # Libraries & utilities
│   │   │   ├── 📂 api/                  # API client methods
│   │   │   │   ├── admin-albums.ts      # Admin album API
│   │   │   │   ├── admin-analytics.ts   # Admin analytics API
│   │   │   │   ├── admin-media.ts       # Admin media API
│   │   │   │   ├── admin-psc.ts         # Admin PSC API
│   │   │   │   ├── admin-users.ts       # Admin user API
│   │   │   │   ├── albums.ts            # Album API
│   │   │   │   ├── content.ts           # Content API
│   │   │   │   ├── discover.ts          # Discovery API
│   │   │   │   ├── finby.ts             # Finby API
│   │   │   │   ├── generate.ts          # Generation API
│   │   │   │   ├── interactions.ts      # Interaction API
│   │   │   │   ├── media.ts             # Media API
│   │   │   │   ├── psc.ts               # PSC API
│   │   │   │   ├── trustpay.ts          # Payment API
│   │   │   │   ├── user.ts              # User API
│   │   │   │   └── index.ts             # API exports
│   │   │   ├── api-util.ts              # API utilities
│   │   │   ├── data.ts                  # Data utilities
│   │   │   ├── dateUtils.ts             # Date formatting
│   │   │   ├── deviceUtils.ts           # Device detection
│   │   │   ├── navigation.ts            # Navigation helpers
│   │   │   ├── opengraph.ts             # OG tag generation
│   │   │   ├── queryClient.ts           # TanStack Query client
│   │   │   ├── urlUtils.ts              # URL composition
│   │   │   ├── userUtils.ts             # User utilities
│   │   │   └── utils.ts                 # General utilities
│   │   │
│   │   ├── 📂 locales/                  # i18n translation files
│   │   ├── 📂 constants/                # Application constants
│   │   ├── 📂 mocks/                    # Mock data for testing
│   │   ├── 📂 providers/                # Context providers
│   │   ├── 📂 types/                    # Frontend types
│   │   ├── 📂 utils/                    # Utility functions
│   │   ├── i18n.ts                      # i18n configuration
│   │   └── middleware.ts                # Next.js middleware
│   │
│   ├── 📂 public/                       # Static assets
│   │   ├── our-friends/                 # Partner logos
│   │   ├── favicon.ico                  # Favicon
│   │   ├── logo.svg                     # Logo
│   │   ├── manifest.json                # PWA manifest
│   │   ├── robots.txt                   # SEO robots
│   │   └── [various icons]
│   │
│   ├── 📂 __tests__/                    # Frontend tests (legacy)
│   ├── .env.example                     # Environment template
│   ├── .env.local                       # Local environment
│   ├── jest.config.js                   # Jest configuration
│   ├── jest.setup.js                    # Jest setup
│   ├── next.config.js                   # Next.js config
│   ├── package.json                     # Frontend dependencies
│   ├── playwright.config.ts             # Playwright E2E config
│   ├── postcss.config.js                # PostCSS config
│   ├── tailwind.config.js               # Tailwind CSS config
│   └── tsconfig.json                    # TypeScript config
│
├── 📂 scripts/                          # Deployment & maintenance scripts
│   ├── 📂 node_modules/                 # Script dependencies
│   ├── .env.example                     # Script env template
│   ├── .env.dev                         # Dev environment
│   ├── .env.stage                       # Stage environment
│   ├── .env.prod                        # Prod environment
│   ├── deploy-backend.sh                # Backend deployment
│   ├── deploy-frontend.sh               # Frontend deployment
│   ├── deploy.sh                        # Full deployment
│   ├── init-local-aws.sh                # LocalStack setup (deprecated)
│   ├── create-dynamodb-table.js         # Table creation
│   ├── setup-local-db.js                # Local DB setup (deprecated)
│   ├── create-admin.js                  # Admin user creation
│   ├── set-admin-role.js                # Role assignment
│   ├── update-user-plan.js              # Plan updates
│   ├── backfill-*.js                    # Data migration scripts
│   ├── cleanup-*.js                     # Cleanup utilities
│   ├── migrate-*.js                     # Migration scripts
│   ├── test-*.js                        # Test utilities
│   ├── psc-*.js                         # PSC analytics
│   └── [many more utility scripts]
│
├── 📂 shared-types/                     # Shared TypeScript types
│   ├── admin.ts                         # Admin types
│   ├── album.ts                         # Album types
│   ├── analytics.ts                     # Analytics types
│   ├── comfyui-events.ts                # ComfyUI event types
│   ├── comment.ts                       # Comment types
│   ├── core.ts                          # Core types
│   ├── database.ts                      # Database types
│   ├── discover.ts                      # Discovery types
│   ├── finby.ts                         # Finby types
│   ├── generation.ts                    # Generation types
│   ├── interaction.ts                   # Interaction types
│   ├── media.ts                         # Media types
│   ├── notification.ts                  # Notification types
│   ├── openrouter.ts                    # OpenRouter types
│   ├── permissions.ts                   # Permission types
│   ├── pornspotcoin.ts                  # PSC types
│   ├── user.ts                          # User types
│   ├── websocket.ts                     # WebSocket types
│   └── index.ts                         # Type exports
│
├── 📂 docs/                             # Documentation (70+ files)
│   ├── ARCHITECTURE.md                  # System architecture
│   ├── API.md                           # API documentation
│   ├── DATABASE_SCHEMA.md               # Database design
│   ├── DEPLOYMENT.md                    # Deployment guide
│   ├── FRONTEND_ARCHITECTURE.md         # Frontend patterns
│   ├── LOCAL_DEVELOPMENT.md             # Dev setup
│   ├── TESTING.md                       # Testing guide
│   ├── PERMISSION_SYSTEM.md             # Permissions & plans
│   ├── USER_AUTHENTICATION.md           # Auth flows
│   ├── ANALYTICS_ARCHITECTURE.md        # Analytics system
│   ├── PORNSPOTCOIN_MAIN_PRINCIPLES.md  # PSC tokenomics
│   └── [60+ more documentation files]
│
├── 📂 runpod-monitor/                   # RunPod monitoring service
│   ├── comfyui_monitor.py               # Monitor script
│   ├── test_monitor.py                  # Monitor tests
│   ├── test_monitor_events.py           # Event tests
│   ├── quick-start.sh                   # Quick setup
│   ├── setup.sh                         # Installation
│   ├── setup-docker.sh                  # Docker setup
│   ├── requirements.txt                 # Python dependencies
│   └── README.md                        # Monitor docs
│
├── 📂 PornSpotCoin/                     # PSC token research (empty)
│
├── 📂 TODO/                             # Project backlog
│   ├── 01-TESTING-INFRASTRUCTURE.md     # Testing roadmap
│   ├── 02-CODE-QUALITY.md               # Quality improvements
│   ├── 03-BUILD-SYSTEM.md               # Build optimization
│   ├── 04-DEPENDENCY-MANAGEMENT.md      # Dependency updates
│   ├── 05-PERFORMANCE-OPTIMIZATION.md   # Performance tasks
│   ├── 06-DOCUMENTATION-CONSISTENCY.md  # Doc improvements
│   ├── 07-INFRASTRUCTURE-MODERNIZATION.md
│   ├── 08-SECURITY-ENHANCEMENTS.md      # Security tasks
│   ├── 09-ARCHITECTURAL-IMPROVEMENTS.md # Architecture tasks
│   ├── NEXTJS_15_UPGRADE_CHECKLIST.md   # Next.js upgrade
│   └── README.md                        # Backlog overview
│
├── 📂 media/                            # Sample media assets
│
├── 📄 Configuration Files
│   ├── .gitignore                       # Git ignore patterns
│   ├── .vercelignore                    # Vercel ignore patterns
│   ├── docker-compose.local.yml         # LocalStack (deprecated)
│   ├── docker-compose.test.yml          # Test compose (legacy)
│   ├── jest.config.root.js              # Root Jest config
│   ├── package.json                     # Root workspace config
│   ├── package-lock.json                # Dependency lock
│   ├── samconfig.toml                   # SAM deployment config
│   ├── template.yaml                    # AWS SAM template
│   └── turbo.json                       # Turborepo config
│
├── 📄 Documentation
│   ├── README.md                        # Main documentation
│   ├── TODO.md                          # Quick TODO list
│   └── BUGS.md                          # Known issues
│
└── 📂 Generated/Cache Folders
    ├── .aws-sam/                        # SAM build cache
    ├── .next/                           # Next.js build
    ├── .turbo/                          # Turbo cache
    ├── .vercel/                         # Vercel deployment
    ├── node_modules/                    # Dependencies
    └── coverage/                        # Test coverage
```

### Key Architecture Components

**Backend Lambda Functions** (17 domains):

- **Admin**: User/content management
- **Albums**: CRUD operations
- **Analytics**: Metrics & insights
- **Content**: Content management
- **Discover**: Content discovery
- **Finby**: Integration services
- **Generation**: AI image/video creation
- **Media**: Upload/processing
- **Moderator**: Content moderation
- **PSC**: Token economy
- **Scheduled Jobs**: Cron tasks
- **Scheduled Emails**: Notifications
- **TrustPay**: Payment processing
- **User**: User operations
- **WebSocket**: Real-time communication

**Frontend Pages** (20+ routes):

- Admin dashboard, Albums & media, AI generation interface
- I2V (Image-to-Video), User profiles & settings
- Payment & pricing, PornSpotCoin, Authentication
- Legal pages (privacy, terms), Discovery & random

**Shared Infrastructure**:

- **70+ documentation files** covering all aspects
- **Shared types** synchronized between backend/frontend
- **100+ utility scripts** for deployment, migration, testing
- **Comprehensive API layer** with centralized methods
- **Internationalization** support via next-intl

## Reference Documentation

### Core Documentation

- [`docs/API.md`](docs/API.md) - Complete API documentation
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) - Database schema and design
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - System architecture overview
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) - Deployment guide and instructions

### Development & Testing

- [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md) - Local development setup
- [`docs/ENVIRONMENT_CONFIGURATION.md`](docs/ENVIRONMENT_CONFIGURATION.md) - Environment variables and configuration
- [`docs/TESTING.md`](docs/TESTING.md) - Testing guide ⚠️ **Outdated - tests currently broken**

### User & Admin Management

- [`docs/USER_MANAGEMENT.md`](docs/USER_MANAGEMENT.md) - User management and admin setup
- [`docs/ADMIN_AUTH.md`](docs/ADMIN_AUTH.md) - Admin authentication system
- [`docs/USER_AUTHENTICATION.md`](docs/USER_AUTHENTICATION.md) - User authentication flows
- [`docs/USER_INTERACTIONS.md`](docs/USER_INTERACTIONS.md) - User interaction patterns
- [`docs/PERMISSION_SYSTEM.md`](docs/PERMISSION_SYSTEM.md) - Centralized permission system and plan management

### Frontend & UI

- [`docs/FRONTEND_ARCHITECTURE.md`](docs/FRONTEND_ARCHITECTURE.md) - Frontend architecture and patterns
- [`docs/RESPONSIVE_PICTURE_IMPLEMENTATION.md`](docs/RESPONSIVE_PICTURE_IMPLEMENTATION.md) - Responsive image implementation

### Media & Performance

- [`docs/MEDIA_UPLOAD_FLOW.md`](docs/MEDIA_UPLOAD_FLOW.md) - Media upload process and optimization
- [`docs/THUMBNAIL_SYSTEM.md`](docs/THUMBNAIL_SYSTEM.md) - Thumbnail generation and management
- [`docs/THUMBNAIL_MIGRATION.md`](docs/THUMBNAIL_MIGRATION.md) - Thumbnail migration procedures
- [`docs/CACHING_STRATEGY.md`](docs/CACHING_STRATEGY.md) - Caching implementation and strategy
- [`docs/PERFORMANCE_GUIDE.md`](docs/PERFORMANCE_GUIDE.md) - Performance optimization guide

### Integration & Third-party

- [`docs/OAUTH_INTEGRATION.md`](docs/OAUTH_INTEGRATION.md) - OAuth integration documentation
- [`docs/SHARP_LAMBDA_FIX.md`](docs/SHARP_LAMBDA_FIX.md) - Sharp image processing in Lambda

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request targeting `stage`; the release manager will promote to `master` after stage verification

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.
