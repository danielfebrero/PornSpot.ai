#!/usr/bin/env python3
"""
WebSocket Message Forwarder for RunPod

This script forwards WebSocket messages from a local ComfyUI instance
to a remote API Gateway WebSocket endpoint.

Simple bridge between:
- Local ComfyUI WebSocket (source)
- Remote API Gateway WebSocket (destination)
"""

import asyncio
import json
import logging
import os
import sys
import signal
from typing import Optional
import uuid

import websockets

# Try to load .env file if available
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ws-forwarder")


class WebSocketForwarder:
    """Forwards messages between two WebSocket connections"""

    def __init__(self):
        # Configuration
        self.local_host = os.getenv("LOCAL_HOST", "localhost")
        self.local_port = os.getenv("LOCAL_PORT", "8188")
        self.remote_ws_url = os.getenv("REMOTE_WS_URL", "")

        # Validate remote URL
        if not self.remote_ws_url:
            raise ValueError("REMOTE_WS_URL environment variable is required")

        # Build local WebSocket URL
        self.local_ws_url = f"ws://{self.local_host}:{self.local_port}/ws?clientId=666"

        # Connection settings
        self.reconnect_delay = int(os.getenv("RECONNECT_DELAY", "5"))
        self.max_reconnect_attempts = int(os.getenv("MAX_RECONNECT_ATTEMPTS", "10"))

        # State
        self.running = True
        self.local_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.remote_ws: Optional[websockets.WebSocketClientProtocol] = None

        logger.info(f"🔧 WebSocket Forwarder initialized")
        logger.info(f"   Local: {self.local_ws_url}")
        logger.info(f"   Remote: {self.remote_ws_url}")

    def is_connection_open(self, ws) -> bool:
        """Check if WebSocket connection is open"""
        if not ws:
            return False
        try:
            # In websockets 15.x, we can check the state attribute
            if hasattr(ws, "state"):
                return str(ws.state) == "State.OPEN" or "OPEN" in str(ws.state)
            # Fallback for older versions
            elif hasattr(ws, "closed"):
                return not ws.closed
            else:
                # Last resort: assume it's open if we can't determine
                return True
        except Exception:
            return False

    async def connect_local(self) -> bool:
        """Connect to local ComfyUI WebSocket"""
        try:
            logger.info(f"🔌 Connecting to local WebSocket...")
            self.local_ws = await websockets.connect(
                self.local_ws_url, ping_interval=30, ping_timeout=10
            )
            logger.info("✅ Connected to local WebSocket")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to local WebSocket: {e}")
            return False

    async def connect_remote(self) -> bool:
        """Connect to remote API Gateway WebSocket"""
        try:
            logger.info(f"🔌 Connecting to remote WebSocket...")
            self.remote_ws = await websockets.connect(
                self.remote_ws_url, ping_interval=30, ping_timeout=10
            )
            logger.info("✅ Connected to remote WebSocket")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to remote WebSocket: {e}")
            return False

    async def forward_messages(self):
        """Forward messages from local to remote WebSocket"""
        reconnect_attempts = 0

        while self.running:
            try:
                # Ensure both connections are established
                if not self.is_connection_open(self.local_ws):
                    if not await self.connect_local():
                        await self.handle_reconnect(reconnect_attempts)
                        reconnect_attempts += 1
                        continue

                if not self.is_connection_open(self.remote_ws):
                    if not await self.connect_remote():
                        await self.handle_reconnect(reconnect_attempts)
                        reconnect_attempts += 1
                        continue

                # Reset reconnect attempts on successful connection
                reconnect_attempts = 0

                # At this point, both connections should be open
                assert self.local_ws is not None
                assert self.remote_ws is not None

                # Listen for messages from local WebSocket and forward to remote
                async for message in self.local_ws:
                    if not self.running:
                        break

                    try:
                        # Forward message as-is to remote WebSocket
                        await self.remote_ws.send(message)

                        # Log message type for debugging (optional)
                        if logger.isEnabledFor(logging.DEBUG):
                            try:
                                data = json.loads(message)
                                msg_type = data.get("type", "unknown")
                                logger.debug(f"➡️  Forwarded message: {msg_type}")
                            except:
                                logger.debug(f"➡️  Forwarded non-JSON message")
                        else:
                            logger.info(f"➡️  Message forwarded")

                    except websockets.exceptions.ConnectionClosed:
                        logger.warning("⚠️  Remote WebSocket connection lost")
                        self.remote_ws = None
                        break
                    except Exception as e:
                        logger.error(f"❌ Error forwarding message: {e}")

            except websockets.exceptions.ConnectionClosed:
                logger.warning("⚠️  Local WebSocket connection lost")
                self.local_ws = None
            except Exception as e:
                logger.error(f"❌ Unexpected error: {e}")

    async def handle_reconnect(self, attempt: int):
        """Handle reconnection with exponential backoff"""
        if not self.running:
            return

        if attempt >= self.max_reconnect_attempts:
            logger.error(f"❌ Max reconnection attempts reached. Stopping.")
            self.running = False
            return

        # Calculate delay with exponential backoff
        delay = min(self.reconnect_delay * (2**attempt), 60)
        logger.info(
            f"🔄 Reconnecting in {delay} seconds (attempt {attempt + 1}/{self.max_reconnect_attempts})"
        )
        await asyncio.sleep(delay)

    async def start(self):
        """Start the forwarding process"""
        logger.info("🚀 Starting WebSocket forwarding...")
        await self.forward_messages()

    async def stop(self):
        """Stop the forwarding process gracefully"""
        logger.info("🛑 Stopping WebSocket forwarding...")
        self.running = False

        # Close connections
        for ws, name in [(self.local_ws, "local"), (self.remote_ws, "remote")]:
            if self.is_connection_open(ws):
                try:
                    await asyncio.wait_for(ws.close(), timeout=5.0)
                    logger.info(f"✅ {name.capitalize()} WebSocket closed")
                except asyncio.TimeoutError:
                    logger.warning(f"⚠️  {name.capitalize()} WebSocket close timeout")
                except Exception as e:
                    logger.warning(f"⚠️  Error closing {name} WebSocket: {e}")

        logger.info("✅ WebSocket forwarding stopped")


# Global forwarder instance for signal handling
forwarder = None
shutdown_event = None


def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"📶 Received signal {signum}, initiating graceful shutdown...")
    if shutdown_event and not shutdown_event.is_set():
        shutdown_event.set()
    if forwarder:
        forwarder.running = False


async def main():
    """Main entry point"""
    global forwarder, shutdown_event

    # Create shutdown event
    shutdown_event = asyncio.Event()

    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        forwarder = WebSocketForwarder()

        # Start forwarding in a task
        forward_task = asyncio.create_task(forwarder.start())

        # Wait for either forwarding to complete or shutdown signal
        done, pending = await asyncio.wait(
            [forward_task, asyncio.create_task(shutdown_event.wait())],
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
        if forwarder:
            await forwarder.stop()


if __name__ == "__main__":
    asyncio.run(main())
