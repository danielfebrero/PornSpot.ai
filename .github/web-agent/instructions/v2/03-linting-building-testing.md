# Linting, Building and Testing Instructions (v2)

## Quality Assurance Philosophy
Maintain the highest code quality standards through comprehensive testing, linting, and building processes tailored to the PornSpot.ai serverless architecture.

## Core Testing Principles

### 1. Respect Existing Infrastructure
- **Only run existing linters, builds and tests** - don't add new tools unless necessary
- **Understand current state** - run repository lints/builds/tests before changes
- **Not responsible for unrelated issues** - focus only on your task-related problems
- **Document-only changes** don't need linting/building unless specific tests exist

### 2. Early & Iterative Validation
- **Test changes immediately** after making them to catch errors early
- **Build iteratively** to ensure each change doesn't break the system
- **Lint frequently** to maintain code style consistency
- **Validate thoroughly** - each code change should be tested before proceeding

## PornSpot.ai Specific Workflows

### 3. Monorepo Build Strategy
```bash
# Dependency installation (correct order)
npm run install:all  # Never use npm install in workspaces directly

# Development workflow (frontend only)
npm run dev:frontend               # Frontend on :3000

# Note: Backend API requires AWS deployment due to Docker images
# Local backend development is not supported with current Docker-based functions
```

### 4. Testing Commands
```bash
# All tests
npm run test:ci                    # Backend + Frontend tests
npm run test:coverage             # Coverage reports
npm run test:summary              # Test summary generation

# Backend testing
npm run test:backend:all          # All backend tests
npm run test:backend:unit         # Unit tests only
npm run test:backend:integration  # Integration tests only
npm run test:backend:coverage     # Backend coverage

# Frontend testing  
npm run test:frontend:all         # All frontend tests
npm run test:frontend:unit        # Unit tests only
npm run test:frontend:integration # Integration tests only
npm run test:frontend:e2e         # End-to-end tests
npm run test:frontend:coverage    # Frontend coverage

# Watch modes
npm run test:watch                # Both backend and frontend
npm run test:backend:watch        # Backend only
npm run test:frontend:watch       # Frontend only
```

### 5. Linting & Type Checking
```bash
# Linting
npm run lint                      # All projects
npm run lint:backend             # Backend only
npm run lint:frontend            # Frontend only

# Linting fixes
npm run lint:fix                 # Auto-fix all
npm run lint:fix:backend        # Auto-fix backend
npm run lint:fix:frontend       # Auto-fix frontend

# Type checking
npm run type-check               # All projects
npm run type-check:backend      # Backend TypeScript
npm run type-check:frontend     # Frontend TypeScript
```

### 6. Build Process
```bash
# Building
npm run build                    # All projects via Turbo
npm run build:backend           # Backend Lambda functions
npm run build:frontend          # Frontend Next.js build

# SAM specific
npm run sam:build               # SAM build for Lambda deployment
npm run sam:deploy              # Deploy to AWS
npm run sam:local               # Local SAM API
```

## Quality Standards

### 7. Code Quality Checks
- **TypeScript strict mode** - all code must pass type checking
- **ESLint rules** - follow established linting rules  
- **Test coverage** - maintain high test coverage for critical paths
- **Performance optimization** - optimize for serverless cold starts
- **Security validation** - validate all inputs and sanitize outputs

### 8. Testing Strategy
- **Unit tests** for individual functions and components
- **Integration tests** for API endpoints and data flow
- **End-to-end tests** for critical user workflows
- **Coverage reports** to identify untested code paths
- **Performance tests** for serverless optimization

## Environment-Specific Considerations

### 9. Development Testing
- **Frontend testing** - Full local development and testing available
- **Backend testing** - Requires AWS deployment due to Docker images  
- **Database testing** - Access via deployed AWS resources
- **File uploads** - S3 testing via deployed environment

### 10. Common Gotchas
- **Backend changes require full restart** - no hot module replacement
- **Separate terminals required** for backend script and frontend dev server  
- **DynamoDB queries must use GSIs** for non-key lookups
- **CORS headers mandatory** in all Lambda responses
- **LocalStack endpoint configuration** required for local S3/DynamoDB access

## Continuous Quality Process
1. **Pre-change validation** - run existing tests to understand baseline
2. **Iterative testing** - test each change immediately after implementation
3. **Comprehensive validation** - run full test suite before completion
4. **Coverage analysis** - ensure new code has appropriate test coverage
5. **Performance validation** - verify serverless optimization complianceess optimization compliance