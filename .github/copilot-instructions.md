# PornSpot.ai Copilot Instructions

This document provides comprehensive guidance for development on the PornSpot.ai serverless gallery platform. For detailed instruction sets, refer to the specialized instruction files in `.github/web-agent/instructions/v2/`.

## ⚠️ CRITICAL: Task Completion Persistence

### What Makes AI Agents Stop Working Prematurely

**Common Failure Patterns:**
- **20% Completion Syndrome** - Claiming task complete when only basic requirements addressed
- **Context Window Pressure** - Rushing to completion when conversation gets long
- **Overconfidence Bias** - Assuming partial work equals complete work
- **Ambiguous Success Criteria** - Not clearly defining what "done" means
- **Insufficient Self-Validation** - Not checking ALL requirements systematically

### Mandatory Completion Criteria

**A task is ONLY complete when ALL of these are verified:**
1. ✅ **Every requirement** from problem statement addressed and working
2. ✅ **All acceptance criteria** met and tested
3. ✅ **No obvious next steps** or loose ends remaining
4. ✅ **Code changes tested** and verified working as intended
5. ✅ **Documentation updated** for any architectural changes
6. ✅ **Quality standards maintained** (tests pass, linting clean, builds successful)

### Context Management for Extensive Tasks

**When context becomes full, NEVER abandon work:**

```markdown
**TASK STATUS: INCOMPLETE - [X]% Complete**

**ORIGINAL REQUIREMENTS:**
- [List every requirement with completion status]

**COMPLETED WORK:**
- [Verified completed items with test results]

**REMAINING WORK:**
- [Specific actionable items still needed]

**CONTEXT HANDOFF NEEDED:** 
This task requires continuation in fresh context.
REQUEST: Confirm approach for completing remaining work.
```

### Continuation Protocol

1. **Never claim completion prematurely** - validate ALL criteria first
2. **Ask for scope clarification** when uncertain about requirements
3. **Break large tasks into phases** but maintain commitment to completion
4. **Use context handoff** when conversation gets long - don't abandon work
5. **Request user guidance** when blocked - don't assume task is complete

## 🎯 Quick Reference

### Core Behavior ([Full Details](.github/instructions/01-core-behavior.instructions.md))

- **Precision & Minimalism** - Make smallest possible changes to achieve goals
- **Context-Driven Development** - Gather context first, search for existing solutions
- **Quality & Consistency** - Maintain architectural patterns and documentation
- **Ecosystem Integration** - Use scaffolding tools, package managers, and linters
- **Parallel Tool Usage** - Invoke multiple tools simultaneously for efficiency
- **⚠️ NEVER STOP UNTIL COMPLETE** - Validate ALL requirements before claiming completion

### Code Changes ([Full Details](.github/instructions/02-code-changes.instructions.md))

- **Surgical Changes** - Change as few lines as possible while preserving functionality
- **Architecture Compliance** - Follow DynamoDB patterns, serverless optimization, CORS headers
- **Frontend Consistency** - Use centralized APIs, LocaleLink navigation, ResponsivePicture images
- **Type Safety** - Edit shared types in `/shared-types/`, run `npm run copy:shared-types`
- **Incremental Development** - Small changes with immediate validation using report_progress

### Testing & Quality ([Full Details](.github/instructions/03-linting-building-testing.instructions.md))

- **Dependency Management** - Always use `npm run install:all` (never workspace npm install)
- **Development Workflow** - Frontend: `npm run dev:frontend` (backend requires AWS deployment)
- **Quality Commands** - `npm run test:ci`, `npm run lint:fix`, `npm run type-check`
- **Coverage Standards** - Maintain high test coverage with comprehensive validation

### Progress Reporting ([Full Details](.github/instructions/04-progress-reporting.instructions.md))

- **Strategic Communication** - Report at start with detailed checklist, frequently during work
- **Structured Tracking** - Use markdown checklists with consistent structure
- **Quality Commits** - Review committed files, exclude build artifacts, clear commit messages
- **PornSpot.ai Categories** - Architecture & Setup, Analysis & Planning, Implementation, Quality Assurance
- **⚠️ COMPLETION VALIDATION** - Never claim complete without verifying ALL requirements met

