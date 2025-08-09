import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { UserUtil } from "@shared/utils/user";
import { EmailService } from "@shared/utils/email";
import { UserRegistrationRequest } from "@shared";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleRegister = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const request: UserRegistrationRequest = JSON.parse(event.body!);

  // Validate required fields using shared utilities
  const email = ValidationUtil.validateEmail(request.email);
  const username = ValidationUtil.validateUsername(request.username);
  const password = ValidationUtil.validatePassword(request.password);

  try {
    const userId = await UserUtil.createUser(
      email,
      password,
      username
    );

    // Generate email verification token
    const verificationToken = await UserUtil.generateEmailVerificationToken(
      userId,
      email
    );

    // Send verification email
    try {
      const emailResult = await EmailService.sendVerificationEmail(
        email,
        verificationToken,
        username
      );

      if (!emailResult.success) {
        console.error(
          "Failed to send verification email:",
          emailResult.error
        );
        // Don't fail registration if email sending fails
      } else {
        console.log("Verification email sent successfully:", {
          messageId: emailResult.messageId,
          email,
          userId,
        });
      }
    } catch (emailError) {
      console.error("Email sending error during registration:", emailError);
      // Don't fail registration if email sending fails
    }

    const responseData = {
      userId,
      email: email.toLowerCase(),
      username,
      message:
        "User registered successfully. Please check your email for verification.",
    };

    return ResponseUtil.created(event, responseData);
  } catch (error: any) {
    if (error.message === "Email already exists") {
      return ResponseUtil.badRequest(event, "Email is already registered");
    }
    if (error.message === "Username already exists") {
      return ResponseUtil.badRequest(event, "Username is already taken");
    }
    throw error;
  }
};

export const handler = LambdaHandlerUtil.withoutAuth(handleRegister, {
  requireBody: true,
});
