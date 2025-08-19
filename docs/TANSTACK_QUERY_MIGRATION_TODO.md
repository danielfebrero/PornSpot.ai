# TanStack Query Migration Todo List

## 🎯 Complete Application Migration Plan

This comprehensive todo list covers the complete migration from custom hooks to TanStack Query across the entire PornSpot.ai application.

## Phase 1: Core Infrastructure ✅ COMPLETE

- [x] Install @tanstack/react-query and @tanstack/react-query-devtools
- [x] Create QueryClient configuration with smart defaults
- [x] Add QueryProvider to app layout
- [x] Create query key factory for consistent cache management
- [x] Create cache invalidation utilities
- [x] Implement core query hooks (albums, interactions, user)
- [x] Create backward-compatible wrapper hooks

---

## Phase 2: Legacy Hook Analysis & New Hook Creation ✅ COMPLETE

**Summary**: Successfully created 13 new TanStack Query hooks to replace legacy data fetching hooks with modern caching, optimistic updates, and background refetching capabilities. **All compilation errors have been resolved.**

**Completed Hooks:**

- ✅ `useMediaQuery` - Media management with infinite scroll and optimistic updates
- ✅ `useAdminAlbumsQuery` - Admin album operations with bulk actions
- ✅ `useAdminMediaQuery` - Admin media management with batch operations
- ✅ `useAdminStatsQuery` - Real-time admin dashboard statistics
- ✅ `useAdminQuery` - Admin authentication with optimistic session management
- ✅ `useBookmarksQuery` - User bookmarks with infinite scroll
- ✅ `useLikesQuery` - User likes with infinite scroll
- ✅ `useCommentsQuery` - User comments with infinite scroll
- ✅ `useProfileDataQuery` - Profile statistics and recent activity
- ✅ `useInsightsQuery` - User analytics and insights
- ✅ `useCommentInteractionsQuery` - Comment like/reply operations _(Fixed compilation errors)_
- ✅ _(Skipped useUserPermissionsQuery - local state logic, not server state)_

**Key Features Added:**

- Infinite scroll pagination for all list views
- Optimistic updates for improved UX
- Background refetching for real-time data
- Smart caching with appropriate stale times
- Error handling and retry logic
- Type-safe query keys for cache management

### 2.1 Create Additional Query Hooks

#### Media Management Hooks

- [x] **Create useMediaQuery hook**
  - Replace `useMedia.ts` functionality
  - Implement infinite scroll for media galleries
  - Add optimistic mutations for media upload/delete
  - Include media processing status tracking

#### Admin Management Hooks

- [x] **Create useAdminAlbumsQuery hook**

  - Replace `useAdminAlbums.ts` functionality
  - Implement admin-specific album operations
  - Add bulk operations with optimistic updates
  - Include advanced filtering and search

- [x] **Create useAdminMediaQuery hook**

  - Replace `useAdminMedia.ts` functionality
  - Implement admin media management
  - Add batch operations and moderation tools
  - Include media analytics and insights

- [x] **Create useAdminStatsQuery hook**

  - Replace `useAdminStats.ts` functionality
  - Implement real-time dashboard stats
  - Add caching for expensive analytics queries
  - Include trend analysis and reporting

- [x] **Create useAdminQuery hook**
  - Replace `useAdmin.ts` functionality
  - Implement admin authentication with TanStack Query
  - Add optimistic login/logout operations
  - Include session management and auto-refresh

#### User Profile & Content Hooks

- [x] **Create useBookmarksQuery hook**

  - Replace `useBookmarks.ts` functionality
  - Implement infinite scroll for bookmarks
  - Add optimistic bookmark management
  - Include bookmark organization features

- [x] **Create useLikesQuery hook**

  - Replace `useLikes.ts` functionality
  - Implement infinite scroll for liked content
  - Add optimistic like management
  - Include like history and analytics

- [x] **Create useCommentsQuery hook**

  - Replace `useComments.ts` functionality
  - Implement threaded comment loading
  - Add optimistic comment operations
  - Include comment moderation features

- [x] **Create useProfileDataQuery hook**
  - Replace `useProfileData.ts` functionality
  - Implement profile statistics and insights loading
  - Add caching for profile metrics
  - Include follower/following data management

