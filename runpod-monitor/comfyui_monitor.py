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
import signal
import sys
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import aiohttp
import boto3
import mimetypes
import websockets
from botocore.config import Config
from urllib.parse import quote

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
        self.local_wss_host = os.getenv("LOCAL_WSS_HOST", "localhost")
        self.local_port = os.getenv("LOCAL_PORT", "8188")
        self.remote_ws_url = os.getenv("REMOTE_WS_URL", "")

        # Validate remote URL
        if not self.remote_ws_url:
            raise ValueError("REMOTE_WS_URL environment variable is required")

        # Build local WebSocket URL
        self.local_ws_url = f"wss://{self.local_wss_host}/ws?clientId=666"

        # Connection settings
        self.reconnect_delay = int(os.getenv("RECONNECT_DELAY", "5"))
        self.max_reconnect_attempts = int(os.getenv("MAX_RECONNECT_ATTEMPTS", "10"))

        # State
        self.running = True
        self.local_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.remote_ws: Optional[websockets.WebSocketClientProtocol] = None

        # AWS/S3 configuration
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        self.s3_bucket = os.getenv("S3_BUCKET")
        if not self.s3_bucket:
            raise ValueError("S3_BUCKET environment variable is required for uploads")

        self.s3_prefix = os.getenv("S3_PREFIX", "generated/comfyui")
        self.cloudfront_domain = os.getenv("CLOUDFRONT_DOMAIN")
        self.public_base_url = os.getenv("S3_PUBLIC_BASE_URL")
        self.s3_endpoint_url = os.getenv("S3_ENDPOINT_URL")
        self.max_upload_concurrency = max(1, int(os.getenv("UPLOAD_CONCURRENCY", "4")))
        self.download_timeout_ms = int(os.getenv("DOWNLOAD_TIMEOUT_MS", "7000"))
        self.download_retries = max(0, int(os.getenv("DOWNLOAD_RETRIES", "2")))
        self.retry_delay_ms = int(os.getenv("DOWNLOAD_RETRY_DELAY_MS", "750"))

        self.s3_client = boto3.client(
            "s3",
            region_name=self.aws_region,
            endpoint_url=self.s3_endpoint_url,
            config=Config(retries={"max_attempts": 3, "mode": "standard"}),
        )

        # HTTP configuration for fetching local images
        self.comfy_http_base = f"http://{self.local_host}:{self.local_port}"

        logger.info(f"🔧 WebSocket Forwarder initialized")
        logger.info(f"   Local: {self.local_ws_url}")
        logger.info(f"   Remote: {self.remote_ws_url}")
        logger.info(f"   S3 Bucket: {self.s3_bucket}")

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
                        await self.process_local_message(message)

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

    async def process_local_message(self, message: str) -> None:
        if not self.remote_ws:
            raise RuntimeError("Remote WebSocket is not connected")

        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            await self.remote_ws.send(message)
            logger.debug("➡️  Forwarded raw message (invalid JSON)")
            return

        msg_type = data.get("type")
        if msg_type == "executed" and data.get("data", {}).get("output", {}).get(
            "images"
        ):
            await self.handle_executed_message(data)
        else:
            await self.remote_ws.send(message)
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(f"➡️  Forwarded message: {msg_type}")

    async def handle_executed_message(self, data: Dict[str, Any]) -> None:
        prompt_id = data.get("data", {}).get("prompt_id")
        node = data.get("data", {}).get("node")
        images = data.get("data", {}).get("output", {}).get("images", [])

        if not prompt_id:
            logger.warning("⚠️  Received executed message without prompt_id")
            return

        if not images:
            logger.info("ℹ️  Executed message contained no images; sending notification")
            await self.send_upload_notification(
                prompt_id,
                node,
                [],
                [],
                total_images=0,
            )
            return

        logger.info(
            f"🖼️  Processing executed message for prompt {prompt_id} with {len(images)} image(s)"
        )

        uploaded, failures = await self.upload_images(prompt_id, images)

        await self.send_upload_notification(
            prompt_id,
            node,
            uploaded,
            failures,
            total_images=len(images),
        )

    async def upload_images(
        self, prompt_id: str, images: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        uploaded: List[Dict[str, Any]] = []
        failures: List[Dict[str, Any]] = []

        semaphore = asyncio.Semaphore(self.max_upload_concurrency)

        async def process_image(index: int, image: Dict[str, Any]) -> None:
            async with semaphore:
                try:
                    image_bytes, mime_type = await self.download_image(image)
                    key = self.build_s3_key(prompt_id, image, index)
                    metadata = {
                        "promptId": prompt_id,
                        "source": "comfyui-monitor",
                        "originalFilename": image.get("filename", "unknown"),
                    }
                    await self.upload_to_s3(key, image_bytes, mime_type, metadata)

                    upload_record = {
                        "index": index,
                        "s3Key": key,
                        "relativePath": self.get_relative_path(key),
                        "publicUrl": self.build_public_url(key),
                        "size": len(image_bytes),
                        "mimeType": mime_type,
                        "originalFilename": image.get("filename"),
                        "uploadedAt": datetime.utcnow().isoformat() + "Z",
                    }

                    uploaded.append(upload_record)
                    logger.info(
                        f"✅ Uploaded image {index + 1}/{len(images)} for prompt {prompt_id}"
                    )
                except Exception as error:
                    error_record = {
                        "index": index,
                        "filename": image.get("filename"),
                        "error": str(error),
                    }
                    failures.append(error_record)
                    logger.error(
                        f"❌ Failed to upload image {index + 1}/{len(images)} for prompt {prompt_id}: {error}"
                    )

        await asyncio.gather(
            *(process_image(index, image) for index, image in enumerate(images))
        )

        uploaded.sort(key=lambda item: item["index"])
        failures.sort(key=lambda item: item["index"])

        return uploaded, failures

    async def download_image(self, image: Dict[str, Any]) -> Tuple[bytes, str]:
        filename = image.get("filename", "")
        subfolder = image.get("subfolder", "")
        image_type = image.get("type", "output")

        params = {
            "filename": filename,
            "subfolder": subfolder,
            "type": image_type,
        }

        query = "&".join(f"{key}={quote(str(value))}" for key, value in params.items())
        url = f"{self.comfy_http_base}/api/view?{query}"

        timeout = aiohttp.ClientTimeout(total=self.download_timeout_ms / 1000)

        last_error: Optional[Exception] = None

        for attempt in range(self.download_retries + 1):
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(url) as response:
                        if response.status != 200:
                            text = await response.text()
                            raise RuntimeError(
                                f"Download failed with status {response.status}: {text[:200]}"
                            )

                        data = await response.read()
                        if not data:
                            raise RuntimeError("Downloaded image is empty")

                        content_type = response.headers.get("Content-Type")
                        mime_type = (
                            content_type
                            or mimetypes.guess_type(filename)[0]
                            or "image/png"
                        )

                        return data, mime_type
            except Exception as error:
                last_error = error
                if attempt < self.download_retries:
                    delay = self.retry_delay_ms / 1000
                    logger.warning(
                        f"⚠️  Download attempt {attempt + 1} failed for {filename}, retrying in {delay}s: {error}"
                    )
                    await asyncio.sleep(delay)

        raise RuntimeError(
            f"Failed to download image {filename} after {self.download_retries + 1} attempts"
        ) from last_error

    def build_s3_key(self, prompt_id: str, image: Dict[str, Any], index: int) -> str:
        _, extension = os.path.splitext(image.get("filename") or "")
        ext = extension.lower() if extension else ".png"
        safe_prompt = self.sanitize_identifier(prompt_id)
        unique_id = uuid.uuid4().hex
        prefix = self.s3_prefix.strip("/")
        return f"{prefix}/{safe_prompt}/{unique_id}_{index}{ext}"

    async def upload_to_s3(
        self, key: str, data: bytes, mime_type: str, metadata: Dict[str, str]
    ) -> None:
        def _upload() -> None:
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=key,
                Body=data,
                ContentType=mime_type,
                CacheControl="public, max-age=31536000",
                Metadata={
                    **metadata,
                    "uploadedAt": datetime.utcnow().isoformat() + "Z",
                },
            )

        await asyncio.to_thread(_upload)

    async def send_upload_notification(
        self,
        prompt_id: str,
        node: Optional[str],
        uploaded: List[Dict[str, Any]],
        failures: List[Dict[str, Any]],
        total_images: int,
    ) -> None:
        if not self.remote_ws:
            logger.error("❌ Remote WebSocket unavailable for notification")
            return

        data = {
            "prompt_id": prompt_id,
            "node": node,
            "uploaded_images": uploaded,
            "failed_uploads": failures,
            "total_images": total_images,
            "uploaded_count": len(uploaded),
            "failed_count": len(failures),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "request_id": uuid.uuid4().hex,
        }

        if len(uploaded) == 0 and total_images > 0:
            data["status"] = "failed"
        elif len(uploaded) < total_images:
            data["status"] = "partial"
        else:
            data["status"] = "completed"

        await self.remote_ws.send(
            json.dumps(
                {
                    "type": "upload_complete",
                    "data": data,
                }
            )
        )
        logger.info(
            f"📤 Sent upload_complete notification for prompt {prompt_id} (status={data['status']})"
        )

    def build_public_url(self, key: str) -> str:
        if self.public_base_url:
            base = self.public_base_url.rstrip("/")
            return f"{base}/{key}"

        if self.cloudfront_domain:
            domain = self.cloudfront_domain.strip()
            if domain.startswith("http://") or domain.startswith("https://"):
                base = domain.rstrip("/")
            else:
                base = f"https://{domain.rstrip('/')}"
            return f"{base}/{key}"

        return f"https://{self.s3_bucket}.s3.{self.aws_region}.amazonaws.com/{key}"

    @staticmethod
    def get_relative_path(key: str) -> str:
        return key if key.startswith("/") else f"/{key}"

    @staticmethod
    def sanitize_identifier(value: str) -> str:
        return "".join(
            char if char.isalnum() or char in {"-", "_"} else "-" for char in value
        )

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
            if ws is None:
                continue

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
