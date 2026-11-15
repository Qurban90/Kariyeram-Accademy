# Karyeram Accademy: layihə qaydaları

Azərbaycan dilində virtual məktəb (dövlət qulluğu və magistratura hazırlığı). Telefon və veb. İki rejim: özünü öyrənmə otaqları (test, səhvlər, FSRS təkrar, gündəlik, konspekt) və oxu zalı (LiveKit ilə canlı dərs).

Cari vəziyyət, növbəti işlər və açıq problemlər: `docs/AI_HANDOFF.md`. İşə başlamazdan əvvəl onu oxu, işi bitirəndə yenilə.

## Sahib ilə ünsiyyət

- Sahib (Qurban) texniki mütəxəssis deyil. Onunla Azərbaycan dilində, qısa və sadə danış; texniki sözü bir cümlə ilə izah et.
- Nəticəni uydurma: test keçibsə rəqəmi yaz, keçməyibsə çıxışı göstər, işə salmadığını "işə salınmayıb" yaz.
- `main`-ə push, force push, budaq silmək, PR açmaq, GitHub-da şərh yazmaq üçün əvvəlcə soruş. İş budağı: `karyeram/foundation`.
- Commit mesajları Azərbaycan dilində, kiçik və məntiqi commit-lər.

## Pozulmayan məhdudiyyətlər

1. **Repo açıqdır (public).** Real sual bankı, konspekt və hər hansı sirr (`.env`, açar, token, parol) heç vaxt repoya yazılmır. `/content/` və `supabase/seed.private.sql` `.gitignore`-dadır. Repodakı demo məzmun `[DEMO]` ilə başlayır.
2. **Suallar və cavab açarları klientə birbaşa getmir.** `questions` cədvəli RLS ilə bağlıdır; tələbə sualı yalnız Edge API-dən alır, düzgün cavab yalnız cavab verildikdən sonra qayıdır (ADR-0003). Bunu zəiflədən dəyişiklik etmə.
3. **Klientdə yalnız anon açar.** `service_role` yalnız Edge Functions-dadır. İcazə yoxlamaları serverdədir (RLS + RPC), klient yalnız göstərir.
4. **Testi atlamaqla "yaşıl" etmə.** Test düşürsə səbəbini tap.
5. **Arxitekturanı yenidən qurma.** Yeni böyük qərar üçün əvvəlcə sahibdən soruş və `docs/adr/`-a ADR yaz.

## Quruluş

| Yer | Nədir |
| --- | --- |
| `apps/app` | Expo tətbiqi (React Native + veb, expo-router). Ekranlar `app/`, ortaq kod `src/` |
| `packages/core` | Saf alqoritmlər: FSRS, test yığma, qiymətləndirmə, sual analizi, CSV idxal validasiyası |
| `supabase/migrations` | Sxem, RLS, RPC (yalnız irəli; tətbiq olunmuş migrasiyanı dəyişmə, yenisini əlavə et) |
| `supabase/functions` | Edge API (`api`, Deno) və `livekit-webhook`; ortaq məntiq `_shared/` |
| `supabase/tests` | SQL testləri (psql) |
| `supabase/prod/base.sql` | İstehsal üçün fənlər və məkanlar (məzmunsuz) |
| `tests/` | İnteqrasiya, veb E2E (Playwright), yük testi |
| `.github/workflows` | `ci.yml`, `deploy-backend.yml`, `deploy-web.yml`, `android-apk.yml` |
| `docs/` | Arxitektura, tələblər, API, DB, təhlükəsizlik, testlər, deploy, ADR-lər |

Texnologiya: Expo SDK 58, React Native 0.88, React 19, TypeScript, Supabase (Postgres, Auth OTP, Realtime, Storage, Edge Functions), LiveKit, three.js / react-three-fiber (3D dəhliz və sinif), Vitest, Playwright.

## Əmrlər

```bash
npm ci
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run db:test
```

İnteqrasiya (`npm run test:int`) və veb E2E (`npm run test:e2e`) lokal Supabase + LiveKit tələb edir: `docs/TESTING.md`. Hər dəyişiklikdən sonra ən azı `typecheck` və `test`; UI dəyişikliyində E2E.

## Kod standartları

- TypeScript strict. Şərhlər və UI mətnləri Azərbaycan dilində; bütün UI mətni `apps/app/src/i18n/az.ts`-dədir.
- Yeni tələb `docs/REQUIREMENTS.md`-də ID ilə (FR-, SEC-, PERF-) qeyd olunur; risklər `docs/SECURITY.md` reyestrində.
- E2E `testID`-lərə bağlıdır: mövcud `testID`-ləri dəyişmə, yeni interaktiv elementə `testID` ver.
- Hər interaktiv element: `accessibilityRole`, etiket, ən azı 44 px toxunma sahəsi. Kontrast WCAG AA.

## 3D məktəb (defolt görünüş, ADR 0008)

- Tələbə joystiklə dəhlizdə gəzir, qapıdan sinfə girir, istədiyi partaya oturur, pəncərə partada açılır. Kod: `apps/app/src/school3d/` (`walk.ts` saf məntiq, `Corridor3D`/`SchoolCorridor` dəhliz, `Room3D`/`StudyRoom` sinif, `WalkPad` giriş, `Hud` düymələr).
- Sadə (2D) görünüş həmişə işlək qalmalıdır (`src/lib/view3d.ts`): WebGL açılmayan cihaz və ekran oxuyucusu üçün yeganə yoldur. Yeni funksiya hər iki görünüşdə əlçatan olmalıdır.
- 3D-də şəkil və şrift faylı yüklənmir (prosedur teksturalar, `texgen.ts`); mətn ekran üstü qatda (HUD) göstərilir.

## Dizayn sistemi (dəyişmə, genişləndir)

- Mənbə: `apps/app/src/theme.ts`. İki palitra: `colors` (gecə: dəhliz, giriş, canlı dərs) və `roomColors` (işıqlı sinif: fənn otağı, test, nəticə, konspekt). Qızılı yalnız seçimi və növbəti addımı göstərir.
- Komponentlər yalnız `apps/app/src/components/ui.tsx`-dən: `Screen`, `Section`, `Card`, `Group`, `ListRow`, `SelectRow`, `Sheet` (modal), `Button`, `Chip`, `Segmented`, `Field`, `Badge`, `Stat`, `Bar`. Kart içində kart qoyma.
- Rəng: komponent daxilində `usePalette()`, stil cədvəli `useSheet(makeStyles)`. Sabit hex yazma.
- Mətn: `react-native`-in `Text`-i yox, `src/components/Text.tsx` (şrift çəkisini düzgün fayla çevirir). Şriftlər: Fraunces (başlıq), Hanken Grotesk (mətn).
- İkon: emoji yox, `Icon` (`src/components/Icon.tsx`).
- Ad hər yerdə "Karyeram Accademy" (iki C, loqodakı kimi).
