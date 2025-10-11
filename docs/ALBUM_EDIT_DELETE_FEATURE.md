# Album Edit and Delete Feature Implementation

This document describes the implementation of edit and delete functionality for user albums in the PornSpot.ai application.

## Overview

Users can now edit and delete their own albums from the `/user/albums` page. This feature includes:

- **Edit albums**: Change title, tags, visibility (public/private), and cover image URL
- **Delete albums**: Remove albums and all associated media with confirmation
- **Responsive design**: Works on mobile and desktop
- **Authentication**: Only album owners can edit/delete their albums

## Backend Implementation

### New API Endpoints

1. **PUT /albums/{albumId}** - Update an album

   - Requires user authentication
   - Validates album ownership
   - Supports updating: title, tags, isPublic, coverImageUrl
   - Generates thumbnails when cover image is updated

2. **DELETE /albums/{albumId}** - Delete an album
   - Requires user authentication
   - Validates album ownership
   - Removes media from album but preserves media for other albums
   - Deletes all comments on the album and their likes
   - Cleans up all interactions (likes/bookmarks) for the album

### Files Added/Modified

#### Backend

- `backend/functions/albums/update.ts` - New album update handler
- `backend/functions/albums/delete.ts` - New album delete handler
- `template.yaml` - Added new Lambda functions and API routes

### Album Cover Synchronization

- When a media item is deleted (or removed from an album), any album that used that media as its cover automatically selects a new cover from the remaining media.
- If no media remain in the album, cover metadata and the `ALBUM_COVER_IMAGE` GSI2 keys are cleared to avoid stale references.
- The revalidation step triggered by media deletion ensures updated covers propagate to the frontend without manual refreshes.

#### Security

- Uses `UserAuthorizer` for authentication
- Validates album ownership before allowing operations
- Input validation for all update fields

## Frontend Implementation

### New Components

1. **EditAlbumDialog** (`src/components/albums/EditAlbumDialog.tsx`)

   - Modal dialog for editing album details
   - Form with title, tags, cover image URL, and public/private toggle
   - Tag management with add/remove functionality
   - Mobile-responsive design

2. **DeleteAlbumDialog** (`src/components/albums/DeleteAlbumDialog.tsx`)
   - Confirmation dialog for album deletion
   - Shows album title and warning about permanent deletion
   - Loading states during deletion

### Enhanced Components

1. **UserAlbumsPage** (`src/app/[locale]/user/albums/page.tsx`)

   - Added action dropdown menu on each album card
   - Edit and delete buttons with appropriate icons
   - Mobile-friendly responsive behavior
   - Click-outside handler for dropdown menus

2. **useAlbums Hook** (`src/hooks/useAlbums.ts`)

   - Added `updateAlbum` and `deleteAlbum` functions
   - Local state updates for immediate UI feedback
   - Error handling with user-friendly messages
   - Consolidated hook that replaced `useUserAlbums` and `useProfileAlbums`

3. **API Layer** (`src/lib/api.ts`)
   - Added `albumsApi.updateAlbum()` method
   - Added `albumsApi.deleteAlbum()` method
   - Proper error handling and response parsing

## User Experience

### Album Actions

- **Desktop**: Actions appear on hover over album cards
- **Mobile**: Actions are always visible for touch interaction
- **Dropdown menu**: Three-dot menu with Edit and Delete options

### Edit Flow

1. User clicks "Edit" from album actions menu
2. Modal dialog opens with current album data pre-populated
3. User can modify title, tags, visibility, and cover image
4. Form validation ensures title is not empty
5. **Optimistic UI Update**: Changes appear immediately in the UI
6. Dialog closes instantly while API call proceeds in background
7. If update fails, changes are automatically reverted

### Delete Flow

1. User clicks "Delete" from album actions menu
2. Confirmation dialog shows album title and warning
3. User must confirm the destructive action
4. **Optimistic UI Update**: Album disappears immediately from the list for better UX
5. Confirmation dialog closes instantly while API call proceeds in background
6. If deletion fails, album is restored to the list automatically

## Responsive Design

### Mobile Optimizations

- Action buttons always visible on mobile (not hover-dependent)
- Modal dialogs use smaller padding and margins
- Dropdown menus have backdrop blur for better visibility
- Touch-friendly button sizes and spacing

### Desktop Experience

- Hover states for discovery of actions
- Larger modal dialogs with more spacing
- Smooth transitions and animations
- Keyboard navigation support (Escape to close)

## Error Handling

### Backend Errors

- 400: Missing required parameters
- 401: User not authenticated
- 403: User doesn't own the album
- 404: Album not found
- 500: Server errors

### Frontend Error Handling

- Network errors shown to user
- Loading states during operations
- Graceful degradation on failures
- Retry mechanisms where appropriate

## Security Considerations

1. **Authentication**: All operations require valid user sessions
2. **Authorization**: Users can only modify their own albums
3. **Input Validation**: Server-side validation of all inputs
4. **CSRF Protection**: Uses credentials: 'include' for cookies
5. **Data Sanitization**: Proper escaping in UI components

## Testing

### Backend Tests

- Unit tests for authentication validation
- Tests for album ownership checks
- Error case coverage

### Frontend Tests

- Component rendering tests
- User interaction tests
- Modal dialog behavior tests
- API integration tests

## Performance Considerations

1. **Optimistic Updates**:
   - **Edit operations**: Changes appear immediately in UI across all album lists
   - **Delete operations**: Album disappears from UI instantly, confirmation dialog closes immediately
   - **Error Recovery**: Failed operations automatically restore previous state across all relevant caches
   - **Cache Strategy**: Updates all album list queries (user-specific, public lists, etc.) simultaneously
2. **Lazy Loading**: Heavy dependencies loaded only when needed
3. **Thumbnail Generation**: Asynchronous with graceful failure
4. **Caching**: Revalidation triggers for updated content
5. **Non-blocking UX**: Delete operations don't block the user interface

## Future Enhancements

1. **Bulk Operations**: Select multiple albums for batch delete
2. **Drag & Drop**: Reorder albums or change covers
3. **Advanced Editing**: Rich text descriptions, custom metadata
4. **Undo/Redo**: Ability to undo delete operations
5. **Activity Log**: Track edit history for albums

## API Documentation

### Update Album

```http
PUT /albums/{albumId}
Content-Type: application/json
Cookie: session=...

{
  "title": "New Album Title",
  "tags": ["tag1", "tag2"],
  "isPublic": true,
  "coverImageUrl": "https://example.com/image.jpg"
}
```

### Delete Album

```http
DELETE /albums/{albumId}
Cookie: session=...
```

Both endpoints return standard API responses with success/error status and appropriate HTTP status codes.