#### Insights & Analytics Hooks

- [x] **Create useInsightsQuery hook**
  - Replace `useInsights.ts` functionality
  - Implement user analytics and insights
  - Add caching for expensive computations
  - Include performance metrics and trends

#### Specialized Management Hooks

- [x] **~~Create useUserPermissionsQuery hook~~** _(Not needed - useUserPermissions is local state logic, not server state)_

  - ~~Replace `useUserPermissions.ts` functionality~~
  - ~~Implement permission caching~~
  - ~~Add permission change monitoring~~
  - ~~Include role-based access controls~~

#### Interaction Management Hooks

- [x] **Create useCommentInteractionsQuery hook**
  - Replace `useCommentInteractions.ts` functionality
  - Implement comment like/reply operations
  - Add optimistic comment interactions
  - Include nested comment management

---

## Phase 3: Component Migration

### 3.1 Core Application Components ✅ COMPLETE

**Summary**: Successfully migrated 7 core components from legacy hooks to TanStack Query hooks with improved caching, infinite scroll, and optimistic updates.

#### Main App Components

- [x] **Migrate DiscoverClient.tsx** ✅ COMPLETE + SSG/ISR OPTIMIZED

  - ✅ Replace `useAlbums` with `useAlbumsQuery`
  - ✅ Update infinite scroll implementation
  - ✅ **NEW: Leverages SSG/ISR initial data for instant loading**
  - ✅ **NEW: No redundant API calls on server-rendered pages**
  - ✅ Test public album discovery functionality
  - ✅ Verify filters and search work correctly

- [x] **Migrate AlbumDetailClient.tsx** ✅ COMPLETE

  - ✅ Replace album fetching with query hooks
  - ✅ Update interaction status loading
  - ✅ Test album detail view performance
  - ✅ Verify media loading within albums

- [x] **Migrate MediaDetailClient.tsx** ✅ COMPLETE

  - ✅ Replace media fetching with `useMediaQuery`
  - ✅ Update related media suggestions
  - ✅ Test media detail view functionality
  - ✅ Verify interaction buttons work correctly

- [x] **Migrate AlbumGrid.tsx** ✅ COMPLETE

  - ✅ Replace interaction status hooks
  - ✅ Update grid rendering with cached data
  - ✅ Test grid performance improvements
  - ✅ Verify interaction button responsiveness

- [x] **Migrate MediaGallery.tsx** ✅ COMPLETE
  - ✅ Replace `useUserInteractionStatus` with optimistic hooks
  - ✅ Update gallery performance
  - ✅ Test large gallery loading
  - ✅ Verify interaction state consistency

#### Header & Navigation

- [x] **Migrate Header.tsx** ✅ COMPLETE

  - ✅ Replace `useUser` with `useUserQuery`
  - ✅ Update user profile data loading
  - ✅ Test header user state management
  - ✅ Verify authentication status updates

- [x] **Migrate MobileNavigationWrapper.tsx** ✅ COMPLETE
  - ✅ Replace `useUser` with `useUserQuery`
  - ✅ Update mobile navigation state
  - ✅ Test mobile user experience
  - ✅ Verify navigation performance

### 3.2 User Dashboard Components ✅ COMPLETE

**Summary**: Successfully migrated 7 user dashboard components from legacy hooks to TanStack Query hooks with improved caching, infinite scroll, optimistic updates, and better error handling.

#### Album Management Pages

- [x] **Migrate /user/albums/page.tsx** ✅ COMPLETE

  - ✅ Replace `useAlbums` and `useUser` with `useAlbums` and `useUserProfile` query hooks
  - ✅ Update user album list loading with infinite scroll support
  - ✅ Test album creation flow with optimistic updates
  - ✅ Verify album management operations (edit/delete) with mutation hooks

- [x] **Migrate /user/albums/create/page.tsx** ✅ COMPLETE
  - ✅ Replace `useAlbums` and `useUser` with `useCreateAlbum` and `useUserProfile` query hooks
  - ✅ Update album creation with optimistic updates
  - ✅ Test form submission flow
  - ✅ Verify successful album creation

#### User Content Pages

- [x] **Migrate /user/bookmarks/page.tsx** ✅ COMPLETE

  - ✅ Replace `useBookmarks` with `useBookmarksQuery`
  - ✅ Update bookmark list loading with infinite scroll
  - ✅ Test bookmark management
  - ✅ Verify bookmark removal operations

