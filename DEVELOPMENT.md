# FounderOS - Development Guide

## Project Overview

FounderOS is a **Founder Command Center** - an all-in-one dashboard for first-time founders to manage their startup formation, compliance, and operations. Built with React + TypeScript frontend and FastAPI + SQLite backend.

## Tech Stack

- **Backend**: FastAPI (Python), SQLAlchemy, SQLite (dev) / PostgreSQL (prod)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Auth**: JWT with httpOnly cookies (following SLMS pattern)

## Key Directories

- `backend/app/` - FastAPI backend
- `frontend/src/` - React frontend
- `frontend/src/pages/` - Page components
- `frontend/src/components/` - Shared components

## Environment

- Backend: port 8000
- Frontend: port 5173

---

## Feature Roadmap

Priority order: **16-18 first** (foundation), then **1-15** (value-adds).

### Phase 1: Foundation (Do First)

#### 16. Password/Credential Vault [COMPLETE]
**Status**: Complete
- Secure storage for service credentials (bank logins, tax portal, etc.)
- Master password protection with bcrypt hashing
- AES-256 encryption at rest (Fernet + PBKDF2 480K iterations)
- Quick-copy masked values
- Categories: banking, tax, legal, government, accounting, insurance, vendors, tools
- TOTP/2FA secret storage support
- 21 unit tests passing

#### 17. Board Meeting Prep
**Status**: Pending
- Meeting agenda templates
- Document assembly (financials, metrics, updates)
- Action item tracking from meetings
- Minutes generation
- Recurring meeting scheduler

#### 18. Equity Calculator
**Status**: Pending
- Founder split scenarios
- ESOP pool modeling
- Dilution visualization
- Vesting schedule calculator
- What-if scenario comparisons

---

### Phase 2: Financial Tools (High Value)

#### 1. Runway Calculator
- Monthly burn tracking
- Cash projection graph
- "Zero date" alert
- Scenario modeling (hiring, revenue changes)

#### 2. Fundraising Tracker
- Investor CRM
- Pipeline stages (intro → term sheet → close)
- Document checklist per investor
- SAFE/note tracking
- Due diligence tracker

#### 3. Cap Table Manager
- Real-time ownership %
- Round modeling
- Convertible instrument tracking
- 409A valuation integration
- Export for lawyers/accountants

---

### Phase 3: Compliance & Operations

#### 4. Compliance Calendar
- Auto-generated from entity type + state
- Annual report dates
- Franchise tax due dates
- Federal/state filing deadlines
- Email/SMS reminders

#### 5. Expense Tracking (Simple)
- Receipt uploads
- Category tagging
- Monthly summaries
- Export to CSV/accountant

#### 6. Founder Vesting Dashboard
- Track each founder's vesting
- Cliff countdown
- Acceleration scenarios
- Buy-back calculations

#### 7. KPI Dashboard
- Connect to Stripe, analytics
- MRR, churn, CAC, LTV
- Goal setting + tracking
- Team-shareable views

---

### Phase 4: Relationships & Resources

#### 8. Advisor CRM
- Track advisors, mentors
- Compensation (equity, cash)
- Meeting notes
- Agreement status

#### 9. Legal Document Templates
- Formation docs
- NDAs, advisor agreements
- Employment contracts
- Customer contracts
- Fill-in-the-blank with company data

#### 10. Integration Hub
- Connect Stripe, QuickBooks
- Bank account sync (Plaid)
- Calendar sync
- Zapier/webhook support

---

### Phase 5: AI & Advanced

#### 11. AI Compliance Assistant
- Ask questions about requirements
- "What do I need to do in Q1?"
- State-specific guidance
- Document deadline explanations

#### 12. Founder Community (Optional)
- Connect with other founders
- Recommend service providers
- Anonymous Q&A
- Milestone sharing

#### 13. State-Specific Guides
- Formation requirements by state
- Tax obligations
- Registered agent info
- Comparison tools

#### 14. Export/Portability
- Full data export
- Backup/restore
- Migration to other tools

#### 15. Multi-Entity Support
- Manage multiple companies
- Holding company structures
- Shared contacts/vendors

---

## Authentication Pattern

Following SLMS (Site2CRM) authentication:

### Backend
- JWT with httpOnly cookies
- Access token (15min) + Refresh token (7 days)
- OAuth2PasswordBearer with cookie fallback
- bcrypt password hashing
- Environment-driven cookie settings

### Frontend
- AuthContext for global auth state
- Protected routes redirect to /login
- Automatic token refresh
- credentials: "include" for all API calls

### Key Files
- `backend/app/security.py` - Token/password utilities
- `backend/app/auth.py` - Auth routes (/token, /logout, /me, /refresh)
- `frontend/src/context/AuthContext.tsx` - React auth context
- `frontend/src/pages/Login.tsx` - Login page

---

## Current Session Notes

Building authentication system (Feature 16 prerequisite).
