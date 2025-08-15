# JWT WebSocket Authentication Implementation

## Overview

This document describes the JWT-based authentication system implemented for WebSocket connections in PornSpot.ai. The system provides secure, time-limited token authentication for real-time WebSocket communications.

## Architecture

The JWT WebSocket authentication follows a secure token-based approach:

1. **JWT Generation**: Frontend requests a JWT token before establishing WebSocket connection
2. **Token Validation**: WebSocket connection validates the JWT token and extracts user identity
3. **Connection Authentication**: Authenticated connection is stored with proper user context
4. **Secure Communication**: Real-time updates are delivered to authenticated users

```
Frontend → JWT Endpoint → WebSocket Connection → Authenticated Session
   ↓           ↓              ↓                    ↓
 Request    Generate       Validate             Store User
  Token      JWT           Token               Connection
```

## Implementation Components

### 1. JWT Generation Endpoint

**Endpoint**: `POST /user/auth/generate-jwt`

**File**: `/backend/functions/user/auth/generate-jwt.ts`

**Purpose**: Generates JWT tokens with encrypted userId for WebSocket authentication

**Features**:
- AES-256-GCM encryption for userId protection
- 5-minute token expiry for security
- HS256 JWT algorithm with HMAC signing
- Parameter Store integration for secure secret management

**Request**:
```typescript
// No request body required - uses session authentication
POST /user/auth/generate-jwt
Authorization: Session-based (from existing user session)
```

**Response**:
```typescript
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 300,  // 5 minutes in seconds
  "tokenType": "Bearer"
}
```

**Error Responses**:
- `401`: Invalid or missing session
- `500`: Token generation failed

### 2. Frontend JWT Integration

**File**: `/frontend/src/lib/api/user.ts`

**API Method**:
```typescript
generateJwt: async (): Promise<JwtTokenResponse> => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/user/auth/generate-jwt`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.json();
}
```

**WebSocket Context Integration**:

**File**: `/frontend/src/contexts/WebSocketContext.tsx`

```typescript
const getWebSocketUrl = async (): Promise<string> => {
  try {
    // Generate JWT token before WebSocket connection
    const { token } = await userApi.generateJwt();
    return `${WS_URL}?token=${encodeURIComponent(token)}`;
  } catch (error) {
    console.error("Failed to generate JWT token:", error);
    throw new Error("Authentication failed");
  }
};
```

### 3. WebSocket Connection Authentication

**File**: `/backend/functions/websocket/connect.ts`

**Authentication Flow**:

1. **Token Extraction**: Extract JWT token from query parameters
2. **Token Validation**: Verify JWT signature and expiry
3. **UserId Decryption**: Decrypt encrypted userId from token payload
4. **Connection Storage**: Store authenticated connection in DynamoDB

**Key Functions**:

```typescript
// JWT token validation and userId extraction
const validateJwtToken = async (token: string): Promise<string | null> => {
  try {
    const [jwtSecret, encryptionKey] = await Promise.all([
      ParameterStoreService.getJwtSecret(),
      ParameterStoreService.getJwtEncryptionKey()
    ]);

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret, { 
      algorithms: ["HS256"],
      issuer: "pornspot.ai"
    }) as any;
    
    // Decrypt userId
    const userId = decryptUserId(decoded.encryptedUserId, encryptionKey);
    return userId;
  } catch (error) {
    console.error("JWT validation failed:", error);
    return null;
  }
};

// AES-256-GCM decryption
const decryptUserId = (encryptedData: string, secretKey: string): string => {
  const key = createHash("sha256").update(secretKey).digest();
  const parts = encryptedData.split(":");
  
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
};
```

## Security Implementation

### Encryption Standards

**JWT Signing**: 
- Algorithm: HS256 (HMAC with SHA-256)
- Secret: 512-bit cryptographically random key
- Expiry: 5 minutes for security

**UserId Encryption**:
- Algorithm: AES-256-GCM (Authenticated Encryption)
- Key: 256-bit cryptographically random key
- IV: Random initialization vector per encryption
- Auth Tag: Authenticated encryption tag for integrity

### Parameter Store Configuration

**Secret Management**: AWS Systems Manager Parameter Store

```bash
# JWT Signing Secret (512-bit hex)
/pornspot-ai/{environment}/jwt-secret