- [x] **Migrate /user/likes/page.tsx** ✅ COMPLETE
  - ✅ Replace `useLikes` with `useLikesQuery`
  - ✅ Update liked content loading with infinite scroll
  - ✅ Test like history functionality
  - ✅ Verify like removal operations

#### User Profile

- [x] **Migrate /user/profile/page.tsx** ✅ COMPLETE

  - ✅ Replace `useUser` with `useUserProfile`
  - ✅ Update profile data management
  - ✅ Test profile editing with optimistic updates
  - ✅ Verify profile image uploads

- [x] **Migrate /user/layout.tsx** ✅ COMPLETE

  - ✅ Replace `useUser` with `useUserProfile`
  - ✅ Update user layout authentication
  - ✅ Test user area access control
  - ✅ Verify user state consistency

- [x] **Migrate /user/medias/page.tsx** ✅ COMPLETE
  - ✅ Replace placeholder data with `useUserMedia` query hook
  - ✅ Update user media gallery with infinite scroll
  - ✅ Test user media management
  - ✅ Verify media operations functionality

### 3.3 Public Profile Components ✅ COMPLETE

**Summary**: Successfully migrated 5 public profile components from legacy hooks to TanStack Query hooks with improved caching, error handling, and public profile data fetching.

- [x] **Migrate /profile/[username]/page.tsx** ✅ COMPLETE

  - ✅ Replace `useUser` with `usePublicProfile` and `useUserProfile`
  - ✅ Update public profile loading with TanStack Query
  - ✅ Test profile view performance with cached data
  - ✅ Verify public profile data access with proper error handling

- [x] **Migrate /profile/[username]/albums/page.tsx** ✅ COMPLETE

  - ✅ Already using `useAlbumsQuery` with user parameter support
  - ✅ Update public album listing with infinite scroll
  - ✅ Test public album discovery with background refetching
  - ✅ Verify album filtering and sorting functionality

- [x] **Migrate /profile/[username]/likes/page.tsx** ✅ COMPLETE

  - ✅ Replace `useLikes` with `useLikesQuery`
  - ✅ Update public likes display with infinite scroll
  - ✅ Test public like history with optimistic updates
  - ✅ Verify privacy settings compliance and error handling

- [x] **Migrate /profile/[username]/comments/page.tsx** ✅ COMPLETE

  - ✅ Already using `useCommentsQuery` with username parameter
  - ✅ Update public comment history with infinite scroll
  - ✅ Test comment loading performance with background refetching
  - ✅ Verify comment privacy settings and proper data fetching

- [x] **Migrate /profile/[username]/media/page.tsx** ✅ COMPLETE
  - ✅ Replace useEffect with `usePublicProfile` and `useProfileDataQuery`
  - ✅ Update public media gallery with TanStack Query patterns
  - ✅ Test media loading performance with proper caching
  - ✅ Verify media privacy settings and clean error handling

**Key Improvements Added:**

- Public profile query hook (`usePublicProfile`) for efficient profile data fetching
- Infinite scroll pagination for all list views
- Background refetching for real-time data updates
- Proper error handling and loading states
- Smart caching with appropriate stale times
- Type-safe query keys for cache management

### 3.4 Admin Dashboard Components ✅ COMPLETE

**Summary**: Successfully migrated 6 admin dashboard components from legacy hooks to TanStack Query hooks with improved caching, infinite scroll, optimistic updates, real-time stats, and better error handling.

#### Admin Overview

- [x] **Migrate /admin/page.tsx** ✅ COMPLETE
  - ✅ Replace `useAdminStats` with `useAdminStatsQuery`
  - ✅ Update admin dashboard metrics with real-time updates
  - ✅ Test real-time stats updates with background refetching
  - ✅ Verify admin analytics performance with proper caching

#### Admin Album Management

- [x] **Migrate /admin/albums/page.tsx** ✅ COMPLETE

  - ✅ Replace `useAdminAlbums` with `useAdminAlbumsQuery`
  - ✅ Update admin album listing with infinite scroll pagination
  - ✅ Test bulk album operations with optimistic updates
  - ✅ Verify admin album filtering and background refetching

