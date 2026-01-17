#!/bin/bash
# Made4Founders Lightsail Deployment
# Run this on your Lightsail instance after SSH'ing in

set -e

echo "=== Made4Founders Lightsail Setup ==="

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone repo
cd ~
git clone https://github.com/joshuarg007/made4founders.git
cd made4founders

# Generate secrets
SECRET_KEY=$(openssl rand -hex 32)

# Create .env file
cat > .env << EOF
SECRET_KEY=$SECRET_KEY
CORS_ORIGINS=https://made4founders.com
EOF

# Start services
docker-compose up -d

echo ""
echo "=== Setup Complete ==="
echo "Made4Founders is starting up..."
echo ""
echo "Next steps:"
echo "1. Point made4founders.com DNS to this server's IP"
echo "2. Run: docker-compose logs -f  (to monitor)"
echo ""
