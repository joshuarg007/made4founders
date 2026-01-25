# Made4Founders - Command Center for Founders

> **FOR CLAUDE: Read the SESSION STATE section before doing anything.**

---

## SESSION STATE (Update before ending each session)
**Last Updated:** 2026-01-25

### Where We Left Off:
- **SECURITY AUDIT COMPLETED** - Found 21 vulnerabilities (4 critical, 7 high, 6 medium, 4 low)
- Full audit report: `SECURITY_AUDIT.md` (gitignored, confidential)
- Critical IDOR vulnerabilities allow cross-tenant data access
- Application NOT production-ready until security fixes applied

### Currently Working On:
- Security remediation (see Security Roadmap below)

### Current Blockers:
- **CRITICAL**: 4 IDOR vulnerabilities expose all tenant data
- **HIGH**: Email API keys stored unencrypted, timing attack on scheduler key

### Deferred (Future)
- Calendar Integration (requires Google/Outlook OAuth setup)
- Team Collaboration (requires significant architecture changes)

---

## Git Rules
**NEVER run `git add`, `git commit`, or `git push` without explicit user permission.** Always provide the commands for the user to run themselves.

---

## Demo Account (Production)
| Field | Value |
|-------|-------|
| Email | `demo@made4founders.com` |
| Password | `Demo2024!` |
| Role | Admin |
| Business | TechFlow AI (Level 7, 4850 XP) |

Pre-populated with: 10 deadlines, 6 contacts, 24 metrics, 8 tasks

---

## Project Overview
A comprehensive startup management platform with React frontend and FastAPI backend. Designed to help founders track everything needed to run their business.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Python FastAPI + SQLAlchemy + SQLite
- **Deployment**: Docker Compose on AWS Lightsail + GitHub Actions CI/CD
- **Security**: AES-256-GCM encryption, Argon2id key derivation, JWT HS512

## Local Development
```bash
# Backend (port 8001)
cd backend && source venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend (port 5173)
cd frontend && npm install && npm run dev
```

## Deployment
- **URL**: https://made4founders.com
- **Server**: AWS Lightsail 3.150.255.144
- **CI/CD**: GitHub Actions (auto-deploys on push to main)
- **SSH Key**: ~/.ssh/LightsailDefaultKey-us-east-2.pem

### Manual Deploy (if needed)
```bash
ssh -i ~/.ssh/LightsailDefaultKey-us-east-2.pem ubuntu@3.150.255.144 "cd ~/made4founders && git pull && docker compose up -d --build"
```

### Sync Local Database to Production
```bash
scp -i ~/.ssh/LightsailDefaultKey-us-east-2.pem backend/made4founders.db ubuntu@3.150.255.144:~/made4founders.db
ssh -i ~/.ssh/LightsailDefaultKey-us-east-2.pem ubuntu@3.150.255.144 "docker cp ~/made4founders.db made4founders-backend:/app/data/made4founders.db && docker restart made4founders-backend"
```

---

## Features Implemented

### Core Features
| Feature | Description | Status |
|---------|-------------|--------|
| Dashboard | Daily Brief with stats, deadlines, metrics | Complete |
| Business Checklist | 98 compliance items across 11 categories | Complete |
| Business Library | Knowledge base for business info | Complete |
| Documents | Secure upload/download, missing file detection | Complete |
| Services | Track external services and logins | Complete |
| Contacts | Business contacts with extended fields (phone, location, social, tags) | Complete |
| Deadlines | Track important dates with reminders | Complete |
| Credential Vault | Encrypted password storage (AES-256-GCM) | Complete |
| Products Offered | Track products/services you sell | Complete |
| Products Used | Track tools/services you use | Complete |
| Web Links | Important bookmarks | Complete |
| Tasks | Kanban board with time tracking | Complete |
| Metrics | Business KPI tracking dashboard | Complete |
| User Management | Admin-only user CRUD with roles | Complete |

