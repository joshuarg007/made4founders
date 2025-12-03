#!/bin/bash
# FounderOS Deployment Script
# Run this on the server to set up initial deployment

set -e

DOMAIN="founder.axiondeep.com"
EMAIL="admin@axiondeep.com"  # Change to your email

echo "=== FounderOS Deployment Script ==="

# Create directories
echo "Creating directories..."
sudo mkdir -p /opt/founderos
sudo chown $USER:$USER /opt/founderos

# Clone or pull latest
cd /opt/founderos
if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    git clone https://github.com/joshuarg007/founderos.git .
else
    echo "Pulling latest changes..."
    git pull origin main
fi

# Generate .env if not exists
if [ ! -f ".env" ]; then
    echo "Generating .env file..."
    SECRET_KEY=$(openssl rand -hex 32)
    cat > .env << EOF
SECRET_KEY=$SECRET_KEY
CORS_ORIGINS=https://$DOMAIN
EOF
fi

# Initial SSL setup (first time only)
if [ ! -d "nginx/ssl/live/$DOMAIN" ]; then
    echo "Setting up SSL certificates..."

    # Create temporary nginx config for certbot
    mkdir -p nginx/ssl

    # Start nginx without SSL for initial cert request
    cat > nginx/nginx-init.conf << EOF
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name $DOMAIN;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'FounderOS Setup';
            add_header Content-Type text/plain;
        }
    }
}
EOF

    # Run certbot
    docker run --rm -it \
        -v $(pwd)/nginx/ssl:/etc/letsencrypt \
        -v $(pwd)/nginx/certbot:/var/www/certbot \
        -p 80:80 \
        certbot/certbot certonly \
        --standalone \
        --agree-tos \
        --email $EMAIL \
        -d $DOMAIN

    rm nginx/nginx-init.conf
fi

# Start services
echo "Starting services..."
docker compose pull
docker compose up -d

echo ""
echo "=== Deployment Complete ==="
echo "FounderOS is now available at: https://$DOMAIN"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
