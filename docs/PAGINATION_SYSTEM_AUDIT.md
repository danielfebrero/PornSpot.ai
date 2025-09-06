# Backend Pagination System Audit

This document provides a comprehensive analysis of pagination inconsistencies across the PornSpot.ai backend and proposes a unified pagination system.

## Current Pagination Issues

The backend currently uses **multiple inconsistent pagination patterns**:

1. **DynamoDB Cursor-based** - uses `cursor` parameter with base64-encoded `lastEvaluatedKey`
2. **Page-based with lastKey** - uses `page` + `lastKey` parameters
3. **Mixed approaches** - some functions use different field names and encoding methods

## Functions Using Pagination

### ✅ **Consistent Cursor-based (Good Examples)**

#### 1. **Albums GET** (`/backend/functions/albums/get.ts`)

- **Pattern**: DynamoDB cursor-based
- **Input Parameters**:
  - `cursor` (base64-encoded JSON)
  - `limit` (default: 20)
- **Response Format**:
  ```typescript
  {
    albums: Album[],
    nextCursor: string | null,
    hasNext: boolean
  }
  ```
- **Encoding**: Base64 JSON of `lastEvaluatedKey`
- **Status**: ✅ **CONSISTENT** - This is the ideal pattern

#### 2. **Media GET** (`/backend/functions/media/get.ts`)

- **Pattern**: DynamoDB cursor-based
- **Input Parameters**:
  - `cursor` (base64-encoded JSON)
  - `limit` (default: 50)
- **Response Format**:
  ```typescript
  {
    media: Media[],
    pagination: {
      hasNext: boolean,
      cursor: string | null
    }
  }
  ```
- **Encoding**: Base64 JSON of `lastEvaluatedKey`
- **Status**: ✅ **CONSISTENT**

#### 3. **Admin Albums List** (`/backend/functions/admin/albums/list.ts`)

- **Pattern**: DynamoDB cursor-based
- **Input Parameters**:
  - `cursor` (base64-encoded JSON)
  - `limit` (default: 20)
- **Response Format**:
  ```typescript
  {
    albums: Album[],
    pagination: {
      hasNext: boolean,
      cursor: string | null
    },
    total: number
  }
  ```
- **Encoding**: Base64 JSON of `lastEvaluatedKey`
- **Status**: ✅ **CONSISTENT**

#### 4. **User Media List** (`/backend/functions/user/media/list.ts`)

- **Pattern**: DynamoDB cursor-based
- **Input Parameters**:
  - `cursor` (base64-encoded JSON)
  - `limit` (default: 50)
- **Response Format**:
  ```typescript
  {
    media: Media[],
    pagination: {
      hasNext: boolean,
      cursor: string | null
    }
  }
  ```
- **Encoding**: Base64 JSON of `lastEvaluatedKey`
- **Status**: ✅ **CONSISTENT**

### ❌ **Inconsistent Page-based with nextKey**

#### 5. **Get Bookmarks** (`/backend/functions/user/interactions/get-bookmarks.ts`)

- **Pattern**: Page-based with lastKey
- **Input Parameters**:
  - `page` (default: 1)
  - `limit` (default: 20, max: 100)
  - `lastKey` (URL-encoded JSON)
- **Response Format**:
  ```typescript
  {
    interactions: UserInteraction[],
    pagination: {
      page: number,
      limit: number,
      hasNext: boolean,
      nextKey: string | undefined,
      total: number // ⚠️ This is current page count, not total
    }
  }
  ```
- **Encoding**: URL-encoded JSON of `lastEvaluatedKey`
- **Status**: ❌ **INCONSISTENT** - Uses different pattern and encoding

#### 6. **Get Likes** (`/backend/functions/user/interactions/get-likes.ts`)

- **Pattern**: Page-based with lastKey
- **Input Parameters**:
  - `page` (default: 1)
  - `limit` (default: 20, max: 100)
  - `lastKey` (URL-encoded JSON)
- **Response Format**:
  ```typescript
  {
    interactions: UserInteraction[],
    pagination: {
      page: number,
      limit: number,
      hasNext: boolean,
      nextKey: string | undefined,
      total: number // ⚠️ This is current page count, not total
    }
  }
  ```
- **Encoding**: URL-encoded JSON of `lastEvaluatedKey`
- **Status**: ❌ **INCONSISTENT** - Same issues as bookmarks

#### 7. **Get Comments** (`/backend/functions/user/interactions/get-comments.ts`)

- **Pattern**: DynamoDB cursor-based (partially)
- **Input Parameters**:
  - `cursor` (base64-encoded JSON)
  - `limit` (default: 20)
- **Response Format**:
  ```typescript
  {
    comments: Comment[],
    pagination: {
      limit: number,
      hasNext: boolean,
      cursor?: string // ⚠️ Inconsistent field presence
    }
  }
  ```
