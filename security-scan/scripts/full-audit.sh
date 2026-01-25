#!/bin/bash
#
# Made4Founders Full Security Audit
# Runs all security scans comprehensively
#
# Usage: ./full-audit.sh [local|production]
#

set -e

MODE="${1:-local}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCAN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCRIPTS_DIR="$SCAN_DIR/scripts"
AUDIT_DIR="$SCAN_DIR/reports/full_audit_$(date +%Y%m%d_%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "$AUDIT_DIR"

echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   __  __           _      _  _   _____                     _              ║
║  |  \/  | __ _  __| | ___| || | |  ___|__  _   _ _ __   __| | ___ _ __ ___ ║
║  | |\/| |/ _` |/ _` |/ _ \ || |_| |_ / _ \| | | | '_ \ / _` |/ _ \ '__/ __|║
║  | |  | | (_| | (_| |  __/__   _|  _| (_) | |_| | | | | (_| |  __/ |  \__ \║
║  |_|  |_|\__,_|\__,_|\___|  |_| |_|  \___/ \__,_|_| |_|\__,_|\___|_|  |___/║
║                                                                           ║
║                    COMPREHENSIVE SECURITY AUDIT                           ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}Mode:${NC} $MODE"
echo -e "${BLUE}Output:${NC} $AUDIT_DIR"
echo ""

# ============ Pre-flight Checks ============
echo -e "${YELLOW}[*] Pre-flight checks...${NC}"

# Check tools
for tool in nuclei httpx ffuf curl; do
    if ! command -v $tool &> /dev/null; then
        echo -e "${RED}[!] $tool not found. Please install it first.${NC}"
        exit 1
    fi
done
echo -e "${GREEN}[✓] All tools available${NC}"

if [ "$MODE" = "local" ]; then
    TARGET="http://localhost:8001"

    # Check backend
    if ! curl -s "$TARGET/api/health" > /dev/null 2>&1; then
        echo -e "${RED}[!] Backend not running at $TARGET${NC}"
        echo -e "${YELLOW}    Start with: cd backend && uvicorn app.main:app --port 8001${NC}"
        exit 1
    fi
    echo -e "${GREEN}[✓] Backend running${NC}"

    # Get auth token
    echo -e "${YELLOW}[*] Getting auth token...${NC}"
    AUTH_TOKEN=$("$SCRIPTS_DIR/get-auth-token.sh" 2>/dev/null | grep -A1 "Auth Token:" | tail -1)

    if [ -z "$AUTH_TOKEN" ]; then
        echo -e "${YELLOW}[!] Could not get auth token. Some tests will be skipped.${NC}"
    else
        echo -e "${GREEN}[✓] Auth token obtained${NC}"
    fi
else
    TARGET="https://made4founders.com"
    AUTH_TOKEN=""
fi
echo ""

# ============ Phase 1: Static Analysis ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 1: Static Code Analysis${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

if [ "$MODE" = "local" ]; then
    BACKEND_DIR="$(cd "$SCAN_DIR/.." && pwd)/backend"

    echo -e "${YELLOW}[1.1] Running bandit (Python security linter)...${NC}"
    if command -v bandit &> /dev/null; then
        bandit -r "$BACKEND_DIR/app" -f txt -o "$AUDIT_DIR/01_bandit.txt" 2>/dev/null || true
        echo -e "${GREEN}[✓] Bandit scan complete${NC}"
    else
        echo -e "${YELLOW}[!] bandit not installed, skipping${NC}"
    fi

    echo -e "${YELLOW}[1.2] Checking for hardcoded secrets...${NC}"
    grep -rn "password\s*=\s*['\"][^'\"]*['\"]" "$BACKEND_DIR/app" 2>/dev/null \
        | grep -v "__pycache__" \
        | grep -v "test" \
        | tee "$AUDIT_DIR/02_secrets.txt" || true

    grep -rn "secret_key\s*=\s*['\"][^'\"]*['\"]" "$BACKEND_DIR/app" 2>/dev/null \
        | grep -v "__pycache__" \
        | tee -a "$AUDIT_DIR/02_secrets.txt" || true

    grep -rn "api_key\s*=\s*['\"][^'\"]*['\"]" "$BACKEND_DIR/app" 2>/dev/null \
        | grep -v "__pycache__" \
        | tee -a "$AUDIT_DIR/02_secrets.txt" || true

    echo -e "${GREEN}[✓] Secret scan complete${NC}"

    echo -e "${YELLOW}[1.3] Checking for dangerous functions...${NC}"
    grep -rn "eval\|exec\|pickle\|yaml.load\|subprocess.call.*shell=True" "$BACKEND_DIR/app" 2>/dev/null \
        | grep -v "__pycache__" \
        | tee "$AUDIT_DIR/03_dangerous.txt" || true
    echo -e "${GREEN}[✓] Dangerous function scan complete${NC}"
fi
echo ""

# ============ Phase 2: Dynamic Scanning ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Phase 2: Dynamic Security Scanning${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

if [ "$MODE" = "local" ]; then
    "$SCRIPTS_DIR/scan-local.sh" "$AUTH_TOKEN" 2>&1 | tee "$AUDIT_DIR/04_dynamic_scan.log"
else
    "$SCRIPTS_DIR/scan-production.sh" 2>&1 | tee "$AUDIT_DIR/04_dynamic_scan.log"
fi
echo ""

# ============ Phase 3: IDOR Testing ============
if [ "$MODE" = "local" ] && [ -n "$AUTH_TOKEN" ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Phase 3: IDOR Testing${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

    "$SCRIPTS_DIR/idor-scanner.sh" "$AUTH_TOKEN" "$TARGET" 2>&1 | tee "$AUDIT_DIR/05_idor.log"
    echo ""
fi

# ============ Phase 4: Pytest Security Tests ============
if [ "$MODE" = "local" ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Phase 4: Running Security Test Suite${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

    BACKEND_DIR="$(cd "$SCAN_DIR/.." && pwd)/backend"
    cd "$BACKEND_DIR"

    echo -e "${YELLOW}[*] Running pytest security tests...${NC}"
    source venv/bin/activate 2>/dev/null || true

    python -m pytest tests/test_auth.py tests/test_authorization.py \
        tests/test_injection.py tests/test_vault.py \
        -v --tb=short 2>&1 | tee "$AUDIT_DIR/06_pytest.log"

    cd - > /dev/null
    echo ""
fi

# ============ Generate Final Report ============
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Generating Final Audit Report${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

cat > "$AUDIT_DIR/FULL_AUDIT_REPORT.md" << EOF
# Made4Founders Full Security Audit Report

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Mode:** $MODE
**Target:** $TARGET

---

## Executive Summary

This report contains the results of a comprehensive security audit of the
Made4Founders application, including:

1. Static code analysis
2. Dynamic security scanning
3. IDOR vulnerability testing
4. Automated security test suite

---

## Phase 1: Static Analysis

### Bandit Results (Python Security Linter)
\`\`\`
$(head -100 "$AUDIT_DIR/01_bandit.txt" 2>/dev/null || echo "Not available")
\`\`\`

### Hardcoded Secrets Check
\`\`\`
$(cat "$AUDIT_DIR/02_secrets.txt" 2>/dev/null || echo "No hardcoded secrets found")
\`\`\`

### Dangerous Functions
\`\`\`
$(cat "$AUDIT_DIR/03_dangerous.txt" 2>/dev/null || echo "No dangerous functions found")
\`\`\`

---

## Phase 2: Dynamic Scanning

See: \`04_dynamic_scan.log\` for full output.

---

## Phase 3: IDOR Testing

See: \`05_idor.log\` for full output.

---

## Phase 4: Security Test Suite

See: \`06_pytest.log\` for full output.

### Test Summary
\`\`\`
$(grep -E "passed|failed|error" "$AUDIT_DIR/06_pytest.log" 2>/dev/null | tail -5 || echo "Not available")
\`\`\`

---

## Recommendations

1. Address any CRITICAL or HIGH severity findings immediately
2. Review MEDIUM severity findings within 1 week
3. Plan remediation for LOW severity findings
4. Re-run this audit after fixes are applied

---

## Files in This Audit

$(ls -la "$AUDIT_DIR" | tail -n +4)

---

*Generated by Made4Founders Security Audit Suite*
EOF

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  FULL AUDIT COMPLETE                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Audit Report:${NC} $AUDIT_DIR/FULL_AUDIT_REPORT.md"
echo -e "${BLUE}All Files:${NC} $AUDIT_DIR/"
echo ""

# Quick summary
echo -e "${YELLOW}Quick Summary:${NC}"
[ -f "$AUDIT_DIR/01_bandit.txt" ] && echo "  - Bandit issues: $(grep -c "Issue:" "$AUDIT_DIR/01_bandit.txt" 2>/dev/null || echo "0")"
[ -f "$AUDIT_DIR/02_secrets.txt" ] && echo "  - Potential secrets: $(wc -l < "$AUDIT_DIR/02_secrets.txt" 2>/dev/null || echo "0")"
[ -f "$AUDIT_DIR/06_pytest.log" ] && echo "  - Test results: $(grep -oP '\d+ passed' "$AUDIT_DIR/06_pytest.log" 2>/dev/null || echo "N/A")"
