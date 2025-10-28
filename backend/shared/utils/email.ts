import sgMail from "@sendgrid/mail";
import { ParameterStoreService } from "./parameters";
import { EmailTemplateService } from "./emailTemplates";

export type InteractionNotificationType = "like" | "bookmark" | "comment";

export type InteractionTargetType = "album" | "image" | "video" | "comment";

export interface InteractionEmailOptions {
  to: string;
  username?: string;
  actorName: string;
  locale?: string;
  targetType: InteractionTargetType;
  targetId: string;
  targetTitle?: string;
  targetThumbnailUrl?: string;
  commentContent?: string;
  targetPath?: string;
}

// Initialize SendGrid
let isInitialized = false;

async function initializeSendGrid() {
  if (!isInitialized) {
    try {
      const apiKey = await ParameterStoreService.getSendGridApiKey();
      sgMail.setApiKey(apiKey);
      isInitialized = true;
      console.log("SendGrid initialized successfully");
    } catch (error) {
      console.error("Failed to initialize SendGrid:", error);
      throw error;
    }
  }
}

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface EmailSendOptions {
  to: string;
  template: EmailTemplate;
  fromEmail?: string;
  fromName?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private static readonly DEFAULT_FROM_EMAIL =
    process.env["FROM_EMAIL"] || "noreply@pornspot.ai";
  private static readonly DEFAULT_FROM_NAME =
    process.env["FROM_NAME"] || "PSpot.ai";

  /**
   * Send an email using SendGrid
   */
  static async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    try {
      // Initialize SendGrid if not already done
      await initializeSendGrid();

      const fromEmail = options.fromEmail || this.DEFAULT_FROM_EMAIL;
      const fromName = options.fromName || this.DEFAULT_FROM_NAME;

      const msg = {
        to: options.to,
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject: options.template.subject,
        text: options.template.textBody,
        html: options.template.htmlBody,
      };

      const response = await sgMail.send(msg);

      console.log("Email sent successfully:", {
        messageId: response[0].headers["x-message-id"],
        to: options.to,
        subject: options.template.subject,
      });

      return {
        success: true,
        messageId: response[0].headers["x-message-id"] as string,
      };
    } catch (error: unknown) {
      const errorObj = error as Error & { response?: { body: unknown } };
      console.error("Failed to send email:", {
        error: errorObj.message || "Unknown error",
        response: errorObj.response?.body,
        to: options.to,
        subject: options.template.subject,
      });

      return {
        success: false,
        error: errorObj.message || "Unknown email error",
      };
    }
  }

  /**
   * Send unread notifications email
   */
  static async sendUnreadNotificationsEmail(options: {
    to: string;
    username?: string;
    unreadCount: number;
    notificationsUrl?: string;
    settingsUrl?: string;
  }): Promise<EmailSendResult> {
    const { to, username, unreadCount } = options;
    const displayName = username || to;
    const subject =
      unreadCount === 1
        ? `You have 1 unread notification`
        : `You have ${unreadCount} unread notifications`;

    let notificationsUrl = options.notificationsUrl;
    let settingsUrl = options.settingsUrl;

    if (!notificationsUrl || !settingsUrl) {
      const frontendUrl = await ParameterStoreService.getFrontendUrl();
      const baseUrl = frontendUrl.endsWith("/")
        ? frontendUrl.slice(0, -1)
        : frontendUrl;
      notificationsUrl = notificationsUrl || `${baseUrl}/en/user/notifications`;
      settingsUrl = settingsUrl || `${baseUrl}/en/settings`;
    }

    const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
      "unread-notifications",
      {
        subject,
        displayName,
        unreadCount: String(unreadCount),
        notificationsUrl,
        settingsUrl,
      }
    );

    return this.sendEmail({
      to,
      template: { subject, htmlBody, textBody },
    });
  }

  /**
   * Send email verification email
   */
  static async sendVerificationEmail(
    email: string,
    verificationToken: string,
    firstName?: string
  ): Promise<EmailSendResult> {
    const frontendUrl = await ParameterStoreService.getFrontendUrl();
    const verificationUrl = `${frontendUrl}/auth/verify-email?token=${verificationToken}`;
    const displayName = firstName ? firstName : email;

    const template = await this.getVerificationEmailTemplate(
      displayName,
      verificationUrl,
      verificationToken
    );

    return this.sendEmail({
      to: email,
      template,
    });
  }

  /**
   * Send welcome email after successful verification
   */
  static async sendWelcomeEmail(
    email: string,
    username?: string
  ): Promise<EmailSendResult> {
    const displayName = username ? username : email;
    const frontendUrl = await ParameterStoreService.getFrontendUrl();
    const loginUrl = `${frontendUrl}/auth/login`;

    const template = await this.getWelcomeEmailTemplate(displayName, loginUrl);

    return this.sendEmail({
      to: email,
      template,
    });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(options: {
    to: string;
    username: string;
    resetUrl: string;
    expiresAt: Date;
  }): Promise<EmailSendResult> {
    const { to, username, resetUrl, expiresAt } = options;
    const displayName = username;
    const expiresAtFormatted = expiresAt.toLocaleString();

    const template = await this.getPasswordResetEmailTemplate(
      displayName,
      resetUrl,
      expiresAtFormatted
    );

    return this.sendEmail({
      to,
      template,
    });
  }

  /**
   * Send PornSpotCoin balance email
   */
  static async sendPornSpotCoinBalanceEmail(options: {
    to: string;
    username?: string;
    balancePSC: number | string;
  }): Promise<EmailSendResult> {
    const { to, username, balancePSC } = options;
    const displayName = username ? username : to;
    const balanceStr = String(balancePSC);

    const subject = `You've earned PSpotCoin! Balance: ${balanceStr} PSC`;

    const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
      "pornspotcoin-balance",
      {
        subject,
        displayName,
        balancePSC: balanceStr,
      }
    );

    return this.sendEmail({
      to,
      template: { subject, htmlBody, textBody },
    });
  }

  /**
   * Send day streak reminder email
   */
  static async sendDayStreakReminderEmail(options: {
    to: string;
    username?: string;
    rewardsUrl: string;
    generateUrl: string;
    settingsUrl: string;
    hoursLeft: number;
  }): Promise<EmailSendResult> {
    const { to, username, rewardsUrl, generateUrl, settingsUrl, hoursLeft } =
      options;
    const displayName = username ? username : to;

    const hoursText = hoursLeft === 1 ? "hour" : "hours";
    const subject = `🔥 You have ${hoursLeft} ${hoursText} left for a 2-day streak!`;

    const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
      "day-streak-reminder",
      {
        subject,
        displayName,
        rewardsUrl,
        generateUrl,
        settingsUrl,
        hoursLeft: hoursLeft.toString(),
        hoursText,
      }
    );

    return this.sendEmail({
      to,
      template: { subject, htmlBody, textBody },
    });
  }

  /**
   * Send new follower notification email
   */
  static async sendNewFollowerEmail(options: {
    to: string;
    username?: string;
    followerName: string;
    profileUrl: string;
    settingsUrl: string;
  }): Promise<EmailSendResult> {
    const { to, username, followerName, profileUrl, settingsUrl } = options;
    const displayName = username ? username : to;
    const followerDisplay = followerName || "A new user";

    const subject = `${followerDisplay} just followed you on PornSpot.ai`;

    const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
      "new-follower",
      {
        subject,
        displayName,
        followerName: followerDisplay,
        profileUrl,
        settingsUrl,
      }
    );

    return this.sendEmail({
      to,
      template: { subject, htmlBody, textBody },
    });
  }

  static async sendLikeNotificationEmail(
    options: InteractionEmailOptions
  ): Promise<EmailSendResult> {
    return this.sendInteractionNotificationEmail("like", options);
  }

  static async sendBookmarkNotificationEmail(
    options: InteractionEmailOptions
  ): Promise<EmailSendResult> {
    return this.sendInteractionNotificationEmail("bookmark", options);
  }

  static async sendCommentNotificationEmail(
    options: InteractionEmailOptions
  ): Promise<EmailSendResult> {
    return this.sendInteractionNotificationEmail("comment", options);
  }

  private static async sendInteractionNotificationEmail(
    notificationType: InteractionNotificationType,
    options: InteractionEmailOptions
  ): Promise<EmailSendResult> {
    const actorName = (options.actorName || "Someone").trim();
    const actorNameHtml = this.escapeHtml(actorName);
    const displayName = (options.username || options.to).trim();
    const displayNameHtml = this.escapeHtml(displayName);
    const displayNameText = displayName;
    const locale = (options.locale || "en").toLowerCase();

    const frontendUrl = await ParameterStoreService.getFrontendUrl();
    const baseUrl = frontendUrl.endsWith("/")
      ? frontendUrl.slice(0, -1)
      : frontendUrl;

    const targetTypeLabel = this.getTargetTypeLabel(options.targetType);
    const targetTypeLabelCapitalized =
      targetTypeLabel.charAt(0).toUpperCase() + targetTypeLabel.slice(1);

    const defaultPath = this.getDefaultTargetPath(
      options.targetType,
      options.targetId
    );
    const normalizedCustomPath = options.targetPath
      ? options.targetPath.replace(/^\/+/, "")
      : undefined;
    const relativePath = normalizedCustomPath || defaultPath;

    const targetUrl = `${baseUrl}/${locale}/${relativePath}`;
    const notificationsUrl = `${baseUrl}/${locale}/user/notifications`;
    const settingsUrl = `${baseUrl}/${locale}/settings`;

    const subject = this.getInteractionSubject(
      notificationType,
      actorName,
      targetTypeLabel
    );

    const rawTargetTitle = options.targetTitle?.trim();
    const targetTitle = rawTargetTitle || `your ${targetTypeLabel}`;
    const targetTitleHtml = this.escapeHtml(targetTitle);
    const targetTitleText = targetTitle;

    const thumbnailUrl = options.targetThumbnailUrl?.trim();
    const thumbnailSection = thumbnailUrl
      ? `<div style="text-align:center;margin:24px 0;">
          <img src="https://cdn.pornspot.ai${this.escapeAttribute(
            thumbnailUrl
          )}" alt="${this.escapeHtml(
          `${targetTypeLabelCapitalized} preview`
        )}" style="width:100%;max-width:360px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.35);" />
        </div>`
      : "";
    const thumbnailText = thumbnailUrl ? `Preview: ${thumbnailUrl}` : "";

    const rawComment = options.commentContent?.trim();
    const truncatedComment = rawComment ? this.truncate(rawComment, 400) : "";
    const commentSection = truncatedComment
      ? `<blockquote style="margin:24px 0;padding:16px 20px;background-color:#1e293b;border-left:4px solid #8b5cf6;border-radius:10px;color:#e2e8f0;">${this.escapeHtml(
          truncatedComment
        )}</blockquote>`
      : "";
    const commentText = truncatedComment
      ? `Comment: "${truncatedComment}"`
      : "";

    const finalTargetUrl = relativePath
      ? targetUrl
      : `${baseUrl}/${locale}/user/notifications`;

    const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
      this.getInteractionTemplateName(notificationType),
      {
        subject,
        displayNameHtml,
        displayNameText,
        actorNameHtml,
        actorNameText: actorName,
        targetTypeLabel,
        targetTypeLabelCapitalized,
        targetTitleHtml,
        targetTitleText,
        targetUrl: finalTargetUrl,
        thumbnailSection,
        thumbnailText,
        notificationsUrl,
        settingsUrl,
        commentSection,
        commentText,
      }
    );

    return this.sendEmail({
      to: options.to,
      template: { subject, htmlBody, textBody },
    });
  }

  private static getInteractionTemplateName(
    notificationType: InteractionNotificationType
  ): string {
    switch (notificationType) {
      case "like":
        return "interaction-like";
      case "bookmark":
        return "interaction-bookmark";
      case "comment":
        return "interaction-comment";
      default:
        return "interaction-like";
    }
  }

  private static getInteractionSubject(
    notificationType: InteractionNotificationType,
    actorName: string,
    targetTypeLabel: string
  ): string {
    switch (notificationType) {
      case "like":
        return `${actorName} liked your ${targetTypeLabel}!`;
      case "bookmark":
        return `${actorName} bookmarked your ${targetTypeLabel}!`;
      case "comment":
        return `${actorName} commented on your ${targetTypeLabel}!`;
      default:
        return `${actorName} interacted with your ${targetTypeLabel}!`;
    }
  }

  private static getTargetTypeLabel(targetType: InteractionTargetType): string {
    switch (targetType) {
      case "album":
        return "album";
      case "image":
        return "image";
      case "video":
        return "video";
      case "comment":
        return "comment";
      default:
        return "content";
    }
  }

  private static getDefaultTargetPath(
    targetType: InteractionTargetType,
    targetId: string
  ): string {
    switch (targetType) {
      case "album":
        return `albums/${targetId}`;
      case "image":
      case "video":
        return `media/${targetId}`;
      case "comment":
      default:
        return "user/notifications";
    }
  }

  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private static escapeAttribute(value: string): string {
    return this.escapeHtml(value);
  }

  private static truncate(value: string, max: number = 280): string {
    if (value.length <= max) {
      return value;
    }
    return `${value.slice(0, max - 1)}…`;
  }

  /**
   * Get email verification template
   */
  private static async getVerificationEmailTemplate(
    displayName: string,
    verificationUrl: string,
    verificationToken: string
  ): Promise<EmailTemplate> {
    const subject = "Please verify your email address";

    const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
      "verification",
      {
        subject,
        displayName,
        verificationUrl,
        verificationToken,
      }
    );

    return {
      subject,
      htmlBody,
      textBody,
    };
  }

  /**
   * Get welcome email template
   */
  private static async getWelcomeEmailTemplate(
    displayName: string,
    loginUrl: string
  ): Promise<EmailTemplate> {
    const subject = "Welcome to PornSpot.ai!";

    const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
      "welcome",
      {
        subject,
        displayName,
        loginUrl,
      }
    );

    return {
      subject,
      htmlBody,
      textBody,
    };
  }

  /**
   * Get password reset email template
   */
  private static async getPasswordResetEmailTemplate(
    displayName: string,
    resetUrl: string,
    expiresAt: string
  ): Promise<EmailTemplate> {
    const subject = "Reset Your Password - PornSpot.ai";

    const { htmlBody, textBody } = await EmailTemplateService.loadTemplate(
      "password-reset",
      {
        subject,
        displayName,
        resetUrl,
        expiresAt,
      }
    );

    return {
      subject,
      htmlBody,
      textBody,
    };
  }

  /**
   * Validate email configuration
   */
  static async validateConfiguration(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!this.DEFAULT_FROM_EMAIL) {
      errors.push("FROM_EMAIL environment variable is not set");
    }

    try {
      await ParameterStoreService.getSendGridApiKey();
    } catch (error) {
      errors.push("SendGrid API key is not configured properly");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
