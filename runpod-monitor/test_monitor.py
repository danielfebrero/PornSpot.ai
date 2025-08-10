#!/usr/bin/env python3
"""
Test script for ComfyUI Monitor

This script helps test the ComfyUI monitor locally by simulating
ComfyUI WebSocket messages and testing EventBridge connectivity.
"""

import asyncio
import json
import logging
import os
import sys
from unittest.mock import AsyncMock, MagicMock

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from comfyui_monitor import ComfyUIMonitor

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("test-monitor")


class MockWebSocket:
    """Mock WebSocket for testing"""

    def __init__(self, messages):
        self.messages = messages
        self.message_index = 0
        self.closed = False

    async def __aiter__(self):
        return self

    async def __anext__(self):
        if self.message_index >= len(self.messages):
            raise StopAsyncIteration

        message = self.messages[self.message_index]
        self.message_index += 1

        # Simulate delay between messages
        await asyncio.sleep(0.5)

        return json.dumps(message)

    async def close(self):
        self.closed = True


def create_test_messages():
    """Create sample ComfyUI messages for testing"""
    return [
        # Status message
        {"type": "status", "data": {"status": {"exec_info": {"queue_remaining": 1}}}},
        # Execution start
        {"type": "execution_start", "data": {"prompt_id": "test-prompt-123"}},
        # Progress updates
        {
            "type": "progress",
            "data": {"value": 1, "max": 20, "node": "checkpoint_loader"},
        },
        {"type": "progress", "data": {"value": 5, "max": 20, "node": "ksampler"}},
        {"type": "progress", "data": {"value": 15, "max": 20, "node": "ksampler"}},
        # Node execution
        {
            "type": "executing",
            "data": {"node": "save_image", "prompt_id": "test-prompt-123"},
        },
        # Node execution with output
        {
            "type": "executed",
            "data": {
                "node": "save_image",
                "prompt_id": "test-prompt-123",
                "output": {
                    "images": [
                        {
                            "filename": "ComfyUI_test_00001_.png",
                            "subfolder": "",
                            "type": "output",
                        }
                    ]
                },
            },
        },
        # Execution completion
        {"type": "executing", "data": {"node": None, "prompt_id": "test-prompt-123"}},
    ]


async def test_message_parsing():
    """Test ComfyUI message parsing without WebSocket connection"""
    logger.info("🧪 Testing message parsing...")

    # Create monitor with mock EventBridge
    monitor = ComfyUIMonitor()
    monitor.eventbridge = MagicMock()
    monitor.eventbridge.put_events = MagicMock(return_value={"FailedEntryCount": 0})

    # Register test prompt mapping
    await monitor.register_prompt_mapping("test-prompt-123", "test-queue-456")

    # Test each message type
    test_messages = create_test_messages()

    for i, message in enumerate(test_messages):
        logger.info(f"📨 Testing message {i+1}/{len(test_messages)}: {message['type']}")

        message_json = json.dumps(message)
        await monitor.handle_websocket_message(message_json)

        # Small delay between messages
        await asyncio.sleep(0.1)

    logger.info("✅ Message parsing test completed")


async def test_eventbridge_connectivity():
    """Test EventBridge connectivity"""
    logger.info("🌉 Testing EventBridge connectivity...")

    try:
        monitor = ComfyUIMonitor()

        if not monitor.eventbridge:
            logger.warning(
                "⚠️  EventBridge client not available (check AWS credentials)"
            )
            return False

        # Test publishing a simple event
        success = await monitor.publish_event(
            "Test Event", {"test": True, "message": "Testing EventBridge connectivity"}
        )

        if success:
            logger.info("✅ EventBridge connectivity test passed")
            return True
        else:
            logger.error("❌ EventBridge connectivity test failed")
            return False

    except Exception as e:
        logger.error(f"❌ EventBridge test error: {e}")
        return False


async def test_websocket_connection():
    """Test WebSocket connection to ComfyUI"""
    logger.info("🔌 Testing WebSocket connection...")

    try:
        monitor = ComfyUIMonitor()

        # Try to connect to ComfyUI
        success = await monitor.connect_websocket()

        if success and monitor.websocket:
            logger.info("✅ WebSocket connection test passed")
            await monitor.websocket.close()
            return True
        else:
            logger.warning("⚠️  WebSocket connection failed (ComfyUI not running?)")
            return False

    except Exception as e:
        logger.error(f"❌ WebSocket test error: {e}")
        return False


async def run_integration_test():
    """Run a full integration test with mock WebSocket"""
    logger.info("🚀 Running integration test...")

    # Create monitor with mock components
    monitor = ComfyUIMonitor()

    # Mock EventBridge
    monitor.eventbridge = MagicMock()
    monitor.eventbridge.put_events = MagicMock(return_value={"FailedEntryCount": 0})

    # Mock WebSocket
    test_messages = create_test_messages()
    mock_websocket = MockWebSocket(test_messages)
    monitor.websocket = mock_websocket

    # Register test mapping
    await monitor.register_prompt_mapping("test-prompt-123", "test-queue-456")

    # Process messages
    logger.info("📨 Processing test messages...")
    async for message in mock_websocket:
        await monitor.handle_websocket_message(message)

    # Verify EventBridge calls
    call_count = monitor.eventbridge.put_events.call_count
    logger.info(f"📤 EventBridge publish calls made: {call_count}")

    if call_count > 0:
        logger.info("✅ Integration test passed")
        return True
    else:
        logger.error("❌ Integration test failed - no events published")
        return False


async def main():
    """Main test runner"""
    logger.info("🧪 Starting ComfyUI Monitor Tests")

    # Test 1: Message parsing
    await test_message_parsing()

    # Test 2: EventBridge connectivity (if credentials available)
    eventbridge_ok = await test_eventbridge_connectivity()

    # Test 3: WebSocket connection (if ComfyUI running)
    websocket_ok = await test_websocket_connection()

    # Test 4: Integration test
    integration_ok = await run_integration_test()

    # Summary
    logger.info("\n📊 Test Results Summary:")
    logger.info(f"   Message Parsing: ✅ PASS")
    logger.info(
        f"   EventBridge: {'✅ PASS' if eventbridge_ok else '⚠️  SKIP (check credentials)'}"
    )
    logger.info(
        f"   WebSocket: {'✅ PASS' if websocket_ok else '⚠️  SKIP (ComfyUI not running)'}"
    )
    logger.info(f"   Integration: {'✅ PASS' if integration_ok else '❌ FAIL'}")

    if eventbridge_ok and integration_ok:
        logger.info("\n🎉 All tests passed! Monitor is ready for deployment.")
        return True
    else:
        logger.info("\n⚠️  Some tests failed or were skipped. Check configuration.")
        return False


if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        logger.info("🔻 Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Test runner error: {e}")
        sys.exit(1)