### Security Features (2025-12-17)
| Feature | Implementation |
|---------|---------------|
| Vault Encryption | AES-256-GCM with Argon2id key derivation |
| Business Identifiers | Encrypted at rest (EIN, DUNS, etc.) |
| JWT Tokens | HS512 algorithm, 15-min access tokens |
| Password Hashing | BCrypt with cost factor 12 |
| Rate Limiting | 5 req/min on auth, 100 req/min general |
| Security Headers | HSTS, CSP, X-Frame-Options, etc. |
| File Downloads | Auth required, forced attachment, no preview |
| Audit Logging | All sensitive operations logged |

### Business Checklist Categories (98 items)
1. Entity Formation (5 items)
2. Federal Requirements (14 items) - EIN, BOI, IRS forms, trademarks
3. Government Contracting (7 items) - SAM.gov, CAGE, SBIR
4. State & Local (10 items) - NM CRS, GRT, licenses
5. Corporate Governance (13 items) - bylaws, minutes, stock ledger
6. Banking & Finance (11 items) - accounts, payroll, D-U-N-S
7. Web Presence (8 items) - domains, email, social
8. Cybersecurity (8 items) - MFA, SOC 2, incident response
9. Employment & HR (9 items) - I-9, handbook, benefits
10. Insurance (6 items) - GL, E&O, cyber, D&O
11. Optional & Strategic (7 items) - partner programs, incubators

---

## User Roles
| Role | Permissions |
|------|-------------|
| Admin | Full access + user management + delete identifiers |
| Editor | View and edit all data |
| Viewer | Read-only access |

---

## API Endpoints Summary

### Auth
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google/login` - Get Google OAuth URL
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/github/login` - Get GitHub OAuth URL
- `GET /api/auth/github/callback` - GitHub OAuth callback

### Documents (Secure)
- `GET /api/documents` - List (includes file_exists status)
- `POST /api/documents/upload` - Upload new
- `GET /api/documents/{id}/download` - Secure download (auth required)
- `POST /api/documents/{id}/reupload` - Re-upload missing file

### Vault (Encrypted)
- `POST /api/vault/setup` - Initialize vault
- `POST /api/vault/unlock` - Unlock with master password
- `POST /api/vault/lock` - Lock vault
- `GET /api/credentials` - List (masked)
- `POST /api/credentials` - Create (encrypted)

### Business Identifiers (Encrypted)
- `GET /api/business-identifiers` - List (masked values)
- `GET /api/business-identifiers/{id}` - Get (decrypted, auth required)
- `POST /api/business-identifiers` - Create (encrypted)

---

## Environment Variables

### Required for Production
```bash
SECRET_KEY=<64+ char random string>
APP_ENCRYPTION_KEY=<32+ char random string>
ENVIRONMENT=production
COOKIE_SECURE=true
COOKIE_SAMESITE=strict
CORS_ORIGINS=https://made4founders.com
```

### OAuth (Required for social login)
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
```

### Notifications (for scheduled emails)
```bash
SCHEDULER_API_KEY=your-secret-scheduler-key
```

### Optional
```bash
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
COOKIE_DOMAIN=.made4founders.com
```

### OAuth Callback URLs
Configure these in your OAuth provider settings:
- **Google**: `https://made4founders.com/api/auth/google/callback`
- **GitHub**: `https://made4founders.com/api/auth/github/callback`
- **LinkedIn**: `https://made4founders.com/api/auth/linkedin/callback`

---

## Database Schema

SQLite database at `backend/made4founders.db`

### Key Tables
- `users` - Authentication and roles
- `documents` - File metadata (file_path stores filename only now)
- `business_identifiers` - Encrypted sensitive IDs
- `vault_config` - Master password hash and salt
- `credentials` - Encrypted credential storage
- `checklist_progress` - Checklist completion tracking
- `tasks`, `task_boards`, `task_columns` - Kanban system
- `metrics` - Business KPIs

---

