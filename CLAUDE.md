# Made4Founders - Command Center for Solo Founders

> **FOR CLAUDE: Read the SESSION STATE section before doing anything.**

---

## SESSION STATE (Update before ending each session)
**Last Updated:** 2026-01-26

### Where We Left Off:
- **PHASE 1 COMPLETE** - All real integrations (Plaid, Stripe, Google Calendar, Slack)
- **PHASE 2 COMPLETE** - Full financial dashboard suite
- **PHASE 3 COMPLETE** - Investor relations (Cap Table, Investor Updates, Data Room, 409A Valuations)
- **PHASE 4 COMPLETE** - Team Management (Gusto-lite)
- **PHASE 5 COMPLETE** - AI Features with Ollama integration
- All 143 security tests passing

### Features Complete:
- **Integrations:** Plaid (banking), Stripe (revenue), Google Calendar, Slack
- **Financial Dashboard:** Cash position, runway calculator, burn rate trending
- **Revenue Dashboard:** MRR/ARR, subscription analytics from Stripe
- **Budget:** Categories, variance reporting, forecasting
- **Invoices:** Create, send, track, PDF generation, payments
- **Cap Table:** Shareholders, equity, options, SAFEs, convertibles, dilution modeling
- **409A Valuations:** Track FMV history, expiration warnings, provider tracking
- **Investor Updates:** Email campaigns with metrics integration
- **Data Room:** Folder organization, shareable links, access tracking
- **Team Management:** Employee directory, org chart, PTO tracking, onboarding checklists, contractor management
- **AI Features:** Business assistant (Cmd+K), document summarization, competitor monitoring, enhanced transcript analysis

### Currently Working On:
- Phase 6: Collaboration (backend complete, frontend components created)

### Remaining Items:
- Phase 6: Add CommentsSection to all entity pages (Deadlines, Documents, Contacts, Metrics)
- Phase 6: Create ActivityFeed page
- Phase 6: Create GuestAccessManager page
- Phase 7-8: Mobile, 2FA

### Deferred (Future)
- Team Collaboration (requires significant architecture changes)

---

## Product Vision

> **"Command Center for Solo Founders"** - The all-in-one platform for 1-5 person startups where one founder manages everything.

### Differentiators
1. **Compliance-First** - 96-item business checklist (unique in market)
2. **Fundraising Toolkit** - Cap table + data room + investor updates in one place
3. **AI CFO** - Financial insights without needing an accountant
4. **Security-First** - AES-256-GCM encryption, audit logging, IDOR-protected

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

### Manual Deploy
```bash
ssh -i ~/.ssh/LightsailDefaultKey-us-east-2.pem ubuntu@3.150.255.144 "cd ~/made4founders && git pull && docker compose up -d --build"
```

---

## Roadmap

### Phase 1: Real Integrations ✅ COMPLETE
| Integration | Purpose | Status |
|-------------|---------|--------|
| **Plaid** | Real-time bank balances, transactions, runway | Complete |
| **Stripe** | Revenue metrics, MRR/ARR auto-populated | Complete |
| **Google Calendar** | Deadlines/meetings sync both ways | Complete |
| **Slack** | Notifications, daily digest | Complete |
| **Gmail/Outlook** | Email tracking with contacts | Not Started |
| **DocuSign** | Document signing workflow | Not Started |
| **QuickBooks/Xero** | Accounting sync | Started (OAuth done) |

### Phase 2: Financial Dashboard ✅ COMPLETE
| Feature | Description | Status |
|---------|-------------|--------|
| Real-time cash position | Via Plaid integration | Complete |
| Runway calculator | With burn rate trending | Complete |
| Budget vs. actuals | Monthly comparison | Complete |
| Invoice generation | Simple invoicing | Complete |
| Expense categorization | Auto-categorize transactions | Complete |
| MRR/ARR dashboard | From Stripe data | Complete |

### Phase 3: Investor Relations (Carta-lite) ✅ COMPLETE
| Feature | Description | Status |
|---------|-------------|--------|
| Cap table management | Shareholders, options, SAFEs | Complete |
| Investor updates | Email reports with metrics | Complete |
| Data room | Secure doc sharing for fundraising | Complete |
| 409A valuation tracking | Annual valuations, FMV history | Complete |
| Dilution calculator | Scenario modeling | Complete |

