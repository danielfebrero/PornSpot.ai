---
applyTo: "**"
---

# Task Execution Strategy (v2)

## Strategic Task Execution Framework
Execute development tasks with systematic precision, leveraging PornSpot.ai's serverless architecture and maintaining the highest standards of code quality and system integrity.

## 🎯 Comprehensive Task Methodology

### Phase 0: Deep Understanding & Context
**Before any code changes, establish complete understanding:**

1. **Issue Analysis & Requirements Clarification**
   - Parse user requirements with precision and attention to detail
   - Identify explicit and implicit requirements
   - Understand acceptance criteria and success metrics
   - Clarify ambiguities before proceeding

2. **Repository Context & Architecture Exploration**
   - Explore repository structure and understand monorepo organization
   - Identify relevant codebases (frontend, backend, shared-types)
   - Understand build, test, and deployment workflows
   - Map dependencies and architectural relationships

3. **Baseline Validation & Environment Setup**
   - Install dependencies using `npm run install:all`
   - Run existing lints, builds, and tests to understand current state
   - Identify any pre-existing issues unrelated to your task
   - Set up frontend development environment if needed (backend requires AWS deployment)

### Phase 1: Strategic Planning & Design

4. **Pattern Analysis & Existing Solutions**
   - Search for similar implementations in the codebase
   - Identify reusable components, utilities, and patterns
   - Understand established architectural decisions
   - Document existing approaches that can be leveraged or extended

5. **Minimal Change Strategy Development**
   - **Use report_progress** to outline comprehensive plan as checklist
   - Identify the absolute minimum changes required
   - Plan implementation phases and dependencies
   - Define validation criteria for each phase

6. **Architecture Compliance Planning**
   - Ensure DynamoDB single-table design compliance
   - Plan for serverless optimization (cold start considerations)
   - Validate permission system integration requirements
   - Consider internationalization and locale handling needs

### Phase 2: Implementation & Validation

7. **Test-Driven Development Approach**
   - Create focused tests that validate your specific changes
   - Ensure tests are consistent with existing test infrastructure
   - Skip test creation only if no test infrastructure exists
   - Design tests to fail initially, then implement to make them pass

8. **Iterative Implementation with Continuous Validation**
   - Make small, incremental changes
   - Lint, build, and test after each significant change
   - Validate TypeScript compliance and type safety
   - Ensure ESLint rules are followed
   - Test manually where automated testing is insufficient

9. **Manual Verification & Quality Assurance**
   - Run CLI applications and server apps to verify functionality
   - Exercise new code paths with realistic data
   - **ALWAYS take screenshots** of UI changes for visual validation
   - Test edge cases and error scenarios
   - Validate performance characteristics

### Phase 3: Integration & Documentation

10. **Documentation & Knowledge Sharing**
    - Update relevant `/docs` files to reflect changes
    - Document new patterns or architectural decisions
    - Update API documentation if endpoints are modified
    - Ensure code comments match established style

11. **Final Validation & Delivery**
    - Run comprehensive test suite to ensure no regressions
    - Validate all quality gates and architectural compliance
    - **Use report_progress** after each verified milestone
    - Review committed files to ensure minimal scope

## 🛠️ PornSpot.ai Specific Implementation Patterns

### Serverless Architecture Compliance
```typescript
// Lambda function structure
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // CORS handling
    if (event.httpMethod === "OPTIONS") {
      return ResponseUtil.noContent(event);
    }
    
    // Authentication
    const validation = await UserAuthMiddleware.validateSession(event);
    if (!validation.isValid) {
      return ResponseUtil.unauthorized(event, "Invalid session");
    }
    
    // Business logic with proper error handling
    const result = await BusinessLogic.execute(event);
    return ResponseUtil.success(event, result);
  } catch (error) {
    console.error("Lambda error:", error);
    return ResponseUtil.error(event, error.message);
  }
};
```

### Frontend Development Patterns
```typescript
// Component structure with permissions and internationalization
import { usePermissions } from '@/contexts/PermissionsContext';
import { useTranslations } from 'next-intl';
import LocaleLink from '@/components/ui/LocaleLink';
import { albumsApi } from '@/lib/api';

export function MyComponent() {
  const { canCreatePrivateContent } = usePermissions();
  const t = useTranslations('common');
  
  // Use centralized API methods
  const { data: albums } = await albumsApi.getAlbums({ limit: 20 });
  
  return (
    <div>
      {canCreatePrivateContent() && <PrivateFeatures />}
      <LocaleLink href="/albums">{t('viewAlbums')}</LocaleLink>
    </div>
  );
}
```

