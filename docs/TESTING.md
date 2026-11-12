# Testlər

Nəticələr uydurulmur: aşağıdakı rəqəmlər son işə salınmanın çıxışıdır (2026-11-12, bu repoda, lokal mühitdə; yük testi 2026-11-04).

| Qat | Əmr | Nəyi yoxlayır | Son nəticə |
| --- | --- | --- | --- |
| Vahid (Vitest) | `npm test` | Alqoritmlər, API handler-ləri, router validasiyası, JWT/LiveKit/webhook, IDOR, telefon, canlı zal modeli, sual idxalı (CSV), medallar | 104/104 keçdi (19 fayl) |
| Tip yoxlaması | `npm run typecheck` | `packages/core` və `apps/app` (native fayllar daxil) | Xətasız |
| DB (psql) | `npm run db:test` | Sxem, RLS, bütün RPC-lər, limitlər, canlı dərs qaydaları, silinmə | 12 fayl, hamısı keçdi (277 yoxlama) |
| İnteqrasiya | `npm run test:int` | Real Supabase (GoTrue, PostgREST, Edge Runtime), real LiveKit, Mailpit | 11/11 keçdi |
| Veb E2E (Playwright) | `npm run test:e2e` | Build olunmuş tətbiq brauzerdə, real stekə qarşı: telefon OTP, razılıq, test, gündəlik, kabinet, şərəf lövhəsi, yarımçıq testə qayıtma, 3D dəhliz (WebGL, qapıdan otağa keçid), 3D sinif (müəllimin uzaq videosu lövhədə, əl qaldıran avatar), konspekt şkafı (mətn + PDF, imzalı URL, imzasız giriş rədd), ikinci giriş üsulu (e-poçt bağlama və onunla giriş), müəllim otağı (dərc, kod yaratma və ləğvi, gündəliyə qiymət, sual analizi, davamiyyət, bütün cihazlardan çıxış → tələbədə aktivləşmə), canlı zal (müəllim + tələbə), Realtime chat, hesab silmə | 31/31 addım keçdi |
| Native (iOS/Android) | — | — | **İşə salınmayıb** (bu mühitdə SDK yoxdur) |
| Yük testi (lokal) | `node tests/load/load.mjs` | Real axın, 20–150 virtual tələbə | 100 tələbə: 100/100; 150 eyni anda: 100/150 (bax PERFORMANCE.md) |

## Lokal stek

Tələblər: Docker, Node 22, `psql`.

```bash
npm install
```

```bash
npx supabase start -x studio,logflare,vector,imgproxy,supavisor,postgres-meta
```

Bəzi şəbəkələrdə Supabase obrazları ECR-dən yüklənmir; onda `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` əlavə edin. Lokal Twilio konfiqurasiyası üçün `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN=local-dummy` təyin edin (SMS göndərilmir; test nömrələri `config.toml`-dakı `test_otp`-dədir: `+994500000001..3`, kod `123456`).

LiveKit dev serveri:

```bash
docker run -d --name lk --network supabase_network_karyeram -p 7880:7880 livekit/livekit-server:v1.9.11 --dev --bind 0.0.0.0
```

Funksiyalar (`supabase/functions/.env.local` faylı gitignore-dadır, nümunə aşağıda):

```bash
npx supabase functions serve --env-file supabase/functions/.env.local
```

```
LIVEKIT_URL=http://lk:7880
LIVEKIT_PUBLIC_URL=ws://127.0.0.1:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
APP_ORIGINS=
# Lokal testlər üçün: app_config keşi 1 saniyə (istehsalda təyin etməyin, defolt 30 s)
APP_CONFIG_TTL_MS=1000
```

Demo məzmun (`[DEMO]` etiketli, real bank deyil) `supabase db reset` zamanı `supabase/seed.sql`-dən yüklənir.

## Tətbiqi lokal açmaq

`apps/app/.env` (gitignore-dadır):

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase status çıxışındakı anon açar>
```

```bash
cd apps/app && npx expo start --web
```

Proksi `api.expo.dev`-i bloklayırsa: `EXPO_OFFLINE=1`.

## CI

`.github/workflows/ci.yml`: `npm ci`, tip yoxlaması, vahid testlər, DB testləri (Postgres 16 servisi), veb build, gitleaks. İnteqrasiya və E2E testləri Docker stek tələb etdiyi üçün CI-də **yoxdur** (plan: ayrıca workflow).

## Qeyd: dəyişkən nəticə

Lokal Supabase yenidən başladılandan dərhal sonra bir dəfə canlı zal addımı Realtime abunəsi gecikdiyi üçün uğursuz oldu; konteyner tam qalxandan sonra ardıcıl işə salmalarda keçdi. İstehsalda Realtime soyuq başlanğıcı ayrıca izlənməlidir.
