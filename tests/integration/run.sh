#!/usr/bin/env bash
# Lokal Supabase (+ LiveKit dev) ilə end-to-end testlər. Əvvəlcə: npx supabase start, functions serve.
set -euo pipefail
eval "$(npx supabase status -o env 2>/dev/null | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_KEY="$SERVICE_ROLE_KEY" SUPABASE_DB_URL="$DB_URL" MAILPIT="$MAILPIT_URL"
export LIVEKIT_HTTP="${LIVEKIT_HTTP:-http://127.0.0.1:7880}" LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-devkey}" LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-secret}"
npx vitest run -c vitest.integration.config.ts "$@"
