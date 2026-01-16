# Deployment Guide for made4founders.com

## AWS Lightsail $20 Instance Setup

### Step 1: Create Lightsail Instance

1. Go to [AWS Lightsail Console](https://lightsail.aws.amazon.com/)
2. Click "Create instance"
3. Select:
   - **Region**: US East (Ohio) or your preferred region
   - **Platform**: Linux/Unix
   - **Blueprint**: Ubuntu 22.04 LTS
   - **Plan**: $20/month (4GB RAM, 2 vCPU, 80GB SSD)
   - **Name**: `made4founders-prod`
4. Click "Create instance"
5. Wait for instance to be running

### Step 2: Configure Networking

1. Go to instance → Networking tab
2. Add firewall rules:
   - HTTP (80) - Already open
   - HTTPS (443) - Add this
   - SSH (22) - Already open
3. Create a **Static IP**:
   - Click "Create static IP"
   - Attach to your instance
   - Note the IP address: `_______________`

### Step 3: Configure DNS (Route 53 or Domain Registrar)

Point `made4founders.com` to your static IP:

```
Type: A
Name: @ (or blank)
Value: YOUR_STATIC_IP

Type: A
Name: www
Value: YOUR_STATIC_IP
```

Wait 5-10 minutes for DNS propagation.

### Step 4: SSH into Server

```bash
# Download SSH key from Lightsail console (Account → SSH keys)
# Or use existing key if you have one

ssh -i ~/.ssh/LightsailDefaultKey-us-east-2.pem ubuntu@YOUR_STATIC_IP
```

### Step 5: Run Server Setup Script

Copy and paste this entire script into your SSH session:

```bash
#!/bin/bash
set -e

echo "=== Made4Founders Server Setup ==="

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
rm get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install git
sudo apt install -y git

# Clone repository
cd ~
git clone https://github.com/joshuarg007/made4founders.git
cd made4founders

# Create nginx SSL directory (for initial HTTP-only setup)
mkdir -p nginx/ssl

# Create environment file
cat > .env << 'EOF'
# Generate these with: openssl rand -hex 32
SECRET_KEY=CHANGE_ME_GENERATE_NEW_KEY
APP_ENCRYPTION_KEY=CHANGE_ME_GENERATE_NEW_KEY

# OAuth (update with your credentials)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# GHCR Token for pulling images
GHCR_TOKEN=your-github-personal-access-token
EOF

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit .env file: nano .env"
echo "2. Generate secrets: openssl rand -hex 32"
echo "3. Log out and back in (for docker group)"
echo "4. Run: ./scripts/deploy-fresh.sh"
```

### Step 6: Configure Environment

```bash
# Log out and back in for docker group to take effect
exit
# SSH back in
ssh -i ~/.ssh/LightsailDefaultKey-us-east-2.pem ubuntu@YOUR_STATIC_IP

cd ~/made4founders

# Generate secure keys
echo "SECRET_KEY=$(openssl rand -hex 32)"
echo "APP_ENCRYPTION_KEY=$(openssl rand -hex 32)"

# Edit .env with your actual values
nano .env
```

### Step 7: Initial Deployment (HTTP only for SSL setup)

```bash
cd ~/made4founders

# Start with HTTP-only nginx for certbot challenge
docker compose -f docker-compose.yml up -d backend frontend

# Get SSL certificate
docker run -it --rm \
  -v $(pwd)/nginx/ssl:/etc/letsencrypt \
  -v $(pwd)/nginx/certbot:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d made4founders.com \
  -d www.made4founders.com

# Now start full stack with HTTPS
docker compose -f docker-compose.yml up -d
```

### Step 8: Verify Deployment

```bash
# Check all containers are running
docker ps

# Check logs if needed
docker logs made4founders-backend
docker logs made4founders-frontend
docker logs made4founders-nginx

# Test endpoints
curl -I https://made4founders.com
curl https://made4founders.com/api/health
```

---

## Ongoing Deployments

After initial setup, deploy updates via GitHub Actions (automatic on push to main) or manually:

```bash
ssh ubuntu@YOUR_STATIC_IP
cd ~/made4founders
git pull
docker compose -f docker-compose.yml up -d --build
```

---

## Useful Commands

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop everything
docker compose down

# Full rebuild
docker compose down
docker compose up -d --build

# Check disk space
df -h

# Check memory
free -m

# Database backup
docker cp made4founders-backend:/app/data/made4founders.db ./backup-$(date +%Y%m%d).db
```

---

## SSL Certificate Renewal

Certificates auto-renew via certbot container. To manually renew:

```bash
docker compose run --rm certbot renew
docker compose restart nginx
```

---

## GitHub Actions Secrets

Update these secrets in your GitHub repo (Settings → Secrets):

| Secret | Value |
|--------|-------|
| `SERVER_HOST` | Your Lightsail static IP |
| `SERVER_USER` | `ubuntu` |
| `SERVER_SSH_KEY` | Contents of your SSH private key |
| `GHCR_TOKEN` | GitHub Personal Access Token with `read:packages` scope |
