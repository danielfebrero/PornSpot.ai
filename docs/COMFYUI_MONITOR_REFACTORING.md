# ComfyUI Monitor System - Refactored Architecture

## Overview

The ComfyUI monitor system has been completely refactored to provide intelligent progress tracking with node-level details and consistent event handling throughout the pipeline. The system now shows the name of the currently processing node and its progress in real-time.

## System Components

### 1. ComfyUI Monitor (Python) - `runpod-monitor/comfyui_monitor.py`

**Enhanced Features:**
- Standardized event structure with consistent property naming
- Intelligent node progress tracking with human-readable names
- Real-time WebSocket monitoring of ComfyUI execution
- Robust error handling and reconnection logic

**Key Events Published:**
- `Monitor Initialized` - When monitor starts up
- `Job Started` - When ComfyUI begins processing a prompt
- `Node Progress Update` - Real-time progress for each processing node
- `Node Executing` - When a node starts execution
- `Node Executed` - When a node completes execution
- `Images Generated` - When a node produces images
- `Job Completed` - When entire generation is complete
- `Monitor Stopped` - When monitor shuts down gracefully

**Event Structure Standardization:**
All events now include consistent base properties:
```python
{
    "promptId": "...",           # Consistent camelCase
    "timestamp": "2024-...",     # ISO timestamp
    "clientId": "...",          # Monitor client ID
    # Event-specific data...
}
```

### 2. Backend Event Lambda Functions - `backend/functions/events/`

#### `job-start.ts`
- **Event**: `Job Started`
- **Purpose**: Updates queue entry status to "processing"
- **WebSocket**: Broadcasts job start to connected clients

#### `job-progress.ts` ⭐ **Enhanced**
- **Event**: `Node Progress Update`
- **Purpose**: Handles real-time node-level progress updates
- **Features**:
  - Intelligent node name formatting (e.g., "KSampler" → "K-Sampler")
  - Context-aware progress messages based on node type
  - Enhanced progress data structure with node metadata

**Progress Message Intelligence:**
```typescript
// Sample intelligent messages based on node type:
"Generating image using K-Sampler: 15/20 steps (75%)"
"Loading VAE Decoder: 100%"
"Encoding with CLIP Text Encoder: 3/5 (60%)"
"Processing with VAE: 45/100 (45%)"
```

#### `job-completion.ts`
- **Event**: `Job Completed`
- **Purpose**: Downloads generated images and creates media entities
- **Enhanced**: Uses standardized event structure

#### `comfyui-monitor-init.ts`
- **Event**: `Monitor Initialized`
- **Purpose**: Stores monitor client ID for ComfyUI communication
- **Enhanced**: Standardized property names

### 3. Frontend Components

#### `useGeneration.ts` Hook ⭐ **Enhanced**
**New State Management:**
```typescript
interface UseGenerationReturn {
  // ... existing properties
  currentNode: string;      // Name of currently processing node
  nodeState: string;        // Current node state (e.g., "executing")
  // ... other properties
}
```

**Enhanced WebSocket Handling:**
- New `job_progress` message type for node-level progress
- Intelligent progress display with node context
- Better state management for retries and errors

#### `GenerateClient.tsx` Component ⭐ **Enhanced**
**New Progress Display Features:**
1. **Current Node Information Panel**:
   - Shows the name of the currently processing node
   - Displays node state (executing, loading, etc.)
   - Visual indicator with pulsing animation

2. **Enhanced Progress Bar**:
   - Gradient styling for better visual appeal
   - Shows step progress (e.g., "15/20 steps")
   - Smooth transitions with enhanced duration

3. **Intelligent Status Messages**:
   - Context-aware messages based on node type
   - Real-time updates from the monitoring system

**Visual Improvements:**
```typescript
// Enhanced progress display
{currentNode && (
  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
      <span className="text-sm font-medium text-primary">
        Currently Processing
      </span>
    </div>
    <div className="text-sm font-semibold text-foreground">
      {currentNode}
    </div>
  </div>
)}
```

### 4. Type Definitions - `shared-types/comfyui-events.ts`