## File Structure
```
made4founders/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app + all routes
│   │   ├── auth.py           # Auth routes and dependencies
│   │   ├── oauth.py          # OAuth provider integrations
│   │   ├── security.py       # JWT, password hashing
│   │   ├── vault.py          # AES-256-GCM encryption
│   │   ├── security_middleware.py  # Headers, rate limiting
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic schemas
│   │   └── database.py       # DB connection
│   ├── requirements.txt
│   └── uploads/              # Uploaded files (not in git)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DailyBrief.tsx
│   │   │   ├── SocialHub.tsx      # Marketing + Branding
│   │   │   ├── Insights.tsx       # Analytics + Metrics
│   │   │   ├── Finance.tsx        # Banking wrapper
│   │   │   ├── Offerings.tsx      # Products + Services
│   │   │   ├── Vault.tsx          # Credential Vault
│   │   │   ├── Login.tsx          # Login with OAuth
│   │   │   └── public/            # Public pages (Privacy, Terms, Security)
│   │   ├── components/
│   │   │   ├── Layout.tsx         # Sidebar with 4 sections
│   │   │   ├── PublicLayout.tsx   # Marketing site layout
│   │   │   ├── SocialPostMockups.tsx  # Social post previews
│   │   │   └── ResizableModal.tsx
│   │   ├── context/          # Auth context
│   │   └── lib/api.ts        # API client
│   └── package.json
├── docker-compose.yml
├── .github/workflows/
│   └── deploy.yml            # CI/CD with .env protection
└── CLAUDE.md                 # This file
```

---

## Reusable Components

### ResizableModal
Location: `frontend/src/components/ResizableModal.tsx`

Resizable modal component with drag-to-resize and maximize/minimize.

```tsx
import ResizableModal from '../components/ResizableModal';

<ResizableModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Modal Title"
  initialWidth={520}
  initialHeight={600}
  minWidth={400}
  minHeight={400}
>
  {/* content */}
</ResizableModal>
```

### SocialPostMockups
Location: `frontend/src/components/SocialPostMockups.tsx`

Mock preview components for social media posts (Twitter, LinkedIn, Facebook, Instagram).

---

## Accounting OAuth Integrations
Location: `backend/app/accounting_oauth.py`

Supports: QuickBooks, Xero, FreshBooks, Zoho Books

Features:
- **Retry logic**: 3 retries with exponential backoff (1s, 2s, 4s)
- **Intuit discovery document**: Fetches OAuth endpoints dynamically with 1-hour cache
- **Token refresh**: Auto-refreshes expired tokens before API calls
- **Error handling**: Marks connections inactive on auth failures, prompts reconnection

---

## Recent Changes Log

### 2026-01-25
- **Security Audit Completed**
  - Found 21 vulnerabilities (4 critical, 7 high, 6 medium, 4 low)
  - Critical IDOR flaws in documents, credentials, business identifiers, tasks
  - XSS in email template preview (dangerouslySetInnerHTML)
  - Timing attack vulnerability on scheduler API key
  - Email integration API keys stored unencrypted
  - OAuth state tokens never expire, no memory limits
  - Rate limiter bypassable via X-Forwarded-For spoofing
  - Full report: `SECURITY_AUDIT.md` (gitignored)
  - Added Security Remediation Roadmap to CLAUDE.md

### 2026-01-24
- **Critical Security Fix**
  - Fixed data leak in `/api/daily-brief` endpoint
  - All queries now properly filter by organization_id
  - Previously exposed all users' contacts, deadlines, documents, tasks

- **Roadmap Update**
  - Added comprehensive prioritized roadmap (18 items across 5 priority levels)
  - P0: Stripe billing, transactional email, email verification, notifications
  - P1: 2FA, onboarding, OAuth linking, automated backups
  - P2: Error tracking, monitoring, audit dashboard
  - P3: Mobile responsive, data export, customer support
  - P4: Analytics, SEO, calendar integration, team collaboration

### 2026-01-17
- **Sidebar Reorganization**
  - 4 color-coded sections: Command Center (cyan), Business (blue), Growth Hub (purple), Operations (emerald)
  - Collapsible sections with state persistence in localStorage
  - Section header colors always visible, menu hover matches section color

- **Page Consolidation**
  - Created SocialHub.tsx (merged Marketing + Branding)
  - Created Insights.tsx (merged Analytics + Metrics views)
  - Created Finance.tsx (Banking page wrapper)
  - Created Offerings.tsx (merged Products Offered/Used + Services)
  - Separated Credential Vault into its own page in Business section

- **Login Page Improvements**
  - Email/password form first, OAuth buttons below
  - Password visibility toggle (eye icon)
  - Proper autocomplete attributes for browser password save
  - Fixed: browsers now prompt to save passwords

