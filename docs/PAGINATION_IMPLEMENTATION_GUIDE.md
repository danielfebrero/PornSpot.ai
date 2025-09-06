# Unified Pagination System Implementation Guide

This guide provides step-by-step instructions for implementing the unified pagination system across the PornSpot.ai backend.

## 🎯 Overview

The unified pagination system standardizes all backend pagination using:

- **DynamoDB cursor-based pagination** (no more page numbers)
- **Base64-encoded cursors** for consistency
- **Standardized response format** across all endpoints
- **Shared utility functions** to eliminate code duplication

## 📦 Files Created

### 1. **Pagination Utilities** (`/backend/shared/utils/pagination.ts`)

- `PaginationUtil` class with static methods
- Standard type definitions
- Cursor encoding/decoding functions
- Request parameter parsing and validation

### 2. **Updated Types** (`/backend/shared/shared-types/core.ts`)

- Added `PaginationRequest`, `PaginationMeta`, `ApiPaginatedResponse<T>`
- Added `KeyedPaginatedPayload<K, T>` for keyed responses (e.g., { interactions: T[]; pagination: PaginationMeta })
- Deprecated top-level array + pagination shapes
- Note: Use `ApiPaginatedResponse<T>` for "data" key, `ApiKeyedPaginatedResponse<K, T>` for domain keys

### 3. **Documentation** (`/docs/PAGINATION_SYSTEM_AUDIT.md`)

- Complete audit of current pagination inconsistencies
- Detailed migration plan
- Testing requirements

## 🔄 Migration Steps

### Phase 1: Update Inconsistent Functions

#### 1. **Get Bookmarks** (`/backend/functions/user/interactions/get-bookmarks.ts`)

**Current Issues:**

- Uses `page` + `lastKey` parameters
- URL-encoded JSON instead of Base64
- Inconsistent response format

**Migration:**

```typescript
// BEFORE (inconsistent)
const page = parseInt(queryParams["page"] || "1", 10);
const lastEvaluatedKey = queryParams["lastKey"]
  ? JSON.parse(decodeURIComponent(queryParams["lastKey"]))
  : undefined;

return ResponseUtil.success(event, {
  interactions: enrichedInteractions,
  pagination: {
    page,
    limit,
    hasNext,
    nextKey: encodeURIComponent(JSON.stringify(result.lastEvaluatedKey)),
    total: enrichedInteractions.length,
  },
});

// AFTER (unified)
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";

const { cursor: lastEvaluatedKey, limit } = PaginationUtil.parseRequestParams(
  event.queryStringParameters as Record<string, string> | null,
  DEFAULT_PAGINATION_LIMITS.interactions,
  MAX_PAGINATION_LIMITS.interactions
);

const paginationMeta = PaginationUtil.createPaginationMeta(
  result.lastEvaluatedKey,
  limit
);

return ResponseUtil.success(event, {
  interactions: enrichedInteractions,
  pagination: paginationMeta,
});
```

#### 2. **Get Likes** (`/backend/functions/user/interactions/get-likes.ts`)

**Same migration pattern as bookmarks:**

- Replace page/lastKey with cursor
- Use PaginationUtil methods
- Standardize response format

#### 3. **Get Comments** (`/backend/functions/user/interactions/get-comments.ts`)

**Current Issues:**

- Already uses cursor but inconsistent response format
- Missing pagination fields in some responses

**Migration:**

```typescript
// BEFORE (partially consistent)
const response: any = {
  success: true,
  data: {
    comments,
    pagination: {
      limit,
      hasNext: !!result.lastEvaluatedKey,
    },
  },
};

if (result.lastEvaluatedKey) {
  response.data.pagination.cursor = Buffer.from(
    JSON.stringify(result.lastEvaluatedKey)
  ).toString("base64");
}

// AFTER (fully unified)
const paginationMeta = PaginationUtil.createPaginationMeta(
  result.lastEvaluatedKey,
  limit
);

return ResponseUtil.success(event, {
  comments,
  pagination: paginationMeta,
});
```

### Phase 2: Update Frontend Integration

#### 1. **API Client** (`/frontend/src/lib/api.ts`)

Update interaction API methods to use unified pagination:

```typescript
// BEFORE (page-based)
async getBookmarks(page: number = 1, limit: number = 20, lastKey?: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (lastKey) {
    params.append('lastKey', lastKey);
  }

  // ... rest of implementation
}

// AFTER (cursor-based)
async getBookmarks(cursor?: string, limit: number = 20) {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  if (cursor) {
    params.append('cursor', cursor);
  }

  // ... rest of implementation
}
```

#### 2. **React Query Hooks** (`/frontend/src/hooks/queries/`)

Update infinite query hooks to use cursor pagination:

```typescript
// BEFORE (page-based)
getNextPageParam: (lastPage: any) => {
  if (!lastPage.data?.pagination?.hasNext) return undefined;
  return (lastPage.data.pagination.page || 1) + 1;
};

// AFTER (cursor-based)
getNextPageParam: (lastPage: any) => {
  return lastPage.data?.pagination?.cursor || undefined;
};
```

### Phase 3: Testing

#### 1. **Update Unit Tests**

