/**
 * @fileoverview Scheduled job to email users about unread notifications
 * @schedule Daily at 07:00 UTC via EventBridge
 * @notes
 * - Queries unread notifications via GSI3 (NOTIFICATION_STATUS = UNREAD)
 * - Aggregates counts per targetUserId
 * - Loads user entities and applies sending rules:
 *   - If lastActive > lastSentUnreadNotificationsEmailAt and has unread -> send
 *   - Else if 7+ days passed since last sent -> send
 * - Uses EmailService with unread-notifications template
 * - Updates user.lastSentUnreadNotificationsEmailAt when sent
 */
import type { EventBridgeEvent } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { EmailService } from "@shared/utils/email";
import { ParameterStoreService } from "@shared/utils/parameters";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000; // Just under 7 days

async function shouldSendEmail(opts: {
  lastActive?: string;
  lastSent?: string;
  unreadCount: number;
}): Promise<boolean> {
  const { lastActive, lastSent, unreadCount } = opts;
  if (unreadCount <= 0) return false;

  const now = Date.now();
  const lastActiveTs = lastActive ? Date.parse(lastActive) : undefined;
  const lastSentTs = lastSent ? Date.parse(lastSent) : undefined;

  // If never sent before, send when there is unread
  if (!lastSentTs) {
    // Optionally avoid emailing users who've never been active; keep permissive per requirement
    return true;
  }

  // If user became active after last sent, send again
  if (lastActiveTs && lastActiveTs > lastSentTs) {
    return true;
  }

  // Otherwise, only send if a week has passed since last sent
  return now - lastSentTs >= ONE_WEEK_MS;
}

export async function handler(
  event: EventBridgeEvent<"Scheduled Event", any>
): Promise<{ processedUsers: number; emailsSent: number } | void> {
  console.log("📧 Unread notifications digest job started", {
    time: new Date().toISOString(),
    eventDetailType: event["detail-type"],
  });

  const frontendUrl = await ParameterStoreService.getFrontendUrl();
  const baseUrl = frontendUrl.endsWith("/")
    ? frontendUrl.slice(0, -1)
    : frontendUrl;

  // Step 1: Get unread counts per user via GSI3
  const countsByUser =
    await DynamoDBService.getUnreadNotificationCountsByUserGSI3();
  const userIds = Object.keys(countsByUser);
  console.log("Found users with unread notifications:", {
    users: userIds.length,
  });

  let emailsSent = 0;

  // Process in small batches to avoid spikes
  const BATCH_SIZE = 25;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batchIds = userIds.slice(i, i + BATCH_SIZE);

    // Load user records
    const users = await Promise.all(
      batchIds.map((uid) => DynamoDBService.getUserById(uid))
    );

    for (const user of users) {
      if (!user) continue;
      const unreadCount = countsByUser[user.userId] || 0;
      if (unreadCount <= 0) continue;

      // Respect user email preferences: skip if user opted out
      if (!user.email) {
        continue;
      }

      const preference = user.emailPreferences?.unreadNotifications;
      if (preference === "never") {
        continue;
      }

      if (preference === "always") {
        continue;
      }

      const canSend = await shouldSendEmail({
        lastActive: user.lastActive,
        lastSent: user.lastSentUnreadNotificationsEmailAt,
        unreadCount,
      });

      if (!canSend) continue;

      // Send the email
      try {
        const locale = (user.preferredLanguage || "en").toLowerCase();
        const notificationsUrl = `${baseUrl}/${locale}/user/notifications`;
        const settingsUrl = `${baseUrl}/${locale}/settings`;

        await EmailService.sendUnreadNotificationsEmail({
          to: user.email,
          username: user.username,
          unreadCount,
          notificationsUrl,
          settingsUrl,
        });

        // Update lastSent timestamp
        await DynamoDBService.updateUser(user.userId, {
          lastSentUnreadNotificationsEmailAt: new Date().toISOString(),
        });

        emailsSent += 1;
      } catch (err) {
        console.error("Failed to send unread notifications email", {
          userId: user.userId,
          email: user.email,
          error: (err as Error).message,
        });
      }
    }
  }

  console.log("📧 Unread notifications digest job completed", {
    processedUsers: userIds.length,
    emailsSent,
  });

  return { processedUsers: userIds.length, emailsSent };
}