- **Legal Pages**
  - Created Privacy.tsx (/privacy)
  - Created Terms.tsx (/terms)
  - Created Security.tsx (/security)
  - Updated PublicLayout footer with links

- **Contacts Enhancement**
  - Added fields: secondary_email, mobile_phone, city, state, country, timezone
  - Added fields: linkedin_url, twitter_handle, birthday, tags
  - Auto-migration adds columns to existing database

- **CI/CD Improvements**
  - Robust .env protection in deploy.yml
  - Backup to ~/.env.made4founders.backup before deploy
  - Auto-restore from backup if .env missing
  - Validation of critical OAuth vars (GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID)
  - Abort deploy on missing env vars

- **Bug Fixes**
  - Fixed credential vault update: custom_fields already dicts after model_dump()
  - Fixed NameError: added Date import to SQLAlchemy models
  - Created organizations for existing users without one

### 2025-12-17
- **Security Overhaul**
  - Upgraded vault encryption to AES-256-GCM with Argon2id
  - Encrypted BusinessIdentifier values at rest
  - Added security headers middleware (HSTS, CSP, etc.)
  - Added rate limiting (5 req/min on auth)
  - Tightened CORS to specific methods/headers
  - Upgraded JWT to HS512 with token IDs
  - Added audit logging for sensitive operations

- **Checklist Redesign**
  - Compact grid layout (2-4 columns)
  - 98 items across 11 categories
  - Added: Government Contracting, Cybersecurity, Insurance
  - Search and filter functionality
  - "Trigger" priority for conditional items

- **Documents Security**
  - Removed static file serving (no direct access)
  - Auth required for all downloads
  - Content-Disposition: attachment (download only, no preview)
  - File extension whitelist/blacklist
  - Path traversal protection
  - Missing file detection with re-upload option

### 2025-12-04
- Added ProductsOffered, ProductsUsed, WebLinks pages
- Added User Management (admin-only)
- Initial deployment to AWS Lightsail

---

## Known Issues
- **OAuth creates new accounts** - When logging in with OAuth (LinkedIn, Twitter, Facebook) for the first time, creates a new account instead of offering to link to existing account

---

## Roadmap (Prioritized)

### P0 - Critical for Launch
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | **Stripe Billing** | Subscription payments, pricing tiers, customer portal | ✅ Complete |
| 2 | **Transactional Email** | AWS SES for password reset, notifications | ✅ Complete |
| 3 | **Email Verification** | Verify email on signup, resend verification | ✅ Complete |
| 4 | **Password Reset** | Forgot password flow | ✅ Complete |
| 5 | **Email Notifications** | Deadline reminders, weekly digest, task alerts | ✅ Complete |

### P1 - Security & Trust
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 6 | **Two-Factor Auth (TOTP)** | Authenticator app support for login | ✅ Complete |
| 7 | **Onboarding/Tutorial** | Interactive walkthrough for new users | ✅ Complete |
| 8 | **OAuth Account Linking** | Link OAuth to existing account instead of creating new | ✅ Complete |
| 9 | **Automated Backups** | Scheduled database backups to S3/external storage | ✅ Complete |

### P2 - Operational Excellence
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 10 | **Error Tracking** | Sentry integration for frontend + backend | ✅ Complete |
| 11 | **Monitoring/Alerting** | Uptime monitoring, server health alerts | ✅ Complete |
| 12 | **Audit Log Dashboard** | View security events, login history | ✅ Complete |

### P3 - User Experience
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 13 | **Mobile Responsive** | Full mobile/tablet support | ✅ Complete |
| 14 | **Data Export** | Export to PDF/CSV (contacts, deadlines, etc.) | ✅ Complete |
| 15 | **Customer Support** | Help widget, support email workflow | ✅ Complete |

### P4 - Growth
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 16 | **Analytics** | User behavior tracking, feature usage | ✅ Complete |
| 17 | **SEO Optimization** | Meta tags, structured data, sitemap | ✅ Complete |
| 18 | **Calendar Integration** | Google/Outlook calendar sync | Not Started |
| 19 | **Team Collaboration** | Invite team members, shared workspaces | Not Started |

---

## Security Remediation Roadmap

