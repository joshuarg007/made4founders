#!/bin/bash
#
# Made4Founders Local Security Scanner
# Run against localhost:8001 (backend must be running)
#
# Usage: ./scan-local.sh [auth_token]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TARGET="http://localhost:8001"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCAN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$SCAN_DIR/reports/$(date +%Y%m%d_%H%M%S)"
TEMPLATES_DIR="$SCAN_DIR/templates"
WORDLISTS_DIR="$SCAN_DIR/wordlists"
LOG_FILE="$SCAN_DIR/logs/scan_$(date +%Y%m%d_%H%M%S).log"

# Tools
export PATH="$HOME/go/bin:$HOME/.local/bin:$PATH"

# Auth token (optional)
AUTH_TOKEN="${1:-}"

mkdir -p "$REPORT_DIR" "$SCAN_DIR/logs"

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Made4Founders Local Security Scanner                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Target:${NC} $TARGET"
echo -e "${BLUE}Reports:${NC} $REPORT_DIR"
echo -e "${BLUE}Log:${NC} $LOG_FILE"
echo ""

# Check if backend is running
echo -e "${YELLOW}[*] Checking if backend is running...${NC}"
if ! curl -s "$TARGET/api/health" > /dev/null 2>&1; then
    echo -e "${RED}[!] Backend is not running at $TARGET${NC}"
    echo -e "${YELLOW}    Start it with: cd backend && uvicorn app.main:app --port 8001${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Backend is running${NC}"
echo ""

# ============ Phase 1: Reconnaissance ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 1: Reconnaissance${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

# Probe endpoints
echo -e "${YELLOW}[1.1] Probing API endpoints...${NC}"
httpx -l "$WORDLISTS_DIR/api-endpoints.txt" -silent -status-code -content-length \
    -prefix "$TARGET/" 2>/dev/null | tee "$REPORT_DIR/01_endpoints.txt"
echo -e "${GREEN}[✓] Found $(wc -l < "$REPORT_DIR/01_endpoints.txt") endpoints${NC}"

# Technology detection
echo -e "${YELLOW}[1.2] Detecting technologies...${NC}"
nuclei -u "$TARGET" -t ~/nuclei-templates/http/technologies/ -silent 2>/dev/null \
    | tee "$REPORT_DIR/02_technologies.txt"
echo ""

# ============ Phase 2: Exposure Scanning ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 2: Sensitive Exposure Scanning${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[2.1] Scanning for exposed files...${NC}"
nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-sensitive-exposure.yaml" -silent 2>/dev/null \
    | tee "$REPORT_DIR/03_exposure.txt"

echo -e "${YELLOW}[2.2] Scanning for misconfigurations...${NC}"
nuclei -u "$TARGET" -t ~/nuclei-templates/http/misconfiguration/ -severity high,critical -silent 2>/dev/null \
    | tee -a "$REPORT_DIR/03_exposure.txt"
echo ""

# ============ Phase 3: Authentication Tests ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 3: Authentication & Authorization Tests${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[3.1] Testing authentication bypass...${NC}"
nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-auth-bypass.yaml" -silent 2>/dev/null \
    | tee "$REPORT_DIR/04_auth.txt"

echo -e "${YELLOW}[3.2] Testing rate limiting...${NC}"
nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-rate-limit.yaml" -silent 2>/dev/null \
    | tee -a "$REPORT_DIR/04_auth.txt"

if [ -n "$AUTH_TOKEN" ]; then
    echo -e "${YELLOW}[3.3] Testing privilege escalation (with auth)...${NC}"
    nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-privilege-escalation.yaml" \
        -var viewer_token="$AUTH_TOKEN" -silent 2>/dev/null \
        | tee -a "$REPORT_DIR/04_auth.txt"
fi
echo ""

# ============ Phase 4: IDOR Testing ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 4: IDOR (Insecure Direct Object Reference) Testing${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

if [ -n "$AUTH_TOKEN" ]; then
    echo -e "${YELLOW}[4.1] Testing document IDOR...${NC}"
    nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-idor-documents.yaml" \
        -var auth_token="$AUTH_TOKEN" -silent 2>/dev/null \
        | tee "$REPORT_DIR/05_idor.txt"

    echo -e "${YELLOW}[4.2] Testing credential vault IDOR...${NC}"
    nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-idor-credentials.yaml" \
        -var auth_token="$AUTH_TOKEN" -silent 2>/dev/null \
        | tee -a "$REPORT_DIR/05_idor.txt"

    echo -e "${YELLOW}[4.3] Testing business identifier IDOR...${NC}"
    nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-idor-identifiers.yaml" \
        -var auth_token="$AUTH_TOKEN" -silent 2>/dev/null \
        | tee -a "$REPORT_DIR/05_idor.txt"
else
    echo -e "${RED}[!] Skipping IDOR tests - no auth token provided${NC}"
    echo -e "${YELLOW}    Run with: ./scan-local.sh <auth_token>${NC}"
fi
echo ""

# ============ Phase 5: Injection Testing ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 5: Injection Testing${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

if [ -n "$AUTH_TOKEN" ]; then
    echo -e "${YELLOW}[5.1] Testing SQL injection...${NC}"
    nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-injection.yaml" \
        -var auth_token="$AUTH_TOKEN" -silent 2>/dev/null \
        | tee "$REPORT_DIR/06_injection.txt"

    echo -e "${YELLOW}[5.2] Testing XSS...${NC}"
    nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-xss.yaml" \
        -var auth_token="$AUTH_TOKEN" -silent 2>/dev/null \
        | tee -a "$REPORT_DIR/06_injection.txt"

    echo -e "${YELLOW}[5.3] Testing path traversal...${NC}"
    nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-path-traversal.yaml" \
        -var auth_token="$AUTH_TOKEN" -silent 2>/dev/null \
        | tee -a "$REPORT_DIR/06_injection.txt"