### Advanced Knowledge ([Full Details](.github/instructions/v2/08-implicit-training-knowledge.instructions.md))

- **AI-Enhanced Development** - Leverage training knowledge for sophisticated solutions
- **Serverless Excellence** - Cold start optimization, event-driven architecture patterns
- **Security & Privacy** - Content platform security, compliance, and privacy protection
- **Performance Optimization** - Media-heavy application optimization strategies

### Comprehensive Practices ([Full Details](.github/instructions/v2/09-comprehensive-development-practices.instructions.md))

- **Advanced Debugging** - Distributed tracing, CloudWatch insights, cross-service debugging
- **Sophisticated Architecture** - Domain-driven design, microservice boundaries, event sourcing
- **Platform Mastery** - DynamoDB optimization, Lambda excellence, Next.js optimization
- **Innovation Excellence** - Emerging technology evaluation, accessibility, cross-platform strategy

## 🏗️ Architecture Overview

This is a serverless adult content gallery platform with Next.js frontend and AWS Lambda backend using a single-table DynamoDB design.

**Core Stack:**

- Frontend: Next.js 14 with TypeScript, Tailwind CSS, next-intl (i18n)
- Backend: AWS Lambda functions (Node.js 20.x) with TypeScript
- Database: DynamoDB single-table design with 5 GSIs
- Storage: S3 + CloudFront CDN with 5-tier thumbnail system
- Infrastructure: AWS SAM for deployment
- Authentication: Session-based with cookies (User/Admin/Moderator roles)

## 📋 Essential Development Patterns

### Context Gathering Strategy ([Full Tool Usage Details](.github/instructions/v2/06-tool-usage.instructions.md))

1. **Search first** - understand existing patterns before implementing
2. **Analyze existing implementations** - find similar components and utilities
3. **Plan reuse or refactor** - identify patterns to follow and extend
4. **Edit only if necessary** - make minimal changes with maximum impact
5. **Update documentation** - maintain `/docs` files when changes affect architecture
6. **Use parallel tool calls** - maximize efficiency with simultaneous operations

### Monorepo Structure & Scripts

```bash
# Dependencies (required order)
npm run install:all  # Never use npm install in workspaces directly

# Local development
npm run dev:frontend               # Frontend on :3000

# Key facts: Backend requires AWS deployment due to Docker images, Frontend has HMR
```

### Permission System (Critical)

All features are gated by centralized permissions in `/frontend/src/contexts/PermissionsContext.tsx`:

```tsx
const { canCreatePrivateContent, canGenerateImages } = usePermissions();
{
  canCreatePrivateContent() && <PrivateContentToggle />;
}
```

- Plans: `free`, `starter`, `unlimited`, `pro` (defined in `/backend/shared/permissions.json`)
- Roles: `user`, `admin`, `moderator`
- Pro-only features marked with Crown icon component

### Database Patterns (Single-Table DynamoDB)

**Table:** `${env}-pornspot-media`

```typescript
// Standard entity patterns:
Album:  PK: "ALBUM#{albumId}"     SK: "METADATA"
Media:  PK: "MEDIA#{mediaId}"     SK: "METADATA"
User:   PK: "USER#{userId}"       SK: "PROFILE"
AlbumMedia: PK: "ALBUM#{albumId}" SK: "MEDIA#{mediaId}"

// GSI usage for queries:
GSI1: Album creation date queries
GSI2: Media by creator queries
GSI3: Public content filtering
GSI4: Album by creator queries
isPublic-createdAt-index: Public albums by date
```

**Critical Rules:**

- All `isPublic` fields stored as strings ("true"/"false") for GSI compatibility
- Use `ResponseUtil` for consistent Lambda responses
- Always include CORS headers in Lambda responses
- DynamoDB native pagination with `LastEvaluatedKey` cursors

## 🚀 Development Workflows

### API Usage Patterns (Critical)

