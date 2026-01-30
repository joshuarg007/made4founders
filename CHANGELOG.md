# Changelog

All notable changes to Made4Founders will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added - 2FA/3FA Security (Phase 8)
- **Mandatory 2FA** - All users must enable TOTP authentication
- **MFA on Login** - 6-digit code verification after password
- **MFA Setup Page** - QR code, manual secret entry, backup codes
- **3FA Vault** - Master password + TOTP for vault unlock
- **Backup Codes** - One-time use recovery codes

### Added - Market Intelligence (Phase 5.5) [Planned]
- **Stock Watchlist** - Track stocks via Yahoo Finance (no API key needed)
- **Market News** - News API integration with category filtering
- **Stock Quotes** - Real-time price, change, market cap, 52-week range
- **Watchlist Management** - Add, remove, and annotate watched stocks

### Added - Plaid Integration (Phase 1)
- **Plaid Link** - Connect bank accounts via Plaid Link UI
- **Real-time balances** - View balances across all linked accounts
- **Transaction sync** - Automatic transaction import with categories
- **Cash position dashboard** - Aggregated view of all cash accounts
- **Runway calculator** - Automatic runway calculation from transaction data
- **Burn rate trending** - Track if burn is improving, stable, or declining
- **Transaction categorization** - Custom categories and notes on transactions
- **Multi-bank support** - Link multiple banks/institutions

### Added - Stripe Revenue Integration (Phase 1)
- **Stripe Connect OAuth** - Connect user's Stripe account (read-only)
- **MRR/ARR tracking** - Automatic calculation from subscriptions
- **Churn rate** - Monthly churn calculation
- **Subscription breakdown** - Revenue by plan
- **Top customers** - Highest revenue customers
- **Growth tracking** - Month-over-month growth rate
- **Customer metrics** - ARPC, new customers, churned

### Added - Financial Dashboard
- `/app/financial-dashboard` - Cash position and runway from Plaid
- `/app/revenue` - MRR, ARR, and subscription metrics from Stripe
- Real-time cash position widget
- Runway months with trend indicator
- Monthly burn rate (3-month average)
- MRR trend chart
- Subscription plan breakdown
- Top customers by revenue

### Added - Google Calendar Integration (Phase 1)
- **Google Calendar OAuth** - Connect your Google Calendar
- **Two-way sync** - Deadlines and meetings sync to calendar
- **Calendar selection** - Choose which calendar to sync to
- **Sync settings** - Toggle deadline/meeting sync independently
- **Upcoming events** - View synced events in integrations page
- **Push to calendar** - Manually push individual items

### Added - Slack Integration (Phase 1)
- **Slack OAuth** - Connect your Slack workspace
- **Channel selection** - Choose which channel receives notifications
- **Deadline alerts** - Get notified about upcoming deadlines
- **Task updates** - Notifications when tasks are created/completed
- **Metric alerts** - Alerts when key metrics change
- **Daily digest** - Morning summary with configurable time
- **Test messages** - Send test notifications to verify setup
- **Rich formatting** - Block Kit formatted messages

### Added - Cap Table (Phase 3)
- **Shareholders** - Track founders, investors, employees, advisors
- **Share Classes** - Common and preferred stock with full terms
- **Equity Grants** - Issue shares with vesting schedules
- **Stock Options** - ISO/NSO grants with exercise tracking
- **SAFEs** - Post-money, pre-money, and MFN SAFEs
- **Convertible Notes** - Track principal, interest, and maturity
- **Funding Rounds** - Pre-seed through Series C tracking
- **Cap Table Summary** - Ownership breakdown and top shareholders
- **Dilution Modeling** - What-if scenarios for new funding rounds
- **Vesting Calculator** - Automatic vesting calculation

### Planned - Phase 2 Features
- Budget vs. actuals comparison
- Invoice generation
- Financial alerts (runway < 6 months)

---

## [1.6.0] - 2026-01-25

### Security - Critical IDOR Fixes
- **CRITICAL**: Fixed 35 IDOR vulnerabilities across all API endpoints
- Fixed cross-organization data leakage in metrics/analytics dashboard
- Fixed task/comment/time-entry cross-tenant access
- Fixed bank accounts accessible without org filter
- Fixed users-list returning all users across organizations
- Fixed credential copy endpoint missing org check
- Added `get_task_with_org_check()` helper for task validation
- Added XSS prevention with DOMPurify sanitization
- Fixed rate limiter bypass via X-Forwarded-For spoofing
- Added OAuth state expiration (10 minutes) and cleanup
- Fixed timing attacks with secrets.compare_digest
- Added API key encryption for email integrations (Fernet)
- Enforced SECRET_KEY minimum length in production
- Strengthened CSP headers (removed unsafe-inline/eval)

### Added
- Security scanning infrastructure (`security-scan/`)
- 11 custom Nuclei templates for M4F-specific vulnerabilities
- 5 security scanning scripts (full-audit, scan-local, scan-production, idor-scanner, get-auth-token)
- Comprehensive API endpoint wordlist for fuzzing

### Changed
- All 143 security tests now passing

---

