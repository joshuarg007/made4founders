#!/bin/bash
#
# Get authentication token for scanning
#
# Usage: ./get-auth-token.sh [email] [password] [target_url]
#

TARGET="${3:-http://localhost:8001}"
EMAIL="${1:-demo@made4founders.com}"
PASSWORD="${2:-Demo2024!}"

echo "Getting auth token from $TARGET..."

RESPONSE=$(curl -s -X POST "$TARGET/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$RESPONSE" | grep -oP '"access_token":"\K[^"]+')

if [ -n "$TOKEN" ]; then
    echo ""
    echo "Auth Token:"
    echo "$TOKEN"
    echo ""
    echo "Use with scanner:"
    echo "./scan-local.sh $TOKEN"
else
    echo "Failed to get token. Response:"
    echo "$RESPONSE"
    exit 1
fi