```typescript
// Test pagination utility functions
describe("PaginationUtil", () => {
  describe("encodeCursor", () => {
    it("should encode lastEvaluatedKey as base64", () => {
      const lastKey = { PK: "USER#123", SK: "INTERACTION#bookmark#456" };
      const cursor = PaginationUtil.encodeCursor(lastKey);

      expect(cursor).toBe(
        Buffer.from(JSON.stringify(lastKey)).toString("base64")
      );
    });

    it("should return null for undefined lastEvaluatedKey", () => {
      expect(PaginationUtil.encodeCursor(undefined)).toBe(null);
    });
  });

  describe("decodeCursor", () => {
    it("should decode base64 cursor to object", () => {
      const lastKey = { PK: "USER#123", SK: "INTERACTION#bookmark#456" };
      const cursor = Buffer.from(JSON.stringify(lastKey)).toString("base64");

      expect(PaginationUtil.decodeCursor(cursor)).toEqual(lastKey);
    });

    it("should throw error for invalid cursor", () => {
      expect(() => PaginationUtil.decodeCursor("invalid-cursor")).toThrow(
        "Invalid cursor format"
      );
    });
  });
});
```

#### 2. **Update Integration Tests**

```typescript
describe("GET /interactions/bookmarks", () => {
  it("should return bookmarks with cursor pagination", async () => {
    const response = await handler(createGetBookmarksEvent());

    const data = expectSuccessResponse(response);
    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("pagination");
    expect(data.pagination).toHaveProperty("hasNext");
    expect(data.pagination).toHaveProperty("cursor");
    expect(data.pagination).toHaveProperty("limit");
  });

  it("should handle cursor parameter correctly", async () => {
    const cursor = PaginationUtil.encodeCursor({
      PK: "USER#123",
      SK: "INTERACTION#bookmark#456",
    });
    const event = createGetBookmarksEvent({ cursor });

    const response = await handler(event);

    expectSuccessResponse(response);
    expect(mockGetUserInteractions).toHaveBeenCalledWith(
      expect.any(String),
      "bookmark",
      20,
      { PK: "USER#123", SK: "INTERACTION#bookmark#456" }
    );
  });
});
```

## 🔧 Implementation Checklist

### Backend Functions

- [ ] **Update get-bookmarks.ts**

  - [ ] Replace page/lastKey with cursor parameter
  - [ ] Use PaginationUtil.parseRequestParams()
  - [ ] Use PaginationUtil.createPaginatedResponse()
  - [ ] Update unit tests
  - [ ] Update integration tests

- [ ] **Update get-likes.ts**

  - [ ] Same changes as get-bookmarks.ts
  - [ ] Update unit tests
  - [ ] Update integration tests

- [ ] **Update get-comments.ts**
  - [ ] Standardize response format
  - [ ] Use PaginationUtil.createPaginatedResponse()
  - [ ] Update unit tests
  - [ ] Update integration tests

### Frontend Updates

- [ ] **Update API client methods**

  - [ ] Remove page-based parameters
  - [ ] Add cursor-based parameters
  - [ ] Update TypeScript interfaces

- [ ] **Update React Query hooks**

  - [ ] Change getNextPageParam implementation
  - [ ] Update query key structures
  - [ ] Test infinite scroll behavior

- [ ] **Update components**
  - [ ] Remove page number displays
  - [ ] Update pagination controls
  - [ ] Test user interactions

### Documentation

- [ ] **Update API.md**

  - [ ] Document new pagination format
  - [ ] Add cursor usage examples
  - [ ] Mark old pagination as deprecated

- [ ] **Update FRONTEND_ARCHITECTURE.md**
  - [ ] Document React Query patterns
  - [ ] Add infinite scroll examples
  - [ ] Update best practices

## 🚨 Breaking Changes

### API Changes

1. **Request Parameters**

   - ❌ `page` parameter removed
   - ❌ `lastKey` parameter removed (URL-encoded)
   - ✅ `cursor` parameter added (Base64-encoded)

2. **Response Format**
   - ❌ `pagination.page` removed
   - ❌ `pagination.nextKey` removed
   - ❌ `pagination.total` removed (unreliable with DynamoDB)
   - ✅ `pagination.cursor` added
   - ✅ `pagination.hasNext` standardized
   - ✅ `pagination.limit` standardized

### Frontend Changes

1. **API Calls**

   - Update all pagination-related API calls
   - Remove page number management
   - Add cursor management

2. **State Management**
   - Update React Query implementations
   - Remove page-based state tracking
   - Add cursor-based infinite scroll

## 🎭 Rollback Plan

If issues arise during migration:

1. **Keep old functions temporarily**

   - Rename current functions to `*-legacy.ts`
   - Deploy new functions alongside old ones
   - Use feature flags to switch between implementations

2. **Gradual migration**

   - Migrate one endpoint at a time
   - Test thoroughly before moving to next endpoint
   - Monitor error rates and performance

3. **Quick rollback**
   - Restore old function files
   - Revert frontend changes
   - Update routing if necessary

## 📊 Success Metrics

- [ ] All backend functions use consistent pagination format
- [ ] Frontend infinite scroll works smoothly
- [ ] No pagination-related errors in logs
- [ ] Performance remains stable or improves
- [ ] User experience is maintained or enhanced

---

**Implementation Timeline**: 1-2 weeks  
**Risk Level**: Medium (breaking changes)  
**Rollback Time**: < 1 hour
