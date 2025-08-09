// Comment-related types
import type { CommentTargetType } from "./core";

export interface Comment {
  id: string;
  content: string;
  targetType: CommentTargetType;
  targetId: string;
  userId: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  isEdited?: boolean;
}

export interface CreateCommentRequest {
  content: string;
  targetType: CommentTargetType;
  targetId: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface CommentResponse {
  success: boolean;
  data?: Comment;
  error?: string;
}

// For standalone comment operations (create, update, delete)
export interface CommentListResponse {
  success: boolean;
  data?: {
    comments: Comment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  error?: string;
}