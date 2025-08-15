/**
 * Manual test for JWT utilities
 * This can be run locally to verify JWT generation and validation
 */

import { JWTService } from '../../shared/utils/jwt';

// Mock environment for testing
process.env['ENVIRONMENT'] = 'dev';

// Mock ParameterStoreService for testing
jest.mock('../../shared/utils/parameters', () => ({
  ParameterStoreService: {
    getParameter: jest.fn().mockResolvedValue('test-jwt-secret-for-testing'),
  },
}));

describe('JWT Service', () => {
  const testUserId = 'test-user-123';

  test('should generate a valid JWT token', async () => {
    const token = await JWTService.generateToken(testUserId);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT should have 3 parts
  });

  test('should verify and extract userId from JWT token', async () => {
    const token = await JWTService.generateToken(testUserId);
    const decoded = await JWTService.verifyToken(token);
    
    expect(decoded.userId).toBe(testUserId);
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  test('should throw error for invalid token', async () => {
    const invalidToken = 'invalid.jwt.token';
    
    await expect(JWTService.verifyToken(invalidToken)).rejects.toThrow('Invalid or expired JWT token');
  });

  test('should decode token without verification', () => {
    // This tests the decode method which doesn't verify signature
    const validButUnsignedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.invalid-signature';
    
    const decoded = JWTService.decodeToken(validButUnsignedToken);
    expect(decoded?.userId).toBe('test-user-123');
  });

  test('should return null for malformed token in decode', () => {
    const malformedToken = 'not.a.jwt';
    const decoded = JWTService.decodeToken(malformedToken);
    expect(decoded).toBeNull();
  });
});