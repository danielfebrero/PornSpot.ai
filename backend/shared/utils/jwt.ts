import jwt, { SignOptions } from 'jsonwebtoken';
import { ParameterStoreService } from './parameters';

export interface JWTTokenPayload {
  userId: string;
  iat: number;
  exp: number;
}

export class JWTService {
  private static jwtSecret: string | null = null;

  /**
   * Get JWT secret from SSM Parameter Store
   */
  private static async getJWTSecret(): Promise<string> {
    if (this.jwtSecret) {
      return this.jwtSecret;
    }

    const environment = process.env['ENVIRONMENT'] || 'dev';
    this.jwtSecret = await ParameterStoreService.getParameter(
      `/${environment}/jwt-secret`,
      true
    );

    return this.jwtSecret;
  }

  /**
   * Generate JWT token containing encrypted userId
   * @param userId User ID to encrypt in the token
   * @param expiresIn Token expiration time (default: 1 hour)
   * @returns JWT token string
   */
  static async generateToken(
    userId: string,
    expiresIn: string | number = '1h'
  ): Promise<string> {
    const secret = await this.getJWTSecret();
    
    const payload = {
      userId,
    };

    return jwt.sign(payload, secret, {
      expiresIn,
      algorithm: 'HS256',
    } as SignOptions);
  }

  /**
   * Verify and decode JWT token to extract userId
   * @param token JWT token to verify and decode
   * @returns Decoded payload with userId
   * @throws Error if token is invalid or expired
   */
  static async verifyToken(token: string): Promise<JWTTokenPayload> {
    const secret = await this.getJWTSecret();
    
    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as JWTTokenPayload;

      return decoded;
    } catch (error) {
      console.error('JWT verification failed:', error);
      throw new Error('Invalid or expired JWT token');
    }
  }

  /**
   * Decode JWT token without verification (for debugging)
   * @param token JWT token to decode
   * @returns Decoded payload or null if invalid
   */
  static decodeToken(token: string): JWTTokenPayload | null {
    try {
      return jwt.decode(token) as JWTTokenPayload;
    } catch (error) {
      console.error('JWT decode failed:', error);
      return null;
    }
  }
}