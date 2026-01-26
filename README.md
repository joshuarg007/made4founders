# Made4Founders

**Command Center for Founders** - A comprehensive startup management platform designed to help founders track everything needed to run their business.

---

## Overview

Made4Founders is a self-hosted business operations dashboard that consolidates critical founder tasks into one secure platform. From compliance checklists to encrypted credential storage, from deadline tracking to business metrics — everything a founder needs in one place.

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Daily Brief with stats, deadlines, and key metrics at a glance |
| **Business Checklist** | 96 compliance items across 11 categories (Entity, Federal, State, Cybersecurity, etc.) |
| **Business Library** | Knowledge base for storing business information |
| **Documents** | Secure file upload/download with missing file detection and re-upload capability |
| **Services** | Track external services, subscriptions, and logins |
| **Contacts** | Business contacts with extended fields (phone, location, social, birthday, tags) |
| **Deadlines** | Track important dates with reminders |
| **Credential Vault** | Encrypted password storage (AES-256-GCM) |
| **Products Offered** | Track products and services you sell |
| **Products Used** | Track tools and services you use |
| **Web Links** | Important bookmarks and URLs |
| **Tasks** | Kanban board with drag-and-drop and time tracking |
| **Metrics** | Business KPI tracking dashboard |
| **User Management** | Admin-only user CRUD with role-based access |

### Authentication

- **Email/Password**: Traditional login with password visibility toggle
- **Google OAuth**: Sign in with Google account
- **GitHub OAuth**: Sign in with GitHub account
- **Browser Integration**: Proper autocomplete attributes for password managers

### Public Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Marketing landing page |
| Features | `/features` | Feature showcase |
| Pricing | `/pricing` | Pricing tiers (Starter, Professional, Enterprise) |
| About | `/about` | Company information |
| Privacy | `/privacy` | Privacy policy |
| Terms | `/terms` | Terms of service |
| Security | `/security` | Security practices |

### Security Features

- **Vault Encryption**: AES-256-GCM with Argon2id key derivation
- **Business Identifiers**: Encrypted at rest (EIN, DUNS, etc.)
- **JWT Authentication**: HS512 algorithm with 15-minute access tokens
- **Password Hashing**: BCrypt with cost factor 12
- **Rate Limiting**: 5 req/min on auth endpoints, 100 req/min general
- **Security Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **File Downloads**: Auth required, forced attachment disposition (no preview)
- **Audit Logging**: All sensitive operations logged

### Business Checklist Categories (98 Items)

1. **Entity Formation** (5 items)
2. **Federal Requirements** (14 items) - EIN, BOI, IRS forms, trademarks
3. **Government Contracting** (7 items) - SAM.gov, CAGE, SBIR
4. **State & Local** (10 items) - NM CRS, GRT, licenses
5. **Corporate Governance** (13 items) - Bylaws, minutes, stock ledger
6. **Banking & Finance** (11 items) - Accounts, payroll, D-U-N-S
7. **Web Presence** (8 items) - Domains, email, social media
8. **Cybersecurity** (8 items) - MFA, SOC 2, incident response
9. **Employment & HR** (9 items) - I-9, handbook, benefits
10. **Insurance** (6 items) - GL, E&O, cyber, D&O
11. **Optional & Strategic** (7 items) - Partner programs, incubators

---

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for build tooling
- **TailwindCSS 4** for styling
- **Lucide React** for icons
- **@hello-pangea/dnd** for drag-and-drop
- **React Router 7** for navigation
- **date-fns** for date formatting

### Backend
- **Python 3.11+** with FastAPI
- **SQLAlchemy 2.0** ORM
- **SQLite** database
- **Pydantic** for validation
- **python-jose** for JWT
- **Argon2** + **BCrypt** for password hashing
- **Cryptography** for AES-256-GCM encryption

### Infrastructure
- **Docker Compose** for containerization
- **Nginx** reverse proxy with SSL
- **Let's Encrypt** via Certbot
- **GitHub Actions** for CI/CD

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/made4founders.git
cd made4founders

# Backend setup (port 8001)
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend setup (port 5173) - in a new terminal
cd frontend
npm install
npm run dev
```

### Docker Deployment

```bash
# Create environment file
cp backend/.env.example backend/.env
# Edit backend/.env with your secrets

# Build and run
docker compose up -d --build

