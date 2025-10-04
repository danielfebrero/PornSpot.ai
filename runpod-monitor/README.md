# ComfyUI Monitor for RunPod

This Python script monitors ComfyUI WebSocket events in real-time and publishes structured events to AWS EventBridge, enabling an event-driven serverless architecture for image generation.

## Features

- **Real-time Monitoring**: Connects to ComfyUI WebSocket API for instant event detection
- **S3 Upload Pipeline**: Downloads generated images directly from ComfyUI, uploads them to S3, and emits an `upload_complete` WebSocket message for the backend Lambda.
- **Event Publishing**: Publishes structured events to AWS EventBridge with retry logic
- **Prompt Mapping**: Maps ComfyUI prompt_ids to application queue_ids
- **Robust Connection**: Handles reconnection and error scenarios
- **Service Integration**: Runs as a systemd service for reliability
- **Comprehensive Logging**: Structured logging for debugging and monitoring

## Architecture

```text
ComfyUI WebSocket → Python Monitor (S3 Upload) → API Gateway WebSocket → Lambda Functions → DynamoDB
```

## Event Types Published

1. **Monitor Started/Stopped** - Lifecycle events
2. **Queue Status Updated** - ComfyUI queue information
3. **Job Started** - When generation begins
4. **Progress Update** - Real-time progress during generation
5. **Node Executing** - Individual node execution events
6. **Images Generated** - When images are produced
7. **Job Completed** - When generation finishes

## Installation

### Prerequisites

- Python 3.8+
- AWS credentials configured (IAM role or access keys)
- ComfyUI running on localhost:8188
- Access to AWS EventBridge

### Setup on RunPod

1. **Copy files to RunPod instance:**

   ```bash
   # Upload the runpod-monitor directory to /workspace/comfyui-monitor
   ```

2. **Run setup script:**

   ```bash
   cd /workspace/comfyui-monitor
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Configure environment:**

   ```bash
   cp .env.example .env
   nano .env  # Update AWS credentials and region
   ```

4. **Test the monitor:**

   ```bash
   source venv/bin/activate
   python test_monitor.py
   ```

5. **Start the service:**

   ```bash
   systemctl daemon-reload
   systemctl enable comfyui-monitor
   systemctl start comfyui-monitor
   ```

## Configuration

### Environment Variables

| Variable                  | Description                                      | Default             |
| ------------------------- | ------------------------------------------------ | ------------------- |
| `COMFYUI_HOST`            | ComfyUI server host                              | `localhost`         |
| `COMFYUI_PORT`            | ComfyUI server port                              | `8188`              |
| `AWS_REGION`              | AWS region for EventBridge                       | `us-east-1`         |
| `EVENTBRIDGE_BUS_NAME`    | EventBridge custom bus name                      | `comfyui-events`    |
| `S3_BUCKET`               | Target S3 bucket for generated uploads           | _(required)_        |
| `S3_PREFIX`               | Key prefix for generated assets                  | `generated/comfyui` |
| `CLOUDFRONT_DOMAIN`       | Optional CloudFront domain for public URLs       | -                   |
| `S3_PUBLIC_BASE_URL`      | Optional full base URL override                  | -                   |
| `S3_ENDPOINT_URL`         | Optional custom S3 endpoint (LocalStack/testing) | -                   |
| `UPLOAD_CONCURRENCY`      | Maximum concurrent S3 uploads                    | `4`                 |
| `DOWNLOAD_TIMEOUT_MS`     | Timeout in milliseconds for ComfyUI downloads    | `7000`              |
| `DOWNLOAD_RETRIES`        | Number of retry attempts for downloads           | `2`                 |
| `DOWNLOAD_RETRY_DELAY_MS` | Delay in milliseconds between retries            | `750`               |
| `AWS_ACCESS_KEY_ID`       | AWS access key (if not using IAM role)           | -                   |
| `AWS_SECRET_ACCESS_KEY`   | AWS secret key (if not using IAM role)           | -                   |

### AWS IAM Permissions

The monitor requires the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["events:PutEvents"],
      "Resource": ["arn:aws:events:*:*:event-bus/comfyui-events"]
    }
  ]
}
```

