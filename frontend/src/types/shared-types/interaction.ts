// User interaction types
import type { InteractionType, TargetType } from "./core";

export interface UserInteraction {
  userId: string;
  interactionType: InteractionType;
  targetType: TargetType;
  targetId: string;
  createdAt: string;
}

export interface InteractionRequest {
  targetType: TargetType;
  targetId: string;
  action: "add" | "remove";
}

export interface InteractionResponse {
  success: boolean;
  data?: UserInteraction;
  error?: string;
}

export interface InteractionCountsResponse {
  success: boolean;
  data?: {
    targetId: string;
    targetType: "album" | "media";
    likeCount: number;
    bookmarkCount: number;
    userLiked: boolean;
    userBookmarked: boolean;
  };
  error?: string;
}

export interface UserInteractionsResponse {
  success: boolean;
  data?: {
    interactions: UserInteraction[];
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