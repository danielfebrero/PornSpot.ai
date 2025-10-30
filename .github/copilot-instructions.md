# PornSpot.ai - AI Agent Instructions

## Project Overview

Premium adult content gallery platform built with Next.js 15 frontend and AWS serverless backend (Lambda + DynamoDB single-table design). Turborepo monorepo with TypeScript throughout.

## Architecture Essentials

### Monorepo Structure

- **Turborepo** orchestrates builds/tests across workspaces (`frontend/`, `backend/`)
- **Shared types**: `shared-types/` is source of truth, copied to both workspaces via `npm run copy:shared-types`
- Import shared types: `@shared/shared-types` in backend, `@/types/shared-types` in frontend

### Backend (AWS SAM + Lambda)

- **Single-table DynamoDB design** with 8 GSIs (see `docs/DATABASE_SCHEMA.md`)
- All entities have `PK`, `SK`, `EntityType` (from `BaseEntity` in `shared-types/database.ts`)
- **Critical**: `isPublic` stored as string `"true"|"false"` for GSI compatibility
- Lambda handlers use **LambdaHandlerUtil** wrapper pattern (avoid manual auth/validation boilerplate):
  ```typescript
  export const handler = LambdaHandlerUtil.withAuth(handleFunction, {
    requireBody: true,
    validatePathParams: ["albumId"],
  });
  ```
- Responses use `ResponseUtil.success(event, data)` returning `ApiResponse<T>`
- Utilities in `backend/shared/utils/`: DynamoDB ops (`dynamodb.ts`), auth (`user-auth.ts`), validation (`validation.ts`)

### Frontend (Next.js 15 App Router)

- **TanStack Query** for all data fetching (migration ongoing, see `docs/TANSTACK_QUERY_IMPLEMENTATION.md`)
- Query keys follow factory pattern in `frontend/src/hooks/query-keys.ts`
- **DeviceProvider** hybrid SSR/client detection for responsive UI - use `useIsMobile()`, `useIsTablet()`, `useIsDesktop()`
- API layer structured by domain: `frontend/src/lib/api/{user,albums,media,admin-*}.ts`
- **Internationalization**: next-intl with locale files in `frontend/src/locales/`

### ComfyUI Integration (Event-Driven)

- Python monitor connects to ComfyUI WebSocket, publishes events to EventBridge
- Lambda functions handle generation queue, progress updates, completion
- `client_id` stored in DynamoDB on monitor init for prompt submission
- Prompt optimization via OpenRouter (streaming WebSocket responses)

## Critical Workflows

### Local Development

```bash
# Frontend
cd frontend && npm run dev  # Port 3000
```

Frontend has hot reload. Backend require deployment on stage environment for testing changes.

### Testing (⚠️ Currently Broken)

Tests exist but are non-functional (import errors, type mismatches). See `docs/TESTING.md` warning.

```bash
npm run test:backend  # Aspirational
npm run test:frontend  # Status unknown
```

### Deployment

- Backend: `npm run deploy:backend:{env}`
- Frontend: Vercel (configured separately)
- Migration scripts required for schema changes (see `docs/DATABASE_SCHEMA.md` for GSI backfills)

## Project-Specific Conventions

### Type Safety & Shared Types

- **Never** manually duplicate types between frontend/backend - use `shared-types/`
- After changing `shared-types/`, run `npm run copy:shared-types`
- Backend imports use `@shared/shared-types`, frontend uses `@/types/shared-types`

### DynamoDB Patterns

- **Access patterns** drive GSI design - check existing GSIs before adding new queries
- Use utility functions from `backend/shared/utils/dynamodb.ts` (e.g., `queryWithPagination`)
- Pagination via `PaginationUtil.parseRequestParams()` and `cursor` token system
- **Counters**: Use `CounterUtil` for atomic increments (views, likes, etc.)

### Backend Lambda Patterns

