# Testing Guide for pornspot.ai

⚠️ **CRITICAL NOTICE: Testing infrastructure is currently broken and requires significant refactoring work.**

**Current Status:**
- Backend tests fail with compilation errors and import issues
- Test coverage claims in this document are aspirational, not current reality
- Test infrastructure exists but is non-functional
- Significant development work is needed to make tests operational

**Known Issues:**
- Import path errors in test files
- Type mismatches between test mocks and actual types  
- Missing shared utilities in test environment
- Jest configuration issues with module resolution

**This document describes the intended testing architecture, but the implementation is currently broken.**

---

This comprehensive guide covers the complete testing infrastructure for the pornspot.ai project, including setup, execution, and best practices for both backend and frontend testing.

## Table of Contents

- [Overview](#overview)
- [Testing Architecture](#testing-architecture)
- [Quick Start](#quick-start)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [End-to-End Testing](#end-to-end-testing)
- [CI/CD Integration](#cicd-integration)
- [Docker Testing Environment](#docker-testing-environment)
- [Coverage Reports](#coverage-reports)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## Overview

**⚠️ IMPORTANT: The testing infrastructure described below is currently non-functional.**

The pornspot.ai project *intends to implement* a comprehensive testing strategy that includes:

- **Backend Testing**: Unit and integration tests for AWS Lambda functions using Jest (❌ Currently broken)
- **Frontend Testing**: Component, integration, and accessibility tests using Jest + React Testing Library (❌ Status unknown)
- **End-to-End Testing**: Full application testing using Playwright (❌ Status unknown)
- **Visual Regression Testing**: Automated screenshot comparison (❌ Not implemented)
- **Performance Testing**: Lighthouse CI integration (❌ Not implemented)
- **Security Testing**: Dependency scanning and vulnerability assessment (❌ Status unknown)

**Reality Check:** The backend tests have numerous compilation errors and import failures. This documentation describes the intended architecture but should not be considered a working implementation guide.

### Testing Pyramid

```
    /\     E2E Tests (Playwright)
   /  \
  /____\   Integration Tests (Jest + MSW)
 /      \
/________\  Unit Tests (Jest + React Testing Library)
```

## Testing Architecture

### Backend Testing Stack

- **Test Runner**: Jest
- **Mocking**: AWS SDK Client Mock
- **Database**: DynamoDB Local
- **Coverage**: Istanbul/NYC
- **Assertions**: Jest built-in matchers

### Frontend Testing Stack

- **Test Runner**: Jest
- **Component Testing**: React Testing Library
- **E2E Testing**: Playwright
- **Mocking**: MSW (Mock Service Worker)
- **Accessibility**: jest-axe + @axe-core/playwright
- **Performance**: Lighthouse CI

## Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose (for containerized testing)
- Git

### Initial Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd pornspot-ai
   npm run install:all
   ```

2. **Setup test environment:**

   ```bash
   chmod +x scripts/test-setup.sh
   ./scripts/test-setup.sh
   ```

3. **Run all tests:**
   ```bash
   npm run test:all
   ```

### Available Test Commands

```bash
# Run all tests
npm run test:all

# Backend tests
npm run test:backend              # All backend tests
npm run test:backend:unit         # Unit tests only
npm run test:backend:integration  # Integration tests only
npm run test:backend:coverage     # With coverage report

# Frontend tests
npm run test:frontend             # Unit/integration tests
npm run test:frontend:e2e         # End-to-end tests
npm run test:frontend:coverage    # With coverage report

# Combined operations
npm run test:coverage             # Generate combined coverage
npm run test:watch                # Watch mode for development
npm run test:ci                   # CI-optimized test run
```

## Backend Testing

### Test Structure

```
backend/__tests__/
├── setup.ts                     # Global test setup
├── fixtures/                    # Test data
│   ├── albums.ts
│   └── media.ts
├── helpers/                     # Test utilities
│   ├── api-gateway.ts
│   └── aws-mocks.ts
├── unit/                        # Unit tests
│   ├── functions/
│   └── shared/
└── integration/                 # Integration tests
    ├── albums.integration.test.ts
    └── media.integration.test.ts
```

### Writing Backend Tests

#### Unit Test Example

```typescript
// backend/__tests__/unit/functions/albums/get.test.ts
import { handler } from "../../../functions/albums/get";
import { mockDynamoDBClient } from "../../helpers/aws-mocks";

describe("GET /albums", () => {
  beforeEach(() => {
    mockDynamoDBClient.reset();
  });

  it("should return public albums", async () => {
    // Setup mock
    mockDynamoDBClient.on(ScanCommand).resolves({
      Items: [
        /* mock data */
      ],
    });

    // Execute
    const event = createAPIGatewayEvent({ queryStringParameters: null });
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveProperty("albums");
  });
});
```

#### Integration Test Example

```typescript
// backend/__tests__/integration/albums.integration.test.ts
describe("Albums Integration Tests", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it("should create and retrieve album", async () => {
    // Create album
    const createEvent = createAPIGatewayEvent({
      body: JSON.stringify({ title: "Test Album" }),
    });
    const createResult = await createHandler(createEvent);

    // Retrieve album
    const getEvent = createAPIGatewayEvent({
      pathParameters: { id: albumId },
    });
    const getResult = await getHandler(getEvent);

    expect(getResult.statusCode).toBe(200);
  });
});
```

### Backend Test Configuration

The backend uses Jest with TypeScript support:

```javascript
// backend/jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
```

## Frontend Testing

### Test Structure

```
frontend/__tests__/
├── components/                   # Component tests
│   ├── ui/
│   └── layout.test.tsx
├── pages/                       # Page tests
│   └── page.test.tsx
├── hooks/                       # Custom hook tests
│   └── useAlbums.test.tsx
├── utils/                       # Utility tests
│   └── test-utils.tsx
├── integration/                 # Integration tests
│   └── api.integration.test.tsx
├── e2e/                        # End-to-end tests
│   ├── discover.spec.ts
│   ├── album-detail.spec.ts
│   └── admin.spec.ts
├── mocks/                      # MSW handlers
│   ├── handlers.ts
│   └── server.ts
└── fixtures/                   # Test data
    ├── data.ts
    └── types.ts
```

### Writing Frontend Tests

#### Component Test Example

```typescript
// frontend/__tests__/components/ui/Button.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../../src/components/ui/Button";

describe("Button Component", () => {
  it("renders with correct text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("handles click events", () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is accessible", async () => {
    const { container } = render(<Button>Accessible button</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

#### Integration Test Example

```typescript
// frontend/__tests__/integration/api.integration.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { server } from "../mocks/server";
import { AlbumsList } from "../../src/components/AlbumsList";

describe("Albums API Integration", () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("loads and displays albums", async () => {
    render(<AlbumsList />);

    expect(screen.getByTestId("loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("albums-list")).toBeInTheDocument();
    });

    expect(screen.getByText("Nature Photography")).toBeInTheDocument();
  });
});
```

### Frontend Test Configuration

```javascript
// frontend/jest.config.js
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jsdom",
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
```

## End-to-End Testing

### Playwright Configuration

E2E tests use Playwright for cross-browser testing:

```typescript
// frontend/playwright.config.ts
export default defineConfig({
  testDir: "./__tests__/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html"],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["junit", { outputFile: "playwright-report/results.xml" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
```

### Writing E2E Tests

```typescript
// frontend/__tests__/e2e/discover.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays main heading and navigation", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /pornspot.ai/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /albums/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /upload/i })).toBeVisible();
  });

  test("is accessible", async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("is responsive", async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole("heading")).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole("heading")).toBeVisible();
  });
});
```

## CI/CD Integration

### GitHub Actions Workflow

The project uses GitHub Actions for automated testing:

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      dynamodb:
        image: amazon/dynamodb-local:latest
        ports:
          - 8000:8000
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"
      - run: npm ci && npm run install:backend
      - run: npm run test:backend:coverage
      - uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage/lcov.info
          flags: backend

  test-frontend:
    runs-on: ubuntu-latest
    needs: test-backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"
      - run: npm ci && npm run install:frontend
      - run: npx playwright install --with-deps
      - run: npm run test:frontend:all
      - uses: codecov/codecov-action@v3
        with:
          file: ./frontend/coverage/lcov.info
          flags: frontend
```

### Quality Gates

Tests must pass these quality gates:

- **Coverage**: ≥85% line coverage for both backend and frontend
- **Pass Rate**: ≥95% of all tests must pass
- **No Critical Issues**: Zero high-severity security vulnerabilities
- **Performance**: Lighthouse scores ≥80 for all metrics
- **Accessibility**: Zero accessibility violations

## Docker Testing Environment

### Using Docker for Testing

For consistent testing across environments:

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run tests in containers
docker-compose -f docker-compose.test.yml run backend-tests
docker-compose -f docker-compose.test.yml run frontend-tests
docker-compose -f docker-compose.test.yml run e2e-tests

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Docker Test Services

- **dynamodb-local**: Local DynamoDB instance
- **localstack**: AWS services simulation
- **redis-test**: Redis for caching tests
- **backend-tests**: Backend test runner
- **frontend-tests**: Frontend test runner
- **e2e-tests**: E2E test runner

## Coverage Reports

### Generating Coverage Reports

```bash
# Individual coverage
npm run test:backend:coverage    # Backend coverage
npm run test:frontend:coverage   # Frontend coverage

# Combined coverage
npm run test:coverage:combined   # Merged coverage report
```

### Coverage Thresholds

| Component | Lines | Statements | Functions | Branches |
| --------- | ----- | ---------- | --------- | -------- |
| Backend   | 90%   | 90%        | 90%       | 90%      |
| Frontend  | 85%   | 85%        | 85%       | 85%      |
| Combined  | 85%   | 85%        | 85%       | 85%      |

### Viewing Coverage Reports

Coverage reports are generated in multiple formats:

- **HTML**: `coverage/lcov-report/index.html`
- **LCOV**: `coverage/lcov.info`
- **JSON**: `coverage/coverage-final.json`
- **Text**: Console output during test runs

## Troubleshooting

### Common Issues

#### 1. DynamoDB Connection Issues

```bash
# Check if DynamoDB Local is running
curl http://localhost:8000/

# Restart DynamoDB Local
docker-compose -f docker-compose.test.yml restart dynamodb-local
```

#### 2. Playwright Browser Issues

```bash
# Reinstall browsers
npx playwright install

# Install system dependencies
npx playwright install-deps
```

#### 3. Port Conflicts

```bash
# Check for processes using test ports
lsof -i :3000  # Frontend dev server
lsof -i :8000  # DynamoDB Local
lsof -i :4566  # LocalStack

# Kill conflicting processes
pkill -f "next dev"
pkill -f "DynamoDBLocal"
```

#### 4. Memory Issues

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Run tests with increased memory
NODE_OPTIONS="--max-old-space-size=4096" npm run test:all
```

### Debug Mode

Enable debug output for troubleshooting:

```bash
# Debug Jest tests
DEBUG=* npm run test:backend

# Debug Playwright tests
DEBUG=pw:* npm run test:frontend:e2e

# Verbose test setup
./scripts/test-setup.sh --verbose
```

### Test Environment Reset

If tests are failing due to environment issues:

```bash
# Clean and reset everything
./scripts/test-cleanup.sh --level complete --force
./scripts/test-setup.sh --clean --verbose
npm run test:all
```

## Best Practices

### Test Organization

1. **Follow the AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Test Names**: Clearly state what is being tested
3. **Keep Tests Independent**: Each test should be able to run in isolation
4. **Use Proper Mocking**: Mock external dependencies appropriately

### Writing Effective Tests

```typescript
// ✅ Good: Descriptive and focused
describe("Album creation", () => {
  it("should create album with valid data and return 201 status", async () => {
    // Arrange
    const albumData = { title: "Test Album", description: "Test Description" };

    // Act
    const result = await createAlbum(albumData);

    // Assert
    expect(result.statusCode).toBe(201);
    expect(result.body).toMatchObject(albumData);
  });
});

// ❌ Bad: Vague and testing multiple things
describe("Album", () => {
  it("should work", async () => {
    const result = await createAlbum({ title: "Test" });
    expect(result.statusCode).toBe(201);
    expect(result.body.title).toBe("Test");
    expect(result.body.createdAt).toBeDefined();
    // ... many more assertions
  });
});
```

### Performance Considerations

1. **Parallel Execution**: Use Jest's parallel execution for faster tests
2. **Selective Testing**: Use `--testPathPattern` for focused testing
3. **Efficient Mocking**: Mock only what's necessary
4. **Resource Cleanup**: Always clean up resources in `afterEach`/`afterAll`

### Accessibility Testing

Always include accessibility tests:

```typescript
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

it("should be accessible", async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Contributing

### Adding New Tests

1. **Backend Tests**: Add to appropriate directory under `backend/__tests__/`
2. **Frontend Tests**: Add to appropriate directory under `frontend/__tests__/`
3. **E2E Tests**: Add to `frontend/__tests__/e2e/`

### Test Naming Conventions

- **Files**: `*.test.ts` for unit tests, `*.spec.ts` for E2E tests
- **Describe blocks**: Use the component/function name being tested
- **Test cases**: Use "should [expected behavior] when [condition]"

### Running Tests Before Commits

The project uses Husky for pre-commit hooks:

```bash
# Install Husky hooks
npm run prepare

# Hooks will automatically run:
# - Linting
# - Type checking
# - Unit tests for changed files
```

### Continuous Integration

All pull requests must:

1. Pass all tests in CI
2. Maintain or improve coverage
3. Pass all quality gates
4. Include tests for new functionality

---

For more information or help with testing, please refer to the individual component documentation or open an issue in the project repository.
