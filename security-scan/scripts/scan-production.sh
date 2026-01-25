#!/bin/bash
#
# Made4Founders Production Security Scanner
# Run against https://made4founders.com with rate limiting
#
# Usage: ./scan-production.sh [auth_token]
#
# WARNING: This scans production - use responsibly!
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TARGET="https://made4founders.com"
RATE_LIMIT=5  # requests per second
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCAN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$SCAN_DIR/reports/prod_$(date +%Y%m%d_%H%M%S)"
TEMPLATES_DIR="$SCAN_DIR/templates"
WORDLISTS_DIR="$SCAN_DIR/wordlists"

# Tools
export PATH="$HOME/go/bin:$HOME/.local/bin:$PATH"

# Auth token (optional)
AUTH_TOKEN="${1:-}"

mkdir -p "$REPORT_DIR"

echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║       Made4Founders PRODUCTION Security Scanner              ║${NC}"
echo -e "${RED}║                    USE WITH CAUTION                          ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Target:${NC} $TARGET"
echo -e "${BLUE}Rate Limit:${NC} $RATE_LIMIT req/sec"
echo -e "${BLUE}Reports:${NC} $REPORT_DIR"
echo ""

# Confirmation
echo -e "${YELLOW}This will scan PRODUCTION at $TARGET${NC}"
read -p "Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi
echo ""

# ============ Phase 1: Non-Intrusive Recon ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 1: Non-Intrusive Reconnaissance${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[1.1] HTTP probe...${NC}"
echo "$TARGET" | httpx -silent -status-code -title -tech-detect -content-length 2>/dev/null \
    | tee "$REPORT_DIR/01_probe.txt"

echo -e "${YELLOW}[1.2] Technology detection...${NC}"
nuclei -u "$TARGET" -t ~/nuclei-templates/http/technologies/ \
    -rate-limit $RATE_LIMIT -silent 2>/dev/null \
    | tee "$REPORT_DIR/02_tech.txt"
echo ""

# ============ Phase 2: Security Headers Check ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 2: Security Headers Analysis${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[2.1] Checking security headers...${NC}"
curl -sI "$TARGET" | tee "$REPORT_DIR/03_headers.txt"

# Check specific headers
echo "" >> "$REPORT_DIR/03_headers.txt"
echo "=== Security Header Analysis ===" >> "$REPORT_DIR/03_headers.txt"
for header in "Strict-Transport-Security" "Content-Security-Policy" "X-Frame-Options" \
              "X-Content-Type-Options" "Referrer-Policy" "Permissions-Policy"; do
    if grep -qi "$header" "$REPORT_DIR/03_headers.txt"; then
        echo "[✓] $header: Present" >> "$REPORT_DIR/03_headers.txt"
    else
        echo "[✗] $header: MISSING" >> "$REPORT_DIR/03_headers.txt"
    fi
done
cat "$REPORT_DIR/03_headers.txt"
echo ""

# ============ Phase 3: Exposure Check ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 3: Sensitive Exposure Check${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[3.1] Checking for exposed files/configs...${NC}"
nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-sensitive-exposure.yaml" \
    -rate-limit $RATE_LIMIT -silent 2>/dev/null \
    | tee "$REPORT_DIR/04_exposure.txt"

echo -e "${YELLOW}[3.2] Checking for exposed documentation...${NC}"
for path in "/docs" "/openapi.json" "/swagger.json" "/api-docs"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET$path")
    echo "$path: $STATUS" | tee -a "$REPORT_DIR/04_exposure.txt"
done
echo ""

# ============ Phase 4: Auth Testing (Limited) ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 4: Authentication Testing (Non-Intrusive)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[4.1] Testing unauthenticated access...${NC}"
for endpoint in "/api/auth/me" "/api/credentials" "/api/business-identifiers" "/api/auth/users"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET$endpoint")
    echo "$endpoint: $STATUS" | tee -a "$REPORT_DIR/05_auth.txt"
    sleep 0.2  # Rate limiting
done
echo ""

# ============ Phase 5: OAuth Check ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 5: OAuth Endpoint Check${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[5.1] Checking OAuth endpoints...${NC}"
for provider in "google" "github" "linkedin" "twitter" "facebook"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/api/auth/$provider/login")
    echo "/api/auth/$provider/login: $STATUS" | tee -a "$REPORT_DIR/06_oauth.txt"
    sleep 0.2
done
echo ""

# ============ Phase 6: General Vuln Scan ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 6: General Vulnerability Scan${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[6.1] Running safe vulnerability checks...${NC}"
nuclei -u "$TARGET" \
    -t ~/nuclei-templates/http/misconfiguration/ \
    -t ~/nuclei-templates/http/exposures/ \
    -severity high,critical \
    -rate-limit $RATE_LIMIT \
    -silent 2>/dev/null \
    | tee "$REPORT_DIR/07_vulns.txt"
echo ""

# ============ Generate Summary ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Generating Summary${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

cat > "$REPORT_DIR/SUMMARY.md" << EOF
# Made4Founders Production Security Scan

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Target:** $TARGET
**Rate Limit:** $RATE_LIMIT req/sec

---

## Security Headers
\`\`\`
$(cat "$REPORT_DIR/03_headers.txt" 2>/dev/null)
\`\`\`

## Exposure Check
\`\`\`
$(cat "$REPORT_DIR/04_exposure.txt" 2>/dev/null || echo "No issues found")
\`\`\`

## Auth Endpoint Status
\`\`\`
$(cat "$REPORT_DIR/05_auth.txt" 2>/dev/null)
\`\`\`

## OAuth Endpoints
\`\`\`
$(cat "$REPORT_DIR/06_oauth.txt" 2>/dev/null)
\`\`\`

## Vulnerabilities
\`\`\`
$(cat "$REPORT_DIR/07_vulns.txt" 2>/dev/null || echo "No vulnerabilities found")
\`\`\`

---

**Note:** This is a non-intrusive production scan. For comprehensive testing,
run the local scanner against a staging environment.

*Generated by Made4Founders Security Scanner*
EOF

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    SCAN COMPLETE                              ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Report:${NC} $REPORT_DIR/SUMMARY.md"
