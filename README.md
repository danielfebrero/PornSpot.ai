# PornSpot.ai

A premium adult content gallery platform for creators and enthusiasts. Built with modern serverless architecture using AWS services and Next.js, featuring high-performance media delivery, secure content management, and responsive design optimized for adult entertainment content.

## Architecture

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: AWS Lambda functions with TypeScript
- **Database**: DynamoDB with single-table design
- **Storage**: S3 with CloudFront CDN
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
- 🔧 **LoRA Models**: Customizable AI models for specialized content (Pro)
- 🛠️ **Bulk Generation**: Generate multiple variations at once (Pro)
- 📐 **Custom Sizes**: Control exact image dimensions (Pro only)
- 🎚️ **Plan-Based Limits**: Tiered usage limits based on subscription plan

### Administration & Authentication

- �👤 **Admin Panel**: Secure admin interface for content management
- 🔐 **User Authentication**: Secure authentication with plan-based permissions
- 📊 **Usage Tracking**: Monitor generation limits and subscription status
- 🏷️ **Role Management**: User, admin, and moderator role system

### Technical Features

- 📱 **Responsive Design**: Beautiful dark theme that works on all devices
- ⚡ **Serverless**: Scalable and cost-effective serverless architecture

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js 18+** and npm 8+
- **Docker** and **Docker Compose** (for LocalStack)
- **Git** (latest version)
- **AWS CLI** configured with appropriate permissions
- **AWS SAM CLI** installed
- **Python 3.x** (required for AWS SAM)

### Verification Commands

```bash
node --version    # Should be 18+
npm --version     # Should be 8+
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

### 2. Backend Setup

For the backend, copy the JSON-based example file:

```bash
cp backend/.env.example.json backend/.env.local.json
```

This file provides the necessary parameters for the `sam local start-api` command.

### 3. Scripts Setup

The scripts also require their own environment file:

```bash
cp scripts/.env.example scripts/.env.local
```

This will configure the scripts for local execution against LocalStack.

### 4. AWS Credentials

Ensure your AWS CLI is configured, as some scripts and local services rely on it:

```bash
aws configure
```

> **Detailed Configuration**: See [`docs/ENVIRONMENT_CONFIGURATION.md`](docs/ENVIRONMENT_CONFIGURATION.md) for a complete guide to all environment variables.

## Local Development

### Quick Start with Automated Setup

The fastest way to get started is using our automated setup script:

```bash
# Make script executable and run
chmod +x scripts/start-local-backend.sh
./scripts/start-local-backend.sh
```

This script will:

- Start LocalStack (Docker container)
- Initialize S3 bucket and DynamoDB table
- Configure CORS settings
- Create default admin user
- Start the backend API server

### Manual Setup (Alternative)

If you prefer to run setup steps manually:

#### 1. Start LocalStack Container

```bash
npm run local:start
```

#### 2. Initialize Local AWS Resources

```bash
npm run local:setup
```

#### 3. Start Backend Development Server

```bash
npm run dev:backend
```

#### 4. Start Frontend Development Server

In a new terminal window:

```bash
npm run dev:frontend
```

### Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **LocalStack**: http://localhost:4566
- **Default Admin**: Username `dani`

### Local Environment Management

```bash
# View LocalStack logs
npm run local:logs

# Stop LocalStack
npm run local:stop

# Clean up volumes
npm run local:clean

# Check LocalStack health
curl http://localhost:4566/_localstack/health
```

> **Detailed Guide**: See [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md) for comprehensive local development instructions.

## Development Workflow

### Backend Development

- Lambda functions are in [`backend/functions/`](backend/functions/)
- Shared utilities in [`backend/shared/`](backend/shared/)
- After making changes, restart backend: `Ctrl+C` then `./scripts/start-local-backend.sh`

### Frontend Development

- Components in [`frontend/src/components/`](frontend/src/components/)
- Pages in [`frontend/src/app/`](frontend/src/app/)
- Hot Module Replacement (HMR) enabled - changes reflect automatically

### Available Scripts

```bash
# Development
npm run dev:backend          # Start backend locally
npm run dev:frontend         # Start frontend dev server

# Building
npm run build               # Build both projects
npm run build:backend       # Build backend only
npm run build:frontend      # Build frontend only

# Linting
npm run lint               # Lint all projects
npm run lint:fix           # Fix linting issues

# Database operations
npm run db:setup           # Create local database tables
npm run local:init         # Initialize local AWS resources
```

## Testing

⚠️ **CRITICAL: Testing infrastructure is currently broken and requires significant work.**

**Current Status:**
- Backend tests fail with compilation errors and missing dependencies
- Frontend tests have not been validated yet  
- Test coverage claims in documentation are inaccurate
- Test infrastructure needs major refactoring before it can be used

**Known Issues:**
- Import path errors in test files
- Type mismatches between test mocks and actual types
- Missing shared utilities in test environment
- Test setup scripts exist but functionality is unverified

### Prerequisites for Testing

Ensure you have completed the installation and local development setup above before running tests.

### Quick Start

```bash
# Setup testing environment (first time only)
./scripts/setup-testing.sh

# Run all tests
npm run test:all

# Run tests with coverage
npm run test:coverage:combined

# Validate testing setup
./scripts/validate-testing.sh
```

### Test Types

- **Unit Tests**: Fast, isolated component testing
- **Integration Tests**: API and database integration testing
- **End-to-End Tests**: Full user workflow testing with Playwright
- **Performance Tests**: Lighthouse CI performance monitoring
- **Security Tests**: Dependency and vulnerability scanning

### Testing Commands (⚠️ Currently Broken)

**The following commands are documented but currently non-functional:**

```bash
# These commands WILL FAIL until testing infrastructure is fixed:
npm run test:all                  # ❌ BROKEN
npm run test:backend              # ❌ BROKEN
npm run test:frontend             # ❌ BROKEN  
npm run test:coverage:combined    # ❌ BROKEN

