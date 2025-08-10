import {
  InteractionRequest,
  UnifiedUserInteractionsResponse,
  UnifiedCommentsResponse,
  CommentWithTarget,
} from "@/types/user";
import { CreateCommentRequest, UpdateCommentRequest } from "@/types";
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
  trackView: async (request: {
    targetType: "album" | "media" | "profile";
    targetId: string;
  }): Promise<{ success: boolean }> => {
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
  getLikes: async (
    limit: number = 20,
    cursor?: string
  ): Promise<UnifiedUserInteractionsResponse> => {
    const response = await ApiUtil.get<UnifiedUserInteractionsResponse>(
      "/user/interactions/likes",
      { limit, cursor }
    );
    return ApiUtil.extractData(response);
  },

  // Get likes by username (for profile views) - NEW UNIFIED FORMAT
  getLikesByUsername: async (
    username: string,
    limit: number = 20,
    cursor?: string
  ): Promise<UnifiedUserInteractionsResponse> => {
    const response = await ApiUtil.get<UnifiedUserInteractionsResponse>(
      "/user/interactions/likes",
      { user: username, limit, cursor }
    );
    return ApiUtil.extractData(response);
  },

  // Get user's bookmarks - NEW UNIFIED FORMAT
  getBookmarks: async (
    limit: number = 20,
    cursor?: string
  ): Promise<UnifiedUserInteractionsResponse> => {
    const response = await ApiUtil.get<UnifiedUserInteractionsResponse>(
      "/user/interactions/bookmarks",
      { limit, cursor }
    );
    return ApiUtil.extractData(response);
  },

  // Get user interaction status for multiple targets (optimized replacement for getCounts)
  getInteractionStatus: async (
    targets: Array<{
      targetType: "album" | "media" | "comment";
      targetId: string;
    }>
  ): Promise<{
    statuses: Array<{
      targetType: "album" | "media" | "comment";
      targetId: string;
      userLiked: boolean;
      userBookmarked: boolean;
      likeCount: number;
      bookmarkCount: number;
    }>;
  }> => {
    const response = await ApiUtil.post<{
      statuses: Array<{
        targetType: "album" | "media" | "comment";
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
    targetType: "album" | "media",
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
  getCommentsByUsername: async (
    username: string,
    limit: number = 20,
    cursor?: string
  ): Promise<UnifiedCommentsResponse> => {
    const response = await ApiUtil.get<UnifiedCommentsResponse>(
      "/user/interactions/comments",
      { user: username, limit, cursor }
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
