# Build System Technical Debt

## 🟡 HIGH PRIORITY

Critical Turbo monorepo configuration issues causing recursive task loops and preventing proper build execution.

## Current State Analysis

### Turbo Configuration Issues

#### Recursive Task Invocation Error
```bash
❌ Error: recursive_turbo_invocations
Your `package.json` script looks like it invokes a Root Task (//#lint), 
creating a loop of `turbo` invocations.

Affected scripts:
- "lint": "turbo lint"
- "type-check": "turbo type-check"
```

#### Root Cause Analysis
The current configuration has root-level scripts that call Turbo tasks, but Turbo is configured to run these same scripts, creating infinite loops.

**Current Problematic Structure**
```json
// package.json (root)
{
  "scripts": {
    "lint": "turbo lint",              // ❌ Recursive
    "type-check": "turbo type-check"   // ❌ Recursive
  }
}

// turbo.json
{
  "tasks": {
    "lint": { ... },        // Calls "lint" script = loop
    "type-check": { ... }   // Calls "type-check" script = loop
  }
}
```

### Impact on Development Workflow

#### Blocked Operations
- Cannot run `npm run lint` - recursive loop error
- Cannot run `npm run type-check` - recursive loop error
- CI/CD pipeline failures due to linting step
- Developer productivity impact

#### Workaround Currently Required
```bash
# Developers must run commands directly in workspaces
cd frontend && npm run lint
cd backend && npm run lint
```

## Root Cause Analysis

### Monorepo Configuration Mismatch
1. **Task Definition**: Turbo tasks defined with same names as root scripts
2. **Script Naming**: Root scripts use same names as Turbo tasks
3. **Execution Chain**: Creates circular dependency in task execution

### Historical Context
- Appears to be result of migrating to Turbo without updating root scripts
- Common issue when transitioning from manual workspace management to Turbo

## Recommended Solutions

### Solution 1: Fix Root Scripts (Recommended)
Update root package.json to avoid recursive calls:

```json
// package.json (root) - FIXED
{
  "scripts": {
    "lint:all": "turbo lint",
    "lint:backend": "turbo lint --filter=pornspot-ai-backend", 
    "lint:frontend": "turbo lint --filter=pornspot-ai-frontend",
    "type-check:all": "turbo type-check",
    "type-check:backend": "turbo type-check --filter=pornspot-ai-backend",
    "type-check:frontend": "turbo type-check --filter=pornspot-ai-frontend"
  }
}
```

### Solution 2: Update Turbo Configuration
Alternative approach - rename Turbo tasks:

```json
// turbo.json - Alternative approach
{
  "tasks": {
    "lint:workspace": { ... },
    "type-check:workspace": { ... }
  }
}
```

## Implementation Plan

### Phase 1: Immediate Fix (Day 1)
1. **Update Root Scripts**
   - Rename conflicting scripts to avoid recursion
   - Maintain backwards compatibility where possible
   - Update documentation

2. **Test Configuration**
   - Verify lint commands work from root
   - Test filtered execution for specific workspaces
   - Validate CI/CD pipeline

### Phase 2: Optimization (Week 1)
1. **Enhance Turbo Config**
   - Optimize task dependencies
   - Configure proper caching
   - Set up incremental builds

2. **Update Documentation**
   - Update README with correct commands
   - Fix developer guides
   - Update CI/CD documentation

## Specific Configuration Changes

### Updated Root Package.json
```json
{
  "scripts": {
    "install:all": "npm run install:backend && npm run install:frontend",
    "install:backend": "cd backend && npm install",
    "install:frontend": "cd frontend && npm install",
    
    "build:all": "turbo build",
    "build:backend": "turbo build --filter=pornspot-ai-backend",
    "build:frontend": "turbo build --filter=pornspot-ai-frontend",
    
    "lint:all": "turbo lint",
    "lint:backend": "turbo lint --filter=pornspot-ai-backend",
    "lint:frontend": "turbo lint --filter=pornspot-ai-frontend",
    "lint:fix:all": "turbo lint:fix",
    "lint:fix:backend": "turbo lint:fix --filter=pornspot-ai-backend",
    "lint:fix:frontend": "turbo lint:fix --filter=pornspot-ai-frontend",
    
    "type-check:all": "turbo type-check",
    "type-check:backend": "turbo type-check --filter=pornspot-ai-backend",
    "type-check:frontend": "turbo type-check --filter=pornspot-ai-frontend",
    
    "test:all": "turbo test",
    "test:backend": "turbo test --filter=pornspot-ai-backend",
    "test:frontend": "turbo test --filter=pornspot-ai-frontend"
  }
}
```

### Turbo.json Verification
Current turbo.json appears correct - the issue is in root scripts:

```json
{
  "tasks": {
    "lint": {
      "inputs": ["$TURBO_DEFAULT$", ".eslintrc*", ".eslintignore", "tsconfig.json"],
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "tsconfig.json"],
      "outputs": ["*.tsbuildinfo"]
    }
  }
}
```

## Updated Development Commands

### For Developers
```bash
# Lint all projects
npm run lint:all

# Lint specific project
npm run lint:frontend
npm run lint:backend

# Type check all
npm run type-check:all

# Type check specific
npm run type-check:frontend
npm run type-check:backend

# Fix linting issues
npm run lint:fix:all
```

### For CI/CD
```yaml
# GitHub Actions example
- name: Lint code
  run: npm run lint:all

- name: Type check
  run: npm run type-check:all
```

## Testing the Fix

### Verification Checklist
- [ ] `npm run lint:all` executes without recursion error
- [ ] `npm run lint:frontend` runs only frontend linting
- [ ] `npm run lint:backend` runs only backend linting
- [ ] `npm run type-check:all` works correctly
- [ ] CI/CD pipeline uses updated commands
- [ ] Documentation reflects new command structure

### Expected Behavior After Fix
```bash
$ npm run lint:all
> pornspot-ai@1.0.0 lint:all
> turbo lint

• Running lint
• Remote caching disabled
pornspot-ai-frontend:lint: cache miss, executing...
pornspot-ai-backend:lint: cache miss, executing...
```

## Long-term Improvements

### Enhanced Turbo Configuration
1. **Pipeline Dependencies**
   - Set up proper task ordering
   - Configure shared dependencies

2. **Caching Optimization**
   - Fine-tune cache keys
   - Optimize for CI/CD performance

3. **Development Scripts**
   - Add watch mode scripts
   - Implement parallel development

## Effort Estimation
- **Immediate fix**: 2-4 hours
- **Testing and validation**: 4-6 hours
- **Documentation updates**: 2-3 hours
- **Total effort**: 1 day

## Success Criteria
- All Turbo commands execute without recursion errors
- CI/CD pipeline passes with updated commands
- Developers can run linting and type checking from root
- No disruption to existing development workflow
- Proper monorepo task orchestration functioning