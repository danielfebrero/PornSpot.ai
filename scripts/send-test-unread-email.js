/**
 * send-test-unread-email.js
 *
 * Quick script to send a test "unread notifications" email using the backend EmailService.
 *
 * Usage:
 *   node scripts/send-test-unread-email.js --env=prod
 *   node scripts/send-test-unread-email.js --env=stage --to=you@example.com --username=You --count=3
 *
 * Options:
 *   --env=<environment>   Load environment variables from .env.<environment> (local|dev|stage|prod)
 *   --to=<email>          Recipient email (default: "febrero.daniel@gmail.com")
 *   --username=<name>     Display name for the email (default: extracted from email before @)
 *   --count=<number>      Unread notifications count to display (default: 5)
 *   --from=<email>        Optional from email override
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const a = args.find((x) => x.startsWith(`${name}=`));
  if (!a) return def;
  return a.split("=")[1];
};
const envArg = getArg("--env", "");
const toArg = getArg("--to", "febrero.daniel@gmail.com");
const usernameArg = getArg("--username", toArg.split("@")[0]);
const countArg = parseInt(getArg("--count", "5"), 10) || 5;
const fromArg = getArg("--from", "");

// Load env file if provided
let envFile = ".env";
if (envArg) {
  envFile = `.env.${envArg}`;
  console.log(`🔧 Using env file: ${envFile}`);
}
const envPath = path.join(__dirname, envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment from ${envFile}`);
} else if (envArg) {
  console.warn(
    `⚠️  Env file ${envFile} not found. Proceeding with process.env`
  );
}

// Ensure ENVIRONMENT is set so ParameterStoreService uses the right SSM path
if (envArg) {
  process.env.ENVIRONMENT = envArg;
  console.log(`🌱 ENVIRONMENT set to: ${process.env.ENVIRONMENT}`);
}

// Provide a default AWS region if not already set (required for SSM client)
if (!process.env.AWS_REGION) {
  process.env.AWS_REGION = "us-east-1";
}

// Prepare TypeScript + module resolution to use backend EmailService
process.env.TS_NODE_PROJECT = path.join(__dirname, "../backend/tsconfig.json");
require("ts-node/register/transpile-only");

// Ensure backend/node_modules is in resolution paths (for @sendgrid/mail, aws sdk, etc.)
process.env.NODE_PATH = [
  path.resolve(__dirname, "../backend/node_modules"),
  process.env.NODE_PATH || "",
]
  .filter(Boolean)
  .join(path.delimiter);
require("module").Module._initPaths();

async function main() {
  console.log("🚀 Sending test unread notifications email...");

  // Import after setting ts-node and NODE_PATH
  const { EmailService } = require("../backend/shared/utils/email");

  // Optional config validation
  try {
    const validation = await EmailService.validateConfiguration();
    if (!validation.isValid) {
      console.warn("⚠️  Email configuration issues:", validation.errors);
    }
  } catch (err) {
    console.warn(
      "⚠️  Could not fully validate email configuration:",
      err?.message || err
    );
  }

  const sendOptions = {
    to: toArg,
    username: usernameArg,
    unreadCount: countArg,
  };

  if (fromArg) {
    // If a from override is provided, call lower-level sendEmail with template built here
    const {
      EmailTemplateService,
    } = require("../backend/shared/utils/emailTemplates");
    const {
      ParameterStoreService,
    } = require("../backend/shared/utils/parameters");
    const frontendUrl = await ParameterStoreService.getFrontendUrl();
    const baseUrl = frontendUrl.endsWith("/")
      ? frontendUrl.slice(0, -1)
      : frontendUrl;
    const notificationsUrl = `${baseUrl}/en/user/notifications`;
    const settingsUrl = `${baseUrl}/en/settings`;
    const subject =
      countArg === 1
        ? `You have 1 unread notification`
        : `You have ${countArg} unread notifications`;
    const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
      "unread-notifications",
      {
        subject,
        displayName: usernameArg,
        unreadCount: String(countArg),
        notificationsUrl,
        settingsUrl,
      }
    );
    const res = await EmailService.sendEmail({
      to: toArg,
      fromEmail: fromArg,
      template: { subject, htmlBody, textBody },
    });
    if (!res.success) {
      throw new Error(res.error || "Unknown email error");
    }
    console.log("✅ Test email sent (custom from)", { to: toArg, subject });
    return;
  }

  const result = await EmailService.sendUnreadNotificationsEmail(sendOptions);
  if (!result.success) {
    throw new Error(result.error || "Unknown email error");
  }

  console.log("✅ Test email sent", {
    to: toArg,
    username: usernameArg,
    count: countArg,
    messageId: result.messageId,
  });
}

main().catch((err) => {
  console.error("💥 Failed to send test email:", err?.message || err);
  process.exit(1);
});
