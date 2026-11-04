#!/usr/bin/env bash
# Veb E2E: lokal Supabase (supabase start), functions serve və LiveKit dev serveri işləməlidir. Bax: docs/TESTING.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|DB_URL)=')"
export DB_URL
printf "EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_ANON_KEY=%s\n" "$API_URL" "$ANON_KEY" > apps/app/.env
if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  (cd apps/app && EXPO_OFFLINE=1 npx expo export --platform web --output-dir dist >/dev/null)
fi
node tests/e2e/web.e2e.mjs