# AES Encryption Key (256-bit base64)
/pornspot-ai/{environment}/jwt-encryption-key
```

**Helper Functions**:

**File**: `/backend/shared/utils/parameters.ts`

```typescript
export const getJwtSecret = async (): Promise<string> => {
  return await getParameter("jwt-secret");
};

export const getJwtEncryptionKey = async (): Promise<string> => {
  return await getParameter("jwt-encryption-key");
};
```

### Token Security Features

1. **Short Expiry**: 5-minute token lifetime reduces exposure window
2. **Encrypted Payload**: UserId is encrypted within JWT payload
3. **Signature Verification**: HMAC-SHA256 prevents token tampering
4. **Secure Storage**: Secrets stored in AWS Parameter Store
5. **Environment Isolation**: Separate keys per environment

## AWS SAM Template Configuration

**File**: `/template.yaml`

```yaml
UserGenerateJwtFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: backend/
    Handler: functions/user/auth/generate-jwt.handler
    Runtime: nodejs20.x
    Environment:
      Variables:
        ENVIRONMENT: !Ref Environment
    Events:
      GenerateJwtApi:
        Type: Api
        Properties:
          RestApiId: !Ref PornSpotApi
          Path: /user/auth/generate-jwt
          Method: POST
          Auth:
            Authorizer: UserAuthorizer
    Policies:
      - SSMParameterReadPolicy:
          ParameterName: !Sub "/pornspot-ai/${Environment}/*"
```

## Connection Entity Structure

WebSocket connections are stored in DynamoDB following the ConnectionEntity schema:

**Type**: `ConnectionEntity`

```typescript
{
  PK: "CONNECTION#{connectionId}",           // Primary key
  SK: "METADATA",                           // Sort key
  GSI1PK: "WEBSOCKET_CONNECTIONS",          // GSI1 partition key
  GSI1SK: "{userId}#{connectionId}",        // GSI1 sort key
  EntityType: "WebSocketConnection",        // Entity type
  connectionId: string,                     // WebSocket connection ID
  userId: string,                           // Authenticated user ID
  connectedAt: string,                      // ISO timestamp
  lastActivity: string,                     // ISO timestamp
  ttl: number                               // TTL for cleanup (24 hours)
}
```

## Usage Flow

### 1. Client Connection Process

```typescript
// 1. Generate JWT token
const { token } = await userApi.generateJwt();

// 2. Connect to WebSocket with token
const ws = new WebSocket(`wss://api.pornspot.ai/ws?token=${token}`);

// 3. Handle connection events
ws.onopen = () => {
  console.log("WebSocket connected and authenticated");
};

ws.onerror = (error) => {
  console.error("WebSocket connection failed:", error);
};
```

### 2. Server Authentication Process

```typescript
// 1. Extract token from query parameters
const jwtToken = queryParams["token"];

// 2. Validate token and extract userId
const userId = await validateJwtToken(jwtToken);

