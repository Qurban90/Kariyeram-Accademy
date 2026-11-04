# ADR 0002: Supabase

Status: Qəbul edildi · 2026-11-03

## Kontekst
Kiçik komanda, idarə olunan backend lazımdır: Auth (telefon + e-poçt OTP), Postgres, sətir səviyyəsində təhlükəsizlik, server funksiyaları, realtime.

## Qərar
Supabase: GoTrue Auth, Postgres 17 + RLS, Edge Functions (Deno), Realtime. Biznes qaydaları SQL RPC-lərdə (`security definer`), yalnız `service_role` icra edir; Edge API JWT-ni yoxlayıb onları çağırır.

## Alternativlər
Firebase (NoSQL, mürəkkəb icazə qaydaları sual bankı üçün zəif), öz Node backend (daha çox əməliyyat yükü).

## Nəticələr
- Qaydalar DB-də testlə yoxlanılır (psql testləri).
- Edge runtime npm paketlərini proksi arxasında yükləyə bilmədiyi üçün `ts-fsrs` vendor edilib (`supabase/functions/_vendor`).
- Vendor kilidi: miqrasiya mümkündür (standart Postgres), amma Auth və Realtime əvəz edilməlidir.
