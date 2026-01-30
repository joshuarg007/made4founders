# Made4Founders Product Roadmap

> **Last Updated:** 2026-01-25
>
> **Vision:** "Command Center for Solo Founders" - The all-in-one platform for 1-5 person startups

---

## Product Differentiators

1. **Compliance-First** - 96-item business checklist (unique in market)
2. **Fundraising Toolkit** - Cap table + data room + investor updates in one place
3. **AI CFO** - Financial insights without needing an accountant
4. **Security-First** - AES-256-GCM encryption, audit logging, IDOR-protected

---

## Current Status

| Area | Status |
|------|--------|
| Core Features | Complete |
| Security | Complete (143 tests passing) |
| OAuth (5 providers) | Complete |
| Social Posting | Complete |
| Production Ready | Yes |

---

## Phase 1: Real Integrations (Current Priority)

> **Goal:** Connect to the tools founders actually use

| Integration | Purpose | Priority | Status |
|-------------|---------|----------|--------|
| **Plaid** | Real-time bank balances, transactions | P0 | Complete |
| **Stripe** | Revenue metrics, MRR/ARR auto-populated | P0 | Complete |
| **Google Calendar** | Deadlines/meetings sync both ways | P1 | Complete |
| **Slack** | Notifications, daily digest | P1 | Complete |
| **Gmail/Outlook** | Email tracking with contacts | P2 | Not Started |
| **DocuSign** | Document signing workflow | P2 | Not Started |
| **QuickBooks** | Accounting sync | P2 | Started (OAuth done) |
| **Xero** | Accounting sync | P2 | Started (OAuth done) |

### Plaid Integration Details (Complete)
- [x] Link bank accounts via Plaid Link
- [x] Sync daily balances automatically
- [x] Categorize transactions
- [x] Calculate runway from burn rate
- [x] Financial Dashboard with cash position
- [x] Burn rate trending (improving/stable/declining)

### Stripe Integration Details (Complete)
- [x] Connect Stripe account via OAuth (read-only)
- [x] Pull subscription data
- [x] Calculate MRR, ARR, churn rate
- [x] Revenue dashboard with charts
- [x] Subscription breakdown by plan
- [x] Top customers by revenue
- [x] Month-over-month growth tracking

### Google Calendar Integration Details (Complete)
- [x] Google Calendar OAuth with calendar scopes
- [x] Two-way sync for deadlines and meetings
- [x] Calendar selection (choose which calendar)
- [x] Sync settings (toggle deadline/meeting sync)
- [x] View upcoming events from calendar
- [x] Push individual items to calendar

### Slack Integration Details (Complete)
- [x] Slack OAuth with workspace connection
- [x] Channel selection for notifications
- [x] Deadline alerts with due date reminders
- [x] Task update notifications
- [x] Metric change alerts
- [x] Daily digest with configurable time
- [x] Test message functionality
- [x] Block Kit rich message formatting

---

## Phase 2: Financial Dashboard (Mercury/Brex Competitor)

> **Goal:** Replace spreadsheets for financial tracking

| Feature | Description | Priority | Status |
|---------|-------------|----------|--------|
| Real-time cash position | Aggregate from all linked accounts | P0 | Complete |
| Runway calculator | Months of runway with burn rate | P0 | Complete |
| Burn rate trending | 3/6/12 month burn trends | P0 | Complete |
| Budget vs. actuals | Monthly comparison view | P1 | Not Started |
| Invoice generation | Simple invoicing with templates | P1 | Not Started |
| Expense categorization | Auto-categorize transactions | P2 | Complete |
| MRR/ARR dashboard | Revenue metrics from Stripe | P0 | Complete |
| Financial alerts | Runway < 6 months warning | P1 | Complete (UI only) |

---

## Phase 3: Investor Relations (Carta-lite)

> **Goal:** Fundraising toolkit for seed-stage startups

| Feature | Description | Priority | Status |
|---------|-------------|----------|--------|
| Cap table management | Shareholders, options, SAFEs | P0 | Complete |
| Investor updates | Email reports with metrics | P0 | Not Started |
| Data room | Secure doc sharing for fundraising | P1 | Not Started |
| 409A valuation tracking | Annual valuations log | P2 | Not Started |
| Dilution calculator | Scenario modeling for raises | P1 | Complete |
| SAFE/Note tracking | Convertible instruments | P1 | Complete |
| Investor CRM | Track investor relationships | P2 | Not Started |

### Cap Table Details (Complete)
- [x] Shareholder management (founders, investors, employees, advisors)
- [x] Share class definitions (common, preferred with full terms)
- [x] Equity grants with vesting schedules
- [x] Stock options (ISO/NSO) with exercise tracking
- [x] SAFE notes (post-money, pre-money, MFN)
- [x] Convertible notes with interest accrual
- [x] Funding round tracking
- [x] Cap table summary with ownership breakdown
- [x] Dilution modeling for new funding scenarios
- [x] Vesting calculation (standard 4y/1y cliff, custom)

---

## Phase 4: Team Management (Gusto-lite)

> **Goal:** Basic HR for teams under 10 people

| Feature | Description | Priority | Status |
|---------|-------------|----------|--------|
| Employee directory | With org chart | P1 | Not Started |
| Equity tracker | Options vesting schedules | P0 | Not Started |
| PTO tracking | Simple leave management | P2 | Not Started |
| Onboarding checklists | Per-role templates | P2 | Not Started |
| Contractor management | 1099 tracking | P2 | Not Started |
| Offer letter templates | Standard offer docs | P2 | Not Started |

