// Notification types for user interactions

export type NotificationType = "like" | "comment" | "bookmark" | "follow";
export type NotificationTargetType = "album" | "media" | "comment" | "user";
export type NotificationStatus = "unread" | "read";

export interface NotificationItem {
  // Core fields
  notificationId: string;
  targetUserId: string; // User who receives the notification
  sourceUserId: string; // User who triggered the notification
  notificationType: NotificationType;
  targetType: NotificationTargetType;
  targetId: string;
  status: NotificationStatus;
  createdAt: string; // ISO timestamp
  readAt?: string; // ISO timestamp when marked as read
}

// Core notification entity
export interface NotificationEntity extends NotificationItem {
  PK: string; // NOTIFICATION#{notificationId}
  SK: string; // METADATA
  GSI1PK: string; // USER#{targetUserId}#NOTIFICATIONS
  GSI1SK: string; // {status}#{createdAt}#{notificationId} - for status-based queries
  GSI2PK: string; // USER#{targetUserId}#NOTIFICATIONS#{status}
  GSI2SK: string; // {createdAt}#{notificationId} - for efficient unread counting
  EntityType: "Notification";
}

export interface GetNotificationsRequest {
  cursor?: string;
  limit?: number;
}

export interface NotificationWithDetails extends NotificationItem {
  // Enriched notification with target details
  targetTitle?: string; // Album/Media title or comment content preview
  sourceUsername?: string; // Username of the user who triggered the notification

  // For comment notifications: information about what the comment is on
  commentTargetType?: "album" | "media"; // Only present when targetType is "comment"
  commentTargetId?: string; // Only present when targetType is "comment"
}

export interface UnreadCountResponse {
  unreadCount: number;
}