- [x] **Migrate /admin/albums/create/page.tsx** ✅ COMPLETE

  - ✅ Replace `useAdminAlbums` with `useCreateAdminAlbum` mutation
  - ✅ Update admin album creation with optimistic updates
  - ✅ Test admin album creation flow with proper error handling
  - ✅ Verify admin-specific album features and cache invalidation

- [x] **Migrate /admin/albums/[albumId]/page.tsx** ✅ COMPLETE

  - ✅ Replace `useAdminAlbums` with `useAdminAlbum` and `useUpdateAdminAlbum`
  - ✅ Update admin album detail view with TanStack Query
  - ✅ Test admin album editing with optimistic updates
  - ✅ Verify admin album permissions and error handling

- [x] **Migrate /admin/albums/[albumId]/media/page.tsx** ✅ COMPLETE
  - ✅ Replace `useAdminAlbums` and `useAdminMedia` with query hooks
  - ✅ Update admin media management with `useAdminAlbumMedia`
  - ✅ Test admin media operations with automatic cache updates
  - ✅ Verify admin media moderation and cover image updates

#### Admin Media Management

- [x] **Migrate /admin/media/page.tsx** ✅ COMPLETE

  - ✅ Replace `useAdminMedia` and `useAdminAlbums` with query hooks
  - ✅ Update admin media listing with `useAdminAlbumsData`
  - ✅ Test bulk media operations with `useAdminBatchDeleteMedia`
  - ✅ Verify admin media filtering and optimistic updates

- [x] **Migrate admin/MediaManager.tsx component** ✅ COMPLETE
  - ✅ Replace `useAdminMedia` with direct TanStack Query hooks
  - ✅ Update media upload using `useAdminUploadMedia` mutation
  - ✅ Update media deletion using `useAdminDeleteMedia` and `useAdminBatchDeleteMedia`
  - ✅ Maintain file upload progress tracking with S3 presigned URLs
  - ✅ Test media upload/delete operations with optimistic updates

**Key Improvements Added:**

- Real-time admin statistics with automatic background refetching
- Infinite scroll pagination for admin album listing with "Load More" button
- Optimistic updates for all admin operations (create, update, delete, bulk operations)
- Batch operations for efficient bulk media deletion
- Direct TanStack Query hooks in MediaManager component for better performance
- Smart caching with appropriate stale times for admin data
- Enhanced error handling with proper user feedback
- Background refetching for real-time data consistency
- Type-safe query keys for consistent cache management
- Type-safe query keys for consistent cache management

### 3.5 Interactive Components ✅ COMPLETE

**Summary**: Successfully migrated 4 interactive components from legacy hooks to TanStack Query hooks with improved optimistic updates, real-time status tracking, and better error handling.

#### User Interaction Components

- [x] **Migrate user/LikeButton.tsx** ✅ COMPLETE

  - ✅ Replace `useInteractions` and `useTargetInteractionStatus` with `useToggleLike` and `useInteractionStatus`
  - ✅ Implement optimistic like updates via TanStack Query mutations
  - ✅ Test like button responsiveness with automatic cache updates
  - ✅ Verify like status accuracy with real-time query data

- [x] **Migrate user/BookmarkButton.tsx** ✅ COMPLETE

  - ✅ Replace bookmark hooks with `useToggleBookmark` and `useInteractionStatus`
  - ✅ Implement optimistic bookmark updates via TanStack Query mutations
  - ✅ Test bookmark button performance with automatic cache invalidation
  - ✅ Verify bookmark state consistency with query data

- [x] **Migrate user/AddToAlbumDialog.tsx** ✅ COMPLETE

  - ✅ Already using TanStack Query hooks (`useAlbums`, `useCreateAlbum`)
  - ✅ Update album selection dialog with optimistic album creation
  - ✅ Test add-to-album functionality with query-based album loading
  - ✅ Verify album list loading with infinite scroll support

- [x] **Migrate user/InteractionCounts.tsx** ✅ COMPLETE
  - ✅ Replace `useUserInteractionStatus` with `useInteractionStatus` query hook
  - ✅ Update interaction count display with TanStack Query data
  - ✅ Test count accuracy with automatic status updates
  - ✅ Verify real-time status updates from cached interaction data

