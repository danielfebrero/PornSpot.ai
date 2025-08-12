#!/usr/bin/env python3
"""
ComfyUI WebSocket Monitor for RunPod

This script connects to ComfyUI's WebSocket API to monitor real-time events
and publishes structured events to AWS EventBridge for our serverless architecture.

Key Features:
- Real-time WebSocket monitoring of ComfyUI events
- Publishes raw ComfyUI events to AWS EventBridge with retry logic
- Backend Lambda functions handle prompt_id to queue_id mapping
- Handles reconnection and error scenarios
- Structured logging for debugging
"""

import asyncio
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime
from typing import Dict, Optional, Any
import signal

# Try to load .env file if available
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    # dotenv not available, continue without it
    pass

import websockets
import boto3
from botocore.exceptions import ClientError, BotoCoreError


# Configure logging
def setup_logging():
    """Setup logging configuration with error handling"""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # Validate log level
    if log_level not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
        log_level = "INFO"

    handlers = []

    # Console handler (always add)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(log_format))
    handlers.append(console_handler)

    # File handler (with error handling)
    log_file = os.getenv("LOG_FILE", "/tmp/comfyui-monitor.log")
    try:
        # Ensure log directory exists
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)

        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(logging.Formatter(log_format))
        handlers.append(file_handler)
    except (OSError, PermissionError) as e:
        # If we can't create the log file, just use console logging
        print(f"Warning: Could not create log file {log_file}: {e}")
        print("Continuing with console logging only...")

    logging.basicConfig(
        level=getattr(logging, log_level),
        format=log_format,
        handlers=handlers,
        force=True,  # Override any existing logging configuration
    )


# Setup logging before creating logger
setup_logging()
logger = logging.getLogger("comfyui-monitor")


