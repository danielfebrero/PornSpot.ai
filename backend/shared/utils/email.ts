import sgMail from "@sendgrid/mail";
import { ParameterStoreService } from "./parameters";
import { EmailTemplateService } from "./emailTemplates";

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
    process.env["FROM_NAME"] || "PornSpot.ai";

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
