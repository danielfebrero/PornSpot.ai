# User Interactions

This document provides a detailed overview of the user interaction system for the PornSpot.ai application, which includes features like "likes" and "bookmarks", as well as user profile insights and metrics.

## Interaction System

The interaction system allows users to engage with content by liking or bookmarking albums and media items with instant UI feedback through optimistic updates.

### Interaction Types

- **Like**: A user can like an album or a media item.
- **Bookmark**: A user can bookmark an album or a media item for later viewing.

### Optimistic Updates

The LikeButton and BookmarkButton components provide instant UI feedback through optimistic updates:

1. **Cache-First Strategy**: Components read interaction status from cache (populated by parent components in bulk)
2. **Immediate UI Response**: When users click like/bookmark, the UI updates instantly before API calls
3. **Automatic Rollback**: Failed API calls automatically revert UI changes
4. **Count Updates**: Like and bookmark counts update immediately and optimistically

```typescript
// Example optimistic update flow:
1. User clicks like button → UI immediately shows liked state + incremented count
2. API call is made in background
3. If API succeeds → state persists
4. If API fails → UI reverts to previous state with error handling
```

### API Endpoints

- `POST /user/interactions/like`: Like or unlike an item.
- `POST /user/interactions/bookmark`: Bookmark or unbookmark an item.
- `GET /user/interactions/likes`: Get a list of items liked by the user.
- `GET /user/interactions/bookmarks`: Get a list of items bookmarked by the user.

## User Profile Insights

The system tracks comprehensive user profile metrics that provide insights into user engagement and content performance.

### Profile Metrics

- **totalLikesReceived**: Total number of likes received on all user's content
- **totalBookmarksReceived**: Total number of bookmarks received on all user's content
- **totalMediaViews**: Total number of views on all user's media content
- **totalProfileViews**: Total number of times the user's profile has been viewed
- **totalGeneratedMedias**: Total number of media items created by the user
- **totalAlbums**: Total number of albums created by the user

### Profile Insights Storage

Profile insights are stored in the user entity with automatic caching and incremental updates:

```typescript
// User entity profileInsights structure
profileInsights: {
  totalLikesReceived: number;
  totalBookmarksReceived: number;
  totalMediaViews: number;
  totalProfileViews: number;
  totalGeneratedMedias: number;
  totalAlbums: number;
  lastUpdated: string; // ISO 8601 timestamp
}
```

### Real-time Metric Updates

The system provides efficient real-time metric updates through the `incrementUserProfileMetric` method:

- **Atomic Operations**: Uses DynamoDB's `ADD` operation for thread-safe increments
- **Auto-initialization**: Handles cases where `profileInsights` doesn't exist yet
- **Race Condition Safety**: Uses conditional expressions to prevent conflicts
- **Efficient**: Only increments specific metrics without recomputing all values

### Error Handling for Profile Insights

The profile insights system handles several edge cases:

1. **Missing profileInsights**: If the `profileInsights` attribute doesn't exist, the system automatically initializes it with the current increment value and zeros for other metrics.

2. **Concurrent Updates**: Uses conditional expressions (`attribute_exists` and `attribute_not_exists`) to handle concurrent initialization attempts safely.

3. **Fallback Computation**: If cached insights are missing, the system can compute them from scratch by aggregating data across all user content.

4. **Graceful Degradation**: Returns default values (zeros) if computation fails, ensuring the application continues to function.

## Database Schema

User interactions are stored in the same DynamoDB table as other entities, following the single-table design pattern.

### `UserInteraction` Entity

- **PK**: `USER#<userId>`
- **SK**: `INTERACTION#<interactionType>#<targetId>`
- **GSI1PK**: `INTERACTION#{interactionType}#{targetId}`
- **GSI1SK**: `<interactionType>#<userId>`
- **EntityType**: `UserInteraction`

| Attribute         | Type     | Description                                     |
| ----------------- | -------- | ----------------------------------------------- |
| `userId`          | `string` | The ID of the user who made the interaction.    |
| `interactionType` | `string` | The type of interaction (`like` or `bookmark`). |
| `targetType`      | `string` | The type of the target (`album` or `media`).    |
| `targetId`        | `string` | The ID of the target item.                      |
| `createdAt`       | `string` | The ISO 8601 timestamp of the interaction.      |

## Backend Implementation

### Creating and Deleting Interactions

- **Handlers**:
  - [`backend/functions/user/interactions/like.ts`](../backend/functions/user/interactions/like.ts)
  - [`backend/functions/user/interactions/bookmark.ts`](../backend/functions/user/interactions/bookmark.ts)
- **Process**:
  1.  The user's session is validated to ensure they are authenticated.
  2.  The request body is parsed to get the `targetType`, `targetId`, and `action` (`add` or `remove`).
  3.  The target item (album or media) is verified to exist.
  4.  If the action is `add`, a new `UserInteraction` item is created in the database.
  5.  If the action is `remove`, the corresponding `UserInteraction` item is deleted from the database.

### Retrieving Interactions

- **Handlers**:
  - [`backend/functions/user/interactions/get-likes.ts`](../backend/functions/user/interactions/get-likes.ts)
  - [`backend/functions/user/interactions/get-bookmarks.ts`](../backend/functions/user/interactions/get-bookmarks.ts)
- **Process**:
  1.  The user's session is validated.
  2.  The `getUserInteractions` function from `DynamoDBService` is called to retrieve a paginated list of interactions for the user.
  3.  The details of the target items (albums or media) are fetched to enrich the response.

## Frontend Implementation

The frontend uses custom hooks to interact with the user interactions API. These hooks provide a simple interface for components to like, bookmark, and retrieve liked or bookmarked items.

- `useLikes`: Manages the state for liked items (supports both current user and profile views via `user` parameter)
- `useBookmarks`: Manages the state for bookmarked items

These hooks are then used in components to display like/bookmark buttons and to show lists of liked or bookmarked items in the user's dashboard and profile pages.

### Comment Interactions

Comment likes use a hybrid approach for optimal user experience:

1. **Instant Visual Feedback**: The heart icon changes color and fill state immediately when clicked using TanStack Query's optimistic updates for the `isLiked` state
2. **Like Count Updates**: Local component state is updated immediately for the like count, with error rollback on API failure
3. **Persistence**: The actual API call happens in the background via TanStack Query mutations

**Implementation Details:**

- `useCommentInteractionsQuery`: Fetches and caches comment like states
- `useToggleCommentLike`: Handles like/unlike actions with optimistic updates for the liked state
- Component-level optimistic updates for like counts ensure immediate visual feedback
- Error handling reverts both like state and count on API failures

This approach ensures users see instant feedback when liking comments while maintaining data consistency.