# View logs
docker compose logs -f
```

---

## Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Required
SECRET_KEY=your-64-character-random-string
APP_ENCRYPTION_KEY=your-32-character-random-string
ENVIRONMENT=production

# Cookie Security
COOKIE_SECURE=true
COOKIE_SAMESITE=strict
COOKIE_DOMAIN=.yourdomain.com

# CORS
CORS_ORIGINS=https://yourdomain.com

# OAuth (for social login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Optional
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Sentry Error Tracking
SENTRY_DSN=https://your-dsn@sentry.io/project

# Automated Backups
BACKUP_S3_BUCKET=your-backup-bucket
BACKUP_RETENTION_DAYS=30

# Scheduler (for automated jobs)
SCHEDULER_API_KEY=your-random-key

# Alerting
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx
ALERT_EMAIL=alerts@yourdomain.com
```

### OAuth Callback URLs

Configure these URLs in your OAuth provider settings:
- **Google Cloud Console**: `https://yourdomain.com/api/auth/google/callback`
- **GitHub Developer Settings**: `https://yourdomain.com/api/auth/github/callback`

### Generate Secure Keys

```bash
# Generate SECRET_KEY (64 chars)
python -c "import secrets; print(secrets.token_hex(32))"

# Generate APP_ENCRYPTION_KEY (32 chars)
python -c "import secrets; print(secrets.token_hex(16))"
```

---

## Project Structure

```
made4founders/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + all routes
│   │   ├── auth.py              # Auth routes and dependencies
│   │   ├── security.py          # JWT, password hashing
│   │   ├── vault.py             # AES-256-GCM encryption
│   │   ├── security_middleware.py  # Headers, rate limiting
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   └── database.py          # DB connection
│   ├── uploads/                 # Uploaded files (gitignored)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/               # React page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── GettingStarted.tsx
│   │   │   ├── Documents.tsx
│   │   │   ├── Vault.tsx
│   │   │   ├── Tasks.tsx
│   │   │   ├── Contacts.tsx
│   │   │   ├── Deadlines.tsx
│   │   │   ├── Metrics.tsx
│   │   │   └── ...
│   │   ├── components/          # Shared components
│   │   ├── context/             # Auth context
│   │   └── lib/api.ts           # API client
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   ├── nginx.conf               # Nginx configuration
│   └── ssl/                     # SSL certificates
├── .github/
│   └── workflows/
│       └── deploy.yml           # CI/CD pipeline
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

---

## API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login with email/password |
| `/api/auth/logout` | POST | Logout and invalidate tokens |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/me` | GET | Get current user info |
| `/api/auth/google/login` | GET | Initiate Google OAuth flow |
| `/api/auth/google/callback` | GET | Google OAuth callback |
| `/api/auth/github/login` | GET | Initiate GitHub OAuth flow |
| `/api/auth/github/callback` | GET | GitHub OAuth callback |

### Documents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List documents (includes `file_exists` status) |
| `/api/documents/upload` | POST | Upload new document |
| `/api/documents/{id}/download` | GET | Secure download (auth required) |
| `/api/documents/{id}/reupload` | POST | Re-upload missing file |
| `/api/documents/{id}` | DELETE | Delete document |

### Credential Vault

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vault/setup` | POST | Initialize vault with master password |
| `/api/vault/unlock` | POST | Unlock vault with master password |
| `/api/vault/lock` | POST | Lock vault |
| `/api/credentials` | GET | List credentials (masked) |
| `/api/credentials` | POST | Create credential (encrypted) |
| `/api/credentials/{id}` | GET | Get credential (decrypted) |

### Business Identifiers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/business-identifiers` | GET | List identifiers (masked values) |
| `/api/business-identifiers` | POST | Create identifier (encrypted) |
| `/api/business-identifiers/{id}` | GET | Get identifier (decrypted) |
| `/api/business-identifiers/{id}` | DELETE | Delete identifier (admin only) |

### Other Endpoints

- `/api/contacts` - Contact management
- `/api/deadlines` - Deadline tracking
- `/api/services` - Service tracking
- `/api/checklist` - Checklist progress
- `/api/tasks` - Task management
- `/api/boards` - Kanban boards
- `/api/metrics` - Business metrics
- `/api/users` - User management (admin only)
- `/api/health` - Health check