- **Encoding**: Base64 JSON of `lastEvaluatedKey`
- **Status**: ⚠️ **PARTIALLY CONSISTENT** - Uses cursor but response format differs

## Recommended Unified Pagination System

### **Standard Pattern: DynamoDB Cursor-based**

All pagination should follow this consistent pattern:

#### **Request Parameters**

```typescript
interface PaginationParams {
  cursor?: string; // Base64-encoded JSON of DynamoDB lastEvaluatedKey
  limit?: number; // Default varies by endpoint, reasonable maximums
}
```

#### **Response Format**

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    hasNext: boolean;
    cursor: string | null; // Base64-encoded JSON for next page
    limit: number; // Actual limit used
  };
}
```

#### **Encoding Standard**

- **Input**: `cursor` parameter as Base64-encoded JSON string
- **Output**: `cursor` field as Base64-encoded JSON string or `null`
- **Method**: `Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64")`
- **Parsing**: `JSON.parse(Buffer.from(cursor, "base64").toString())`

### **Type Definitions**

#### **Shared Pagination Types** (from backend/shared/shared-types/core.ts)

```typescript
// Request parameter interface
export interface PaginationRequest {
  cursor?: string;
  limit?: number;
}

// Response pagination metadata
export interface PaginationMeta {
  hasNext: boolean;
  cursor: string | null;
  limit: number;
}

// Generic paginated response for endpoints returning array under "data"
export type ApiPaginatedResponse<T> = ApiResponse<PaginatedListPayload<T>>;

// Where PaginatedListPayload<T> = { data: T[]; pagination: PaginationMeta }
```

#### **Utility Functions**

```typescript
// Cursor encoding/decoding utilities
export class PaginationUtil {
  static encodeCursor(
    lastEvaluatedKey: Record<string, any> | undefined
  ): string | null {
    return lastEvaluatedKey
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64")
      : null;
  }

  static decodeCursor(
    cursor: string | undefined
  ): Record<string, any> | undefined {
    if (!cursor) return undefined;

    try {
      return JSON.parse(Buffer.from(cursor, "base64").toString());
    } catch (error) {
      throw new Error("Invalid cursor format");
    }
  }

  static createPaginationMeta(
    lastEvaluatedKey: Record<string, any> | undefined,
    limit: number
  ): PaginationMeta {
    return {
      hasNext: !!lastEvaluatedKey,
      cursor: this.encodeCursor(lastEvaluatedKey),
      limit,
    };
  }
}
```

## Migration Plan

### **Phase 1: Create Shared Utilities**

1. Create `/backend/shared/utils/pagination.ts` with utility functions
2. Add pagination types to `/backend/shared/types/index.ts`
3. Update all imports to use shared utilities

### **Phase 2: Migrate Inconsistent Functions**

1. **Get Bookmarks** - Convert from page/lastKey to cursor pattern
2. **Get Likes** - Convert from page/lastKey to cursor pattern
3. **Get Comments** - Standardize response format

### **Phase 3: Update Frontend**

1. Update API client methods to use consistent cursor pattern
2. Update React Query hooks to handle unified pagination
3. Remove page-based pagination logic

### **Phase 4: Validation & Testing**

1. Update all tests to use new pagination format
2. Validate frontend-backend integration
3. Update documentation

## Breaking Changes Required

### **Backend Functions to Update**

- `get-bookmarks.ts` - Change from page/lastKey to cursor
- `get-likes.ts` - Change from page/lastKey to cursor
- `get-comments.ts` - Standardize response format

### **Frontend Updates Required**

- API client methods in `/frontend/src/lib/api.ts`
- React Query hooks expecting page-based pagination
- Components using page-based pagination

### **Database Impact**

- **None** - All functions use DynamoDB `lastEvaluatedKey` internally
- Only the API interface changes

## Implementation Priority

### **High Priority** (Inconsistent encoding)

1. ❌ Get Bookmarks - URL-encoded vs Base64-encoded
2. ❌ Get Likes - URL-encoded vs Base64-encoded

### **Medium Priority** (Different response format)

3. ⚠️ Get Comments - Missing response fields

### **Low Priority** (Minor field naming)

4. Various functions with slightly different response field names

## Testing Requirements

### **Unit Tests**

- Test cursor encoding/decoding utilities
- Test pagination metadata generation
- Test invalid cursor handling

### **Integration Tests**

- Test end-to-end pagination flows
- Test cursor continuity across pages
- Test limit boundaries and validation

### **Frontend Tests**

- Test React Query hooks with new pagination
- Test infinite scroll components
- Test error handling for invalid cursors

---

**Last Updated**: December 2024  
**Next Review**: After pagination system unification
