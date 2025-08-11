#!/bin/bash
# Quick start script for ComfyUI Monitor in container environment

echo "🚀 Quick starting ComfyUI Monitor in container..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run setup first."
    exit 1
fi

# Check if requirements are installed
if [ ! -f "venv/bin/python" ]; then
    echo "❌ Python environment not properly set up."
    exit 1
fi

# Create log directory
mkdir -p /var/log/comfyui-monitor

# Start the monitor in background using nohup
echo "🔄 Starting ComfyUI Monitor in background..."

# Kill any existing process
pkill -f "comfyui_monitor.py" 2>/dev/null || true

# Wait a moment
sleep 2

# Start new process
cd /workspace/comfyui-monitor
source venv/bin/activate

nohup python comfyui_monitor.py > /var/log/comfyui-monitor/monitor.log 2>&1 &
MONITOR_PID=$!

echo "✅ ComfyUI Monitor started with PID: $MONITOR_PID"
echo "📝 Logs: tail -f /var/log/comfyui-monitor/monitor.log"
echo "🛑 Stop with: pkill -f comfyui_monitor.py"

# Show the process
sleep 1
if ps -p $MONITOR_PID > /dev/null; then
    echo "✅ Process is running successfully"
    ps aux | grep comfyui_monitor.py | grep -v grep
else
    echo "❌ Process failed to start. Check logs:"
    tail -20 /var/log/comfyui-monitor/monitor.log
fi
