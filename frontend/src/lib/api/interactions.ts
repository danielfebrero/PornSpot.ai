import {
  InteractionRequest,
  UnifiedUserInteractionsResponse,
  UnifiedCommentsResponse,
  CommentWithTarget,
} from "@/types/user";
import {
  CreateCommentRequest,
  UpdateCommentRequest,
  ViewTrackingRequest,
} from "@/types";
import { ApiUtil } from "../api-util";

// User Interaction API Functions
export const interactionApi = {
  // Like/Unlike content
  like: async (
    request: InteractionRequest
  ): Promise<UnifiedUserInteractionsResponse> => {
    const response = await ApiUtil.post<UnifiedUserInteractionsResponse>(
      "/user/interactions/like",
      request
    );
    return ApiUtil.extractData(response);
  },

  // Bookmark/Unbookmark content
  bookmark: async (
    request: InteractionRequest
  ): Promise<UnifiedUserInteractionsResponse> => {
    const response = await ApiUtil.post<UnifiedUserInteractionsResponse>(
      "/user/interactions/bookmark",
      request
    );
    return ApiUtil.extractData(response);
  },

  // Track view
  trackView: async (
    request: ViewTrackingRequest
  ): Promise<{ success: boolean }> => {
    try {
      const response = await ApiUtil.post<{ success: boolean }>(
        "/user/interactions/view",
        request
      );
      ApiUtil.extractData(response);
      return { success: true };
    } catch (error) {
      // Don't throw error for view tracking - it's not critical
      console.warn(`View tracking failed:`, error);
      return { success: false };
    }
  },

  // Get user's likes - NEW UNIFIED FORMAT
  getLikes: async ({
    limit = 20,
    cursor,
    includeContentPreview,
    username,
  }: {
    limit?: number;
    cursor?: string;
    includeContentPreview?: boolean;
    username?: string;
  }): Promise<UnifiedUserInteractionsResponse> => {
    const response = await ApiUtil.get<UnifiedUserInteractionsResponse>(
      "/user/interactions/likes",
      { limit, cursor, includeContentPreview, user: username }
    );
    return ApiUtil.extractData(response);
  },

  // Get user's bookmarks - NEW UNIFIED FORMAT
  getBookmarks: async ({
    limit = 20,
    cursor,
    includeContentPreview,
  }: {
    limit: number;
    cursor?: string;
    includeContentPreview?: boolean;
  }): Promise<UnifiedUserInteractionsResponse> => {
    const response = await ApiUtil.get<UnifiedUserInteractionsResponse>(
      "/user/interactions/bookmarks",
      { limit, cursor, includeContentPreview }
    );
    return ApiUtil.extractData(response);
  },

  // Get user interaction status for multiple targets (optimized replacement for getCounts)
  getInteractionStatus: async (
    targets: Array<{
      targetType: "album" | "image" | "video" | "comment";
      targetId: string;
    }>
  ): Promise<{
    statuses: Array<{
      targetType: "album" | "image" | "video" | "comment";
      targetId: string;
      userLiked: boolean;
      userBookmarked: boolean;
      likeCount: number;
      bookmarkCount: number;
    }>;
  }> => {
    const response = await ApiUtil.post<{
      statuses: Array<{
        targetType: "album" | "image" | "video" | "comment";
        targetId: string;
        userLiked: boolean;
        userBookmarked: boolean;
        likeCount: number;
        bookmarkCount: number;
      }>;
    }>("/user/interactions/status", { targets });
    return ApiUtil.extractData(response);
  },

  // Comment operations
  getComments: async (
    targetType: "album" | "image" | "video",
    targetId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<UnifiedCommentsResponse> => {
    const response = await ApiUtil.get<UnifiedCommentsResponse>(
      `/user/interactions/comments/${targetType}/${targetId}`,
      { limit, cursor }
    );
    return ApiUtil.extractData(response);
  },

  // Get comments by username (for profile views) - NEW UNIFIED FORMAT
  getCommentsByUsername: async ({
    username,
    limit = 20,
    cursor,
    includeContentPreview,
  }: {
    username: string;
    limit?: number;
    cursor?: string;
    includeContentPreview?: boolean;
  }): Promise<UnifiedCommentsResponse> => {
    const response = await ApiUtil.get<UnifiedCommentsResponse>(
      "/user/interactions/comments",
      { user: username, limit, cursor, includeContentPreview }
    );
    return ApiUtil.extractData(response);
  },

  createComment: async (
    request: CreateCommentRequest
  ): Promise<CommentWithTarget> => {
    const response = await ApiUtil.post<CommentWithTarget>(
      "/user/interactions/comment",
      request
    );
    return ApiUtil.extractData(response);
  },

  updateComment: async (
    commentId: string,
    request: UpdateCommentRequest
  ): Promise<CommentWithTarget> => {
    const response = await ApiUtil.put<CommentWithTarget>(
      `/user/interactions/comment/${commentId}`,
      request
    );
    return ApiUtil.extractData(response);
  },

  deleteComment: async (commentId: string): Promise<{ success: boolean }> => {
    const response = await ApiUtil.delete<{ success: boolean }>(
      `/user/interactions/comment/${commentId}`
    );
    return ApiUtil.extractData(response);
  },
};
