# WebSocket API Documentation

## Overview

The PornSpot.ai platform provides real-time updates for generation progress through WebSocket connections. This document outlines the WebSocket message format, authentication, and subscription patterns.

## Connection

WebSocket connections are managed through AWS API Gateway WebSocket API. The connection process includes:

1. **Handshake**: Client initiates WebSocket connection to the API Gateway endpoint
2. **Authentication**: Optional session token validation for authenticated users
3. **Connection Storage**: Connection details stored in DynamoDB for message routing
4. **Ready State**: Client can now subscribe to queue updates and receive real-time messages

Connection entities are automatically cleaned up after 24 hours using DynamoDB TTL.

### Authentication

WebSocket connections support multiple authentication methods:

#### JWT Token Authentication (Recommended)

**New JWT-based authentication provides enhanced security with time-limited tokens:**

- Generate JWT token before WebSocket connection: `POST /user/auth/generate-jwt`
- Include token as query parameter: `wss://your-websocket-url?token=jwt_token`
- Tokens expire after 5 minutes for security
- UserId is encrypted within the JWT payload using AES-256-GCM

**Frontend Implementation:**

```typescript
// Generate JWT token and connect
const { token } = await userApi.generateJwt();
const wsUrl = `wss://your-websocket-url?token=${encodeURIComponent(token)}`;
const ws = new WebSocket(wsUrl);
```

**See detailed documentation**: [JWT WebSocket Authentication](./JWT_WEBSOCKET_AUTHENTICATION.md)

#### Legacy Session Authentication

WebSocket connections also support legacy session-based authentication:

**Authenticated Connection:**

- Include the user session token as a query parameter: `wss://your-websocket-url?sessionToken=your_session_token`
- The session token is extracted from the `user_session` cookie in the browser
- Authenticated users can receive personalized updates and subscribe to their own generation queues

**Anonymous Connection:**

- Connect without any session token: `wss://your-websocket-url`
- Anonymous users can still receive public updates but with limited functionality

**Frontend Implementation:**

```typescript
// Extract session cookie and include in WebSocket URL
const getSessionCookie = () => {
  const cookies = document.cookie.split(";");
  const userSessionCookie = cookies.find((cookie) =>
    cookie.trim().startsWith("user_session=")
  );
  return userSessionCookie ? userSessionCookie.split("=")[1] : null;
};

const sessionToken = getSessionCookie();
const wsUrl = sessionToken
  ? `wss://your-websocket-url?sessionToken=${encodeURIComponent(sessionToken)}`
  : `wss://your-websocket-url`;

