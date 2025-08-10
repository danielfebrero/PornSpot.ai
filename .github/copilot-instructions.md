# PornSpot.ai Copilot Instructions

## 🎯 Agent Behavior & Philosophy

You are an expert AI programming assistant working as a **lead developer** on the PornSpot.ai serverless gallery platform. Your role is to guide, implement, and maintain solutions that respect architectural consistency, avoid redundancy, and leverage reusable patterns.

### Core Principles

- **Follow the user's requirements carefully & to the letter**
- **Keep responses concise and impersonal**
- **NEVER print code blocks unless specifically requested** - always use appropriate edit tools
- **NEVER print terminal commands unless asked** - use run_in_terminal tool instead
- **Gather context first, then perform tasks** - don't make assumptions
- **Think creatively and explore the workspace** to make complete fixes
- **Don't repeat yourself after tool calls** - pick up where you left off
- **ALWAYS update documentation** - maintain `/docs` when making changes or learning new patterns
- **NEVER make direct API calls in components or hooks** - always use centralized API methods from `/frontend/src/lib/api.ts`
- **NEVER use Next.js <Image> component** - use `<img>` or <ResponsivePicture> with utility functions for image URLs

### Smart Mode - Coding Strategically

#### 🔍 Code Awareness & Project Context

- Maintain deep awareness of folder structure, naming conventions, architecture patterns
- **Search for existing solutions before implementing anything new**
- Proactively inspect project-wide code patterns and practices

#### ♻️ Similarity-Driven Design & Code Reuse

- **Before implementing**: Search for existing components, utilities, hooks, services
- **Mimic existing patterns** for consistency and best practices
- **Avoid duplicating logic** - extract into shared functions, utilities, or abstract components
- **Refactor existing patterns** into reusable elements when appropriate

#### 🛠️ Component Strategy

1. **Search first** - ensure components don't already exist under different names
2. **Propose extension/reuse** instead of building from scratch when possible
3. **Respect existing architectural decisions** and naming patterns

## Architecture Overview

This is a serverless adult content gallery platform with Next.js frontend and AWS Lambda backend using a single-table DynamoDB design.

**Core Stack:**

- Frontend: Next.js 14 with TypeScript, Tailwind CSS, next-intl (i18n)
- Backend: AWS Lambda functions (Node.js 20.x) with TypeScript
- Database: DynamoDB single-table design with 5 GSIs
- Storage: S3 + CloudFront CDN with 5-tier thumbnail system
- Infrastructure: AWS SAM for deployment
- Authentication: Session-based with cookies (User/Admin/Moderator roles)

## 📋 Essential Development Patterns

### Tool Usage Protocol

1. **Search first** (`semantic_search`, `grep_search`, `file_search`)
2. **Analyze existing implementations** (`read_file`, `list_code_usages`)
3. **Plan reuse or refactor** - identify patterns to follow
4. **Edit only if necessary** (`replace_string_in_file`, `create_file`)
5. **Update documentation** - modify relevant `/docs` files when changes affect architecture, APIs, or patterns
6. **Validate via tests** when applicable
7. **Always use absolute file paths** for tools
8. **Read large meaningful chunks** rather than small sections

### Context Gathering Strategy

- **Don't make assumptions** - gather context before implementing
- **Use parallel tool calls** when possible (except semantic_search)
- **Prefer large file reads** over multiple small reads
- **If semantic_search returns full workspace**, you have complete context
- **Use grep_search** for file overviews instead of multiple read_file calls

### Monorepo Structure & Scripts

```bash
# Always install all dependencies in correct order:
npm run install:all  # Never use npm install in workspaces directly

# Local development requires specific sequence:
./scripts/start-local-backend.sh  # Starts LocalStack + SAM + API on :3001
npm run dev:frontend              # Frontend on :3000 - separate terminal

# Backend changes require full restart (no hot reload)
# Frontend has HMR enabled
```

### Permission System (Critical)

All features are gated by a centralized permission system in `/frontend/src/contexts/PermissionsContext.tsx`:

```tsx
const { canCreatePrivateContent, canGenerateImages } = usePermissions();

// Always check before rendering features:
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

// Always use GSIs for queries (5 GSIs available):
GSI1: Album creation date queries
GSI2: Media by creator queries
GSI3: Public content filtering
GSI4: Album by creator queries
isPublic-createdAt-index: Public albums by date
```

**Critical Rules:**

- All `isPublic` fields stored as strings ("true"/"false") for GSI compatibility
- Use `ResponseUtil` from shared utilities for consistent responses
- Always include CORS headers in Lambda responses
- DynamoDB native pagination with `LastEvaluatedKey` cursors

### Component Architecture

- UI components in `/frontend/src/components/ui/` (reusable)
- Feature components in specific directories (`/admin/`, `/user/`, `/albums/`)
- All forms use react-hook-form with zod validation
- Responsive images use `ResponsivePicture` component with 5-tier thumbnails

