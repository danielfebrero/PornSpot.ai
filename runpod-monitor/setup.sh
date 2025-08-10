#!/bin/bash
# Setup script for ComfyUI Monitor on RunPod

set -e

echo "🚀 Setting up ComfyUI Monitor on RunPod..."

# Update system packages
echo "📦 Updating system packages..."
apt-get update -y
apt-get install -y python3 python3-pip python3-venv

# Create virtual environment
echo "🐍 Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📥 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create systemd service file
echo "⚙️  Creating systemd service..."
cat > /etc/systemd/system/comfyui-monitor.service << 'EOF'
[Unit]
Description=ComfyUI Monitor Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/workspace/comfyui-monitor
Environment=PATH=/workspace/comfyui-monitor/venv/bin
Environment=PYTHONPATH=/workspace/comfyui-monitor
ExecStart=/workspace/comfyui-monitor/venv/bin/python comfyui_monitor.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

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

# Set up log rotation
cat > /etc/logrotate.d/comfyui-monitor << 'EOF'
/tmp/comfyui-monitor.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure AWS credentials in .env file"
echo "2. Update AWS_REGION and EVENTBRIDGE_BUS_NAME in .env if needed"
echo "3. Enable and start the service:"
echo "   systemctl daemon-reload"
echo "   systemctl enable comfyui-monitor"
echo "   systemctl start comfyui-monitor"
echo "4. Check service status:"
echo "   systemctl status comfyui-monitor"
echo "   journalctl -u comfyui-monitor -f"