const ws = new WebSocket(wsUrl);
```

**Backend Processing:**

- Session tokens in query parameters take priority over cookie headers
- Fallback to cookie-based authentication if no session token in query
- Invalid or missing authentication results in anonymous connection
- User information is stored in the connection entity for message routing

## Message Format

All WebSocket messages follow this structure:

```json
{
  "action": "subscribe|unsubscribe|ping",
  "data": {
    "queueId": "string"
  },
  "requestId": "optional-string"
}
```

## Subscription Management

### Subscribe to Queue Updates

Subscribe to receive real-time updates for a specific generation queue:

```json
{
  "action": "subscribe",
  "data": {
    "queueId": "uuid-of-queue-entry"
  },
  "requestId": "optional-request-id"
}
```

**Response:**

```json
{
  "type": "subscription_confirmed",
  "queueId": "uuid-of-queue-entry",
  "requestId": "optional-request-id"
}
```

### Unsubscribe from Queue Updates

Stop receiving updates for a specific queue:

```json
{
  "action": "unsubscribe",
  "data": {
    "queueId": "uuid-of-queue-entry"
  },
  "requestId": "optional-request-id"
}
```

**Response:**

```json
{
  "type": "unsubscription_confirmed",
  "queueId": "uuid-of-queue-entry",
  "requestId": "optional-request-id"
}
```

### Health Check

Send a ping to maintain connection health:

```json
{
  "action": "ping",
  "requestId": "optional-request-id"
}
```

**Response:**

```json
{
  "type": "pong",
  "timestamp": "2025-08-12T10:30:00.000Z",
  "requestId": "optional-request-id"
}
```

## Generation Update Messages

Once subscribed to a queue, clients will receive real-time updates:

### Queue Status Update

```json
{
  "type": "queue_update",
  "queueId": "uuid-of-queue-entry",
  "queuePosition": 3,
  "estimatedWaitTime": 120000,
  "comfyUIQueueRemaining": 5,
  "timestamp": "2025-08-12T10:30:00.000Z",
  "status": "pending",
  "message": "Queue position: 3 (ComfyUI: 5 remaining)"
}
```

### Prompt Optimization Messages

#### Optimization Start

```json
{
  "type": "optimization_start",
  "queueId": "uuid-of-queue-entry",
  "timestamp": "2025-08-12T10:30:00.000Z",
  "optimizationData": {
    "originalPrompt": "a beautiful landscape",
    "optimizedPrompt": "",
    "completed": false
  }
}
```

#### Optimization Token Stream

```json
{
  "type": "optimization_token",
  "queueId": "uuid-of-queue-entry",
  "timestamp": "2025-08-12T10:30:00.000Z",
  "optimizationData": {
    "originalPrompt": "a beautiful landscape",
    "optimizedPrompt": "a breathtaking, stunning landscape with",
    "token": " with",
    "completed": false
  }
}
```

#### Optimization Complete

```json
{
  "type": "optimization_complete",
  "queueId": "uuid-of-queue-entry",
  "timestamp": "2025-08-12T10:30:00.000Z",
  "optimizationData": {
    "originalPrompt": "a beautiful landscape",
    "optimizedPrompt": "a breathtaking, stunning landscape with vibrant colors and dramatic lighting",
    "completed": true
  }
}
```

#### Optimization Error

```json
{
  "type": "optimization_error",
  "queueId": "uuid-of-queue-entry",
  "timestamp": "2025-08-12T10:30:00.000Z",
  "error": "OpenRouter API error: Rate limit exceeded",
  "optimizationData": {
    "originalPrompt": "a beautiful landscape",
    "optimizedPrompt": "",
    "completed": true
  }
}
```

### Job Progress Update

```json
{
  "type": "job_progress",
  "queueId": "uuid-of-queue-entry",
  "promptId": "comfyui-prompt-id",
  "timestamp": "2025-08-12T10:30:00.000Z",
  "status": "processing",
  "progressType": "node_progress",
  "progressData": {
    "nodeId": "3",
    "displayNodeId": "KSampler",
    "currentNode": "KSampler",
    "value": 15,
    "max": 20,
    "percentage": 75,
    "nodeState": "running",
    "parentNodeId": "2",
    "realNodeId": "3",
    "message": "KSampler: 15/20 (75%) - running"
  }
}
}
```

### Generation Completion

```json
{
  "type": "completed",
  "queueId": "uuid-of-queue-entry",
  "promptId": "comfyui-prompt-id",
  "timestamp": "2025-08-12T10:30:00.000Z",
  "status": "completed",
  "message": "Generation completed successfully!",
  "medias": [
    {
      "mediaId": "generated-media-id",
      "url": "relative/path/to/image.jpg",
      "thumbnails": {
        "xs": "relative/path/to/thumb_xs.webp",
        "sm": "relative/path/to/thumb_sm.webp",
        "md": "relative/path/to/thumb_md.webp",
        "lg": "relative/path/to/thumb_lg.webp",
        "xl": "relative/path/to/thumb_xl.webp"
      }
    }
  ]
}
```

### Error Messages

```json
{
  "type": "error",
  "error": "Error message description",
  "requestId": "optional-request-id",
  "timestamp": "2025-08-12T10:30:00.000Z"
}
```

## Implementation Notes

### Authentication Architecture Changes

**Version 2.0 - Session Token Authentication:**

- Moved from query parameter `userId` to secure session token authentication
- Session tokens extracted from `user_session` cookies and passed as query parameters
- Fallback support for cookie headers when session token not available in query
- Graceful degradation to anonymous connections for invalid/missing authentication

**Connection Flow:**

1. Frontend extracts `user_session` cookie value
2. Includes session token in WebSocket URL: `?sessionToken=<token>`
3. Backend validates token using existing `UserAuthMiddleware`
4. Connection entity stores `userId` for authenticated users or remains anonymous

### Queue ID vs Prompt ID

- **Queue ID**: Unique identifier for the generation request in our internal queue system
- **Prompt ID**: ComfyUI's internal identifier for the submitted prompt

WebSocket subscriptions use **Queue ID** for consistency with the internal generation queue system. The prompt ID is included in updates for reference but should not be used for subscriptions.

### Subscription Storage

Subscriptions are now stored directly in the queue entry's `connectionId` field instead of separate subscription entities:

- **Queue Entry**: `connectionId` field stores the WebSocket connection ID
- **Simplified Architecture**: One queue entry can have at most one active subscriber (the submitter)
- **Automatic Cleanup**: Connection IDs are removed when connections are closed or become stale

This approach eliminates the need for separate subscription tracking entities and simplifies the broadcast mechanism.

### Backward Compatibility

The system provides a helper function `broadcastToQueueSubscribersByPromptId()` for existing job handlers that work with ComfyUI prompt IDs. This function:

1. Looks up the queue entry by prompt ID
2. Retrieves the corresponding queue ID
3. Broadcasts to all queue subscribers

## Error Handling

### Connection Errors

- Stale connections (410 error) are automatically cleaned up
- Failed message deliveries are logged but don't stop broadcasting to other subscribers

### Invalid Requests

- Missing `queueId` in subscription requests returns an error
- Unknown actions are rejected with an error message
- Connection validation is performed before processing requests

## Usage Examples

### Frontend Integration

```typescript
// Subscribe to queue updates
const subscribe = (queueId: string) => {
  websocket.send(
    JSON.stringify({
      action: "subscribe",
      data: { queueId },
    })
  );
};

