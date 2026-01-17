# Made4Founders - Command Center for Founders

> **FOR CLAUDE: Read the SESSION STATE section before doing anything.**

---

## SESSION STATE (Update before ending each session)
**Last Updated:** 2026-01-16

### Where We Left Off:
- Deployed to made4founders.com (AWS Lightsail)
- Added Social Publisher with mock post previews (Twitter, LinkedIn, Facebook, Instagram)
- Added ResizableModal component for better UX
- Fixed drag & drop file upload in Documents page
- Added accounting OAuth integrations with retry logic and Intuit discovery document

### Immediate Next Steps:
- Complete Intuit/QuickBooks app review process
- Test accounting integrations end-to-end
- Continue marketing page enhancements

### Current Blockers:
- None

---

## Git Rules
**NEVER run `git add`, `git commit`, or `git push` without explicit user permission.** Always provide the commands for the user to run themselves.

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
| Contacts | Business contacts management | Complete |
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
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

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

### Optional
```bash
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
COOKIE_DOMAIN=.made4founders.com
```

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
│   │   ├── pages/            # React pages
│   │   ├── components/       # Shared components
│   │   ├── context/          # Auth context
│   │   └── lib/api.ts        # API client
│   └── package.json
├── docker-compose.yml
├── .github/workflows/        # CI/CD
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

Supports: QuickBooks, Xero, FreshBooks, Wave, Zoho Books

Features:
- **Retry logic**: 3 retries with exponential backoff (1s, 2s, 4s)
- **Intuit discovery document**: Fetches OAuth endpoints dynamically with 1-hour cache
- **Token refresh**: Auto-refreshes expired tokens before API calls
- **Error handling**: Marks connections inactive on auth failures, prompts reconnection

---

## Recent Changes Log

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
- None currently documented

---

## Future Roadmap
- [ ] Email notifications for deadlines
- [ ] Calendar integration
- [ ] Mobile responsive improvements
- [ ] Export data (PDF/CSV)
- [ ] Two-factor authentication (TOTP)
- [ ] Team collaboration features
- [ ] API rate limiting dashboard
- [ ] Backup/restore functionality

---

*This document ensures session continuity. Future Claude sessions should read this first.*