### Phase 4: Team Management (Gusto-lite) ✅ COMPLETE
| Feature | Description | Status |
|---------|-------------|--------|
| Employee directory | With org chart | Complete |
| Equity tracker | Links to cap table shareholder | Complete |
| PTO tracking | Simple leave management with approval workflow | Complete |
| Onboarding checklists | Per-role templates | Complete |
| Contractor management | 1099 tracking | Complete |

### Phase 5: AI Features ✅ COMPLETE
| Feature | Description | Status |
|---------|-------------|--------|
| AI business assistant | "How's my runway?" natural language, Cmd+K | Complete |
| Document summarization | Auto-summarize uploaded docs | Complete |
| Smart deadline extraction | Parse dates from documents | Complete |
| Competitor monitoring | Track competitor news/changes via NewsAPI | Complete |
| Meeting action items | Extract from transcripts with task creation | Complete |

### Phase 6: Collaboration
| Feature | Description | Status |
|---------|-------------|--------|
| Comments everywhere | On any entity | Not Started |
| @mentions | With notifications | Not Started |
| Activity feed | Per-entity history | Not Started |
| Guest access | Investors, advisors, lawyers | Not Started |
| Real-time presence | Who's viewing what | Not Started |

### Phase 7: Mobile & Reporting
| Feature | Description | Status |
|---------|-------------|--------|
| Native mobile apps | iOS/Android or PWA | Not Started |
| Push notifications | Deadline reminders | Not Started |
| Investor report builder | Template-based | Not Started |
| Board deck generator | Auto-generate from metrics | Not Started |
| Custom dashboards | Drag-and-drop widgets | Not Started |

### Phase 8: Notifications & 2FA
| Feature | Description | Status |
|---------|-------------|--------|
| Email digests | Daily/weekly summaries | Complete |
| Deadline reminders | Email + push | Partial |
| Metric alerts | Runway warnings | Not Started |
| TOTP 2FA | Google Authenticator | Not Started |
| SMS backup | For 2FA recovery | Not Started |

---

## Technical Debt (After Phase 2)

| Item | Description | Priority |
|------|-------------|----------|
| `datetime.utcnow()` → `datetime.now(UTC)` | Python deprecation warnings | High |
| Pydantic v2 migration | `Config` → `ConfigDict` | High |
| SQLAlchemy 2.0 migration | `declarative_base()` warning | Medium |
| React component testing | Jest/Vitest test coverage | Medium |
| API documentation | OpenAPI examples, better descriptions | Medium |

---

## Features Implemented

### Core Features
| Feature | Description | Status |
|---------|-------------|--------|
| Dashboard | Daily Brief with stats, deadlines, metrics | Complete |
| Business Checklist | 96 compliance items across 11 categories | Complete |
| Business Library | Knowledge base for business info | Complete |
| Documents | Secure upload/download, missing file detection | Complete |
| Services | Track external services and logins | Complete |
| Contacts | Business contacts with extended fields | Complete |
| Deadlines | Track important dates with reminders | Complete |
| Credential Vault | Encrypted password storage (AES-256-GCM) | Complete |
| Products Offered | Track products/services you sell | Complete |
| Products Used | Track tools/services you use | Complete |
| Web Links | Important bookmarks | Complete |
| Tasks | Kanban board with time tracking | Complete |
| Metrics | Business KPI tracking dashboard | Complete |
| User Management | Admin-only user CRUD with roles | Complete |
| Meeting Transcripts | Upload, parse, summarize transcripts | Complete |
| Gamification | XP, levels, achievements, quests | Complete |
| Social Posting | LinkedIn, Twitter, Facebook | Complete |

### Security Features
| Feature | Implementation | Status |
|---------|---------------|--------|
| Vault Encryption | AES-256-GCM with Argon2id | Complete |
| Business Identifiers | Encrypted at rest | Complete |
| JWT Tokens | HS512, 15-min access tokens | Complete |
| Password Hashing | BCrypt with cost factor 12 | Complete |
| Rate Limiting | 5 req/min auth, 100 req/min general | Complete |
| Security Headers | HSTS, CSP, X-Frame-Options | Complete |
| IDOR Protection | All endpoints org-filtered | Complete |
| XSS Prevention | DOMPurify sanitization | Complete |
| Timing Attack Prevention | secrets.compare_digest | Complete |
| OAuth State Security | 10-min expiration, cleanup | Complete |
| API Key Encryption | Fernet for email integrations | Complete |

---