// Handle incoming messages
websocket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case "queue_update":
      updateQueuePosition(message.queuePosition);
      break;
    case "optimization_start":
      showOptimizationProgress("Starting prompt optimization...");
      break;
    case "optimization_token":
      streamOptimizationToken(message.optimizationData.optimizedPrompt);
      break;
    case "optimization_complete":
      finishOptimization(message.optimizationData.optimizedPrompt);
      break;
    case "optimization_error":
      handleOptimizationError(message.error);
      break;
    case "job_progress":
      updateProgress(message.progressData);
      break;
    case "completed":
      showResults(message.medias);
      break;
    case "error":
      handleError(message.error);
      break;
  }
};
```

### Backend Broadcasting

```typescript
import { broadcastToQueueSubscribers } from "./websocket/route";

// Broadcast update to the subscriber of a queue (if any)
await broadcastToQueueSubscribers(queueId, {
  type: "queue_update",
  queuePosition: 2,
  estimatedWaitTime: 60000,
});
```

## Security Considerations

### Session Token Security

**Token Transmission:**

- Session tokens are transmitted as query parameters during WebSocket handshake
- URLs with session tokens are logged server-side but sanitized in client logs
- Tokens are not stored persistently in browser history or cache

**Token Validation:**

- Session tokens are validated against the DynamoDB session store
- Expired or invalid tokens result in anonymous connection (graceful degradation)
- Session validation includes user active status and email verification checks

**Best Practices:**

- Session tokens should only be transmitted over HTTPS/WSS connections in production
- Tokens are automatically extracted from secure HttpOnly cookies when available
- Connection attempts with invalid authentication fall back to anonymous mode
- WebSocket connections automatically clean up after 24 hours via TTL

**Logging and Monitoring:**

- Authentication attempts are logged with sanitized session information
- Failed authentication attempts are monitored but don't block connection
- User connection events include authentication source (token vs cookie vs anonymous)

```typescript
// Example of secure logging (session token is masked)
console.log(
  "WebSocket URL:",
  wsUrl.replace(/sessionToken=[^&]+/, "sessionToken=***")
);
```

## Migration from Prompt ID

Previous implementations used `promptId` for subscriptions. The migration involves:

1. **Frontend**: Already updated to use `queueId`
2. **Backend**: Updated subscription logic to use `queueId`
3. **Compatibility**: Helper functions maintain compatibility with existing prompt-based handlers

This change improves consistency across the generation system and aligns WebSocket subscriptions with the internal queue management.
