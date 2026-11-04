# İstehsala çıxış (runbook)

Status: **heç vaxt istehsala deploy edilməyib.** Aşağıdakı addımlar Supabase və LiveKit sənədlərinə əsaslanan plandır; ilk deploy zamanı yoxlanıb düzəldilməlidir.

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
   - Telefon: provayder (Twilio/Vonage/MessageBird...), şablon `Karyeram Academy giriş kodu: {{ .Code }}`. **Test OTP nömrələri istehsalda olmamalıdır.**
   - Rate limitlər: SMS və e-poçt üçün saatlıq limitləri büdcəyə görə təyin edin.
   - Staff hesabları üçün MFA (plan).
4. Realtime: `live_chat` nəşrə migrasiya ilə əlavə olunur; panelədə yoxlayın.

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

## 6. Geri qaytarma

- Funksiyalar: əvvəlki commit-dən yenidən deploy.
- DB: migrasiyalar irəli yazılır; geri qaytarmaq üçün yeni düzəliş migrasiyası. Riskli dəyişiklikdən əvvəl backup/PITR nöqtəsi.