## User Roles
| Role | Permissions |
|------|-------------|
| Admin | Full access + user management + delete identifiers |
| Editor | View and edit all data |
| Viewer | Read-only access |

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
SCHEDULER_API_KEY=<random string for cron jobs>
```

### OAuth Providers
```bash
# Social Login
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret

# Social Posting
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

### Integrations (Phase 1)
```bash
# Plaid (Banking)
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
PLAID_ENV=sandbox  # or development, production

# Stripe (Payments/Revenue)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Google Calendar
GOOGLE_CALENDAR_ENABLED=true

# Slack
SLACK_BOT_TOKEN=xoxb-xxx
SLACK_SIGNING_SECRET=xxx
```

---

## Database Schema

SQLite database at `backend/made4founders.db`

### Key Tables
- `users` - Authentication and roles
- `organizations` - Multi-tenant isolation
- `documents` - File metadata
- `business_identifiers` - Encrypted sensitive IDs
- `vault_config` - Master password hash and salt
- `credentials` - Encrypted credential storage
- `checklist_progress` - Checklist completion tracking
- `tasks`, `task_boards`, `task_columns` - Kanban system
- `metrics`, `metric_goals` - Business KPIs
- `bank_accounts` - Financial accounts
- `meeting_transcripts` - Uploaded transcripts

---

## Recent Changes Log

### 2026-01-26
- **Phase 6: Collaboration In Progress**
  - Backend: Comment, Notification, Activity, GuestUser models added
  - API: `/api/comments`, `/api/notifications`, `/api/activity`, `/api/guests` endpoints
  - Frontend: CommentsSection, NotificationBell components created
  - NotificationBell added to Layout.tsx header
  - Polymorphic comments with @mention detection and notifications
  - Activity feed for org-wide transparency
  - Guest access with magic link tokens for investors/advisors

- **Phase 5: AI Features Complete**
  - AI Business Assistant with floating chat widget (Cmd+K shortcut)
  - Document summarization and deadline extraction
  - Competitor monitoring with NewsAPI integration
  - Enhanced meeting transcript analysis (action items, decisions, speaker analysis)
  - Create tasks directly from extracted action items
  - All using Ollama (qwen2.5:7b) for local, free AI processing

### 2026-01-25
- **Security Audit Complete - ALL FIXED**
  - Fixed 35 IDOR vulnerabilities across all endpoints
  - Fixed metrics/analytics leaking data across organizations
  - Fixed task/comment/time-entry cross-org access
  - Fixed bank accounts, credentials, users-list leaks
  - Added `get_task_with_org_check()` helper for task validation
  - 143 security tests passing
  - Full security scan infrastructure created in `security-scan/`

### 2026-01-24
- **Critical Security Fix**
  - Fixed data leak in `/api/daily-brief` endpoint
  - All queries now properly filter by organization_id

### 2026-01-17
- **Sidebar Reorganization** - 4 color-coded sections
- **Page Consolidation** - SocialHub, Insights, Finance, Offerings
- **Login Improvements** - Password visibility, autocomplete
- **Legal Pages** - Privacy, Terms, Security pages

### 2025-12-17
- **Security Overhaul** - Vault encryption, headers, rate limiting
- **Checklist Redesign** - 96 items across 11 categories
- **Documents Security** - Auth-required downloads

---

## File Structure
```
made4founders/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + routes
│   │   ├── auth.py              # Auth routes
│   │   ├── oauth.py             # OAuth providers
│   │   ├── security.py          # JWT, hashing
│   │   ├── vault.py             # AES-256-GCM encryption
│   │   ├── security_middleware.py  # Headers, rate limiting
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   └── database.py          # DB connection
│   ├── tests/                   # Security tests (143 tests)
│   ├── requirements.txt
│   └── uploads/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/
│   │   └── lib/api.ts
│   └── package.json
├── security-scan/               # Security scanning suite
│   ├── scripts/                 # Scan scripts
│   ├── templates/               # Nuclei templates
│   └── wordlists/               # API endpoints
├── docker-compose.yml
├── .github/workflows/deploy.yml
└── CLAUDE.md
```

---

## Security Scanning

Security scan infrastructure at `security-scan/`:

```bash
# Full audit (static + dynamic + IDOR + tests)
./security-scan/scripts/full-audit.sh local

# Individual scans
./security-scan/scripts/scan-local.sh <token>
./security-scan/scripts/idor-scanner.sh <token>
./security-scan/scripts/get-auth-token.sh
```

---

*This document ensures session continuity. Future Claude sessions should read this first.*