# Use these commands to check what needs to be fixed:
cd backend && npm run test        # See backend test errors
cd frontend && npm run test       # Check frontend test status
```

**What Works:**
- Basic build and type checking: ✅ `npm run type-check`
- Linting: ✅ `npm run lint` (with workspace fix applied)
- Individual workspace builds: ✅ `npm run build`

### Test Environment Setup

```bash
# Local development
./scripts/test-setup.sh local

# CI environment
./scripts/test-setup.sh ci

# Docker environment
./scripts/test-setup.sh docker

# Cleanup after testing
./scripts/test-cleanup.sh
```

### Coverage Reports (⚠️ Not Available)

**Current Status:** Coverage reporting is not functional due to broken test infrastructure.

**When Fixed, Coverage Will Be Available At:**
- **Backend**: `backend/coverage/lcov-report/index.html`
- **Frontend**: `frontend/coverage/lcov-report/index.html`  
- **Combined**: `coverage/lcov-report/index.html`

**Target Coverage Goals (When Functional):**
- **Backend**: 90%+ coverage with Jest
- **Frontend**: 85%+ coverage with Jest + React Testing Library
- **E2E**: Critical user paths with Playwright

### CI/CD Pipeline (⚠️ Testing Disabled)

**Current Status:** Automated testing is disabled in CI/CD due to broken test infrastructure.

**When Testing Is Fixed, Pipeline Will Include:**
- Push to `main` or `develop` branches
- Pull requests  
- Manual workflow dispatch

**Target Quality Gates (When Functional):**
- ✅ 85%+ code coverage
- ✅ 95%+ test pass rate
- ✅ Security vulnerability scanning
- ✅ Performance benchmarks

### Documentation

- [`TESTING.md`](./TESTING.md) - Comprehensive testing guide
- [`TESTING_QUICKSTART.md`](./TESTING_QUICKSTART.md) - Quick reference
- Backend tests: [`backend/__tests__/README.md`](./backend/__tests__/README.md)
- Frontend tests: [`frontend/__tests__/README.md`](./frontend/__tests__/README.md)

## Deployment

The project supports multiple environments (dev, staging, prod) with automated deployment scripts.

### Prerequisites for Deployment

- Completed installation and environment setup
- AWS CLI configured with deployment permissions
- Environment-specific configuration files

### Quick Deployment

1. **Deploy backend to development**

   ```bash
   ./scripts/deploy.sh --env dev
   ```

2. **Deploy backend to production**

   ```bash
   npm run deploy:backend:prod
   ```

3. **Prepare frontend for deployment**
   ```bash
   ./scripts/deploy-frontend.sh --env prod --type production
   vercel --prod
   ```

### Environment Support

- **Development**: `./scripts/deploy.sh --env dev`
- **Staging**: `./scripts/deploy.sh --env staging`
- **Production**: `npm run deploy:backend:prod`

### Manual Deployment

1. **Backend (SAM)**

   ```bash
   sam build
   sam deploy --config-env prod  # or dev, staging
   ```

2. **Frontend (Vercel)**
   ```bash
   cd frontend
   npm run build
   vercel --prod
   ```

For detailed deployment instructions, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Project Structure

```
PornSpot.ai/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # Next.js 14 app directory
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility libraries
│   │   ├── mocks/           # MSW mocks for testing
│   │   └── types/           # TypeScript type definitions
│   ├── __tests__/           # Frontend test suite
│   │   ├── components/      # Component tests
│   │   ├── e2e/            # End-to-end tests
│   │   ├── integration/    # Integration tests
│   │   ├── mocks/          # MSW mocks
│   │   └── fixtures/       # Test data
│   ├── public/             # Static assets
│   └── package.json
├── backend/                 # Lambda functions and API
│   ├── functions/
│   │   ├── admin/          # Admin management functions
│   │   ├── albums/         # Album management functions
│   │   ├── email/          # Email notification functions
│   │   ├── media/          # Media management functions
│   │   └── user/           # User management functions
│   ├── shared/
│   │   ├── types/          # Shared type definitions
│   │   └── utils/          # Shared utilities
│   ├── __tests__/          # Backend test suite
│   │   ├── unit/           # Unit tests
│   │   ├── integration/    # Integration tests
│   │   ├── fixtures/       # Test data
│   │   └── helpers/        # Test utilities
│   └── package.json
├── scripts/                # Testing and deployment scripts
│   ├── start-local-backend.sh  # Local backend startup script
│   ├── deploy.sh           # Deployment script (deprecated - use npm run deploy:backend:*)
│   ├── setup-testing.sh    # Test environment setup
│   └── ...                 # Additional utility scripts
├── docs/                   # Documentation
│   ├── API.md              # API documentation
│   ├── ARCHITECTURE.md     # System architecture
│   ├── DATABASE_SCHEMA.md  # Database schema
│   └── ...                 # Additional documentation
├── .github/
│   └── workflows/          # CI/CD pipelines
├── coverage/               # Combined coverage reports
├── docker-compose.local.yml # Docker test environment
├── docker-compose.test.yml # Docker test environment
├── jest.config.root.js     # Root Jest configuration
├── template.yaml           # SAM template
├── samconfig.toml         # SAM configuration
├── .env.example           # Environment variables template
└── package.json           # Root package.json with workspace scripts
```

## Documentation

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
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.
