/**
 * @fileoverview Scheduled job to grant i2v credits to Pro users on their monthly renewal date
 * @schedule Daily at 01:01 UTC via EventBridge
 * @notes
 * - Runs daily and checks if any Pro users have their monthly renewal date today
 * - Renewal date is based on the day of the month from planStartDate
 * - Handles month-end edge cases (e.g., Jan 31 -> Feb 28/29, Oct 31 -> Nov 30)
 * - Grants 100 i2vCreditsSecondsFromPlan to qualifying Pro users
 * - Uses batch updates for efficiency
 */
import type { EventBridgeEvent } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";

export async function handler(
  event: EventBridgeEvent<"Scheduled Event", any>
): Promise<{ processedUsers: number; creditsGranted: number } | void> {
  console.log("🔋 I2V credits grant job started", {
    source: event.source,
    detailType: event["detail-type"],
    time: event.time,
  });

  try {
    const now = new Date();
    const todayISO = now.toISOString();

    console.log(`📅 Current time: ${todayISO}`);
    console.log("🔍 Checking for Pro users with renewal date today...");

    // Get Pro users whose renewal date is today
    const usersWithRenewalToday =
      await DynamoDBService.getProUsersWithRenewalToday(todayISO);

    console.log(
      `👥 Found ${usersWithRenewalToday.length} Pro users with renewal today`
    );

    if (usersWithRenewalToday.length === 0) {
      console.log("✅ No Pro users have renewal today, nothing to update");
      return { processedUsers: 0, creditsGranted: 0 };
    }

    // Grant i2v credits for users with renewal today
    let creditsGrantedCount = 0;
    const batchSize = 25; // DynamoDB batch limit

    console.log("🔄 Starting credit grant process...");

    for (let i = 0; i < usersWithRenewalToday.length; i += batchSize) {
      const batch = usersWithRenewalToday.slice(i, i + batchSize);

      console.log(
        `📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          usersWithRenewalToday.length / batchSize
        )} (${batch.length} users)`
      );

      const batchResults = await Promise.allSettled(
        batch.map(async (user) => {
          try {
            await DynamoDBService.updateUser(user.userId, {
              i2vCreditsSecondsFromPlan: 100,
            });

            console.log(
              `✅ Granted i2v credits for user ${user.userId} (${user.email}) - renewal from ${user.planStartDate}`
            );
            return { success: true, userId: user.userId };
          } catch (error) {
            console.error(
              `❌ Failed to grant credits for user ${user.userId}:`,
              error
            );
            return { success: false, userId: user.userId, error };
          }
        })
      );

      // Count successful updates in this batch
      const successfulInBatch = batchResults.filter(
        (result) => result.status === "fulfilled" && result.value.success
      ).length;

      creditsGrantedCount += successfulInBatch;

      console.log(
        `📊 Batch complete: ${successfulInBatch}/${batch.length} successful`
      );
    }

    const finalResult = {
      processedUsers: usersWithRenewalToday.length,
      creditsGranted: creditsGrantedCount,
    };

    console.log("🎉 I2V credits grant job completed:", finalResult);
    return finalResult;
  } catch (error) {
    console.error("💥 I2V credits grant job failed:", error);
    throw error;
  }
}