## Usage

### Starting/Stopping the Service

```bash
# Start service
systemctl start comfyui-monitor

# Stop service
systemctl stop comfyui-monitor

# Check status
systemctl status comfyui-monitor

# View logs
journalctl -u comfyui-monitor -f
```

### Event Publishing

The monitor publishes raw ComfyUI events to AWS EventBridge with prompt_id information. Backend Lambda functions handle the mapping from prompt_id to queue_id using DynamoDB lookups.

Key events published:

- `Job Started` - When ComfyUI begins processing a prompt
- `Job Completed` - When ComfyUI finishes processing
- `Progress Update` - General progress updates
- `Node Progress Update` - Detailed node-level progress
- `Images Generated` - When nodes produce output images
- `Node Executing` - When individual nodes start/complete

Backend Lambda functions (like `job-start.ts`, `job-progress.ts`) receive these events and resolve prompt_id to queue_id using the `GenerationQueueService.findQueueEntryByPromptId()` method.

### Event Examples

**Job Started Event:**

```json
{
  "Source": "comfyui.monitor",
  "DetailType": "Job Started",
  "Detail": {
    "prompt_id": "abc123",
    "queue_id": "xyz789",
    "timestamp": "2024-01-01T10:00:00Z",
    "client_id": "monitor-uuid"
  }
}
```

**Progress Update Event:**

```json
{
  "Source": "comfyui.monitor",
  "DetailType": "Progress Update",
  "Detail": {
    "prompt_id": "abc123",
    "queue_id": "xyz789",
    "progress": 15,
    "max_progress": 20,
    "current_node": "ksampler",
    "percentage": 75.0,
    "timestamp": "2024-01-01T10:01:00Z"
  }
}
```

**Job Completed Event:**

```json
{
  "Source": "comfyui.monitor",
  "DetailType": "Job Completed",
  "Detail": {
    "prompt_id": "abc123",
    "queue_id": "xyz789",
    "timestamp": "2024-01-01T10:02:00Z"
  }
}
```

## Testing

Run the test suite to verify functionality:

```bash
source venv/bin/activate
python test_monitor.py
```

The test suite will:

- Test message parsing logic
- Test EventBridge connectivity
- Test WebSocket connection to ComfyUI
- Run an integration test with mock data

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**

   - Ensure ComfyUI is running on localhost:8188
   - Check firewall settings
   - Verify ComfyUI WebSocket endpoint is accessible

2. **EventBridge Publish Failed**

   - Check AWS credentials configuration
   - Verify IAM permissions
   - Ensure EventBridge bus exists
   - Check network connectivity to AWS

3. **Service Won't Start**
   - Check systemd service file: `/etc/systemd/system/comfyui-monitor.service`
   - Verify Python virtual environment path
   - Check file permissions

### Logs

- **Service logs**: `journalctl -u comfyui-monitor -f`
- **Application logs**: `/tmp/comfyui-monitor.log`
- **System logs**: `/var/log/syslog`

### Debugging

Enable debug logging:

```bash
# In .env file
LOG_LEVEL=DEBUG
```

Run monitor in foreground for debugging:

```bash
source venv/bin/activate
python comfyui_monitor.py
```

## Development

### File Structure

```text
runpod-monitor/
├── comfyui_monitor.py    # Main monitor script
├── test_monitor.py       # Test suite
├── requirements.txt      # Python dependencies
├── setup.sh             # Setup script
├── .env.example         # Environment template
└── README.md           # This file
```

### Contributing

1. Test your changes with `python test_monitor.py`
2. Ensure proper error handling and logging
3. Update documentation as needed
4. Follow Python best practices and async/await patterns

## License

MIT License - see LICENSE file for details.
