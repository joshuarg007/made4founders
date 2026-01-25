# Changelog

All notable changes to Made4Founders will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
- 98 items across 11 categories
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