else
    echo -e "${RED}[!] Skipping injection tests - no auth token provided${NC}"
fi
echo ""

# ============ Phase 6: OAuth Security ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 6: OAuth Security Testing${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[6.1] Testing OAuth security...${NC}"
nuclei -u "$TARGET" -t "$TEMPLATES_DIR/m4f-oauth-security.yaml" -silent 2>/dev/null \
    | tee "$REPORT_DIR/07_oauth.txt"
echo ""

# ============ Phase 7: General Vulnerability Scan ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 7: General Vulnerability Scan${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[7.1] Running nuclei vulnerability templates...${NC}"
nuclei -u "$TARGET" -t ~/nuclei-templates/http/vulnerabilities/ \
    -severity critical,high,medium -silent 2>/dev/null \
    | tee "$REPORT_DIR/08_vulns.txt"

echo -e "${YELLOW}[7.2] Running nuclei CVE templates...${NC}"
nuclei -u "$TARGET" -t ~/nuclei-templates/http/cves/ \
    -severity critical,high -silent 2>/dev/null \
    | tee -a "$REPORT_DIR/08_vulns.txt"
echo ""

# ============ Phase 8: Fuzzing ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 8: Endpoint Fuzzing${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}[8.1] Fuzzing for hidden endpoints...${NC}"
ffuf -u "$TARGET/api/FUZZ" -w "$WORDLISTS_DIR/api-endpoints.txt" \
    -mc 200,201,204,301,302,307,401,403,405 -s 2>/dev/null \
    | tee "$REPORT_DIR/09_fuzz.txt"

if [ -n "$AUTH_TOKEN" ]; then
    echo -e "${YELLOW}[8.2] Fuzzing with authentication...${NC}"
    ffuf -u "$TARGET/api/FUZZ" -w "$WORDLISTS_DIR/api-endpoints.txt" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -mc 200,201,204 -s 2>/dev/null \
        | tee -a "$REPORT_DIR/09_fuzz.txt"
fi
echo ""

# ============ Generate Summary Report ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Generating Summary Report${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

SUMMARY_FILE="$REPORT_DIR/SUMMARY.md"

cat > "$SUMMARY_FILE" << EOF
# Made4Founders Security Scan Report

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Target:** $TARGET
**Scanner:** Made4Founders Security Scanner v1.0

---

## Executive Summary

| Category | Findings |
|----------|----------|
| Endpoints Discovered | $(wc -l < "$REPORT_DIR/01_endpoints.txt" 2>/dev/null || echo "0") |
| Exposure Issues | $(wc -l < "$REPORT_DIR/03_exposure.txt" 2>/dev/null || echo "0") |
| Auth Issues | $(wc -l < "$REPORT_DIR/04_auth.txt" 2>/dev/null || echo "0") |
| IDOR Issues | $(wc -l < "$REPORT_DIR/05_idor.txt" 2>/dev/null || echo "0") |
| Injection Issues | $(wc -l < "$REPORT_DIR/06_injection.txt" 2>/dev/null || echo "0") |
| OAuth Issues | $(wc -l < "$REPORT_DIR/07_oauth.txt" 2>/dev/null || echo "0") |
| General Vulnerabilities | $(wc -l < "$REPORT_DIR/08_vulns.txt" 2>/dev/null || echo "0") |

---

## Detailed Findings

### Technologies Detected
\`\`\`
$(cat "$REPORT_DIR/02_technologies.txt" 2>/dev/null || echo "No technologies detected")
\`\`\`

### Exposure Issues
\`\`\`
$(cat "$REPORT_DIR/03_exposure.txt" 2>/dev/null || echo "No exposure issues found")
\`\`\`

### Authentication Issues
\`\`\`
$(cat "$REPORT_DIR/04_auth.txt" 2>/dev/null || echo "No auth issues found")
\`\`\`

### IDOR Issues
\`\`\`
$(cat "$REPORT_DIR/05_idor.txt" 2>/dev/null || echo "No IDOR issues found (or test skipped)")
\`\`\`

### Injection Issues
\`\`\`
$(cat "$REPORT_DIR/06_injection.txt" 2>/dev/null || echo "No injection issues found (or test skipped)")
\`\`\`

### OAuth Issues
\`\`\`
$(cat "$REPORT_DIR/07_oauth.txt" 2>/dev/null || echo "No OAuth issues found")
\`\`\`

### General Vulnerabilities
\`\`\`
$(cat "$REPORT_DIR/08_vulns.txt" 2>/dev/null || echo "No vulnerabilities found")
\`\`\`

---

## Recommendations

1. Review all findings in the detailed reports above
2. Prioritize critical and high severity issues
3. Verify each finding manually before remediation
4. Re-run scan after fixes to confirm remediation

---

*Generated by Made4Founders Security Scanner*
EOF

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    SCAN COMPLETE                              ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Summary Report:${NC} $SUMMARY_FILE"
echo -e "${BLUE}All Reports:${NC} $REPORT_DIR/"
echo ""

# Count findings
TOTAL_FINDINGS=0
for f in "$REPORT_DIR"/*.txt; do
    if [ -f "$f" ]; then
        COUNT=$(wc -l < "$f")
        TOTAL_FINDINGS=$((TOTAL_FINDINGS + COUNT))
    fi
done

if [ $TOTAL_FINDINGS -gt 0 ]; then
    echo -e "${RED}[!] Total findings: $TOTAL_FINDINGS${NC}"
    echo -e "${YELLOW}    Review the summary report for details${NC}"
else
    echo -e "${GREEN}[✓] No vulnerabilities detected${NC}"
fi
