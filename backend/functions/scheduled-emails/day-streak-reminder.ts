/**
 * @fileoverview Scheduled job to remind users about their day streak
 * @schedule Daily at 12:00 UTC (12pm UTC) and 21:00 UTC (9pm UTC) via EventBridge
 * @notes
 * - Queries users who have a current streak of 1 day
 * - Sends enthusiastic reminder about achieving a 2-day streak with dynamic hours left
 * - Only sends if user has been active recently
 * - Uses EmailService with day-streak-reminder template
 * - Updates user.lastSentDayStreakReminderEmailAt when sent
 * - Hours left calculated dynamically based on current UTC time until midnight
 */
import type { EventBridgeEvent } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { EmailService } from "@shared/utils/email";
import { ParameterStoreService } from "@shared/utils/parameters";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function calculateHoursUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0); // Set to midnight UTC

  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  const hoursUntilMidnight = Math.ceil(msUntilMidnight / (1000 * 60 * 60));

  return Math.max(1, hoursUntilMidnight); // Always show at least 1 hour
}

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

  // Allow sending twice per day: at 12am UTC and 9pm UTC
  // Send if at least 8 hours have passed since last sent (allows for both daily sends)
  const MIN_HOURS_BETWEEN_SENDS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
  return now - lastSentTs >= MIN_HOURS_BETWEEN_SENDS;
}

export async function handler(
  event: EventBridgeEvent<"Scheduled Event", any>
): Promise<{ processedUsers: number; emailsSent: number } | void> {
  const hoursUntilMidnight = calculateHoursUntilMidnightUTC();
  console.log("📧 Day streak reminder job started", {
    time: new Date().toISOString(),
    eventDetailType: event["detail-type"],
    hoursUntilMidnight,
  });

  const frontendUrl = await ParameterStoreService.getFrontendUrl();
  const baseUrl = frontendUrl.endsWith("/")
    ? frontendUrl.slice(0, -1)
    : frontendUrl;

  let processedUsers = 0;
  let emailsSent = 0;
  let usersWithEmail = 0;
  let usersWithCorrectStreak = 0;
  let usersWithRecentActivity = 0;
  let eligibleUsers = 0;

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
      usersWithEmail += 1;

      if (user.emailPreferences?.dayStreakReminder === "never") {
        continue;
      }

      const currentStreak = user.daysStreakGeneration || 0;
      if (currentStreak === 1) {
        usersWithCorrectStreak += 1;
      }

      // Check recent activity
      const now = Date.now();
      const lastActiveTs = user.lastActive
        ? Date.parse(user.lastActive)
        : undefined;
      const isRecentlyActive =
        lastActiveTs && now - lastActiveTs <= 2 * 24 * 60 * 60 * 1000;
      if (isRecentlyActive) {
        usersWithRecentActivity += 1;
      }

      const canSend = await shouldSendEmail({
        lastActive: user.lastActive,
        lastSent: user.lastSentDayStreakReminderEmailAt,
        currentStreak,
      });

      if (!canSend) {
        console.log(
          `⏭️ Skipping user ${user.userId}: streak=${currentStreak}, lastActive=${user.lastActive}, lastSent=${user.lastSentDayStreakReminderEmailAt}`
        );
        continue;
      }

      eligibleUsers += 1;

      try {
        const rewardsUrl = `${baseUrl}/user/rewards`;
        const generateUrl = `${baseUrl}/generate`;
        const settingsUrl = `${baseUrl}/settings`;
        const hoursLeft = calculateHoursUntilMidnightUTC();

        await EmailService.sendDayStreakReminderEmail({
          to: user.email,
          username: user.username,
          rewardsUrl,
          generateUrl,
          settingsUrl,
          hoursLeft,
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
    usersWithEmail,
    usersWithCorrectStreak,
    usersWithRecentActivity,
    eligibleUsers,
    emailsSent,
  });

  return { processedUsers, emailsSent };
}