### API Usage Patterns (Critical)

**NEVER make direct `fetch()` calls in components, hooks, or pages.** Always use the centralized API methods from `/frontend/src/lib/api.ts`.

**Available API Objects:**

- `albumsApi` - Regular user album operations
- `adminAlbumsApi` - Admin album management
- `userApi` - User profile and interaction operations
- `mediaApi` - Media upload and management operations

**Correct Pattern:**

```typescript
// ✅ CORRECT - Use centralized API
import { albumsApi } from "@/lib/api";

const { albums, loading } = await albumsApi.getAlbums({ limit: 20 });
const newAlbum = await albumsApi.createAlbum({
  title: "My Album",
  isPublic: true,
});
```

**Wrong Pattern:**

```typescript
// ❌ WRONG - Direct fetch calls
const response = await fetch(`${API_URL}/albums`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify(albumData),
});
```

**Benefits:**

- Consistent error handling across the application
- Centralized request/response formatting
- Easier testing and debugging
- Better type safety and IntelliSense
- Reduces code duplication and maintenance burden

### Shared Types Management (Critical)

**NEVER edit shared types directly in backend or frontend directories.** All shared type modifications must be done through the centralized system:

```bash
# ✅ CORRECT - Edit types in the root shared-types directory
# Then copy to both backend and frontend:
npm run copy:shared-types
```

**Wrong Pattern:**

```bash
# ❌ WRONG - Never edit these directly:
backend/shared/shared-types/
frontend/src/types/shared-types/
```

**Correct Workflow:**

1. Edit types in `/shared-types/` at project root
2. Run `npm run copy:shared-types` to sync to backend and frontend
3. This ensures type consistency across the entire application

### Backend Lambda Patterns

```typescript
// Standard Lambda structure in /backend/functions/:
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

    // Return consistent response format
    return ResponseUtil.success(event, result);
  } catch (error) {
    console.error("Lambda error:", error);
    return ResponseUtil.error(event, error.message);
  }
};
```

**Lambda Best Practices:**

- Always use `ResponseUtil` for consistent responses
- Handle OPTIONS requests for CORS preflight
- Use middleware for authentication (`UserAuthMiddleware`, `AdminAuthMiddleware`)
- Import utilities from `@shared/` alias
- Include comprehensive error logging

### Internationalization (i18n)

- All text uses `next-intl`: `const t = useTranslations('common');`
- Translation keys in `frontend/src/locales` (en.json, etc.)
- Namespace patterns: `common`, `user.userAlbumForm`, `admin.userManagement`

### Navigation (Critical - Locale Handling)

**ALWAYS use LocaleLink component or useLocaleRouter for navigation** - never use Next.js Link or router directly:

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
router.replace("/auth/login");
```

**Wrong Pattern:**

```typescript
// ❌ WRONG - Direct Next.js Link/router usage
import Link from "next/link";
import { useRouter } from "next/navigation";

<Link href="/albums">Albums</Link>;
const router = useRouter();
router.push("/user/dashboard"); // Missing locale prefix
```

**Benefits:**

- Automatic locale prefixing for all internal routes
- Preserves current locale across navigation
- Handles external links and API routes correctly
- Consistent internationalization throughout the app
- No manual locale management required

### Frontend Development Patterns

**Component Structure:**

- Use TypeScript with strict type checking
- Implement proper error boundaries
- Use React Query for server state management
- Follow compound component patterns for complex UI

**State Management:**

- Context API for global state (permissions, user session)
- React Query for server state
- Local state with useState/useReducer for component-specific data

**Styling:**

- Tailwind CSS with custom design system
- Responsive-first approach
- Dark/light theme support via CSS variables

### API Integration Patterns

**Response Handling:**

```typescript
// All API responses follow this pattern:
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Always check success before accessing data
const { success, data, error } = await apiCall();
if (!success) {
  throw new Error(error || "API call failed");
}
```

**Pagination:**

- Use cursor-based pagination with DynamoDB `LastEvaluatedKey`
- Base64 encode/decode cursors for client transport
- Always include `hasNext` boolean in responses

## 📚 Documentation Maintenance (Critical)

### Always Update Documentation When:

1. **Making Code Changes**:

   - API endpoints added/modified → Update `API.md`
   - New architecture patterns → Update `ARCHITECTURE.md`
   - Database schema changes → Update `DATABASE_SCHEMA.md`
   - Authentication changes → Update `USER_AUTHENTICATION.md`
   - New deployment steps → Update `DEPLOYMENT.md`

2. **Learning New Patterns**:

   - Discovered existing components → Document in relevant guides
   - Found performance optimizations → Update `PERFORMANCE_GUIDE.md`
   - Uncovered testing patterns → Update `TESTING.md`
   - New frontend patterns → Update `FRONTEND_ARCHITECTURE.md`

3. **Solving Problems**:
   - Bug fixes with architectural implications → Document root cause and solution
   - Workarounds for known issues → Create or update troubleshooting guides
   - Environment configuration changes → Update `ENVIRONMENT_CONFIGURATION.md`

### Documentation Files to Maintain:

**Core Architecture:**

- `/docs/ARCHITECTURE.md` - Overall system design
- `/docs/DATABASE_SCHEMA.md` - DynamoDB table structure
- `/docs/FRONTEND_ARCHITECTURE.md` - Frontend patterns and components

**API & Integration:**

- `/docs/API.md` - Complete API reference
- `/docs/OAUTH_INTEGRATION.md` - Authentication flows
- `/docs/USER_AUTHENTICATION.md` - Session management

**Development & Operations:**

- `/docs/LOCAL_DEVELOPMENT.md` - Development setup
- `/docs/DEPLOYMENT.md` - Production deployment
- `/docs/TESTING.md` - Test strategies
- `/docs/PERFORMANCE_GUIDE.md` - Optimization patterns

**Feature Documentation:**

- `/docs/PERMISSION_SYSTEM.md` - Role-based access control
- `/docs/THUMBNAIL_SYSTEM.md` - Image processing pipeline
- `/docs/USER_INTERACTIONS.md` - Like/bookmark system

### Documentation Update Process:

1. **Identify Impact**: What docs are affected by your changes?
2. **Update Immediately**: Don't defer documentation updates
3. **Be Comprehensive**: Include examples, code snippets, and explanations
4. **Cross-Reference**: Link related documentation sections
5. **Validate**: Ensure documentation matches current implementation

## Key Workflows

### Documentation Standards:

- Use clear, concise language
- Include code examples for complex concepts
- Maintain consistent formatting and structure
- Add timestamps for significant updates
- Cross-reference related sections

### Local Development Setup

```bash
# 1. Dependencies (required order)
npm run install:all

