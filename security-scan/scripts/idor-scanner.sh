#!/bin/bash
#
# Made4Founders IDOR Scanner
# Tests for Insecure Direct Object Reference vulnerabilities
#
# Usage: ./idor-scanner.sh <auth_token> [target_url]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

AUTH_TOKEN="$1"
TARGET="${2:-http://localhost:8001}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCAN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$SCAN_DIR/reports/idor_$(date +%Y%m%d_%H%M%S)"

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}Usage: $0 <auth_token> [target_url]${NC}"
    echo "Get token with: ./get-auth-token.sh"
    exit 1
fi

mkdir -p "$REPORT_DIR"

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Made4Founders IDOR Scanner                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get current user's organization ID first
echo -e "${YELLOW}[*] Getting current user info...${NC}"
USER_INFO=$(curl -s "$TARGET/api/auth/me" -H "Authorization: Bearer $AUTH_TOKEN")
CURRENT_ORG=$(echo "$USER_INFO" | grep -oP '"organization_id":\K[0-9]+' | head -1)
echo "Current organization ID: $CURRENT_ORG"
echo ""

# IDOR Test function
test_idor() {
    local ENDPOINT="$1"
    local NAME="$2"
    local MAX_ID="${3:-100}"

    echo -e "${YELLOW}[*] Testing $NAME IDOR...${NC}"
    echo "=== $NAME IDOR Test ===" >> "$REPORT_DIR/idor_results.txt"

    for id in $(seq 1 $MAX_ID); do
        RESPONSE=$(curl -s -w "\n%{http_code}" "$TARGET$ENDPOINT$id" \
            -H "Authorization: Bearer $AUTH_TOKEN")

        STATUS=$(echo "$RESPONSE" | tail -1)
        BODY=$(echo "$RESPONSE" | sed '$d')

        if [ "$STATUS" = "200" ]; then
            # Check if organization_id matches
            RESP_ORG=$(echo "$BODY" | grep -oP '"organization_id":\K[0-9]+' | head -1)

            if [ -n "$RESP_ORG" ] && [ "$RESP_ORG" != "$CURRENT_ORG" ]; then
                echo -e "${RED}[VULN] $ENDPOINT$id - Cross-org access! (org $RESP_ORG vs $CURRENT_ORG)${NC}"
                echo "[VULNERABLE] $ENDPOINT$id - Accessed org $RESP_ORG (current: $CURRENT_ORG)" >> "$REPORT_DIR/idor_results.txt"
            else
                echo "[OK] $ENDPOINT$id" >> "$REPORT_DIR/idor_results.txt"
            fi
        elif [ "$STATUS" = "404" ]; then
            # Expected for non-existent IDs
            :
        else
            echo "[STATUS $STATUS] $ENDPOINT$id" >> "$REPORT_DIR/idor_results.txt"
        fi
    done
    echo ""
}

# Test critical endpoints
test_idor "/api/documents/" "Documents" 50
test_idor "/api/credentials/" "Credentials" 50
test_idor "/api/business-identifiers/" "Business Identifiers" 50
test_idor "/api/contacts/" "Contacts" 50
test_idor "/api/tasks/" "Tasks" 50
test_idor "/api/boards/" "Task Boards" 20
test_idor "/api/services/" "Services" 50
test_idor "/api/deadlines/" "Deadlines" 50
test_idor "/api/marketplaces/" "Marketplaces" 20
test_idor "/api/products-offered/" "Products Offered" 30
test_idor "/api/products-used/" "Products Used" 30

# Summary
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}IDOR Scan Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"

VULN_COUNT=$(grep -c "VULNERABLE" "$REPORT_DIR/idor_results.txt" 2>/dev/null || echo "0")

if [ "$VULN_COUNT" -gt 0 ]; then
    echo -e "${RED}[!] Found $VULN_COUNT IDOR vulnerabilities!${NC}"
    echo ""
    grep "VULNERABLE" "$REPORT_DIR/idor_results.txt"
else
    echo -e "${GREEN}[✓] No IDOR vulnerabilities found${NC}"
fi

echo ""
echo "Full results: $REPORT_DIR/idor_results.txt"
