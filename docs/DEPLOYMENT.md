# İstehsala çıxış (runbook)

Status: **heç vaxt istehsala deploy edilməyib.** Aşağıdakı addımlar Supabase və LiveKit sənədlərinə əsaslanan plandır; ilk deploy zamanı yoxlanıb düzəldilməlidir.

## Pilot (mağazasız sınaq): GitHub Actions ilə

Pilot üçün pulsuz planlar kifayətdir: Supabase Free, LiveKit Cloud pulsuz plan, GitHub Pages, GitHub Actions. Giriş yalnız e-poçtladır (SMS provayderi qoşulana qədər). Deploy sirləri GitHub-da saxlanılır (Settings → Secrets and variables → Actions), çata və repoya yazılmır.

| Sirr (Secrets) | Haradan | Məcburi |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens | bəli |
| `SUPABASE_PROJECT_REF` | Layihə ünvanındakı kod (Settings → General → Project ID) | bəli |
| `SUPABASE_DB_PASSWORD` | Layihə yaradılanda təyin olunan baza parolu | bəli |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER` | E-poçt göndərən hesab (məs. Gmail: `smtp.gmail.com`, `587`, ünvan, tətbiq parolu, ünvan) | tələbələrə kod getməsi üçün bəli |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | cloud.livekit.io → Settings → Keys | canlı dərs üçün |

| Dəyişən (Variables) | Dəyər |
| --- | --- |
| `APP_ORIGINS` | Veb tətbiqin ünvanı, məs. `https://qurban90.github.io` (CORS) |
| `AUTH_METHODS` | Defolt `email`; SMS qoşulanda `phone,email` |

İş axınları (Actions bölməsində əl ilə işə salınır):

1. **Server deploy (Supabase)**: migrasiyalar, `supabase/prod/base.sql` (fənlər, məkanlar), Auth ayarları (`.github/scripts/auth-config.mjs`: OTP şablonları, TOTP, SMTP), funksiya sirləri, funksiyalar. `supabase config push` qəsdən işlədilmir: `config.toml` lokal mühit üçündür və test OTP nömrələri var.
2. **Veb deploy (GitHub Pages)**: veb tətbiq `https://<istifadəçi>.github.io/<repo>/` ünvanında.
3. **Android APK**: quraşdırıla bilən APK, "pilot" buraxılışına (Releases) əlavə olunur.

İlk admin: admin tətbiqə bir dəfə daxil olandan sonra Supabase paneli → SQL Editor:
`update public.profiles set role = 'admin' where id = (select id from auth.users where email = '<e-poçt>');`

LiveKit webhook (davamiyyət üçün): LiveKit paneli → Settings → Webhooks → `https://<ref>.supabase.co/functions/v1/livekit-webhook`.

Məzmun (suallar, konspektlər) repoya yazılmır: `npm run import:questions` ilə birbaşa bazaya və ya Müəllim otağından yüklənir.

## 0. Buraxılış bloklayıcıları

- [ ] Hüquqşünasın yazdığı istifadə şərtləri və məxfilik siyasəti (`legal_documents`-ə yeni versiya kimi). Risk R-02.
- [ ] Məlumat saxlanma yeri barədə qərar → Supabase regionu. Risk R-03.
- [ ] SMS provayderi (hesab, göndərən adı, büdcə). Risk R-05.
- [ ] Native build-lər real cihazlarda yoxlanılıb (ekran qoruması, LiveKit, SecureStore). Risk R-04.

## 1. Supabase layihəsi

1. Layihə yaradın (region qərarı ilə). Plan: Pro (gündəlik backup, PITR istəyə görə).
2. Lokal repoda:

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

`seed.sql` istehsala **yüklənmir** (yalnız `db reset` zamanı).

