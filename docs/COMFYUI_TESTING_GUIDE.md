# ComfyUI Monitor System - Testing Guide

## Overview
This guide provides comprehensive testing procedures for the refactored ComfyUI monitor system with intelligent progress tracking.

## Prerequisites

### Environment Setup
```bash
# Install dependencies
npm run install:all

# Copy shared types
npm run copy:shared-types

# Set up environment files
cp frontend/.env.example frontend/.env.local
cp backend/.env.example.json backend/.env.local.json
cp scripts/.env.example scripts/.env.local
```

### Required Services
1. **ComfyUI Server** - Running on port 8188
2. **LocalStack** - For local AWS services (DynamoDB, EventBridge, S3)
3. **WebSocket API** - For real-time frontend updates

## Testing Scenarios

### 1. Event Structure Validation ✅

**Run the automated test:**
```bash
cd runpod-monitor
python test_monitor_events.py
```

**Expected Output:**
- ✅ Event structure standardization
- ✅ Property naming consistency  
- ✅ Node progress tracking
- ✅ Intelligent message formatting

### 2. Python Monitor Testing

**Start the monitor:**
```bash
cd runpod-monitor
python comfyui_monitor.py
```

**Test Steps:**
1. Monitor should connect to ComfyUI WebSocket
2. Publish "Monitor Initialized" event
3. Listen for ComfyUI events
4. Transform events to standardized format

**Expected Events:**
```json
{
  "promptId": "test-123",
  "timestamp": "2024-...",
  "clientId": "uuid-...",
  "nodeId": "15",
  "displayNodeId": "KSampler",
  "nodeProgress": 8,
  "nodeMaxProgress": 20,
  "nodePercentage": 40.0,
  "nodeState": "executing"
}
```

### 3. Backend Lambda Function Testing

**Build backend:**
```bash
cd backend
npm run build
```

**Test Event Processing:**
Each lambda function should:
1. Receive standardized EventBridge events
2. Process with correct type definitions
3. Update DynamoDB queue entries
4. Send WebSocket messages to frontend

**Key Functions to Test:**
- `job-start.ts` - Job Started events
- `job-progress.ts` - Node Progress Update events  
- `job-completion.ts` - Job Completed events
- `job-failure.ts` - Job Failed events
- `comfyui-monitor-init.ts` - Monitor Initialized events

### 4. Frontend Progress Display Testing

**Start development server:**
```bash
cd frontend
npm run dev
```

**Test Flow:**
1. Navigate to generation page
2. Submit a generation request
3. Observe real-time progress updates
4. Verify node name display
5. Check intelligent progress messages

**Expected UI Behavior:**
- ✅ Current node name displayed (e.g., "K-Sampler")
- ✅ Progress bar with step details (e.g., "15/20 steps")
- ✅ Intelligent status messages
- ✅ Smooth progress transitions
- ✅ Enhanced visual indicators

## Manual Testing Procedures

### Complete End-to-End Test

1. **Start all services:**
   ```bash
   # Terminal 1: Backend services
   ./scripts/start-local-backend.sh
   
   # Terminal 2: Frontend
   npm run dev:frontend
   
   # Terminal 3: ComfyUI Monitor
   cd runpod-monitor && python comfyui_monitor.py
   ```

2. **Submit generation request:**
   - Open frontend at http://localhost:3000
   - Enter a prompt (e.g., "beautiful landscape, sunset")
   - Click "Generate Image"

3. **Observe progress flow:**
   - Queue status: "Position #1 in queue" 
   - Processing status: "Your generation is now being processed"
   - Node progress: "Currently Processing: K-Sampler"
   - Progress bar: "15/20 steps (75%)"
   - Intelligent messages: "Generating image using K-Sampler: 15/20 steps (75%)"

4. **Verify completion:**
   - Status: "Generation completed successfully!"
   - Generated images displayed
   - Proper cleanup of progress state

### Error Handling Test

1. **Simulate ComfyUI error:**
   - Stop ComfyUI server during generation
   - Or submit invalid workflow

2. **Verify error handling:**
   - Retry logic triggers (attempt 1/3)
   - Error messages displayed clearly
   - Proper fallback to final failure state

### Node Type Intelligence Test

**Test different node types:**
1. **Sampling Nodes** (KSampler, DPMSolver++)
   - Expected: "Generating image using K-Sampler: X/Y steps"
   
2. **Loading Nodes** (CheckpointLoader, VAELoader)
   - Expected: "Loading VAE Loader: X%"
   
3. **Encoding/Decoding** (VAEEncode, VAEDecode)
   - Expected: "Decoding with VAE Decoder: X/Y (Z%)"

## Performance Testing

### WebSocket Message Frequency
- Monitor should handle high-frequency progress updates
- Frontend should throttle updates for smooth animations
- No memory leaks in long-running generations

### Event Bridge Throughput
- Verify EventBridge can handle rapid event publishing
- Lambda functions process events without backlog
- DynamoDB updates don't cause throttling

## Validation Checklist

### ✅ System Integration
- [ ] ComfyUI → Python Monitor connection
- [ ] Python Monitor → EventBridge publishing  
- [ ] EventBridge → Lambda function routing
- [ ] Lambda → WebSocket message broadcasting
- [ ] WebSocket → Frontend progress display

### ✅ Data Consistency  
- [ ] All events use camelCase properties (promptId, nodeId, etc.)
- [ ] Timestamps in ISO format throughout pipeline
- [ ] Node names properly formatted for display
- [ ] Progress percentages calculated correctly

### ✅ User Experience
- [ ] Real-time node name display
- [ ] Intelligent progress messages
- [ ] Smooth progress bar transitions
- [ ] Clear error handling and retry feedback
- [ ] Professional visual design

### ✅ Error Scenarios
- [ ] ComfyUI connection loss
- [ ] EventBridge publishing failures
- [ ] Lambda function errors
- [ ] WebSocket disconnections
- [ ] Frontend error display

## Troubleshooting

### Common Issues

1. **No progress updates:**
   - Check WebSocket connection in browser DevTools
   - Verify EventBridge event delivery in CloudWatch
   - Check Lambda function logs for errors

2. **Missing node names:**
   - Verify ComfyUI is sending display_node_id
   - Check progress event structure in monitor logs
   - Ensure frontend receives progressData correctly

3. **Event type mismatches:**
   - Check EventBridge rules target correct functions
   - Verify event DetailType matches lambda expectations
   - Update shared types if structure changes

### Debug Commands

```bash
# Monitor events in Python
tail -f /tmp/comfyui-monitor.log

# Check EventBridge in LocalStack
aws --endpoint-url=http://localhost:4566 events list-rules

# Frontend WebSocket debugging
// In browser console:
window.addEventListener('message', console.log)
```

## Success Criteria

The refactored system passes testing when:

1. **Intelligent Progress Display** ⭐
   - Node names appear correctly during generation
   - Progress messages are context-aware and helpful
   - Visual indicators enhance user experience

2. **System Reliability** 🔒
   - Events flow consistently through entire pipeline
   - Error handling works gracefully with retries
   - No data loss or corruption during failures

3. **Performance** ⚡
   - Real-time updates without lag or stuttering
   - Efficient WebSocket message handling
   - Smooth frontend animations and transitions

4. **Developer Experience** 🛠️
   - Clear TypeScript interfaces and error messages
   - Comprehensive logging throughout system
   - Easy debugging and troubleshooting

---

This testing guide ensures the refactored ComfyUI monitor system delivers on its promise of intelligent progress tracking with node-level detail and system-wide consistency.