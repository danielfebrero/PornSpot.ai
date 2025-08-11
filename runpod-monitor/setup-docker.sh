#!/bin/bash
# Setup script for ComfyUI Monitor on RunPod (Docker/Container environment)

set -e

# Get the current working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR_DIR="$SCRIPT_DIR"

echo "🚀 Setting up ComfyUI Monitor on RunPod (Container Mode)..."
echo "📁 Working directory: $MONITOR_DIR"

# Change to the script directory
cd "$MONITOR_DIR"

# Update system packages
echo "📦 Updating system packages..."
apt-get update -y
apt-get install -y python3 python3-pip python3-venv screen supervisor

# Create virtual environment
echo "🐍 Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📥 Installing Python dependencies..."
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo "⚠️  requirements.txt not found, installing basic dependencies..."
    pip install requests boto3 websocket-client python-dotenv
fi

# Set executable permissions
chmod +x comfyui_monitor.py

# Create environment configuration
echo "📝 Creating environment configuration..."
cat > .env << 'EOF'
# ComfyUI Configuration
COMFYUI_HOST=localhost
COMFYUI_PORT=8188

# AWS Configuration
AWS_REGION=us-east-1
EVENTBRIDGE_BUS_NAME=comfyui-events

# AWS Credentials (set these with your actual values)
# AWS_ACCESS_KEY_ID=your_access_key
# AWS_SECRET_ACCESS_KEY=your_secret_key

# Logging Configuration
LOG_LEVEL=INFO
EOF

# Create log directory
mkdir -p /var/log/comfyui-monitor

# Create supervisor configuration for the monitor
echo "⚙️  Creating supervisor configuration..."
cat > /etc/supervisor/conf.d/comfyui-monitor.conf << 'EOF'
[program:comfyui-monitor]
command=/workspace/comfyui-monitor/venv/bin/python /workspace/comfyui-monitor/comfyui_monitor.py
directory=/workspace/comfyui-monitor
user=root
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/comfyui-monitor/monitor.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=5
environment=PYTHONPATH="/workspace/comfyui-monitor"
EOF

# Create startup script
echo "📜 Creating startup script..."
cat > start-monitor.sh << 'EOF'
#!/bin/bash
# Start ComfyUI Monitor using supervisor

echo "🚀 Starting ComfyUI Monitor..."

# Start supervisor if not running
if ! pgrep supervisord > /dev/null; then
    echo "📡 Starting supervisor..."
    supervisord -c /etc/supervisor/supervisord.conf
fi

# Start the monitor service
echo "🔄 Starting ComfyUI Monitor service..."
supervisorctl reread
supervisorctl update
supervisorctl start comfyui-monitor

echo "✅ ComfyUI Monitor started!"
echo "📊 Check status with: supervisorctl status"
echo "📝 View logs with: tail -f /var/log/comfyui-monitor/monitor.log"
EOF

# Create stop script
cat > stop-monitor.sh << 'EOF'
#!/bin/bash
# Stop ComfyUI Monitor

echo "🛑 Stopping ComfyUI Monitor..."
supervisorctl stop comfyui-monitor
echo "✅ ComfyUI Monitor stopped!"
EOF

# Create simple background runner (alternative to supervisor)
cat > run-background.sh << 'EOF'
#!/bin/bash
# Run ComfyUI Monitor in background using screen

echo "🚀 Starting ComfyUI Monitor in background..."

# Kill existing screen session if it exists
screen -S comfyui-monitor -X quit 2>/dev/null || true

# Start new screen session
screen -dmS comfyui-monitor bash -c "
    cd /workspace/comfyui-monitor
    source venv/bin/activate
    python comfyui_monitor.py 2>&1 | tee /var/log/comfyui-monitor/monitor.log
"

echo "✅ ComfyUI Monitor started in background!"
echo "📱 Attach to session with: screen -r comfyui-monitor"
echo "📝 View logs with: tail -f /var/log/comfyui-monitor/monitor.log"
echo "🛑 Stop with: screen -S comfyui-monitor -X quit"
EOF

# Make scripts executable
chmod +x start-monitor.sh stop-monitor.sh run-background.sh

# Set up log rotation
cat > /etc/logrotate.d/comfyui-monitor << 'EOF'
/var/log/comfyui-monitor/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    copytruncate
}
EOF

echo "✅ Setup complete!"
echo ""
echo "🐳 Container-friendly startup options:"
echo ""
echo "Option 1 - Using Supervisor (recommended):"
echo "   ./start-monitor.sh"
echo "   supervisorctl status"
echo "   supervisorctl stop comfyui-monitor"
echo ""
echo "Option 2 - Using Screen (simple background):"
echo "   ./run-background.sh"
echo "   screen -r comfyui-monitor  # to attach"
echo "   screen -S comfyui-monitor -X quit  # to stop"
echo ""
echo "📝 Configuration:"
echo "1. Edit .env file with your AWS credentials"
echo "2. Update AWS_REGION and EVENTBRIDGE_BUS_NAME if needed"
echo ""
echo "📊 Monitor logs:"
echo "   tail -f /var/log/comfyui-monitor/monitor.log"
