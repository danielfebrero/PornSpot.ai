# JWT Token WebSocket Authentication

This document describes the JWT token authentication system implemented for WebSocket connections.

## Overview

The JWT token authentication system allows authenticated users to connect to WebSocket endpoints with a secure token that contains their encrypted user ID. This replaces the previous TODO implementation in the WebSocket connect function.

## Architecture

### 1. JWT Token Generation Endpoint

**Endpoint**: `POST /user/auth/jwt-token`  
**Authentication**: Requires user authentication (UserAuthorizer)  
**File**: `/backend/functions/user/auth/jwt-token.ts`

This endpoint generates a JWT token containing the authenticated user's ID. The token:
- Is signed with HS256 algorithm
- Has a 1-hour expiration by default
- Contains only the userId in the payload
- Uses a secret stored in AWS SSM Parameter Store

### 2. JWT Utilities

**File**: `/backend/shared/utils/jwt.ts`

Provides:
- `generateToken(userId, expiresIn)`: Creates JWT tokens
- `verifyToken(token)`: Validates and decodes JWT tokens
- `decodeToken(token)`: Decodes without verification (for debugging)

The utilities handle:
- SSM secret retrieval with caching
- Proper error handling for invalid/expired tokens
- Type-safe token payload structure

### 3. WebSocket Connection Authentication

**File**: `/backend/functions/websocket/connect.ts`

Enhanced to:
- Extract JWT token from `token` query parameter
- Validate the token using JWT utilities
- Extract userId from verified token
- Graceful fallback to anonymous connection on failure
- Enhanced logging for debugging

### 4. Frontend Integration

**File**: `/frontend/src/contexts/WebSocketContext.tsx`

Updated to:
- Fetch JWT token before WebSocket connection
- Include token as query parameter in WebSocket URL
- Handle async token generation
- Mask tokens in logs for security

**File**: `/frontend/src/lib/api/user.ts`

Added:
- `generateJWTToken()`: API method to fetch JWT tokens

## Flow Diagram

```
User Authentication → JWT Token Generation → WebSocket Connection
                                           ↓
Frontend Request    → POST /user/auth/jwt-token → JWT Token
                                           ↓
WebSocket Connect   → wss://...?token=JWT → Token Validation → User ID
```

## Security Considerations

1. **Token Expiration**: Tokens expire after 1 hour by default
2. **Secret Management**: JWT secret stored securely in AWS SSM
3. **Error Handling**: Invalid tokens gracefully degrade to anonymous connections
4. **Logging**: Tokens are masked in client-side logs
5. **Transport**: Tokens transmitted over secure WebSocket connections (WSS)

## AWS Infrastructure

### SAM Template Updates

1. **New Lambda Function**: `UserJWTTokenFunction`
   - Endpoint: `/user/auth/jwt-token`
   - Authentication: UserAuthorizer
   - Permissions: SSM parameter access

2. **WebSocket Function Updates**: 
   - Added SSM permissions for JWT secret access

3. **Required SSM Parameter**:
   - Parameter: `/[environment]/jwt-secret`
   - Type: SecureString (encrypted)
   - Purpose: JWT signing and verification

### Deployment Requirements

1. **Set JWT Secret**: Store a secure secret in SSM Parameter Store:
   ```bash
   aws ssm put-parameter \
     --name "/dev/jwt-secret" \
     --value "your-secure-secret-here" \
     --type "SecureString"
   ```

2. **Deploy Backend**: Use SAM deployment with updated template

## Usage Examples

### Frontend: Generate JWT Token
```typescript
import { userApi } from '@/lib/api/user';

try {
  const response = await userApi.generateJWTToken();
  const token = response.token;
  // Use token in WebSocket connection
} catch (error) {
  // Handle authentication error
}
```

### Backend: Verify JWT Token
```typescript
import { JWTService } from '@shared/utils/jwt';

try {
  const decoded = await JWTService.verifyToken(token);
  const userId = decoded.userId;
  // Use userId for authenticated WebSocket connection
} catch (error) {
  // Handle invalid token - continue as anonymous
}
```

## Error Handling

1. **Token Generation Failures**: 
   - SSM parameter not found
   - User not authenticated
   - Service errors

2. **Token Verification Failures**:
   - Invalid token format
   - Expired tokens
   - Signature verification failures
   - Missing or incorrect secret

3. **WebSocket Connection**:
   - Graceful degradation to anonymous connections
   - Comprehensive error logging
   - No connection failures due to authentication issues

## Testing

The implementation includes:
- Unit tests for JWT utilities
- Integration tests for the token endpoint
- Manual testing for WebSocket authentication flow

## Benefits

1. **Security**: Encrypted user identification in WebSocket connections
2. **Scalability**: Token-based authentication scales better than session-based
3. **Flexibility**: Configurable token expiration and claims
4. **Reliability**: Graceful fallback ensures WebSocket connections always succeed
5. **Debugging**: Comprehensive logging for troubleshooting

This implementation follows the repository's established patterns for authentication, API integration, and serverless architecture while meeting all specified requirements.