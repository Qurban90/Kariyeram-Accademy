#!/usr/bin/env bash
# Tətbiq build-i üçün ictimai dəyişənlər: Supabase URL və anon açar (anon açar ictimaidir, RLS qoruyur).
# Açar Management API-dən götürülür ki, əl ilə köçürmək lazım olmasın. Sirlər yoxdursa placeholder yazılır
# (yalnız "yığılırmı" yoxlaması üçün; belə build serverə qoşula bilməz).
set -euo pipefail
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" && -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  KEY=$(curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const k=JSON.parse(s).find(x=>x.name==="anon");if(!k){console.error("anon açar tapılmadı");process.exit(1)}process.stdout.write(k.api_key)})')
  echo "::add-mask::$KEY"
  { echo "EXPO_PUBLIC_SUPABASE_URL=https://$SUPABASE_PROJECT_REF.supabase.co"; echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=$KEY"; echo "KARYERAM_REAL_BACKEND=1"; } >> "$GITHUB_ENV"
  echo "Real server ünvanı ilə yığılır."
else
  { echo "EXPO_PUBLIC_SUPABASE_URL=https://example.invalid"; echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder"; echo "KARYERAM_REAL_BACKEND=0"; } >> "$GITHUB_ENV"
  echo "::warning::Supabase sirləri yoxdur: placeholder ünvanla yığılır (yalnız yığım yoxlaması)."
fi