**NEVER make direct `fetch()` calls in components, hooks, or pages.** Always use centralized API methods:

```typescript
// ✅ CORRECT - Use centralized API
import { albumsApi } from "@/lib/api";
const { albums, loading } = await albumsApi.getAlbums({ limit: 20 });

// ❌ WRONG - Direct fetch calls
const response = await fetch(`${API_URL}/albums`, {...});
```

**Available API Objects:**

- `albumsApi` - Regular user album operations
- `adminAlbumsApi` - Admin album management
- `userApi` - User profile and interaction operations
- `mediaApi` - Media upload and management operations

### Shared Types Management (Critical)

**NEVER edit shared types directly in backend or frontend directories:**

```bash
# ✅ CORRECT - Edit types in root shared-types directory, then:
npm run copy:shared-types

# ❌ WRONG - Never edit these directly:
backend/shared/shared-types/
frontend/src/types/shared-types/
```

### Navigation (Critical - Locale Handling)

**ALWAYS use LocaleLink component or useLocaleRouter for navigation:**

```typescript
// ✅ CORRECT - Use LocaleLink for links
import LocaleLink from "@/components/ui/LocaleLink";
<LocaleLink href="/albums" className="nav-link">
  Albums
</LocaleLink>;

// ✅ CORRECT - Use useLocaleRouter for programmatic navigation
import { useLocaleRouter } from "@/lib/navigation";
const router = useLocaleRouter();
router.push("/user/dashboard");

// ❌ WRONG - Direct Next.js Link/router usage
import Link from "next/link";
<Link href="/albums">Albums</Link>; // Missing locale prefix
```

### Component Architecture

- UI components in `/frontend/src/components/ui/` (reusable)
- Feature components in specific directories (`/admin/`, `/user/`, `/albums/`)
- All forms use react-hook-form with zod validation
- Responsive images use `ResponsivePicture` component with 5-tier thumbnails
- **NEVER use Next.js `<Image>` component** - use `<img>` or `<ResponsivePicture>`

### Backend Lambda Patterns

```typescript
// Standard Lambda structure:
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Handle OPTIONS requests for CORS
    if (event.httpMethod === "OPTIONS") {
      return ResponseUtil.noContent(event);
    }

    // Authentication handling
    const validation = await UserAuthMiddleware.validateSession(event);
    if (!validation.isValid) {
      return ResponseUtil.unauthorized(event, "Invalid session");
    }

    // Use shared utilities from /backend/shared/
    const result = await DynamoDBService.someOperation();
    return ResponseUtil.success(event, result);
  } catch (error) {
    console.error("Lambda error:", error);
    return ResponseUtil.error(event, error.message);
  }
};
```

## 📚 Documentation Maintenance (Critical)

### Always Update Documentation When:

1. **Making Code Changes** - API endpoints, architecture patterns, database schema, authentication
2. **Learning New Patterns** - discovered components, performance optimizations, testing patterns
3. **Solving Problems** - bug fixes with architectural implications, workarounds, environment configs

### Documentation Files to Maintain:

**Core Architecture:** `/docs/ARCHITECTURE.md`, `/docs/DATABASE_SCHEMA.md`, `/docs/FRONTEND_ARCHITECTURE.md`
**API & Integration:** `/docs/API.md`, `/docs/OAUTH_INTEGRATION.md`, `/docs/USER_AUTHENTICATION.md`
**Development & Operations:** `/docs/LOCAL_DEVELOPMENT.md`, `/docs/DEPLOYMENT.md`, `/docs/TESTING.md`

## 🔧 Task Execution Strategy ([Full Details](.github/instructions/v2/07-task-execution.instructions.md))

### Development Workflow

1. **Deep Understanding** - analyze requirements, explore repository, validate baseline
2. **Strategic Planning** - pattern analysis, minimal change strategy, architecture compliance
3. **Implementation** - test-driven development, iterative implementation, manual verification
4. **Integration** - documentation updates, final validation, progress reporting

### Local Development Setup