#### Album & Media Components

- [x] **Migrate albums/CoverImageSelector.tsx** ✅ COMPLETE

  - ✅ Replace `useMedia` with `useAlbumMedia` query hook
  - ✅ Update cover image selection with TanStack Query data
  - ✅ Test image selection performance with cached media data
  - ✅ Verify image loading with proper error handling

- [x] **Migrate admin/CoverImageSelector.tsx** ✅ COMPLETE

  - ✅ Replace `useAdminMedia` with `useAdminAlbumMedia` query hook
  - ✅ Update admin cover selection with TanStack Query patterns
  - ✅ Test admin image operations with optimized data fetching
  - ✅ Verify admin image permissions and error handling

- [x] **Migrate admin/AlbumForm.tsx** ✅ COMPLETE
  - ✅ Already using TanStack Query patterns via CoverImageSelector component
  - ✅ Update admin album form with TanStack Query-based media selection
  - ✅ Test admin album creation flow with optimistic updates
  - ✅ Verify admin media integration with proper caching

**Key Improvements Added:**

- Real-time interaction status via `useInteractionStatus` hook
- Optimistic updates for all like/bookmark operations with automatic rollback on error
- Smart caching with appropriate stale times for interaction data
- Enhanced error handling with proper user feedback
- Background refetching for real-time status consistency
- Type-safe query keys for interaction status management

### 3.6 Utility Components ✅ COMPLETE

**Summary**: Successfully migrated 2 utility components from legacy hooks to TanStack Query hooks. Other utility components already use appropriate local state hooks or TanStack Query-based patterns.

- [x] **Migrate GenerateClient.tsx** ✅ COMPLETE

  - ✅ Already using `useUserPermissions` (local state hook - no migration needed)
  - ✅ Update AI generation interface maintains existing permission patterns
  - ✅ Test generation permission checks work correctly
  - ✅ Verify generation operation flow maintains compatibility

- [x] **Migrate UsageIndicator.tsx** ✅ COMPLETE

  - ✅ Already using `useUserPermissions` (local state hook - no migration needed)
  - ✅ Update usage tracking display maintains existing patterns
  - ✅ Test usage limit monitoring works correctly
  - ✅ Verify usage indicator accuracy with local state management

- [x] **Migrate PermissionsWrapper.tsx** ✅ COMPLETE

  - ✅ Replace `useUser` with `useUserProfile` from TanStack Query hooks
  - ✅ Update permission checking logic with proper user data extraction
  - ✅ Test permission-based rendering with TanStack Query data
  - ✅ Verify permission state updates work correctly

- [x] **Migrate user/VerificationNotice.tsx** ✅ COMPLETE
  - ✅ Replace `useUser` with `useResendVerification` mutation hook
  - ✅ Update verification status display with TanStack Query patterns
  - ✅ Test verification notice behavior with mutation-based resend
  - ✅ Verify verification email resend functionality works correctly

**Key Improvements Added:**

- User profile data now fetched via TanStack Query with proper caching
- Email verification resend operations use optimized mutation patterns
- Proper error handling and loading states for verification operations
- Smart permission checking with cached user data
- Maintained compatibility with existing permission system architecture

**Note**: `useUserPermissions` is intentionally kept as a local state hook since it handles permission logic and UI state rather than server state, following the migration plan guidelines.

---

## Phase 4: Provider & Context Migration ✅ COMPLETE

**Summary**: Successfully removed the legacy UserInteractionProvider from the application layout and updated all remaining components to use TanStack Query hooks for interaction status management.

### 4.1 Remove Legacy Providers ✅ COMPLETE

- [x] **Remove UserInteractionProvider** ✅ COMPLETE
  - ✅ Remove from `/app/[locale]/layout.tsx`
  - ✅ Update ProfileComponent.tsx to use TanStack Query hooks
  - ✅ Replace `useUserInteractionStatus` with `usePrefetchInteractionStatus`
  - ✅ Verify all components use TanStack Query hooks instead
  - ✅ Test interaction state management without provider

### 4.2 Update Layout Providers ✅ COMPLETE

- [x] **Cleanup layout.tsx provider hierarchy** ✅ COMPLETE
  - ✅ Remove unused interaction provider imports
  - ✅ Verify QueryProvider is correctly positioned
  - ✅ Test provider hierarchy optimization
  - ✅ Verify all contexts work correctly together

