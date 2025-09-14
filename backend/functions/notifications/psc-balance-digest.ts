/**
 * @fileoverview Scheduled job to email users about their PornSpotCoin (PSC) balance
 * @schedule Daily at 06:00 UTC via EventBridge
 * @notes
 * - Iterates over users via DynamoDBService.getAllUsers (GSI1 USER_EMAIL)
 * - Applies sending rules similar to unread-digest:
 *   - Balance must be > 0
 *   - If never sent before -> send
 *   - Else if lastActive > lastSentPscBalanceEmailAt -> send
 *   - Else if 7 days minus 1 hour passed since lastSent -> send
 * - Uses EmailService with pornspotcoin-balance template
 * - Updates user.lastSentPscBalanceEmailAt when sent
 */
import type { EventBridgeEvent } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { EmailService } from "@shared/utils/email";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000; // Just under 7 days

async function shouldSendEmail(opts: {
  lastActive?: string;
  lastSent?: string;
  balancePSC: number;
}): Promise<boolean> {
  const { lastActive, lastSent, balancePSC } = opts;

  if (!balancePSC || balancePSC <= 0) return false;

  const now = Date.now();
  const lastActiveTs = lastActive ? Date.parse(lastActive) : undefined;
  const lastSentTs = lastSent ? Date.parse(lastSent) : undefined;

  // If never sent before, send when there is a positive balance
  if (!lastSentTs) {
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
  console.log("📧 PSC balance digest job started", {
    time: new Date().toISOString(),
    eventDetailType: event["detail-type"],
  });

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
      const balancePSC = user.pscBalance || 0;

      const canSend = await shouldSendEmail({
        lastActive: user.lastActive,
        lastSent: user.lastSentPscBalanceEmailAt,
        balancePSC,
      });

      if (!canSend) continue;

      try {
        await EmailService.sendPornSpotCoinBalanceEmail({
          to: user.email,
          username: user.username,
          balancePSC,
        });

        await DynamoDBService.updateUser(user.userId, {
          lastSentPscBalanceEmailAt: new Date().toISOString(),
        });

        emailsSent += 1;
      } catch (err) {
        console.error("Failed to send PSC balance email", {
          userId: user.userId,
          email: user.email,
          error: (err as Error).message,
        });
      }
    }

    lastEvaluatedKey = lek;
  } while (lastEvaluatedKey);

  console.log("📧 PSC balance digest job completed", {
    processedUsers,
    emailsSent,
  });

  return { processedUsers, emailsSent };
}
