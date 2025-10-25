/**
 * @fileoverview Scheduled job to remind users about their day streak
 * @schedule Daily at 21:00 UTC (9pm UTC) via EventBridge
 * @notes
 * - Queries users who have a current streak of 1 day
 * - Sends enthusiastic reminder about achieving a 2-day streak
 * - Only sends if user has been active recently
 * - Uses EmailService with day-streak-reminder template
 * - Updates user.lastSentDayStreakReminderEmailAt when sent
 */
import type { EventBridgeEvent } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { EmailService } from "@shared/utils/email";
import { ParameterStoreService } from "@shared/utils/parameters";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function shouldSendEmail(opts: {
  lastActive?: string;
  lastSent?: string;
  currentStreak: number;
}): Promise<boolean> {
  const { lastActive, lastSent, currentStreak } = opts;

  // Only send to users with exactly 1-day streak (on their way to 2-day streak)
  if (currentStreak !== 1) return false;

  const now = Date.now();
  const lastActiveTs = lastActive ? Date.parse(lastActive) : undefined;
  const lastSentTs = lastSent ? Date.parse(lastSent) : undefined;

  // Don't send if user hasn't been active in the last 2 days
  if (!lastActiveTs || now - lastActiveTs > 2 * ONE_DAY_MS) {
    return false;
  }

  // If never sent before, send
  if (!lastSentTs) {
    return true;
  }

  // Otherwise, only send if at least 1 day has passed since last sent
  return now - lastSentTs >= ONE_DAY_MS;
}

export async function handler(
  event: EventBridgeEvent<"Scheduled Event", any>
): Promise<{ processedUsers: number; emailsSent: number } | void> {
  console.log("📧 Day streak reminder job started", {
    time: new Date().toISOString(),
    eventDetailType: event["detail-type"],
  });

  const frontendUrl = await ParameterStoreService.getFrontendUrl();
  const baseUrl = frontendUrl.endsWith("/")
    ? frontendUrl.slice(0, -1)
    : frontendUrl;

  let processedUsers = 0;
  let emailsSent = 0;

  const LIMIT = 100;
  let lastEvaluatedKey: any | undefined = undefined;

  do {
    const { users, lastEvaluatedKey: lek } = await DynamoDBService.getAllUsers(
      LIMIT,
      lastEvaluatedKey
    );

    for (const user of users) {
      processedUsers += 1;

      // Respect user email preferences
      if (!user.email) {
        continue;
      }

      if (user.emailPreferences?.dayStreakReminder === "never") {
        continue;
      }

      const currentStreak = user.currentStreak || 0;

      const canSend = await shouldSendEmail({
        lastActive: user.lastActive,
        lastSent: user.lastSentDayStreakReminderEmailAt,
        currentStreak,
      });

      if (!canSend) continue;

      try {
        const locale = (user.preferredLanguage || "en").toLowerCase();
        const rewardsUrl = `${baseUrl}/${locale}/user/rewards`;
        const generateUrl = `${baseUrl}/${locale}/generate`;
        const settingsUrl = `${baseUrl}/${locale}/settings`;

        await EmailService.sendDayStreakReminderEmail({
          to: user.email,
          username: user.username,
          rewardsUrl,
          generateUrl,
          settingsUrl,
        });

        await DynamoDBService.updateUser(user.userId, {
          lastSentDayStreakReminderEmailAt: new Date().toISOString(),
        });

        emailsSent += 1;
      } catch (err) {
        console.error("Failed to send day streak reminder email", {
          userId: user.userId,
          email: user.email,
          error: (err as Error).message,
        });
      }
    }

    lastEvaluatedKey = lek;
  } while (lastEvaluatedKey);

  console.log("📧 Day streak reminder job completed", {
    processedUsers,
    emailsSent,
  });

  return { processedUsers, emailsSent };
}
