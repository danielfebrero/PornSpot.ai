import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ParameterStoreService } from "@shared/utils/parameters";
import jwt from "jsonwebtoken";
import { createHash, createCipheriv, randomBytes } from "crypto";

// Constants for encryption
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const JWT_EXPIRY = "5m"; // 5 minutes expiry

/**
 * Encrypts the userId using AES-256-GCM encryption
 */
const encryptUserId = (userId: string, secretKey: string): string => {
  try {
    // Create a hash of the secret key to ensure it's 32 bytes
    const key = createHash("sha256").update(secretKey).digest();

    // Generate random IV
    const iv = randomBytes(16);

    // Create cipher
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    // Encrypt the userId
    let encrypted = cipher.update(userId, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get the auth tag
    const authTag = cipher.getAuthTag();

    // Combine IV + authTag + encrypted data
    const result =
      iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;

    console.log("✅ UserId encrypted successfully");
    return result;
  } catch (error) {
    console.error("❌ Failed to encrypt userId:", error);
    throw new Error("Encryption failed");
  }
};

/**
 * Generates a JWT token containing the encrypted userId
 */
const generateJWTToken = (
  encryptedUserId: string,
  jwtSecret: string
): string => {
  try {
    const payload = {
      encryptedUserId,
      iat: Math.floor(Date.now() / 1000),
      iss: "pornspot.ai",
    };

    const token = jwt.sign(payload, jwtSecret, {
      expiresIn: JWT_EXPIRY,
      algorithm: "HS256",
    });

    console.log("✅ JWT token generated successfully");
    return token;
  } catch (error) {
    console.error("❌ Failed to generate JWT token:", error);
    throw new Error("JWT generation failed");
  }
};

const handleGenerateJWT = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;

  console.log("🔍 /user/auth/generate-jwt handler called");
  console.log("✅ Authenticated user:", userId);

  try {
    console.log(
      "🔐 Fetching JWT encryption key and secret from Parameter Store..."
    );

    // Get encryption key and JWT secret from Parameter Store
    const [encryptionKey, jwtSecret] = await Promise.all([
      ParameterStoreService.getJwtEncryptionKey(),
      ParameterStoreService.getJwtSecret(),
    ]);

    console.log("🔐 Encrypting userId...");
    const encryptedUserId = encryptUserId(userId, encryptionKey);

    console.log("🎫 Generating JWT token...");
    const jwtToken = generateJWTToken(encryptedUserId, jwtSecret);

    console.log("✅ JWT token generated successfully for user:", userId);

    return ResponseUtil.success(event, {
      token: jwtToken,
      expiresIn: JWT_EXPIRY,
      tokenType: "Bearer",
    });
  } catch (error) {
    console.error("💥 Error generating JWT token:", error);
    return ResponseUtil.error(event, "Failed to generate token", 500);
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleGenerateJWT);
