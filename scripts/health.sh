#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080}"
EMAIL="demo+$(date +%s)@example.com"
PASS="Password123!"

say() { echo -e "\033[1;34m$*\033[0m"; }

say "1) Register"
curl -sS -X POST "$API_BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -i | tee /tmp/resp.txt >/dev/null

COOKIE=$(grep -i '^set-cookie:' /tmp/resp.txt | sed -E 's/.*(sid=[^;]+).*/\1/I' | tr -d '\r')

say "2) Login"
LOGIN=$(curl -sS -X POST "$API_BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -i)
COOKIE=$(printf "%s\n%s" "$COOKIE" "$LOGIN" | grep -i '^set-cookie:' | sed -E 's/.*(sid=[^;]+).*/\1/I' | head -n1)

say "3) Me"
curl -sS "$API_BASE/auth/me" -H "Cookie: $COOKIE" | jq . || true

say "4) Get profile (may be null)"
curl -sS "$API_BASE/me/patient" -H "Cookie: $COOKIE" | jq . || true

say "5) Update profile"
curl -sS -X PUT "$API_BASE/me/patient" -H 'Content-Type: application/json' -H "Cookie: $COOKIE" \
  -d '{"first_name":"Demo","last_name":"User","sex":"other"}' | jq . || true

say "6) Chat send (tool)"
curl -sS -X POST "$API_BASE/chat/send" -H 'Content-Type: application/json' -H "Cookie: $COOKIE" \
  -d '{"message":"hello","args":{}}' | jq . || true

say "✅ Smoke test finished"