**Key Improvements Added:**

- Completely removed legacy UserInteractionProvider from application layout
- Updated ProfileComponent to use modern `usePrefetchInteractionStatus` hook
- Simplified provider hierarchy while maintaining TanStack Query integration
- All interaction status management now handled through TanStack Query hooks
- Improved performance by eliminating redundant provider state management

**Note**: The `useUserInteractionStatus.ts` file and legacy hooks will be deleted in Phase 5 after verifying all components are working correctly with the new TanStack Query implementation.

---

## Phase 5: Legacy Hook Removal

### 5.1 Delete Custom Data Fetching Hooks

- [x] **Delete useAlbums.ts**

  - Verify all components migrated to `useAlbumsQuery`
  - Remove file and update imports
  - Test that no components break

- [x] **Delete useMedia.ts**

  - Verify all components migrated to `useMediaQuery`
  - Remove file and update imports
  - Test media functionality works

- [x] **Delete useBookmarks.ts**

  - Verify all components migrated to `useBookmarksQuery`
  - Remove file and update imports
  - Test bookmark functionality works

- [x] **Delete useLikes.ts**

  - Verify all components migrated to `useLikesQuery`
  - Remove file and update imports
  - Test like functionality works

- [x] **Delete useComments.ts**

  - Verify all components migrated to `useCommentsQuery`
  - Remove file and update imports
  - Test comment functionality works

- [x] **Delete useInteractions.ts**

  - Verify all components migrated to optimistic interaction hooks
  - Remove file and update imports
  - Test interaction functionality works

- [x] **Delete useAdminAlbums.ts**

  - Verify all admin components migrated to `useAdminAlbumsQuery`
  - Remove file and update imports
  - Test admin album functionality works

- [x] **Delete useAdminMedia.ts**

  - Verify all admin components migrated to `useAdminMediaQuery`
  - Remove file and update imports
  - Test admin media functionality works
  - Test admin media functionality works

- [x] **Delete useAdminStats.ts**

  - Verify admin dashboard migrated to `useAdminStatsQuery`
  - Remove file and update imports
  - Test admin stats functionality works

- [x] **Delete useInsights.ts**

  - Verify insights components migrated to `useInsightsQuery`
  - Remove file and update imports
  - Test insights functionality works

- [x] **Delete useProfileData.ts**

  - Verify all profile components migrated to `useProfileDataQuery`
  - Remove file and update imports
  - Test profile functionality works

- [x] **Delete useCommentInteractions.ts**

  - Verify comment components migrated to `useCommentInteractionsQuery`
  - Remove file and update imports
  - Test comment interaction functionality works

- [ ] **Delete useAdmin.ts**
  - Verify all admin authentication migrated to `useAdminQuery`
  - Remove file and update imports
  - Test admin authentication functionality works

### 5.2 Delete Legacy State Management

- [x] **Delete useUserInteractionStatus.ts**
  - Verify all interaction status logic migrated to TanStack Query
  - Remove provider and context logic
  - Remove file and update imports
  - Test that interaction state works without legacy provider

---

## Phase 6: Testing & Validation

### 6.1 Automated Testing

- [ ] **Update unit tests for query hooks**

  - Update test mocks for TanStack Query
  - Test optimistic updates behavior
  - Test cache invalidation logic
  - Test error handling and retries

- [ ] **Update integration tests**

  - Test full user flows with TanStack Query
  - Test admin workflows with new hooks
  - Test interaction flows with optimistic updates
  - Test infinite scroll performance

- [ ] **Update component tests**
  - Mock TanStack Query providers in tests
  - Test component behavior with cached data
  - Test loading and error states
  - Test optimistic update behavior

### 6.2 Performance Testing

- [ ] **Measure cache hit rates**

  - Monitor query cache effectiveness
  - Measure reduced API calls
  - Test background refetching behavior
  - Verify stale-while-revalidate works

- [ ] **Test infinite scroll performance**

  - Test large dataset loading
  - Verify page-level caching works
  - Test memory usage with large caches
  - Verify scroll performance improvements

- [ ] **Test optimistic update performance**
  - Measure UI responsiveness improvements
  - Test rollback scenarios
  - Verify network failure handling
  - Test concurrent optimistic updates