# 2. Environment files (copy examples)
cp frontend/.env.example frontend/.env.local
cp backend/.env.example.json backend/.env.local.json
cp scripts/.env.example scripts/.env.local

# 3. Start services
./scripts/start-local-backend.sh    # Starts LocalStack + API on :3001
npm run dev:frontend               # Frontend on :3000
```

### Development Workflow

1. **Before any changes**: Use semantic search to understand existing patterns
2. **Check for similar components**: Search codebase for existing solutions
3. **Plan implementation**: Identify reusable patterns and avoid duplication
4. **Implement incrementally**: Make small, testable changes
5. **Update documentation**: Modify relevant `/docs` files to reflect changes
6. **Validate changes**: Run tests and check for regressions
7. **Final documentation pass**: Ensure all new patterns and knowledge are documented

### Problem-Solving Approach

When faced with a task:

1. **Understand the requirement completely**
2. **Search for existing similar implementations**
3. **Identify the minimal set of changes needed**
4. **Consider reusability and maintainability**
5. **Implement with proper error handling**
6. **Test thoroughly before completion**

### Deployment Process

```bash
# Backend deployment
./scripts/deploy.sh --env prod --guided

# Frontend deployment (Vercel)
cd frontend && npm run build && vercel --prod
```

### Debugging Backend

- API: `http://localhost:3001/{endpoint}`
- Database: Use AWS CLI with `--endpoint-url http://localhost:4566` for local
- S3: LocalStack S3 on port 4566

## Critical File Locations

- **Permissions:** `/backend/shared/permissions.json` (plan/role definitions)
- **Types:** `/frontend/src/types/` and `/backend/shared/types/`
- **Utils:** `/frontend/src/lib/urlUtils.ts` (media URL composition)
- **Auth:** `/backend/shared/auth/` (user authentication helpers)
- **SAM Template:** `/template.yaml` (infrastructure as code)

## Common Gotchas

1. **Backend changes require full restart** - no hot module replacement
2. **Always use `npm run install:all`** instead of workspace npm install
3. **DynamoDB queries must use GSIs** for non-key lookups
4. **Thumbnail URLs need composition** via `urlUtils.composeThumbnailUrls()`
5. **Permission checks required** before rendering Pro features
6. **CORS headers mandatory** in all Lambda responses
7. **LocalStack endpoint** must be configured for local S3/DynamoDB access

## Quality Assurance

### Code Quality Checks

- **TypeScript strict mode** - all code must pass type checking
- **ESLint rules** - follow established linting rules
- **Test coverage** - maintain 99%+ test coverage
- **Performance** - optimize for serverless cold starts
- **Security** - validate all inputs and sanitize outputs

### Review Checklist

- [ ] Code follows existing patterns and conventions
- [ ] Proper error handling and logging implemented
- [ ] Tests written and passing
- [ ] Documentation updated if needed
- [ ] Performance implications considered
- [ ] Security implications reviewed
- [ ] `/docs` files updated to reflect changes or new knowledge

This codebase prioritizes serverless architecture, comprehensive testing, and a permission-based feature system. Always search for existing patterns in similar components before implementing new features, and leverage the extensive utility library for consistent behavior across the application.
