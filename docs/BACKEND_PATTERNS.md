# Backend Patterns Using Shared Types

This document describes common patterns in backend functions using the shared types from backend/shared/shared-types/.

## Response Patterns

### ApiResponse<T>

All API endpoints return an [`ApiResponse<T>`](backend/shared/shared-types/core.ts:6) wrapper:

```typescript
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

**Pattern**: Wrap success responses with { success: true, data: ... } and errors with { success: false, error: ... }.

Example in functions/user/media/list.ts:

```typescript
return ResponseUtil.success(event, {
  media,
  pagination,
});
```

### Paginated Responses

List endpoints use [`ApiPaginatedResponse<T>`](backend/shared/shared-types/core.ts:41) or [`ApiKeyedPaginatedResponse<K, T>`](backend/shared/shared-types/core.ts:32).

**Pattern for non-keyed**: { success: true, data: { data: T[], pagination: PaginationMeta } }

**Pattern for keyed**: { success: true, data: { [key]: T[], pagination: PaginationMeta } }

Example in functions/user/interactions/get-bookmarks.ts:

```typescript
return ResponseUtil.success(event, {
  interactions,
  pagination,
});
```

## Query Patterns

### PaginationRequest

List endpoints accept [`PaginationRequest`](backend/shared/shared-types/core.ts:14):

```typescript
export interface PaginationRequest {
  cursor?: string;
  limit?: number;
}
```

**Pattern**: Parse with PaginationUtil.parseRequestParams(event.queryStringParameters, defaultLimit, maxLimit).

## Database Patterns

### EntityType

All DynamoDB items have [`EntityType`](backend/shared/shared-types/core.ts:46) for single-table design.

**Pattern**: Set EntityType: "User", "Album", etc., in putItem.

Example in functions/user/auth/register.ts:

```typescript
const userEntity: UserEntity = {
  PK: `USER#${userId}`,
  SK: "METADATA",
  EntityType: "User",
  // ...
};
```

### BaseEntity

All entities extend [`BaseEntity`](backend/shared/shared-types/database.ts:18) with PK, SK, EntityType.

**Pattern**: Use for all put/get/delete operations.

### Metadata

Flexible [`Metadata`](backend/shared/shared-types/core.ts:90) for arbitrary data.

**Pattern**: Store as { [key: string]: any } in entities like MediaEntity.metadata.

### ThumbnailUrls

Images use [`ThumbnailUrls`](backend/shared/shared-types/core.ts:79) for multiple sizes.

**Pattern**: Populate in media processing Lambdas.

## Authentication Patterns

### AuthProvider

Users have [`AuthProvider`](backend/shared/shared-types/core.ts:74): "email" or "google".

**Pattern**: Set during registration/login.

## Subscription Patterns

### SubscriptionStatus

Subscriptions use [`SubscriptionStatus`](backend/shared/shared-types/core.ts:76): "active", "canceled", "expired".

**Pattern**: Update on Stripe webhooks.

## Error Handling Patterns

**Pattern**: Return ApiResponse with success: false, error: message for validation, auth, or server errors.