class ComfyUIMonitor:
    """Monitors ComfyUI WebSocket events and publishes to EventBridge

    The monitor publishes raw ComfyUI events with prompt_id.
    Backend Lambda functions handle the mapping from prompt_id to queue_id.
    """

    def __init__(self):
        # Configuration from environment variables with validation
        self.comfyui_host = os.getenv("COMFYUI_HOST", "localhost")
        self.comfyui_port = self._validate_port(os.getenv("COMFYUI_PORT", "8188"))
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        self.eventbridge_bus_name = os.getenv(
            "EVENTBRIDGE_BUS_NAME", "prod-comfyui-events"
        )

        # Validate required configuration
        self._validate_configuration()

        # WebSocket configuration
        self.client_id = str(uuid.uuid4())
        self.websocket_url = (
            f"ws://{self.comfyui_host}:{self.comfyui_port}/ws?clientId={self.client_id}"
        )

        # State management
        self.running = True
        self.websocket = None

        # AWS EventBridge client with better error handling
        try:
            # Test AWS credentials availability
            session = boto3.Session()
            credentials = session.get_credentials()

            if not credentials:
                logger.warning(
                    "⚠️  No AWS credentials found. EventBridge publishing will be disabled."
                )
                self.eventbridge = None
            else:
                self.eventbridge = boto3.client("events", region_name=self.aws_region)
                logger.info(
                    f"✅ EventBridge client initialized for region: {self.aws_region}"
                )
        except Exception as e:
            logger.error(f"❌ Failed to initialize EventBridge client: {e}")
            self.eventbridge = None

        # Reconnection settings with validation
        self.reconnect_delay = self._validate_positive_int(
            os.getenv("RECONNECT_DELAY", "5"), "RECONNECT_DELAY", 5
        )
        self.max_reconnect_attempts = self._validate_positive_int(
            os.getenv("MAX_RECONNECT_ATTEMPTS", "10"), "MAX_RECONNECT_ATTEMPTS", 10
        )
        self.reconnect_attempts = 0

        logger.info(f"🔧 ComfyUI Monitor initialized")
        logger.info(f"   WebSocket URL: {self.websocket_url}")
        logger.info(f"   EventBridge Bus: {self.eventbridge_bus_name}")
        logger.info(f"   Client ID: {self.client_id}")

    def _validate_port(self, port_str: str) -> str:
        """Validate port number"""
        try:
            port = int(port_str)
            if not (1 <= port <= 65535):
                raise ValueError(f"Port must be between 1 and 65535, got {port}")
            return str(port)
        except ValueError as e:
            logger.error(f"❌ Invalid port configuration: {e}")
            raise ValueError(f"Invalid COMFYUI_PORT: {port_str}") from e

    def _validate_positive_int(self, value_str: str, name: str, default: int) -> int:
        """Validate positive integer configuration"""
        try:
            value = int(value_str)
            if value <= 0:
                logger.warning(f"⚠️  {name} must be positive, using default: {default}")
                return default
            return value
        except ValueError:
            logger.warning(f"⚠️  Invalid {name} '{value_str}', using default: {default}")
            return default

    def _validate_configuration(self):
        """Validate essential configuration"""
        errors = []

        if not self.comfyui_host:
            errors.append("COMFYUI_HOST cannot be empty")

        if not self.aws_region:
            errors.append("AWS_REGION cannot be empty")

        if not self.eventbridge_bus_name:
            errors.append("EVENTBRIDGE_BUS_NAME cannot be empty")

        if errors:
            error_msg = "Configuration validation failed: " + ", ".join(errors)
            logger.error(f"❌ {error_msg}")
            raise ValueError(error_msg)

    async def publish_event(self, event_type: str, detail: Dict[str, Any]) -> bool:
        """Publish an event to AWS EventBridge"""
        if not self.eventbridge:
            logger.warning("⚠️  EventBridge client not available, event not published")
            return False

        try:
            event = {
                "Source": "comfyui.monitor",
                "DetailType": event_type,
                "Detail": json.dumps(detail),
                "EventBusName": self.eventbridge_bus_name,
            }

            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: self.eventbridge.put_events(Entries=[event])
            )

            if response["FailedEntryCount"] == 0:
                logger.info(
                    f"📤 Published event: {event_type} - {detail.get('prompt_id', 'unknown')}"
                )
                logger.debug(f"Event detail: {json.dumps(detail)}")
                return True
            else:
                logger.error(f"❌ Failed to publish event: {response}")
                return False

        except (ClientError, BotoCoreError) as e:
            logger.error(f"❌ AWS error publishing event: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error publishing event: {e}")
            return False

    async def handle_status_message(self, data: Dict[str, Any]):
        """Handle ComfyUI status messages (queue info)"""
        try:
            exec_info = data.get("status", {}).get("exec_info", {})
            queue_remaining = exec_info.get("queue_remaining", 0)

            logger.debug(f"📊 Queue status: {queue_remaining} items remaining")

            # Publish queue status event with standardized structure
            await self.publish_event(
                "Queue Status Updated",
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "clientId": self.client_id,
                    "promptId": "system",  # System-level event, no specific prompt
                    "queueRemaining": queue_remaining,
                    "execInfo": exec_info,
                },
            )

        except Exception as e:
            logger.error(f"❌ Error handling status message: {e}")

    async def handle_execution_start_message(self, data: Dict[str, Any]):
        """Handle execution start messages"""
        try:
            prompt_id = data.get("prompt_id")
            if not prompt_id:
                return

            logger.info(f"🚀 Execution started: prompt_id={prompt_id}")

            # Publish execution start event with standardized structure
            # Backend will resolve promptId to queueId
            await self.publish_event(
                "Job Started",
                {
                    "promptId": prompt_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "clientId": self.client_id,
                },
            )

        except Exception as e:
            logger.error(f"❌ Error handling execution start message: {e}")

    async def handle_executing_message(self, data: Dict[str, Any]):
        """Handle executing messages (node start/prompt completion)"""
        try:
            prompt_id = data.get("prompt_id")
            node = data.get("node")

            if not prompt_id:
                return

            if node is None:
                # Execution completed
                logger.info(f"✅ Execution completed: prompt_id={prompt_id}")

                # await self.publish_event(
                #     "Job Completed",
                #     {
                #         "promptId": prompt_id,
                #         "timestamp": datetime.utcnow().isoformat(),
                #         "clientId": self.client_id,
                #         "executionData": {
                #             "promptId": prompt_id,
                #             "output": data.get("output", {}),
                #         },
                #     },
                # )

            else:
                # Node execution started
                logger.debug(f"🔄 Node executing: {node} for prompt_id={prompt_id}")

                await self.publish_event(
                    "Node Executing",
                    {
                        "promptId": prompt_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "clientId": self.client_id,
                        "nodeId": node,
                        "executionData": data,
                    },
                )

        except Exception as e:
            logger.error(f"❌ Error handling executing message: {e}")

    async def handle_executed_message(self, data: Dict[str, Any]):
        """Handle executed messages (node completion with outputs)"""
        try:
            prompt_id = data.get("prompt_id")
            node = data.get("node")
            output = data.get("output", {})

            if not prompt_id:
                return

            # Check if this node produced images
            images = output.get("images", [])
            if images:
                logger.info(
                    f"🖼️  Node {node} produced {len(images)} image(s) for prompt_id={prompt_id}"
                )

                await self.publish_event(
                    "Images Generated",
                    {
                        "promptId": prompt_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "clientId": self.client_id,
                        "nodeId": node,
                        "images": images,
                        "output": output,
                    },
                )
            else:
                logger.debug(
                    f"🔄 Node {node} executed (no images) for prompt_id={prompt_id}"
                )

                await self.publish_event(
                    "Node Executed",
                    {
                        "promptId": prompt_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "clientId": self.client_id,
                        "nodeId": node,
                        "output": output,
                    },
                )
        except Exception as e:
            logger.error(f"❌ Error handling executed message: {e}")

    async def handle_progress_state_message(self, data: Dict[str, Any]):
        """Handle progress_state messages - enhanced progress tracking with node-level detail"""
        try:
            # progress_state has a more complex structure with prompt_id and nodes object
            prompt_id = data.get("prompt_id")
            nodes_data = data.get("nodes", {})

            if not prompt_id:
                logger.warning("⚠️  No prompt_id in progress_state message")
                return

            # Since nodes only appear when they start running, and typically only one node
            # runs at a time, we'll report on the currently running node(s)
            if not nodes_data:
                logger.debug(
                    f"📊 No active nodes in progress_state for prompt_id={prompt_id}"
                )
                return

            for node_id, node_info in nodes_data.items():
                value = node_info.get("value", 0)
                max_value = node_info.get("max", 1)
                state = node_info.get("state", "unknown")
                display_node_id = node_info.get("display_node_id", node_id)

                # Calculate percentage for this specific node
                node_percentage = (
                    round((value / max_value) * 100, 2) if max_value > 0 else 0
                )

                logger.info(
                    f"📈 Node progress: {display_node_id} - {value}/{max_value} ({node_percentage}%) state: {state} for prompt_id={prompt_id}"
                )

                # Publish event for this specific node's progress with standardized structure
                await self.publish_event(
                    "Node Progress Update",
                    {
                        "promptId": prompt_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "clientId": self.client_id,
                        "nodeId": node_id,
                        "displayNodeId": display_node_id,
                        "nodeProgress": value,
                        "nodeMaxProgress": max_value,
                        "nodePercentage": node_percentage,
                        "nodeState": state,
                        "parentNodeId": node_info.get("parent_node_id"),
                        "realNodeId": node_info.get("real_node_id", node_id),
                    },
                )

        except Exception as e:
            logger.error(f"❌ Error handling progress_state message: {e}")

    async def handle_execution_error_message(self, data: Dict[str, Any]):
        """Handle execution error messages from ComfyUI"""
        try:
            prompt_id = data.get("prompt_id")
            error_details = data.get("exception", {})
            node_id = data.get("node_id")
            node_type = data.get("node_type")

            if not prompt_id:
                logger.warning("⚠️  No prompt_id in execution_error message")
                return

            logger.error(
                f"💥 Execution error for prompt_id={prompt_id}: {error_details}"
            )

            # Extract error information
            error_type = error_details.get("type", "unknown_error")
            error_message = error_details.get("message", "Unknown execution error")
            traceback = error_details.get("traceback", [])

            # Publish job failure event with standardized structure
            await self.publish_event(
                "Job Failed",
                {
                    "promptId": prompt_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "clientId": self.client_id,
                    "error": {
                        "type": error_type,
                        "message": error_message,
                        "nodeId": node_id,
                        "nodeType": node_type,
                        "traceback": traceback,
                    },
                },
            )

        except Exception as e:
            logger.error(f"❌ Error handling execution_error message: {e}")

    async def handle_websocket_message(self, message: str):
        """Parse and handle incoming WebSocket messages from ComfyUI"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            message_data = data.get("data", {})

            logger.debug(f"📨 Received message: {message_type}")
            logger.debug(f"Message data: {json.dumps(message_data, indent=2)}")

            # Route message to appropriate handler
            if message_type == "status":
                await self.handle_status_message(message_data)
            elif message_type == "execution_start":
                await self.handle_execution_start_message(message_data)
            elif message_type == "progress_state":
                await self.handle_progress_state_message(message_data)
            elif message_type == "executing":
                await self.handle_executing_message(message_data)
            elif message_type == "executed":
                await self.handle_executed_message(message_data)
            elif message_type == "execution_cached":
                # Node output was cached, not a critical event for our use case
                logger.debug(f"💾 Execution cached for data: {message_data}")
            elif message_type == "execution_error":
                # Handle execution errors
                await self.handle_execution_error_message(message_data)
            else:
                logger.debug(f"🤷 Unknown message type: {message_type}")

        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse JSON message: {e}")
        except Exception as e:
            logger.error(f"❌ Error handling WebSocket message: {e}")

    async def connect_websocket(self):
        """Establish WebSocket connection to ComfyUI"""
        try:
            logger.info(f"🔌 Connecting to ComfyUI WebSocket: {self.websocket_url}")

            # Get WebSocket configuration from environment
            ping_interval = self._validate_positive_int(
                os.getenv("PING_INTERVAL", "30"), "PING_INTERVAL", 30
            )
            ping_timeout = self._validate_positive_int(
                os.getenv("PING_TIMEOUT", "10"), "PING_TIMEOUT", 10
            )
            close_timeout = self._validate_positive_int(
                os.getenv("CLOSE_TIMEOUT", "10"), "CLOSE_TIMEOUT", 10
            )

            self.websocket = await websockets.connect(
                self.websocket_url,
                ping_interval=ping_interval,  # Send ping every N seconds
                ping_timeout=ping_timeout,  # Wait N seconds for pong
                close_timeout=close_timeout,  # Wait N seconds for close
            )

            logger.info("✅ Connected to ComfyUI WebSocket")
            self.reconnect_attempts = 0

            return True

        except Exception as e:
            logger.error(f"❌ Failed to connect to WebSocket: {e}")
            return False

    async def websocket_listener(self):
        """Main WebSocket listener loop"""
        while self.running:
            try:
                if not self.websocket or self.websocket.closed:
                    if not await self.connect_websocket():
                        await self.handle_reconnect()
                        continue

                # Ensure websocket is available before iterating
                if not self.websocket:
                    await self.handle_reconnect()
                    continue

                # Listen for messages
                async for message in self.websocket:
                    if not self.running:
                        break
                    await self.handle_websocket_message(message)

            except websockets.exceptions.ConnectionClosed:
                logger.warning("⚠️  WebSocket connection closed")
                self.websocket = None
                await self.handle_reconnect()
            except websockets.exceptions.WebSocketException as e:
                logger.error(f"❌ WebSocket error: {e}")
                self.websocket = None
                await self.handle_reconnect()
            except Exception as e:
                logger.error(f"❌ Unexpected error in WebSocket listener: {e}")
                self.websocket = None
                await self.handle_reconnect()

    async def handle_reconnect(self):
        """Handle WebSocket reconnection with exponential backoff"""
        if not self.running:
            return

        self.reconnect_attempts += 1

        if self.reconnect_attempts > self.max_reconnect_attempts:
            logger.error(
                f"❌ Max reconnection attempts ({self.max_reconnect_attempts}) reached. Stopping."
            )
            self.running = False
            return

        # Calculate delay with exponential backoff and jitter
        base_delay = self.reconnect_delay * (2 ** (self.reconnect_attempts - 1))
        # Add some jitter to avoid thundering herd
        import random

        jitter = random.uniform(0.1, 0.5) * base_delay
        delay = min(base_delay + jitter, 60)

        logger.info(
            f"🔄 Reconnecting in {delay:.1f} seconds (attempt {self.reconnect_attempts}/{self.max_reconnect_attempts})"
        )

        await asyncio.sleep(delay)

    async def start_monitoring(self):
        """Start the monitoring process"""
        logger.info("🚀 Starting ComfyUI monitoring...")

        # Publish startup event with standardized structure
        if self.eventbridge:
            try:
                await self.publish_event(
                    "Monitor Initialized",
                    {
                        "timestamp": datetime.utcnow().isoformat(),
                        "clientId": self.client_id,
                        "promptId": "system",  # System-level event
                        "comfyuiHost": self.comfyui_host,
                        "version": "1.0.0",
                    },
                )
            except Exception as e:
                logger.warning(f"⚠️  Could not publish startup event: {e}")

        # Start WebSocket listener
        await self.websocket_listener()

    async def stop_monitoring(self):
        """Stop the monitoring process gracefully"""
        logger.info("🛑 Stopping ComfyUI monitoring...")
        self.running = False

        # Close WebSocket connection gracefully
        if self.websocket and not self.websocket.closed:
            try:
                await asyncio.wait_for(self.websocket.close(), timeout=5.0)
                logger.info("✅ WebSocket connection closed gracefully")
            except asyncio.TimeoutError:
                logger.warning("⚠️  WebSocket close timeout, forcing closure")
            except Exception as e:
                logger.warning(f"⚠️  Error closing WebSocket: {e}")
            finally:
                self.websocket = None

        # Publish shutdown event with standardized structure
        if self.eventbridge:
            try:
                await self.publish_event(
                    "Monitor Stopped",
                    {
                        "timestamp": datetime.utcnow().isoformat(),
                        "clientId": self.client_id,
                        "promptId": "system",  # System-level event
                        "reason": "graceful_shutdown",
                    },
                )
            except Exception as e:
                logger.warning(f"⚠️  Could not publish shutdown event: {e}")

        logger.info("✅ ComfyUI monitoring stopped")


# Global monitor instance for signal handling
monitor = None
shutdown_event = None


def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"📶 Received signal {signum}, initiating graceful shutdown...")
    if shutdown_event and not shutdown_event.is_set():
        shutdown_event.set()
    if monitor:
        monitor.running = False


async def main():
    """Main entry point"""
    global monitor, shutdown_event

    # Create shutdown event for signal handling
    shutdown_event = asyncio.Event()

    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        monitor = ComfyUIMonitor()

        # Start monitoring in a task
        monitor_task = asyncio.create_task(monitor.start_monitoring())

        # Wait for either monitoring to complete or shutdown signal
        done, pending = await asyncio.wait(
            [monitor_task, asyncio.create_task(shutdown_event.wait())],
            return_when=asyncio.FIRST_COMPLETED,
        )

        # Cancel any pending tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    except KeyboardInterrupt:
        logger.info("🔻 Interrupted by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
    finally:
        if monitor:
            await monitor.stop_monitoring()


if __name__ == "__main__":
    asyncio.run(main())