```bash
# 1. Dependencies (required order)
npm run install:all

# 2. Environment files (copy examples)
cp frontend/.env.example frontend/.env.local

# 3. Start frontend development
npm run dev:frontend               # Frontend on :3000

# Note: Backend API requires AWS deployment due to Docker images
# Local backend development is not supported with current Docker-based functions
```

### Deployment Process

```bash
# Backend deployment
./scripts/deploy.sh --env prod --guided

# Frontend deployment (Vercel)
cd frontend && npm run build && vercel --prod
```

## 🎯 Critical File Locations

- **Permissions:** `/backend/shared/permissions.json` (plan/role definitions)
- **Types:** `/shared-types/` (edit here), then run `npm run copy:shared-types`
- **Utils:** `/frontend/src/lib/urlUtils.ts` (media URL composition)
- **Auth:** `/backend/shared/auth/` (user authentication helpers)
- **SAM Template:** `/template.yaml` (infrastructure as code)

## ⚠️ Common Gotchas

1. **Backend requires AWS deployment** - no local backend development due to Docker images
2. **Always use `npm run install:all`** instead of workspace npm install
3. **DynamoDB queries must use GSIs** for non-key lookups
4. **Thumbnail URLs need composition** via `urlUtils.composeThumbnailUrls()`
5. **Permission checks required** before rendering Pro features
6. **CORS headers mandatory** in all Lambda responses
7. **Frontend only for local development** - backend must be deployed to AWS for testing

## 🛡️ Environment & Limitations ([Full Details](.github/instructions/v2/05-environment-limitations.instructions.md))

### Capabilities

- Local repository access with full read/write permissions
- **report_progress tool** for committing and pushing to GitHub PR
- Build, test, and package management operations
- Limited internet access with some domain restrictions

### Restrictions

- Cannot use git/gh commands directly for commits/pushes (use **report_progress** instead)
- Cannot create/update issues or PRs directly
- Cannot fix merge conflicts (requires user intervention)
- Must maintain security and privacy policies

## ✅ Quality Assurance Checklist

- [ ] **⚠️ ALL REQUIREMENTS VERIFIED COMPLETE** - every requirement from problem statement addressed
- [ ] **⚠️ COMPLETION VALIDATION PASSED** - systematic check of all completion criteria
- [ ] Code follows existing patterns and conventions
- [ ] Proper error handling and logging implemented
- [ ] Tests written and passing (if infrastructure exists)
- [ ] Documentation updated if needed
- [ ] Performance implications considered
- [ ] Security implications reviewed
- [ ] `/docs` files updated to reflect changes or new knowledge
- [ ] API patterns use centralized `/frontend/src/lib/api.ts` methods
- [ ] Navigation uses LocaleLink/useLocaleRouter components
- [ ] TypeScript strict mode compliance
- [ ] ESLint rules followed
- [ ] **⚠️ NO OBVIOUS NEXT STEPS REMAINING** - task is genuinely complete

---

This codebase prioritizes serverless architecture, comprehensive testing, and a permission-based feature system. Always search for existing patterns before implementing new features, and leverage the extensive utility library for consistent behavior across the application.

For detailed guidance on any aspect, refer to the specialized instruction files:

- [Core Behavior](.github/instructions/v2/01-core-behavior.instructions.md)
- [Code Changes](.github/instructions/v2/02-code-changes.instructions.md)
- [Testing & Quality](.github/instructions/v2/03-linting-building-testing.instructions.md)
- [Progress Reporting](.github/instructions/v2/04-progress-reporting.instructions.md)
- [Environment Limitations](.github/instructions/v2/05-environment-limitations.instructions.md)
- [Tool Usage](.github/instructions/v2/06-tool-usage.instructions.md)
- [Task Execution](.github/instructions/v2/07-task-execution.instructions.md)
- [Implicit Training Knowledge](.github/instructions/v2/08-implicit-training-knowledge.instructions.md)
- [Comprehensive Development Practices](.github/instructions/v2/09-comprehensive-development-practices.instructions.md)
- [**⚠️ CRITICAL: Task Completion Persistence**](.github/instructions/10-task-completion-persistence.instructions.md)
