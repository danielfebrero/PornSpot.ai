# Shared Utilities for Code Deduplication

This document describes the new shared utilities created to reduce code duplication across the PornSpot.ai codebase.

## Overview

The following shared utilities have been created to consolidate common patterns and reduce duplication:

1. **LambdaHandlerUtil** - Wrapper for common Lambda function patterns
2. **ValidationUtil** - Shared validation logic
3. **CounterUtil** - DynamoDB counter operations
4. **ApiUtil** - Frontend API request utilities

## Backend Utilities

### LambdaHandlerUtil

**Location**: `/backend/shared/utils/lambda-handler.ts`

**Purpose**: Eliminates the duplication of common Lambda handler patterns found in 50+ functions.

**Before** (repeated in every function):
```typescript
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return ResponseUtil.noContent(event);
  }

  try {
    const authResult = await UserAuthUtil.requireAuth(event, { includeRole: true });
    if (UserAuthUtil.isErrorResponse(authResult)) {
      return authResult;
    }

    if (!event.body) {
      return ResponseUtil.badRequest(event, "Request body is required");
    }

    // ... actual handler logic
  } catch (error) {
    return ResponseUtil.internalError(event, "Error message");
  }
};
```

**After** (consolidated):
```typescript
const handleFunction = async (event: APIGatewayProxyEvent, auth: AuthResult): Promise<APIGatewayProxyResult> => {
  // ... actual handler logic only
};

export const handler = LambdaHandlerUtil.withAuth(handleFunction, {
  requireBody: true,
  includeRole: true,
  validatePathParams: ['albumId'],
});
```

**Features**:
- Automatic OPTIONS request handling
- Authentication validation
- Request body validation
- Path parameter validation
- Centralized error handling
- Type-safe auth result

### ValidationUtil

**Location**: `/backend/shared/utils/validation.ts`

**Purpose**: Centralizes validation logic that was duplicated across multiple functions.

**Common Validations**:
```typescript
// String validation
const title = ValidationUtil.validateAlbumTitle(request.title);
const email = ValidationUtil.validateEmail(userEmail);

// Array validation
const tags = ValidationUtil.validateTags(request.tags);
const mediaIds = ValidationUtil.validateArray(request.mediaIds, "mediaIds");

// Enum validation
const role = ValidationUtil.validateUserRole(userRole);
const interaction = ValidationUtil.validateInteractionType(type);
```

### CounterUtil

**Location**: `/backend/shared/utils/counter.ts`

**Purpose**: Consolidates DynamoDB counter increment/decrement operations that were duplicated throughout the DynamoDBService.

**Before** (repeated pattern):
```typescript
static async incrementAlbumLikeCount(albumId: string, increment: number = 1): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ALBUM#${albumId}`, SK: "METADATA" },
      UpdateExpression: "ADD likeCount :inc",
      ExpressionAttributeValues: { ":inc": increment },
    })
  );
}
```

**After** (centralized):
```typescript
// All counter operations use the same underlying pattern
static async incrementAlbumLikeCount(albumId: string, increment: number = 1): Promise<void> {
  return CounterUtil.incrementAlbumLikeCount(albumId, increment);
}
```

**Features**:
- Generic counter increment/decrement
- Support for all entity types (album, media, comment)
- Support for all counter types (like, bookmark, view, comment, media)
- Bulk operations support
- Consistent error handling

## Frontend Utilities

### ApiUtil

**Location**: `/frontend/src/lib/api-util.ts`

**Purpose**: Reduces duplication in API request patterns across frontend components.

**Before** (repeated pattern):
```typescript
const response = await fetch(`${API_URL}/albums?${searchParams.toString()}`, {
  method: "GET",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});

if (!response.ok) {
  throw new Error(`Failed to fetch albums: ${response.statusText}`);
}

return response.json();
```

**After** (consolidated):
```typescript
const response = await ApiUtil.get<UnifiedAlbumsResponse>("/albums", params);
return ApiUtil.extractData(response);
```

**Features**:
- Consistent request/response handling
- Built-in error handling
- Support for all HTTP methods
- URL parameter building
- Form data uploads
- Retry logic
- Batch operations

## Usage Examples

### Refactored Lambda Function

```typescript
// albums/create.ts
import { LambdaHandlerUtil, ValidationUtil } from "@shared/utils";

const handleCreateAlbum = async (event: APIGatewayProxyEvent, auth: AuthResult) => {
  const request = LambdaHandlerUtil.parseJsonBody<CreateAlbumRequest>(event);
  const title = ValidationUtil.validateAlbumTitle(request.title);
  const tags = request.tags ? ValidationUtil.validateTags(request.tags) : undefined;
  
  // ... business logic only
};

export const handler = LambdaHandlerUtil.withAuth(handleCreateAlbum, {
  requireBody: true,
  includeRole: true,
});
```

### Refactored API Call

```typescript
// albums.ts
import { ApiUtil } from "../api-util";

export const albumsApi = {
  getAlbums: async (params?: GetAlbumsParams): Promise<UnifiedAlbumsResponse> => {
    const response = await ApiUtil.get<UnifiedAlbumsResponse>("/albums", params);
    return ApiUtil.extractData(response);
  },
  
  createAlbum: async (albumData: CreateAlbumData): Promise<Album> => {
    const response = await ApiUtil.post<Album>("/albums", albumData);
    return ApiUtil.extractData(response);
  },
};
```

## Impact Analysis

### Lines of Code Reduction

**Backend**:
- **Lambda handlers**: ~20-30 lines per function → ~5-10 lines per function
- **Counter operations**: ~15 lines per operation → 1 line per operation
- **Validation**: ~5-10 lines per validation → 1 line per validation

**Frontend**:
- **API calls**: ~15-20 lines per request → ~2-3 lines per request

### Estimated Total Reduction

- **50+ Lambda functions** with common patterns: ~750-1500 lines saved
- **20+ counter operations** in DynamoDB service: ~300 lines saved
- **Validation patterns** across functions: ~200-400 lines saved
- **Frontend API calls**: ~500-800 lines saved

**Total estimated reduction**: ~1750-2700 lines of code

### Maintenance Benefits

1. **Consistency**: All functions now follow the same patterns
2. **Error handling**: Centralized and consistent across all functions
3. **Type safety**: Better TypeScript support with shared interfaces
4. **Testing**: Easier to test shared utilities than scattered code
5. **Updates**: Changes to common patterns only need to be made in one place

## Migration Strategy

To migrate existing functions to use these utilities:

1. **Lambda functions**: Replace boilerplate with `LambdaHandlerUtil.withAuth()`
2. **Validations**: Replace manual validation with `ValidationUtil` methods
3. **Counter operations**: Update DynamoDB service to delegate to `CounterUtil`
4. **API calls**: Replace manual fetch calls with `ApiUtil` methods

## Future Enhancements

1. **Additional validation helpers** for common patterns
2. **More API utility methods** for specific patterns
3. **Lambda middleware chain** for more complex auth scenarios
4. **Performance monitoring** integration in shared utilities
5. **Caching layer** in API utilities