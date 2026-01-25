# Made4Founders Security Scanning Suite

Comprehensive security scanning infrastructure for Made4Founders application.

## Prerequisites

Install required tools:

```bash
# Go tools (nuclei, httpx, ffuf, subfinder)
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
go install -v github.com/ffuf/ffuf/v2@latest
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# Update nuclei templates
nuclei -update-templates

# Python tools
pip install bandit

# Ensure Go bin is in PATH
export PATH="$HOME/go/bin:$PATH"
```

## Directory Structure

```
security-scan/
├── scripts/           # Scanning scripts
│   ├── full-audit.sh       # Complete audit (static + dynamic + tests)
│   ├── scan-local.sh       # Local environment scan (8 phases)
│   ├── scan-production.sh  # Production scan (rate-limited)
│   ├── idor-scanner.sh     # Dedicated IDOR testing
│   └── get-auth-token.sh   # Obtain auth token for testing
├── templates/         # Custom nuclei templates for M4F
│   ├── m4f-auth-bypass.yaml
│   ├── m4f-idor-*.yaml
│   ├── m4f-injection.yaml
│   ├── m4f-xss.yaml
│   └── ...
├── wordlists/         # Custom wordlists
│   ├── api-endpoints.txt   # All API endpoints
│   ├── params.txt          # Common parameters
│   └── idor-ids.txt        # ID ranges for IDOR testing
├── reports/           # Scan output (gitignored)
└── logs/              # Scan logs (gitignored)
```

## Quick Start

### 1. Start Backend Locally

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Get Auth Token

```bash
./scripts/get-auth-token.sh [email] [password] [target_url]

# Default uses demo account:
./scripts/get-auth-token.sh
# Returns: eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...
```

### 3. Run Scans

#### Full Audit (Recommended)
```bash
./scripts/full-audit.sh local
```

This runs:
1. **Static Analysis** - Bandit, secrets scan, dangerous functions
2. **Dynamic Scanning** - Nuclei templates against running backend
3. **IDOR Testing** - Cross-organization access tests
4. **Security Test Suite** - pytest security tests

#### Local Scan Only
```bash
./scripts/scan-local.sh [auth_token]
```

8-phase scan:
1. Reconnaissance (endpoint discovery)
2. Exposure scanning (sensitive files)
3. Authentication tests
4. IDOR testing
5. Injection testing (SQLi, XSS)
6. OAuth security
7. General vulnerability scan
8. Endpoint fuzzing

#### Production Scan
```bash
./scripts/scan-production.sh [auth_token]
```

Rate-limited (5 req/sec) non-intrusive scan:
- Security headers
- Exposure checks
- Auth endpoint status
- OAuth endpoint status
- Misconfiguration scan

#### IDOR Scanner
```bash
./scripts/idor-scanner.sh <auth_token> [target_url]
```

Tests cross-organization access on:
- Documents, Credentials, Business Identifiers
- Contacts, Tasks, Boards
- Services, Deadlines, Marketplaces
- Products Offered/Used

## Custom Templates

### IDOR Templates
- `m4f-idor-documents.yaml` - Document access control
- `m4f-idor-credentials.yaml` - Credential vault isolation
- `m4f-idor-identifiers.yaml` - Business identifier protection

### Auth Templates
- `m4f-auth-bypass.yaml` - Authentication bypass attempts
- `m4f-rate-limit.yaml` - Rate limiting validation
- `m4f-privilege-escalation.yaml` - Role escalation tests

### Injection Templates
- `m4f-injection.yaml` - SQL injection tests
- `m4f-xss.yaml` - Cross-site scripting tests
- `m4f-path-traversal.yaml` - Path traversal attempts

### Other Templates
- `m4f-sensitive-exposure.yaml` - Exposed files/configs
- `m4f-oauth-security.yaml` - OAuth flow security

## Report Files

After scanning, reports are saved to `reports/<timestamp>/`:

| File | Contents |
|------|----------|
| `SUMMARY.md` | Executive summary |
| `01_endpoints.txt` | Discovered endpoints |
| `02_technologies.txt` | Tech detection |
| `03_exposure.txt` | Exposure issues |
| `04_auth.txt` | Auth vulnerabilities |
| `05_idor.txt` | IDOR findings |
| `06_injection.txt` | Injection vulns |
| `07_oauth.txt` | OAuth issues |
| `08_vulns.txt` | General vulns |
| `09_fuzz.txt` | Fuzzing results |

## Interpreting Results

### Severity Levels
- **Critical** - Immediate action required (RCE, auth bypass)
- **High** - Fix within 24 hours (IDOR, SQLi, sensitive exposure)
- **Medium** - Fix within 1 week (XSS, missing headers)
- **Low** - Plan remediation (info disclosure, minor issues)

### IDOR Results
```
[VULNERABLE] /api/documents/42 - Accessed org 2 (current: 1)
```
This means user from org 1 accessed data belonging to org 2.

### False Positives
Some common false positives:
- 404 responses counted as "findings" (expected for non-existent IDs)
- Rate limit detections on intentionally limited endpoints
- Tech detection showing expected stack (FastAPI, React)

## Security Test Suite

The backend includes pytest security tests:

```bash
cd backend
source venv/bin/activate
pytest tests/test_auth.py tests/test_authorization.py \
       tests/test_injection.py tests/test_vault.py -v
```

Tests cover:
- Authentication flows
- Authorization (IDOR, role-based access)
- Injection prevention
- Vault encryption

## Extending Templates

Create new nuclei templates in `templates/`:

```yaml
id: m4f-custom-test
info:
  name: Custom Security Test
  author: your-name
  severity: high
  description: Description of what this tests

http:
  - method: GET
    path:
      - "{{BaseURL}}/api/endpoint"
    matchers:
      - type: status
        status:
          - 200
      - type: word
        words:
          - "sensitive_data"
```

## Maintenance

### Update Templates
```bash
nuclei -update-templates
```

### Update Wordlists
Add new endpoints to `wordlists/api-endpoints.txt` as the API grows.

### Clean Reports
```bash
rm -rf reports/* logs/*
```

## Safety Notes

1. **Never run production scans without authorization**
2. **Use test accounts only** - Never scan with real user credentials
3. **Rate limiting** - Production scans are limited to 5 req/sec
4. **Local first** - Always test locally before production
5. **Review before commit** - Reports may contain sensitive info

## Troubleshooting

### "Backend not running"
```bash
cd backend && uvicorn app.main:app --port 8001
```

### "nuclei not found"
```bash
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
export PATH="$HOME/go/bin:$PATH"
```

### "Permission denied"
```bash
chmod +x scripts/*.sh
```

### "No auth token"
```bash
./scripts/get-auth-token.sh demo@made4founders.com Demo2024!
```