- Always use `LambdaHandlerUtil.withAuth()` wrapper - don't write raw handlers
- Import `ResponseUtil` for consistent API responses: `success()`, `badRequest()`, `internalError()`
- Validate inputs with `ValidationUtil` methods (e.g., `validateEmail`, `validateAlbumTitle`)
- Authentication returns `AuthResult` with `{ user, role?, sessionId? }`

### Frontend Data Fetching

- **Use TanStack Query hooks** (not legacy custom hooks) - follow patterns in `frontend/src/hooks/queries/`
- Query keys via centralized factory: `queryKeys.albums.list()`, `queryKeys.media.byId(id)`
- Mutations include optimistic updates - see `useCreateAlbum` example
- WebSocket connections for real-time generation updates (separate from REST API)

### Error Handling

- Backend: Use `ResponseUtil.internalError(event, message)` - logs automatically
- Frontend: React Error Boundaries wrap route segments (see `docs/ERROR_BOUNDARY_IMPLEMENTATION.md`)
- **Don't** add generic try-catch unless you have specific recovery logic

### File Organization

- Backend Lambda functions: `backend/functions/{domain}/{action}.ts` (e.g., `user/auth/login.ts`)
- Frontend components: `frontend/src/components/{ui|user|admin}/`
- Shared utilities: Backend in `backend/shared/utils/`, frontend in `frontend/src/lib/`

## Key Files & Patterns

### Must-Read Documentation

- `docs/ARCHITECTURE.md` - System design, CDN, ComfyUI integration
- `docs/BACKEND_PATTERNS.md` - Response/query patterns, entity types
- `docs/DATABASE_SCHEMA.md` - Single-table design, GSI usage, migration scripts
- `docs/SHARED_UTILITIES.md` - LambdaHandlerUtil, ValidationUtil, CounterUtil patterns

### Example Patterns

- Lambda handler: `backend/functions/user/media/list.ts`
- TanStack Query hook: `frontend/src/hooks/queries/useAlbums.ts`
- DynamoDB utility usage: `backend/shared/utils/dynamodb.ts` (see exported functions)
- Shared type definition: `shared-types/core.ts` (ApiResponse, PaginationRequest)

### Environment Configuration

- Frontend: `frontend/.env.local` (copy from `.env.example`)
- Backend: `backend/.env.local.json` (JSON format for SAM CLI)
- Scripts: `scripts/.env.local`
- **Never commit** `.env.local*` files

## Common Pitfalls

1. **Shared Types Sync**: Forgetting to run `copy:shared-types` after changing `shared-types/` causes build errors
2. **isPublic as String**: DynamoDB GSI requires `"true"|"false"` strings, not booleans
3. **Manual Lambda Handlers**: Use `LambdaHandlerUtil.withAuth()` - don't reimplement auth/validation
4. **Legacy Hooks**: Use TanStack Query hooks (in `hooks/queries/`), not old custom hooks
5. **Test Suite**: Tests are broken - don't expect them to pass (see `docs/TESTING.md`)

## Integration Points

- **ComfyUI**: WebSocket + EventBridge event-driven architecture (see `docs/COMFYUI_MONITOR_REFACTORING.md`)
- **OpenRouter**: AI prompt optimization via streaming API (see `docs/OPENROUTER_SERVICE.md`)
- **Payment**: TrustPay/Finby integration for subscriptions (see `docs/TRUSTPAY_*.md`, `docs/FINBY_*.md`)
- **OAuth**: Google authentication for users and admins (see `docs/OAUTH_INTEGRATION.md`)
- **Email**: SendGrid for transactional emails (templates in `backend/shared/email_templates/`)

## Commands Reference

```bash
# Development
npm run dev:frontend         # Start frontend (port 3000)

# Build
npm run build                # Build all workspaces (Turbo)
npm run build:backend        # Backend TypeScript compilation
npm run build:frontend       # Next.js production build

# Deployment
npm run deploy:backend:{env}  # Backend only deployment (stage, prod)

# Utilities
npm run copy:shared-types    # Sync shared-types to workspaces
```

---

**When in doubt**: Check `docs/` directory for detailed guides on specific features. Architecture decisions are documented, not aspirational.