**Comprehensive Event Interfaces:**
- `BaseComfyUIEvent` - Common properties for all events
- `NodeProgressEvent` - Enhanced node progress structure
- `JobStartedEvent`, `JobCompletedEvent` - Lifecycle events
- `WebSocketProgress` - Frontend message structure

**Key Improvements:**
```typescript
interface NodeProgressEvent extends BaseComfyUIEvent {
  nodeId: string;
  displayNodeId: string;
  nodeProgress: number;
  nodeMaxProgress: number;
  nodePercentage: number;
  nodeState: string;
  parentNodeId?: string;
  realNodeId?: string;
}
```

## Data Flow

```
ComfyUI → Python Monitor → EventBridge → Lambda Functions → WebSocket → Frontend
```

**Detailed Flow:**
1. **ComfyUI** generates WebSocket events during image generation
2. **Python Monitor** listens to these events and transforms them into standardized format
3. **EventBridge** receives events and routes them to appropriate Lambda functions
4. **Lambda Functions** process events, update database, and send WebSocket messages
5. **Frontend** receives real-time updates and displays intelligent progress

## Event Flow Consistency

### Before Refactoring:
- ❌ Mixed property naming (`prompt_id` vs `promptId`)
- ❌ Inconsistent event types
- ❌ Basic progress display without context
- ❌ Limited error information

### After Refactoring:
- ✅ Consistent camelCase property naming
- ✅ Standardized event types and structures
- ✅ Intelligent node-level progress tracking
- ✅ Enhanced error handling and retry logic
- ✅ Context-aware progress messages
- ✅ Real-time node name display

## Key Benefits

### 1. **Intelligent Progress Display**
- Users can see exactly which step is being processed
- Context-aware messages (e.g., "Generating image using K-Sampler")
- Real-time node state information

### 2. **System Consistency**
- All components use standardized event structures
- Consistent property naming throughout the pipeline
- Predictable error handling

### 3. **Better User Experience**
- More informative progress updates
- Visual indicators for current processing step
- Enhanced retry feedback with step-level detail

### 4. **Maintainability**
- Clear separation of concerns
- Comprehensive type definitions
- Self-documenting event structures

## Configuration

### Environment Variables
```bash
# ComfyUI Monitor
COMFYUI_HOST=localhost
COMFYUI_PORT=8188
EVENTBRIDGE_BUS_NAME=prod-comfyui-events
AWS_REGION=us-east-1

# Lambda Functions
WEBSOCKET_API_ENDPOINT=wss://...
```

### EventBridge Rules
Events are routed based on their `DetailType`:
- `Monitor Initialized` → `comfyui-monitor-init`
- `Job Started` → `job-start`
- `Node Progress Update` → `job-progress`
- `Job Completed` → `job-completion`
- `Job Failed` → `job-failure`

## Testing

### Manual Testing Steps
1. Start ComfyUI server
2. Start Python monitor
3. Submit generation request through frontend
4. Observe real-time progress with node names
5. Verify completion handling

### Expected Behavior
- Progress bar shows smooth transitions
- Current node name updates in real-time
- Context-aware status messages appear
- Error handling shows detailed information

## Troubleshooting

### Common Issues
1. **Missing Node Names**: Check WebSocket connection and event routing
2. **Progress Not Updating**: Verify EventBridge and Lambda function logs
3. **Event Type Mismatches**: Ensure all components use latest type definitions

### Monitoring
- CloudWatch logs for Lambda functions
- EventBridge metrics for event delivery
- WebSocket connection status in frontend
- Python monitor logs for ComfyUI communication

## Future Enhancements

1. **Node Type Icons**: Display different icons based on node type
2. **Estimated Time Remaining**: Calculate based on historical node performance
3. **Progress History**: Show completed nodes in the current generation
4. **Parallel Node Processing**: Handle multiple nodes running simultaneously
5. **Advanced Error Recovery**: Automatic retry with different parameters

---

This refactored system provides a comprehensive, intelligent progress tracking experience that keeps users informed about the exact state of their image generation process.