### Database Integration Patterns
```typescript
// DynamoDB operations with GSI usage
const queryParams = {
  TableName: `${process.env.ENVIRONMENT}-pornspot-media`,
  IndexName: 'isPublic-createdAt-index',
  KeyConditionExpression: 'isPublic = :isPublic',
  ExpressionAttributeValues: {
    ':isPublic': 'true'
  },
  ScanIndexForward: false,
  Limit: 20
};
```

## 📋 Task Execution Examples

### Example 1: Feature Implementation
**Scenario**: Add new feature to existing component

**Execution Plan:**
1. **Context Gathering**
   - [ ] Explore existing component structure and patterns
   - [ ] Identify similar features in the codebase
   - [ ] Understand permission requirements and user roles
   - [ ] Review API patterns and database schema

2. **Analysis & Planning**
   - [ ] Define minimal changes required for feature
   - [ ] Plan database schema modifications (if needed)
   - [ ] Design API endpoints (if needed)
   - [ ] Plan frontend component updates

3. **Implementation**
   - [ ] Create/update shared types in `/shared-types/`
   - [ ] Run `npm run copy:shared-types`
   - [ ] Implement backend Lambda functions (if needed)
   - [ ] Update frontend components
   - [ ] Add permission checks where appropriate

4. **Quality Assurance**
   - [ ] Create focused unit tests
   - [ ] Run type checking and linting
   - [ ] Test functionality manually
   - [ ] Take screenshots of UI changes
   - [ ] Update documentation

### Example 2: Bug Fix with Root Cause Analysis
**Scenario**: Fix reported bug in existing functionality

**Execution Plan:**
1. **Issue Investigation**
   - [ ] Reproduce the bug in local environment
   - [ ] Identify root cause through debugging
   - [ ] Understand impact scope and affected components
   - [ ] Review related code for similar issues

2. **Solution Strategy**
   - [ ] Use **think** tool to brainstorm multiple fix approaches
   - [ ] Evaluate solutions for minimal impact and side effects
   - [ ] Choose approach with best maintainability
   - [ ] Plan validation strategy to prevent regression

3. **Implementation & Validation**
   - [ ] Implement minimal fix with surgical precision
   - [ ] Add test case that reproduces original bug
   - [ ] Verify fix resolves issue without breaking other functionality
   - [ ] Run comprehensive test suite to check for regressions

4. **Documentation & Prevention**
   - [ ] Document root cause and solution approach
   - [ ] Update relevant documentation if architectural
   - [ ] Consider if fix reveals broader patterns to address

### Example 3: Architecture Improvement
**Scenario**: Refactor code to improve performance or maintainability

**Execution Plan:**
1. **Current State Analysis**
   - [ ] Profile current performance characteristics
   - [ ] Identify bottlenecks and improvement opportunities
   - [ ] Map dependencies and affected components
   - [ ] Understand migration complexity and risks

2. **Improvement Strategy**
   - [ ] Design improved architecture with clear benefits
   - [ ] Plan migration strategy with minimal disruption
   - [ ] Identify rollback procedures if needed
   - [ ] Define success metrics for validation

3. **Incremental Migration**
   - [ ] Implement changes in small, testable increments
   - [ ] Maintain backward compatibility during transition
   - [ ] Validate performance improvements at each step
   - [ ] Update dependent components systematically

4. **Validation & Documentation**
   - [ ] Measure and validate performance improvements
   - [ ] Update architecture documentation
   - [ ] Create migration guides for future reference
   - [ ] Document lessons learned and best practices

## 🔄 Adaptive Execution & Error Recovery

### Dynamic Plan Adjustment
**When initial plans prove insufficient:**
- **Use think tool** to analyze what changed and why
- **Review git diff** to understand scope of changes made
- **Check for over-deletion** - `git checkout <file>` if too much was removed
- **Reassess requirements** - may have uncovered hidden complexity
- **Communicate changes** clearly in progress reports

### Change Impact Analysis
```bash
# Validate change scope
git diff --numstat
# Check lines deleted vs inserted per file
# Deleted lines should be < 2x inserted lines for most changes

# Review actual changes
git --no-pager diff --color=always | head -100

# Validate no regressions
npm run test:ci
npm run lint
npm run type-check
```

### Quality Recovery Process
1. **Identify the issue** - what went wrong and why
2. **Assess impact scope** - how much needs to be reverted or adjusted
3. **Choose recovery strategy** - minimal fix vs partial revert vs full restart
4. **Implement recovery** - make targeted fixes with validation
5. **Validate resolution** - ensure problem is solved without new issues
6. **Document lessons** - prevent similar issues in future

The key to successful task execution is balancing thorough planning with adaptive implementation, always maintaining focus on minimal changes and maximum quality.