## [1.5.0] - 2026-01-25

### Added - Production Readiness Release

#### Operations & Monitoring
- **Automated Backups** (`backups.py`) - Scheduled S3 backups with configurable retention
- **System Monitoring** (`monitoring.py`) - Health checks, system metrics, Slack/email alerting
- **Audit Logging** (`audit_logs.py`) - Security event tracking with admin dashboard
- **Error Tracking** - Sentry integration for frontend and backend

#### User Experience
- **Mobile Responsive Layout** - Hamburger menu, slide-out sidebar for mobile/tablet
- **Support Widget** (`SupportWidget.tsx`) - Floating help button with FAQs and contact form
- **Data Export** (`data_export.py`) - Export all data as JSON/CSV (GDPR compliant)

#### Analytics & Insights
- **Privacy-Friendly Analytics** (`analytics.py`) - Page views, feature usage tracking
- **Analytics Hook** (`useAnalytics.ts`) - Automatic page view tracking in React

#### Backend Modules Added
- `backups.py` - S3 backup management with retention policy
- `monitoring.py` - Health checks and alerting system
- `audit_logs.py` - Security audit trail
- `data_export.py` - User data export (JSON/CSV)
- `support.py` - Customer support contact form
- `analytics.py` - Usage analytics with privacy hashing

#### Frontend Components Added
- `SupportWidget.tsx` - Floating help widget with FAQs
- `useAnalytics.ts` - Page tracking React hook
- Mobile-responsive sidebar in `Layout.tsx`
- Audit log viewer in `Settings.tsx`

### Changed
- Updated `Layout.tsx` with mobile hamburger menu and responsive sidebar
- Added audit logs section to Settings page (admin only)
- Enhanced `.env.example` with new environment variables

---

## [1.4.0] - 2026-01-24

### Added - Authentication & Email

#### Authentication
- **Password Reset Flow** - Forgot password with email token
- **Email Verification** - Verify email on signup with resend option
- **MFA Setup UI** - Two-factor authentication in Settings page
- **OAuth Account Linking** - Link Google/GitHub to existing accounts

#### Email Notifications
- **Deadline Reminders** (`notifications.py`) - Daily email reminders
- **Weekly Digest** - Summary of tasks and deadlines
- Email templates for all notification types

#### Frontend Pages Added
- `ForgotPassword.tsx` - Request password reset
- `ResetPassword.tsx` - Set new password with token
- `VerifyEmail.tsx` - Email verification page

### Changed
- Updated `Login.tsx` with "Forgot password?" link
- Updated `Settings.tsx` with full MFA setup flow
- Updated OAuth callbacks to support account linking

---

## [1.3.0] - 2026-01-22

### Added
- LinkedIn OAuth for sign-in and social posting
- Twitter/X OAuth for sign-in and social posting
- Facebook OAuth for sign-in and social posting
- Social posting endpoints: `/api/social/{platform}/post`

### Changed
- Login page now has 5 OAuth options: Google, GitHub, LinkedIn, X, Facebook
- Fixed production deployment issues (redirect URIs, env vars)

---

## [1.2.0] - 2026-01-17

### Added - Sidebar Reorganization

#### UI Improvements
- 4 color-coded sidebar sections: Command Center, Business, Growth Hub, Operations
- Collapsible sections with localStorage persistence
- Page consolidation: SocialHub, Insights, Finance, Offerings

#### Legal Pages
- Privacy Policy (`/privacy`)
- Terms of Service (`/terms`)
- Security Practices (`/security`)

#### Contacts Enhancement
- Added fields: secondary_email, mobile_phone, city, state, country, timezone
- Added fields: linkedin_url, twitter_handle, birthday, tags

### Changed
- Login page: email/password form first, OAuth below
- Password visibility toggle added
- Browser password save prompt fixed

---

## [1.1.0] - 2025-12-17

### Added - Security Overhaul

#### Encryption
- Upgraded vault to AES-256-GCM with Argon2id key derivation
- Encrypted BusinessIdentifier values at rest

#### Security Features
- Security headers middleware (HSTS, CSP, X-Frame-Options)
- Rate limiting (5 req/min on auth, 100 req/min general)
- JWT upgraded to HS512 with token IDs
- Audit logging for sensitive operations

#### Document Security
- Auth required for all downloads
- Content-Disposition: attachment (no preview)
- File extension whitelist/blacklist
- Path traversal protection

#### Checklist Redesign
- 96 items across 11 categories
- Added: Government Contracting, Cybersecurity, Insurance
- Compact grid layout with search/filter

---

## [1.0.0] - 2025-12-04

### Added - Initial Release

#### Core Features
- Dashboard with Daily Brief
- Business Checklist (compliance tracking)
- Document management with secure upload/download
- Encrypted Credential Vault
- Contact management
- Deadline tracking
- Task Kanban board with time tracking
- Business metrics dashboard
- User management with roles

#### Authentication
- Email/password login
- Google OAuth
- GitHub OAuth

#### Infrastructure
- Docker Compose deployment
- GitHub Actions CI/CD
- SQLite database
- FastAPI backend
- React frontend with Vite
