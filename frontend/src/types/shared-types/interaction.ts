/**
 * @fileoverview Interaction Shared Types
 * @description Types for likes, bookmarks, and user interactions.
 * @notes
 * - Interaction, UserInteractionEntity for database.
 * - CreateInteractionRequest, UpdateInteractionRequest for API.
 * - InteractionType enum.
 * - TargetType, CommentTargetType enums.
 */
import type { InteractionType, TargetType } from "./core";
import type { Album } from "./album";
import type { Media } from "./media";

export interface UserInteraction {
  userId: string;
  interactionType: InteractionType;
  targetType: TargetType;
  targetId: string;
  createdAt: string;
  target?: Album | Media; // Optional target for enriched interactions
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

// Interaction status for UI components
export interface InteractionStatus {
  targetType: TargetType;
  targetId: string;
  userLiked: boolean;
  userBookmarked: boolean;
  likeCount: number;
  bookmarkCount: number;
}

export interface InteractionTarget {
  targetType: TargetType;
  targetId: string;
}

export interface InteractionStatusResponse {
  statuses: InteractionStatus[];
}

export interface InteractionCountsResponse {
  success: boolean;
  data?: {
    targetId: string;
    targetType: "album" | "image" | "video";
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