// 3. Store authenticated connection
const connectionEntity: ConnectionEntity = {
  PK: `CONNECTION#${connectionId}`,
  SK: "METADATA",
  GSI1PK: "WEBSOCKET_CONNECTIONS", 
  GSI1SK: `${userId}#${connectionId}`,
  EntityType: "WebSocketConnection",
  connectionId,
  userId,
  connectedAt: currentTime,
  lastActivity: currentTime,
  ttl: Math.floor(Date.now() / 1000) + 86400
};
```

## Error Handling

### Frontend Error Scenarios

1. **JWT Generation Failed**: User session invalid or expired
2. **WebSocket Connection Failed**: Invalid token or network issues
3. **Token Expired**: Token expired during connection attempt

```typescript
const connectWithRetry = async (maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { token } = await userApi.generateJwt();
      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      return ws;
    } catch (error) {
      console.error(`Connection attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};
```

### Backend Error Responses

1. **401 Unauthorized**: Missing or invalid JWT token
2. **500 Internal Server Error**: Token generation or validation failed

```typescript
// Missing token
{
  statusCode: 401,
  body: JSON.stringify({ message: "JWT token required" })
}

// Invalid token
{
  statusCode: 401, 
  body: JSON.stringify({ message: "Invalid JWT token" })
}
```

## Security Considerations

### Best Practices Implemented

1. **Principle of Least Privilege**: Tokens contain minimal user information
2. **Defense in Depth**: Multiple layers of validation and encryption
3. **Secure Secret Management**: AWS Parameter Store with encryption
4. **Time-Limited Access**: Short token expiry reduces attack surface
5. **Audit Logging**: Comprehensive logging for security monitoring

### Security Checklist

- ✅ JWT tokens signed with HMAC-SHA256
- ✅ UserId encrypted with AES-256-GCM
- ✅ Secrets stored in AWS Parameter Store
- ✅ Token expiry enforced (5 minutes)
- ✅ Input validation and sanitization
- ✅ Comprehensive error handling
- ✅ Audit logging implemented
- ✅ Environment-specific secret isolation

## Testing

### Unit Tests

Test JWT generation and validation:

```typescript
describe('JWT WebSocket Authentication', () => {
  test('should generate valid JWT token', async () => {
    const response = await request(app)
      .post('/user/auth/generate-jwt')
      .set('Cookie', validSessionCookie)
      .expect(200);
      
    expect(response.body.token).toBeDefined();
    expect(response.body.expiresIn).toBe(300);
  });

  test('should validate JWT token in WebSocket', async () => {
    const token = await generateTestJWT();
    const userId = await validateJwtToken(token);
    expect(userId).toBe('test-user-id');
  });
});
```

### Integration Tests

Test end-to-end WebSocket authentication:

```typescript
describe('WebSocket Integration', () => {
  test('should connect with valid JWT token', async () => {
    const { token } = await userApi.generateJwt();
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    
    await new Promise((resolve) => {
      ws.onopen = resolve;
      ws.onerror = (error) => fail(error);
    });
  });
});
```

## Key Generation

### Production Key Setup

```bash
# Generate JWT secret (512-bit)
JWT_SECRET=$(openssl rand -hex 64)
aws ssm put-parameter \
  --name "/pornspot-ai/prod/jwt-secret" \
  --value "${JWT_SECRET}" \
  --type "SecureString"

# Generate encryption key (256-bit)  
ENCRYPTION_KEY=$(openssl rand -base64 32)
aws ssm put-parameter \
  --name "/pornspot-ai/prod/jwt-encryption-key" \
  --value "${ENCRYPTION_KEY}" \
  --type "SecureString"
```

### Key Rotation

Recommended rotation schedule: Every 90-180 days

```bash
# Key rotation script
./scripts/rotate-jwt-keys.sh --environment prod
```

## Monitoring and Observability

### CloudWatch Metrics

- JWT token generation rate
- WebSocket connection success/failure rate
- Token validation errors
- Connection duration statistics

### Logging

- JWT generation requests
- Token validation attempts
- WebSocket connection events
- Authentication failures

### Alarms

- High authentication failure rate
- Unusual token generation patterns
- WebSocket connection errors

## Migration Guide

### From Session-Based to JWT Authentication

1. **Deploy JWT endpoint**: Deploy new generate-jwt Lambda function
2. **Update frontend**: Integrate JWT generation in WebSocket context
3. **Update WebSocket handler**: Add JWT validation logic
4. **Test thoroughly**: Verify authentication flow works correctly
5. **Monitor**: Watch for authentication errors and connection issues

### Backward Compatibility

The implementation maintains backward compatibility by:
- Keeping existing session-based authentication as fallback
- Graceful degradation for clients without JWT support
- Comprehensive error handling for mixed authentication scenarios

## Troubleshooting

### Common Issues

1. **Token Generation Fails**: Check user session validity and Parameter Store access
2. **WebSocket Connection Rejected**: Verify token format and expiry
3. **Decryption Errors**: Ensure encryption key consistency across environments
4. **Parameter Store Access**: Verify Lambda IAM permissions

### Debug Commands

```bash
# Test JWT token generation
curl -X POST https://api.pornspot.ai/user/auth/generate-jwt \
  -H "Cookie: user_session=valid_session_token"

# Validate Parameter Store access
aws ssm get-parameter --name "/pornspot-ai/dev/jwt-secret" --with-decryption

# Check WebSocket connection logs
aws logs tail /aws/lambda/websocket-connect --follow
```

## Related Documentation

- [WebSocket API Documentation](./WEBSOCKET_API.md)
- [User Authentication](./USER_AUTHENTICATION.md)
- [Parameter Store Configuration](./ENVIRONMENT_CONFIGURATION.md)
- [Security Best Practices](./PERFORMANCE_GUIDE.md#security)

---

*Last updated: August 15, 2025*
*Implementation version: 1.0*