---

## Phase 5: AI Features

> **Goal:** AI CFO - financial insights without an accountant

| Feature | Description | Priority | Status |
|---------|-------------|----------|--------|
| AI business assistant | "How's my runway?" natural language | P0 | Complete |
| Document summarization | Auto-summarize uploaded docs | P1 | Complete |
| Smart deadline extraction | Parse dates from documents | P2 | Complete |
| Competitor monitoring | Track competitor news/changes | P2 | Complete |
| Meeting action items | Extract from transcripts | P1 | Complete |
| Financial insights | "Your burn rate increased 20%" | P0 | Not Started |
| Anomaly detection | Flag unusual transactions | P1 | Not Started |

---

## Phase 5.5: Market Intelligence (NEW)

> **Goal:** Track market news and stocks relevant to your business

| Feature | Description | Priority | Status |
|---------|-------------|----------|--------|
| Market news feed | News API integration with search | P1 | Not Started |
| Stock watchlist | Track stocks via Yahoo Finance | P1 | Not Started |
| News categories | Filter by tech, business, startups | P2 | Not Started |
| Stock quotes | Real-time price, change, market cap | P1 | Not Started |

---

## Phase 6: Collaboration

> **Goal:** Enable founder + 1-2 team members to work together

| Feature | Description | Priority | Status |
|---------|-------------|----------|--------|
| Comments everywhere | On any entity | P1 | Not Started |
| @mentions | With notifications | P1 | Not Started |
| Activity feed | Per-entity history | P2 | Not Started |
| Guest access | Investors, advisors, lawyers | P0 | Not Started |
| Real-time presence | Who's viewing what | P3 | Not Started |
| Shared workspaces | Multiple organizations | P2 | Not Started |

---

## Phase 7: Mobile & Reporting

> **Goal:** Access on the go, professional reports

| Feature | Description | Priority | Status |
|---------|-------------|----------|--------|
| Native mobile apps | iOS/Android or PWA | P1 | Not Started |
| Push notifications | Deadline reminders | P1 | Not Started |
| Investor report builder | Template-based | P0 | Not Started |
| Board deck generator | Auto-generate from metrics | P1 | Not Started |
| Custom dashboards | Drag-and-drop widgets | P2 | Not Started |
| PDF export everything | Professional formatting | P1 | Not Started |

---

## Phase 8: Notifications & 2FA

> **Goal:** Keep founders informed and secure

| Feature | Description | Priority | Status |
|---------|-------------|----------|--------|
| Email digests | Daily/weekly summaries | Complete | Done |
| Deadline reminders | Email + push | P1 | Partial |
| Metric alerts | Runway < 6 months warning | P1 | Not Started |
| TOTP 2FA | Google Authenticator (mandatory) | P0 | Complete |
| 3FA Vault | Login + master password + TOTP | P0 | Complete |
| SMS backup | For 2FA recovery | P2 | Not Started |
| Recovery codes | Backup access (one-time use) | P1 | Complete |

---

## Technical Debt (After Phase 2)

| Item | Description | Priority |
|------|-------------|----------|
| `datetime.utcnow()` deprecation | Migrate to `datetime.now(UTC)` | High |
| Pydantic v2 migration | `Config` → `ConfigDict` | High |
| SQLAlchemy 2.0 migration | `declarative_base()` warning | Medium |
| React component testing | Jest/Vitest test coverage | Medium |
| API documentation | OpenAPI examples, better descriptions | Medium |

---

## Completed (Security Milestone)

### 2026-01-25: Security Hardening Complete
- [x] Fixed 35 IDOR vulnerabilities
- [x] 143 security tests passing
- [x] XSS prevention (DOMPurify)
- [x] Rate limiter bypass fixed
- [x] OAuth state expiration
- [x] Timing attack prevention
- [x] API key encryption
- [x] CSP hardening
- [x] Security scanning infrastructure

### Previously Completed
- [x] Core features (Dashboard, Tasks, Metrics, Contacts, etc.)
- [x] OAuth (Google, GitHub, LinkedIn, Twitter, Facebook)
- [x] Social posting (LinkedIn, Twitter, Facebook)
- [x] Credential Vault (AES-256-GCM)
- [x] Business Checklist (96 items)
- [x] Meeting Transcripts
- [x] Gamification (XP, achievements)
- [x] Mobile responsive layout
- [x] Email notifications
- [x] Audit logging

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Backend | Python FastAPI, SQLAlchemy, SQLite |
| Auth | JWT HS512, OAuth 2.0 (5 providers) |
| Encryption | AES-256-GCM, Argon2id, BCrypt |
| Payments | Stripe (planned) |
| Banking | Plaid (planned) |
| Deployment | Docker, AWS Lightsail, GitHub Actions |

---

## Competitive Landscape

| Competitor | Their Focus | Our Advantage |
|------------|-------------|---------------|
| Notion | General docs/wiki | Purpose-built for founders |
| Monday.com | Team project management | Solo founder optimized |
| Carta | Cap table only | Full command center |
| Mercury | Banking only | All-in-one platform |
| Gusto | HR/Payroll only | Integrated with financials |

---

*This roadmap reflects current priorities. Updated as we complete phases.*