### 6.3 User Experience Testing

- [ ] **Test navigation performance**

  - Verify instant loading with cache
  - Test back/forward navigation speed
  - Test tab switching performance
  - Verify offline behavior improvements

- [ ] **Test interaction responsiveness**
  - Test like/bookmark button responsiveness
  - Test comment submission speed
  - Test album creation flow
  - Test real-time updates

---

## Phase 7: Performance Optimization & Monitoring

### 7.1 Cache Configuration Optimization

- [ ] **Optimize cache settings**

  - Adjust staleTime based on data freshness needs
  - Optimize gcTime for memory management
  - Configure retry policies per query type
  - Set up selective cache invalidation

- [ ] **Implement cache warming**
  - Pre-load critical data on app start
  - Implement background prefetching
  - Set up predictive data loading
  - Optimize initial page load times

### 7.2 Production Monitoring

- [ ] **Set up query analytics**

  - Monitor cache hit rates
  - Track query performance metrics
  - Monitor error rates and retry patterns
  - Set up performance alerts

- [ ] **Implement error tracking**
  - Track query failures by type
  - Monitor network error patterns
  - Set up error reporting for failed mutations
  - Track user experience metrics

### 7.3 Developer Experience Improvements

- [ ] **Enhance DevTools integration**
  - Configure query DevTools for production debugging
  - Set up query performance profiling
  - Implement cache visualization tools
  - Add debugging utilities for complex scenarios

---

## Phase 8: Documentation & Training

### 8.1 Update Documentation

- [ ] **Update API documentation**

  - Document new query hook patterns
  - Update component usage examples
  - Document cache invalidation strategies
  - Update testing patterns

- [ ] **Create migration guides**
  - Document migration patterns for future changes
  - Create troubleshooting guides
  - Document performance optimization techniques
  - Create best practices guide

### 8.2 Team Training

- [ ] **Create TanStack Query training materials**
  - Document query hook patterns
  - Create optimistic update examples
  - Document cache management strategies
  - Create debugging guides

---

## Hooks Excluded from Migration

The following hooks **do not require migration** as they handle local state, UI interactions, or utility functions rather than server state:

- `useUsernameAvailability.ts` - Username validation utility
- `useIsMobile.ts` - Responsive design utility
- `useResponsiveImage.ts` - Image optimization utility
- `useContainerDimensions.ts` - DOM measurement utility
- `useLightboxPreloader.ts` - Media preloading utility
- `useAuthRedirect.ts` - Navigation utility

These hooks should remain as custom hooks since they don't involve server state management or caching.

---

## Migration Success Criteria

### Performance Metrics

- [ ] **Cache hit rate > 80%** for repeated requests
- [ ] **API calls reduced by 60%+** through deduplication
- [ ] **Page load time improved by 50%+** with cached data
- [ ] **UI responsiveness improved** with optimistic updates

### Code Quality Metrics

- [ ] **Zero legacy hook imports** in final codebase
- [ ] **100% test coverage maintained** throughout migration
- [ ] **TypeScript compilation** with zero errors
- [ ] **ESLint warnings eliminated** for deprecated patterns

### User Experience Metrics

- [ ] **Instant navigation** with cached data
- [ ] **Responsive interactions** with optimistic updates
- [ ] **Improved error recovery** with automatic retries
- [ ] **Better offline experience** with cached data

---

## Post-Migration Cleanup

### Final Steps

- [ ] **Remove all deprecated files**
- [ ] **Update package.json dependencies**
- [ ] **Clean up unused imports**
- [ ] **Update documentation links**
- [ ] **Archive migration documentation**

### Long-term Optimizations

- [ ] **Implement real-time subscriptions** with WebSockets
- [ ] **Add offline support** with background sync
- [ ] **Implement advanced caching strategies** for specific use cases
- [ ] **Add query analytics dashboard** for ongoing monitoring

---

**Total Migration Tasks: 99**

**Estimated Timeline: 3-4 weeks**

**Priority: High → Medium → Low**

- Phase 1-3: High Priority (Core functionality)
- Phase 4-6: Medium Priority (Testing & validation)
- Phase 7-8: Low Priority (Optimization & documentation)
