# FounderOS - Command Center for Founders

## Project Overview
A comprehensive startup management platform with React frontend and FastAPI backend.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Python FastAPI + SQLAlchemy + SQLite
- **Deployment**: Docker Compose on AWS Lightsail

## Local Development
```bash
# Backend (port 8001)
cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend (port 5173)
cd frontend && npm run dev
```

## Deployment
- **URL**: https://founders.axiondeep.com
- **Server**: AWS Lightsail 3.150.255.144
- **SSH Key**: ~/.ssh/LightsailDefaultKey-us-east-2.pem

### Deploy Command
```bash
ssh -i ~/.ssh/LightsailDefaultKey-us-east-2.pem ubuntu@3.150.255.144 "cd ~/founderos && git pull && sudo docker compose up -d --build"
```

### DEPLOYMENT STATUS (2025-12-04)
**PENDING** - Docker build was in progress but stalled due to Lightsail instance resource constraints.
- Build stuck at step 3/7 (installing gcc packages)
- Server overloaded - SSH connections timing out
- **Options to complete deployment**:
  1. Build images locally and push to Docker Hub, then pull on server
  2. Upgrade Lightsail instance to 2GB+ RAM
  3. Wait for current build to finish (may take 30+ more minutes)
  4. SSH in after server calms down and restart with existing images

## Features Implemented
- Daily Brief dashboard
- Getting Started checklist
- Business Library
- Web Presence management
- Products Offered / Products Used tracking
- Web Links management
- Services, Documents, Contacts, Deadlines
- Credential Vault (encrypted)
- **User Management** (admin only) - roles: admin, editor, viewer

## User Roles
- **Admin**: Full access + user management
- **Editor**: Can view and edit all data
- **Viewer**: Read-only access

## Recent Changes (2025-12-04)
- Added ProductsOffered page
- Added ProductsUsed page
- Added WebLinks page
- Added User Management page (admin-only)
- Backend API endpoints for products, tools, weblinks, users

## Database
SQLite database at `backend/founderos.db`
- Tables: users, services, documents, contacts, deadlines, library_items, vault_items, products_offered, products_used, web_links