### Operations Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/monitoring/health` | GET | Quick health check for load balancers |
| `/api/monitoring/status` | GET | Detailed status with all service checks |
| `/api/monitoring/metrics` | GET | System resource metrics (admin only) |
| `/api/backups/create` | POST | Create database backup (scheduler key required) |
| `/api/backups/list` | GET | List available backups (admin only) |
| `/api/backups/restore/{key}` | POST | Restore from backup (admin only) |
| `/api/audit-logs/` | GET | List audit logs with filtering (admin only) |
| `/api/audit-logs/stats` | GET | Audit log statistics (admin only) |
| `/api/audit-logs/export` | GET | Export audit logs as CSV (admin only) |
| `/api/export/all` | GET | Export all user data as JSON |
| `/api/export/contacts` | GET | Export contacts as CSV |
| `/api/export/deadlines` | GET | Export deadlines as CSV |
| `/api/analytics/track` | POST | Track analytics event |
| `/api/analytics/stats` | GET | Get analytics statistics (admin only) |
| `/api/support/contact` | POST | Submit support request |
| `/api/notifications/send-deadline-reminders` | POST | Send deadline emails (scheduler key) |
| `/api/notifications/send-weekly-digest` | POST | Send weekly digest (scheduler key) |

---

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access + user management + delete sensitive identifiers |
| **Editor** | View and edit all data |
| **Viewer** | Read-only access |

---

## Deployment

### AWS Lightsail (Recommended)

1. Create a Lightsail instance (Ubuntu 22.04)
2. Install Docker and Docker Compose
3. Clone the repository
4. Configure environment variables
5. Set up SSL with Certbot
6. Run with Docker Compose

### CI/CD with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys on push to main.

### Manual Deployment

```bash
# SSH to server
ssh -i your-key.pem ubuntu@your-server-ip

# Navigate to project
cd ~/made4founders

# Pull latest changes
git pull

# Rebuild and restart
sudo docker compose up -d --build
```

---

## Development

### Backend Development

```bash
cd backend
source venv/bin/activate

# Run with hot reload
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Run tests
pytest
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

---

## Database

SQLite database located at `backend/made4founders.db`

### Key Tables

| Table | Description |
|-------|-------------|
| `users` | Authentication and roles |
| `documents` | File metadata |
| `business_identifiers` | Encrypted sensitive IDs |
| `vault_config` | Master password hash and salt |
| `credentials` | Encrypted credential storage |
| `checklist_progress` | Checklist completion tracking |
| `tasks` | Task items |
| `task_boards` | Kanban boards |
| `task_columns` | Board columns |
| `metrics` | Business KPIs |
| `contacts` | Business contacts |
| `deadlines` | Important dates |
| `services` | External services |

---

## Security Considerations

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Use strong secrets** - Generate cryptographically secure keys
3. **Enable HTTPS** - Required for production
4. **Regular backups** - Back up the SQLite database regularly
5. **Update dependencies** - Keep all packages up to date
6. **Review audit logs** - Monitor for suspicious activity

---

## Roadmap

### Completed
- [x] OAuth authentication (Google, GitHub, LinkedIn, Twitter, Facebook)
- [x] Public marketing pages (Privacy, Terms, Security)
- [x] Extended contact fields
- [x] Color-coded navigation sections
- [x] Browser password manager integration
- [x] Social media posting (LinkedIn, Twitter, Facebook)
- [x] Accounting integrations (QuickBooks, Xero, FreshBooks, Zoho)
- [x] **Stripe Billing** - Subscription payments, pricing tiers, customer portal
- [x] **Transactional Email** - AWS SES for password reset, notifications
- [x] **Email Verification** - Verify email on signup with resend
- [x] **Password Reset** - Forgot password flow with secure tokens
- [x] **Email Notifications** - Deadline reminders, weekly digest
- [x] **Two-Factor Auth (TOTP)** - Authenticator app support with backup codes
- [x] **Onboarding/Tutorial** - Interactive walkthrough for new users
- [x] **OAuth Account Linking** - Link OAuth to existing account
- [x] **Automated Backups** - Scheduled S3 backups with retention policy
- [x] **Error Tracking** - Sentry integration (frontend + backend)
- [x] **Monitoring/Alerting** - Health checks, Slack/email alerts
- [x] **Audit Log Dashboard** - View security events, login history
- [x] **Mobile Responsive** - Hamburger menu, slide-out sidebar
- [x] **Data Export** - Export to JSON/CSV (GDPR compliant)
- [x] **Customer Support** - Help widget with FAQs and contact form
- [x] **Analytics** - Privacy-friendly usage tracking
- [x] **SEO Optimization** - Meta tags, Open Graph, structured data, sitemap

### Future
- [ ] **Calendar Integration** - Google/Outlook calendar sync
- [ ] **Team Collaboration** - Invite members, shared workspaces

---

## License

Private - All rights reserved.

---

## Support

For issues and feature requests, please create an issue in the repository.
<!-- Pair Extraordinaire -->
