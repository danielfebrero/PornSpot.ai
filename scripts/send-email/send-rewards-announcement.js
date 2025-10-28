#!/usr/bin/env node

/**
 * send-rewards-announcement.js
 *
 * Broadcast the PornSpot.ai Day-Streak Rewards feature launch email to all users.
 *
 * Usage examples:
 *   node scripts/send-email/send-rewards-announcement.js --env=prod --send
 *   node scripts/send-email/send-rewards-announcement.js --env=stage --limit=100 --send
 *   node scripts/send-email/send-rewards-announcement.js --env=prod --to=user@example.com --send
 *   node scripts/send-email/send-rewards-announcement.js --env=prod --feature-url=https://www.pornspot.ai/user/rewards --subject="Introducing Daily Streak Rewards!" --send
 *
 * Important flags:
 *   --env=<environment>       Environment to target (local|dev|stage|prod) [required]
 *   --send                    Actually send the emails (omit for dry run)
 *   --to=<email>              Send to a single recipient (bypasses user query)
 *   --limit=<number>          Limit number of recipients (for testing)
 *   --resume-after=<email>    Skip recipients until after the provided email (case-insensitive)
 *   --page-size=<number>      Batch size per DynamoDB query (default: 50)
 *   --throttle-ms=<number>    Delay between sends in ms (default: 300)
 *   --from=<email>            Optional override for From address
 *   --subject=<text>          Email subject override
 *   --feature-url=<url>       Override feature URL (supports {locale} placeholder)
 *   --include-unverified      Include users whose email is not verified
 *   --include-inactive        Include users whose account is inactive
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

function parseArgs() {
  const rawArgs = process.argv.slice(2);

  const getArg = (name, def) => {
    const prefix = `${name}=`;
    const found = rawArgs.find((arg) => arg.startsWith(prefix));
    if (!found) return def;
    return found.slice(prefix.length);
  };

  const hasFlag = (name) => rawArgs.includes(name);

  return {
    rawArgs,
    getArg,
    hasFlag,
  };
}

function loadEnvironment(envArg) {
  const baseDir = path.join(__dirname, "..");
  let envFile = ".env";
  if (envArg) {
    envFile = `.env.${envArg}`;
    console.log(`🔧 Using environment file: ${envFile}`);
  }

  const envPath = path.join(baseDir, envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`✅ Loaded environment from ${envFile}`);
  } else if (envArg) {
    console.warn(
      `⚠️  Environment file ${envFile} not found. Falling back to process.env`
    );
  }
}

async function main() {
  const { rawArgs, getArg, hasFlag } = parseArgs();

  const environment = getArg("--env", "");
  if (!environment) {
    console.error("❌ Missing required --env parameter (local|dev|stage|prod)");
    process.exit(1);
  }

  loadEnvironment(environment);

  // Ensure ENVIRONMENT is set for ParameterStore lookups
  process.env.ENVIRONMENT = environment;

  if (!process.env.AWS_REGION) {
    process.env.AWS_REGION = "us-east-1";
  }

  // Prepare ts-node to use backend TypeScript modules
  const tsConfigPath = path.join(__dirname, "../../backend/tsconfig.json");
  process.env.TS_NODE_PROJECT = tsConfigPath;
  require("ts-node/register/transpile-only");

  // Extend module resolution so backend dependencies are visible
  process.env.NODE_PATH = [
    path.resolve(__dirname, "../../backend/node_modules"),
    path.resolve(__dirname, "../node_modules"),
    path.resolve(__dirname, "../../node_modules"),
    process.env.NODE_PATH || "",
  ]
    .filter(Boolean)
    .join(path.delimiter);
  require("module").Module._initPaths();

  const dryRun = !hasFlag("--send");
  const limitArg = getArg("--limit", "");
  const limit = limitArg ? parseInt(limitArg, 10) : null;
  const pageSizeArg = getArg("--page-size", "");
  const pageSize = pageSizeArg ? Math.max(1, parseInt(pageSizeArg, 10)) : 50;
  const throttleArg = getArg("--throttle-ms", "");
  const throttleMs = throttleArg ? Math.max(0, parseInt(throttleArg, 10)) : 300;
  const subject = getArg(
    "--subject",
    "🔥 Introducing Daily Streak Rewards - Earn Bonus Credits!"
  );
  const featureUrlProvided = rawArgs.some((arg) =>
    arg.startsWith("--feature-url=")
  );
  let featureUrlTemplate = getArg(
    "--feature-url",
    "https://www.pornspot.ai/user/rewards"
  );
  const fromOverride = getArg("--from", "");
  const resumeAfter = getArg("--resume-after", "").toLowerCase();
  const includeUnverified = hasFlag("--include-unverified");
  const includeInactive = hasFlag("--include-inactive");
  const singleRecipient = getArg("--to", "");

  console.log(
    "\n� PornSpot.ai Day-Streak Rewards Announcement Email Broadcast"
  );
  console.log("==============================================");
  console.log(`Environment: ${environment}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE SEND"}`);
  console.log(`Subject: ${subject}`);
  console.log(`Feature URL template: ${featureUrlTemplate}`);
  if (singleRecipient) console.log(`Single recipient: ${singleRecipient}`);
  if (limit) console.log(`Limit: ${limit} recipients`);
  if (resumeAfter) console.log(`Resume after email: ${resumeAfter}`);
  console.log(`Page size: ${pageSize}`);
  console.log(`Throttle: ${throttleMs} ms between sends`);
  console.log(`Include unverified emails: ${includeUnverified ? "yes" : "no"}`);
  console.log(`Include inactive accounts: ${includeInactive ? "yes" : "no"}`);
  if (fromOverride) console.log(`Using custom From: ${fromOverride}`);
  console.log("==============================================\n");

  if (!dryRun && environment === "prod") {
    console.log("⚠️  WARNING: Sending to production users.");
    console.log("    Press Ctrl+C within 5 seconds to abort.\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const { EmailService } = require("../../backend/shared/utils/email");
  const {
    EmailTemplateService,
  } = require("../../backend/shared/utils/emailTemplates");
  const { DynamoDBService } = require("../../backend/shared/utils/dynamodb");
  const {
    ParameterStoreService,
  } = require("../../backend/shared/utils/parameters");

  if (!featureUrlProvided) {
    try {
      const frontendUrl = await ParameterStoreService.getFrontendUrl();
      if (frontendUrl) {
        const normalized = frontendUrl.endsWith("/")
          ? frontendUrl.slice(0, -1)
          : frontendUrl;
        featureUrlTemplate = `${normalized}/user/rewards`;
        console.log(
          `🌐 Feature URL resolved from Parameter Store: ${featureUrlTemplate}`
        );
      }
    } catch (error) {
      console.warn(
        "⚠️  Unable to resolve frontend URL from Parameter Store. Using default feature URL.",
        error.message || error
      );
    }
  }

  const configValidation = await EmailService.validateConfiguration();
  if (!configValidation.isValid) {
    console.warn(
      "⚠️  Email configuration validation warnings:",
      configValidation.errors
    );
  }

  const buildFeatureUrl = (locale) => {
    const effectiveLocale = locale || "en";
    if (featureUrlTemplate.includes("{locale}")) {
      return featureUrlTemplate.replace("{locale}", effectiveLocale);
    }
    return featureUrlTemplate;
  };

  const stats = {
    scanned: 0,
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  // Define rewards milestones based on user plan
  const MILESTONES = [
    {
      day: 7,
      rewards: {
        free: { type: "images", amount: 10, unit: "credits" },
        starter: { type: "images", amount: 10, unit: "credits" },
        unlimited: { type: "video", amount: 5, unit: "seconds" },
        pro: { type: "video", amount: 10, unit: "seconds" },
      },
    },
    {
      day: 30,
      rewards: {
        free: { type: "images", amount: 50, unit: "credits" },
        starter: { type: "images", amount: 50, unit: "credits" },
        unlimited: { type: "video", amount: 25, unit: "seconds" },
        pro: { type: "video", amount: 50, unit: "seconds" },
      },
    },
    {
      day: 90,
      rewards: {
        free: { type: "images", amount: 500, unit: "credits" },
        starter: { type: "images", amount: 500, unit: "credits" },
        unlimited: { type: "video", amount: 100, unit: "seconds" },
        pro: { type: "video", amount: 200, unit: "seconds" },
      },
    },
  ];

  const formatReward = (reward) => {
    if (reward.type === "images") {
      return `+${reward.amount} bonus image ${reward.unit}`;
    } else if (reward.type === "video") {
      return `+${reward.amount} ${reward.unit} of video generation`;
    }
    return `+${reward.amount} ${reward.unit}`;
  };

  const getRewardsForPlan = (userPlan) => {
    const plan = userPlan || "free";
    return {
      reward7Day: formatReward(MILESTONES[0].rewards[plan]),
      reward30Day: formatReward(MILESTONES[1].rewards[plan]),
      reward90Day: formatReward(MILESTONES[2].rewards[plan]),
    };
  };

  let lastProgressRender = 0;
  let progressLineLength = 0;
  const renderProgress = (force = false) => {
    const now = Date.now();
    if (!force && now - lastProgressRender < 200) {
      return;
    }
    const summary = `Progress: scanned=${stats.scanned} processed=${stats.processed} sent=${stats.sent} skipped=${stats.skipped} failed=${stats.failed}`;
    const paddedSummary =
      summary.length < progressLineLength
        ? summary + " ".repeat(progressLineLength - summary.length)
        : summary;
    process.stdout.write(`\r${paddedSummary}`);
    progressLineLength = Math.max(progressLineLength, summary.length);
    lastProgressRender = now;
  };

  const clearProgressLine = () => {
    if (progressLineLength > 0) {
      process.stdout.write(`\r${" ".repeat(progressLineLength)}\r`);
      progressLineLength = 0;
    }
  };

  // Handle single recipient mode
  if (singleRecipient) {
    console.log(`🎯 Single recipient mode: sending to ${singleRecipient}\n`);

    try {
      const rewards = getRewardsForPlan("pro"); // Default to free plan for single test emails

      const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
        "rewards-announcement",
        {
          subject,
          displayName: singleRecipient.split("@")[0],
          dashboardUrl: buildFeatureUrl("en"),
          settingsUrl: `https://www.pornspot.ai/en/settings`,
          ...rewards,
        }
      );

      if (dryRun) {
        console.log(`📝 [DRY RUN] Would send to ${singleRecipient}`);
        console.log("✅ Dry run complete.");
        return;
      }

      const sendResult = await EmailService.sendEmail({
        to: singleRecipient,
        fromEmail: fromOverride || undefined,
        template: {
          subject,
          htmlBody,
          textBody,
        },
      });

      if (!sendResult.success) {
        console.error(
          `❌ Failed to send: ${sendResult.error || "Unknown error"}`
        );
        process.exit(1);
      } else {
        console.log(
          `✅ Email sent successfully [messageId=${sendResult.messageId}]`
        );
      }
    } catch (error) {
      console.error(`💥 Error sending email:`, error?.message || error);
      process.exit(1);
    }
    return;
  }

  let lastEvaluatedKey;
  let hasReachedResume = resumeAfter ? false : true;
  let shouldContinue = true;

  while (shouldContinue) {
    const { users, lastEvaluatedKey: nextKey } =
      await DynamoDBService.getAllUsers(pageSize, lastEvaluatedKey);

    if (!users.length) {
      if (!nextKey) break;
    }

    for (const user of users) {
      stats.scanned += 1;
      renderProgress();

      if (!hasReachedResume) {
        if ((user.email || "").toLowerCase() === resumeAfter) {
          clearProgressLine();
          console.log(`⏭️  Resuming after ${resumeAfter}`);
          renderProgress(true);
          hasReachedResume = true;
          continue;
        }
        continue;
      }

      if (limit && stats.processed >= limit) {
        shouldContinue = false;
        break;
      }

      const email = user.email;
      if (!email) {
        stats.skipped += 1;
        renderProgress();
        continue;
      }

      if (!includeInactive && user.isActive === false) {
        stats.skipped += 1;
        renderProgress();
        continue;
      }

      if (!includeUnverified && user.isEmailVerified === false) {
        stats.skipped += 1;
        renderProgress();
        continue;
      }

      // Skip users who have opted out of communications
      if (
        user.emailPreferences?.communications === "never" ||
        user.emailPreferences?.communications === false
      ) {
        stats.skipped += 1;
        renderProgress();
        continue;
      }

      stats.processed += 1;
      renderProgress();

      const displayName =
        (user.firstName && user.firstName.trim()) ||
        (user.username && user.username.trim()) ||
        email;
      const locale = user.preferredLanguage
        ? user.preferredLanguage.toLowerCase()
        : "en";
      const dashboardUrl = buildFeatureUrl(locale);
      const frontendUrl = await ParameterStoreService.getFrontendUrl();
      const baseUrl = frontendUrl.endsWith("/")
        ? frontendUrl.slice(0, -1)
        : frontendUrl;
      const settingsUrl = `${baseUrl}/${locale}/settings`;

      // Get user's plan and personalized rewards
      const userPlan = user.planInfo?.plan || user.plan || "free";
      const rewards = getRewardsForPlan(userPlan);

      try {
        const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
          "rewards-announcement",
          {
            subject,
            displayName,
            dashboardUrl,
            settingsUrl,
            ...rewards,
          }
        );

        if (dryRun) {
          if (stats.processed <= 5) {
            clearProgressLine();
            console.log(
              `📝 [DRY RUN] Would send to ${email} (${displayName}) -> ${dashboardUrl}`
            );
            renderProgress(true);
          }
          continue;
        }

        const sendResult = await EmailService.sendEmail({
          to: email,
          fromEmail: fromOverride || undefined,
          template: {
            subject,
            htmlBody,
            textBody,
          },
        });

        if (!sendResult.success) {
          stats.failed += 1;
          clearProgressLine();
          console.error(
            `❌ Failed to send to ${email}: ${
              sendResult.error || "Unknown error"
            }`
          );
          renderProgress(true);
        } else {
          stats.sent += 1;
          if (stats.sent <= 5) {
            clearProgressLine();
            console.log(
              `✅ Sent to ${email} (${displayName}) [messageId=${sendResult.messageId}]`
            );
            renderProgress(true);
          }
        }

        if (throttleMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, throttleMs));
        }
      } catch (error) {
        stats.failed += 1;
        clearProgressLine();
        console.error(
          `❌ Unexpected error sending to ${email}:`,
          error?.message || error
        );
        renderProgress(true);
      }

      renderProgress();
    }

    if (!shouldContinue) {
      break;
    }

    if (!nextKey) {
      break;
    }

    lastEvaluatedKey = nextKey;
  }

  renderProgress(true);
  if (progressLineLength > 0) {
    process.stdout.write("\n");
    progressLineLength = 0;
  }

  console.log("\n📊 Broadcast complete");
  console.log("----------------------");
  console.log(`Scanned:   ${stats.scanned}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Sent:      ${stats.sent}`);
  console.log(`Skipped:   ${stats.skipped}`);
  console.log(`Failed:    ${stats.failed}`);
  console.log("----------------------\n");

  if (dryRun) {
    console.log("✅ Dry run finished. Re-run with --send to deliver emails.");
  } else if (stats.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("💥 Fatal error during broadcast:", error?.message || error);
  process.exit(1);
});