3. Auth ayarları (panel → Authentication):
   - E-poçt: OTP uzunluğu 6, şablonlar `supabase/templates/otp.html` ilə eyni (`{{ .Token }}`), xüsusi SMTP (göndərən domeni SPF/DKIM ilə).
   - Telefon: provayder (Twilio/Vonage/MessageBird...), şablon `Karyeram Accademy giriş kodu: {{ .Code }}`. **Test OTP nömrələri istehsalda olmamalıdır.**
   - Rate limitlər: SMS və e-poçt üçün saatlıq limitləri büdcəyə görə təyin edin.
   - **MFA (TOTP)**: Authentication → Multi-Factor → TOTP: enroll və verify **aktiv** (lokalda `supabase/config.toml` `[auth.mfa.totp]`). Admin otağı MFA olmadan açılmır.
4. Realtime: `live_chat` nəşrə migrasiya ilə əlavə olunur; panelədə yoxlayın.
5. İlk admin (yalnız SQL ilə, API admin təyin etmir): panel → SQL Editor:
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = '<e-poçt>');`
   Sonra admin tətbiqdə Kabinet → İki mərhələli qoruma (hesabda e-poçt olmalıdır). Telefon itərsə: `delete from auth.mfa_factors where user_id = '<id>';` (yalnız şəxsiyyət yoxlanandan sonra, audit üçün qeyd edin).
6. pg_cron: migrasiya `karyeram-cleanup` işini planlayır (`select * from cron.job;` ilə yoxlayın). Panelda Integrations → Cron aktiv olmalıdır.
7. Hər yeni mağaza buraxılışında: köhnə versiyalar artıq işləməməlidirsə, Admin otağı → Tətbiq → minimum versiya. `APP_CONFIG_TTL_MS` istehsalda **təyin etməyin** (defolt 30 s).

## 2. Sirlər və funksiyalar

```bash
npx supabase secrets set LIVEKIT_URL=https://<layihə>.livekit.cloud LIVEKIT_PUBLIC_URL=wss://<layihə>.livekit.cloud LIVEKIT_API_KEY=<key> LIVEKIT_API_SECRET=<secret> APP_ORIGINS=https://app.<domen>
```

```bash
npx supabase functions deploy api
```

```bash
npx supabase functions deploy livekit-webhook --no-verify-jwt
```

`APP_ORIGINS` boş qalarsa CORS `*` olur (risk R-08) — istehsalda mütləq təyin edin.
İlk deploy-da yoxlanmalı: funksiyaların `packages/core` və `_vendor/ts-fsrs`-i düzgün paketləməsi (`deno.json` importları).

## 3. LiveKit

1. LiveKit Cloud layihəsi (və ya öz server: TURN/TLS ilə).
2. Webhook: `https://<ref>.supabase.co/functions/v1/livekit-webhook`, imza açarı = API key.
3. Otaqların boş qalma vaxtı (empty timeout) və maksimum iştirakçı limitləri.

## 4. Tətbiq

```bash
cd apps/app && npx eas build --profile production --platform all
```

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` EAS mühit dəyişənləri kimi.
- iOS: kamera və mikrofon izah mətnləri `app.json`-dadır. Ekran paylaşma native-də yoxdur.
- Veb: `npx expo export --platform web` → statik hostinq (SPA fallback `index.html`), domen `APP_ORIGINS`-də.
- Mağaza: hesab silmə tətbiq daxilindədir (Apple tələbi), məxfilik anketləri (toplanan məlumat: ad, telefon/e-poçt, test nəticələri).

## 5. Deploydan sonra yoxlama

- [ ] Telefon və e-poçt ilə qeydiyyat, razılıq, test, nəticə.
- [ ] `questions` cədvəli anon/authenticated REST ilə `[]` qaytarır.
- [ ] Canlı dərs: müəllim + 2 tələbə, əl qaldırma, söz vermə, bitirmə; webhook davamiyyəti yazır.
- [ ] Funksiya loglarında `api_crash` yoxdur.
- [ ] `select * from cron.job` → `karyeram-cleanup` var; ertəsi gün `cron.job_run_details`-də uğurlu.
- [ ] Admin otağı açılır (admin hesabı ilə), texniki iş rejimi aç/bağla işləyir.

## 6. Geri qaytarma

- Funksiyalar: əvvəlki commit-dən yenidən deploy.
- DB: migrasiyalar irəli yazılır; geri qaytarmaq üçün yeni düzəliş migrasiyası. Riskli dəyişiklikdən əvvəl backup/PITR nöqtəsi.
