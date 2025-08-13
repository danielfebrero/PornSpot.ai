# Testing Infrastructure Technical Debt

## 🔴 CRITICAL PRIORITY

The current testing infrastructure is fundamentally broken and requires a complete overhaul. This is blocking development productivity and CI/CD pipeline reliability.

## Current State Analysis

### Backend Testing Issues
```bash
❌ Import errors: Cannot find module '../../../../functions/media/upload'
❌ Type mismatches: Property 'userEmail' is missing in UserSession
❌ Type conflicts: AlbumEntity vs Album type incompatibility
❌ Test files don't match current codebase structure
```

### Frontend Testing Issues
```bash
❌ MSW import errors: Cannot find module 'msw/node'
❌ Jest configuration issues: Unexpected token errors
❌ Transform configuration missing for modern JS syntax
❌ Test environment setup incomplete
```

### Root Causes
1. **Outdated Test Dependencies**: MSW and Jest configurations are incompatible
2. **Type Misalignment**: Tests use outdated type definitions
3. **Path Resolution**: Import paths don't match current file structure
4. **Configuration Drift**: Jest setup diverged from actual codebase

## Specific Issues Identified

### Backend Test Failures
- `__tests__/unit/functions/media/upload.test.ts` - Import path resolution
- Type definitions in shared-types not matching test expectations
- Mock implementations don't align with current API signatures

### Frontend Test Failures  
- MSW server setup in `__tests__/mocks/server.ts` using outdated imports
- Jest transform configuration missing for Next.js 14 features
- Integration tests can't resolve MSW dependencies

### Documentation vs Reality Gap
- README claims "99%+ code coverage" but tests don't run
- Testing documentation references features that don't exist
- Quick start guides reference broken test commands

## Impact Assessment

### Development Impact
- **Blocking CI/CD**: No reliable automated testing
- **Regression Risk**: Changes can't be validated automatically  
- **Developer Confidence**: Manual testing only for complex serverless app
- **Code Quality**: No test-driven development possible

### Business Impact
- **Deployment Risk**: No safety net for production releases
- **Bug Detection**: Issues only caught in production
- **Feature Velocity**: Slower development without test confidence

## Recommended Solutions

### Phase 1: Foundation Repair (Week 1-2)
1. **Update Test Dependencies**
   ```bash
   # Frontend
   npm install --save-dev msw@^2.10.3 @testing-library/jest-dom@^6.6.3
   
   # Backend  
   npm install --save-dev aws-sdk-client-mock@^4.0.0
   ```

2. **Fix Jest Configuration**
   - Update `jest.config.js` for Next.js 14 compatibility
   - Configure transform for TypeScript and modern JS
   - Fix module resolution for shared types

3. **Align Type Definitions**
   - Update test mocks to match current shared-types
   - Fix UserSession, Album, and other type mismatches
   - Ensure tests import from correct shared-types location

### Phase 2: Test Infrastructure Rebuild (Week 3-4)
1. **Backend Test Framework**
   - Rewrite Lambda function tests with proper mocking
   - Create shared test utilities for DynamoDB and S3 mocking
   - Implement integration tests with LocalStack

2. **Frontend Test Framework** 
   - Set up MSW v2 with proper handlers
   - Create component test utilities
   - Implement React Testing Library best practices

### Phase 3: Coverage and Quality (Week 5-6)
1. **Test Coverage**
   - Achieve minimum 80% coverage for critical paths
   - Focus on business logic and API endpoints
   - Skip UI component visual tests initially

2. **CI/CD Integration**
   - Fix GitHub Actions workflow
   - Add test quality gates
   - Set up coverage reporting

## Implementation Checklist

### Backend Testing
- [ ] Fix import paths in all test files
- [ ] Update UserSession type in tests to include userEmail
- [ ] Align AlbumEntity mocks with Album interface
- [ ] Create shared test utilities for AWS service mocking
- [ ] Implement integration tests for Lambda functions
- [ ] Set up LocalStack test environment
- [ ] Configure DynamoDB test fixtures

### Frontend Testing
- [ ] Upgrade MSW to v2 and fix import statements
- [ ] Update Jest configuration for Next.js 14
- [ ] Fix transform configuration for TypeScript
- [ ] Create API mocking handlers for all endpoints
- [ ] Implement component testing utilities
- [ ] Set up React Testing Library properly
- [ ] Add integration tests for key user flows

### Infrastructure
- [ ] Update GitHub Actions workflow to run tests
- [ ] Configure test environment variables
- [ ] Set up test database seeding
- [ ] Implement test coverage reporting
- [ ] Add test quality gates to PR process

## Effort Estimation
- **High Priority Fixes**: 2-3 weeks
- **Complete Infrastructure**: 4-6 weeks  
- **Full Test Coverage**: 8-10 weeks

## Success Criteria
- All test suites run without errors
- Coverage above 80% for critical business logic
- CI/CD pipeline includes automated testing
- Developers can run tests locally without issues
- New features require tests before merge