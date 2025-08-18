"use client";

import { useState } from "react";
import { Edit, Trash2, Heart, User } from "lucide-react";
import { Comment } from "@/types";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import LocaleLink from "@/components/ui/LocaleLink";

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onEdit?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
  onLike?: (commentId: string) => void;
  isLiked?: boolean;
  likeCount?: number;
  className?: string;
}

export function CommentItem({
  comment,
  currentUserId,
  onEdit,
  onDelete,
  onLike,
  isLiked = false,
  likeCount,
  className,
}: CommentItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const isOwner = currentUserId === comment.userId;
  const timeAgo = formatTimeAgo(comment.createdAt);

  const handleEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit?.(comment.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  return (
    <div
      className={cn("group relative", className)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
          {comment.username ? (
            comment.username.slice(0, 2).toUpperCase()
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            {comment.username ? (
              <LocaleLink
                href={`/profile/${comment.username}`}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
              >
                {comment.username}
              </LocaleLink>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                Anonymous User
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {timeAgo}
              {comment.isEdited && " (edited)"}
            </span>
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 text-sm border border-border rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
                maxLength={1000}
                placeholder="Write a comment..."
              />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default" onClick={handleEdit}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {editContent.length}/1000
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {comment.content}
            </p>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-2 mt-2">
              {/* Like button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onLike?.(comment.id)}
                className={cn(
                  "h-6 px-2 text-xs hover:text-foreground transition-colors",
                  isLiked
                    ? "text-red-500 hover:text-red-600"
                    : "text-muted-foreground"
                )}
              >
                <Heart
                  className={cn("w-3 h-3 mr-1", isLiked && "fill-current")}
                />
                {likeCount !== undefined ? likeCount : comment.likeCount || 0}
              </Button>

              {/* Owner actions */}
              {isOwner && (
                <div
                  className={cn(
                    "flex items-center gap-1",
                    !showActions &&
                      !isEditing &&
                      "opacity-0 pointer-events-none"
                  )}
                >
                  <Tooltip content="Edit comment" side="top">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Delete comment" side="top">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete?.(comment.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </Tooltip>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return "just now";
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}