> **CRITICAL: Do NOT deploy to production until P0 items are fixed.**

### S0 - Critical (Fix Immediately)
| # | Vulnerability | File | Fix Required | Status |
|---|--------------|------|--------------|--------|
| 1 | **IDOR - Documents** | `main.py:3315-3344` | Add `organization_id` filter to GET/PATCH/DELETE | Not Started |
| 2 | **IDOR - Business Identifiers** | `main.py:4453-4589` | Add `organization_id` filter | Not Started |
| 3 | **IDOR - Credentials** | `main.py:4869-5083` | Add `organization_id` filter | Not Started |
| 4 | **Password Field Bug** | `main.py:3187` | Change `password_hash` to `hashed_password` | Not Started |
| 5 | **Unencrypted API Keys** | `marketing.py:617` | Encrypt before storing | Not Started |

### S1 - High (Fix This Week)
| # | Vulnerability | File | Fix Required | Status |
|---|--------------|------|--------------|--------|
| 6 | **XSS - Email Templates** | `SocialHub.tsx:1600`, `Marketing.tsx:1614` | Add DOMPurify sanitization | Not Started |
| 7 | **IDOR - Task Boards** | `main.py:5798-6056` | Add `organization_id` filter | Not Started |
| 8 | **Rate Limit Bypass** | `security_middleware.py:156-160` | Validate X-Forwarded-For | Not Started |
| 9 | **Timing Attack** | `backups.py:79`, `notifications.py:37` | Use `secrets.compare_digest()` | Not Started |

### S2 - Medium (Fix Within 2 Weeks)
| # | Vulnerability | File | Fix Required | Status |
|---|--------------|------|--------------|--------|
| 10 | **Weak CSP** | `security_middleware.py:70-80` | Remove unsafe-inline/eval, use nonces | Not Started |
| 11 | **Missing Rate Limits** | `security_middleware.py:174-179` | Add limits for documents, credentials | Not Started |
| 12 | **OAuth Memory DoS** | `oauth.py:57` | Add state expiration + max size | Not Started |
| 13 | **IDOR - Marketplace** | `main.py:5307-5329` | Add `organization_id` filter | Not Started |
| 14 | **Calendar Enumeration** | `main.py:7289-7304` | Generic error message, rate limit | Not Started |

### S3 - Low (Fix Within Month)
| # | Vulnerability | File | Fix Required | Status |
|---|--------------|------|--------------|--------|
| 15 | **File Size Bypass** | `security_middleware.py:313-318` | Add streaming size check | Not Started |
| 16 | **OpenAPI Exposure** | `main.py:341-343` | Case-insensitive env check | Not Started |
| 17 | **OAuth No Expiry** | `oauth.py:57-60` | Add 10-min state expiration | Not Started |
| 18 | **Default SECRET_KEY** | `security.py:23-26` | Enforce in production | Not Started |
| 19 | **Insufficient Logging** | Various | Log failed auth, IDOR attempts | Not Started |

### Quick Reference: IDOR Fix Pattern
```python
# BEFORE (vulnerable):
item = db.query(Model).filter(Model.id == item_id).first()

# AFTER (secure):
item = db.query(Model).filter(
    Model.id == item_id,
    Model.organization_id == current_user.organization_id
).first()
```

### Quick Reference: Timing-Safe Comparison
```python
# BEFORE (vulnerable to timing attack):
if x_api_key != SCHEDULER_API_KEY:

# AFTER (constant-time):
import secrets
if not x_api_key or not secrets.compare_digest(x_api_key, SCHEDULER_API_KEY):
```

---

## Known Security Issues
| Issue | Description | Impact |
|-------|-------------|--------|
| Cross-tenant IDOR | Documents, credentials, identifiers, tasks accessible by any authenticated user | **CRITICAL** - Full data breach |
| XSS in templates | Email template preview executes arbitrary JavaScript | **HIGH** - Session hijacking |
| API key storage | Marketing integration keys stored plaintext | **HIGH** - Third-party compromise |
| Rate limit bypass | X-Forwarded-For spoofing bypasses auth rate limits | **HIGH** - Brute force attacks |

---

*This document ensures session continuity. Future Claude sessions should read this first.*
