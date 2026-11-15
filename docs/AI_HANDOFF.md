# AI təhvil sənədi

Son yeniləmə: 2026-11-15. Dəyişməyən qaydalar `CLAUDE.md`-dədir; burada yalnız vəziyyət, qərarlar və növbəti işlər var. İşi bitirəndə bu faylı yenilə, köhnəlmiş sətirləri sil.

## Budaqlar

- `main`: buraxılış budağı. `karyeram/foundation`: iş budağı. Köhnə "Pillə" tətbiqi silinib (yalnız git tarixçəsindədir).
- 2026-11-15-də `foundation` `main`-dən irəlidədir (pilot deploy axınları, ikonlar, bu sənədlər). `main`-ə push üçün sahibdən icazə al.

## Hazır olanlar (testlə təsdiqlənib)

Son tam yoxlama 2026-11-12, lokal mühit: tip yoxlaması xətasız, vahid 104/104, DB 277 yoxlama (12 fayl), inteqrasiya 11/11 (real lokal Supabase + LiveKit), veb E2E 31/31 addım. 2026-11-15-dəki dəyişikliklərdən sonra yalnız tip yoxlaması və vahid testlər (104/104) təkrar işə salınıb.

- Giriş: telefon və e-poçt OTP (parolsuz), razılıqlar, hesab silmə və ixrac, ikinci giriş üsulu bağlama.
- Özünü öyrənmə: fənn otaqları, mövzu / qarışıq / səhvlər / sınaq imtahanı, izahlar, FSRS təkrar, gündəlik, seriya və medallar, şərəf lövhəsi, konspekt şkafı (mətn və serverdə möhürlənən PDF).
- Canlı dərs: LiveKit, yer nömrəsi, əl qaldırma, söz vermə, "yalnız host danışır", chat, davamiyyət, 2D və 3D sinif.
- Müəllim otağı (sual dərci, sual analizi, abunə kodları, qiymət, konspekt), admin otağı (dayandırma, rol, audit, texniki iş rejimi), müəllim/admin üçün TOTP.
- Dizayn: loqoya uyğun gecə palitrası, fənn otağında işıqlı sinif palitrası və `RoomScene`.

## Heç vaxt yoxlanmayıb

- Native Android/iOS: tətbiq real cihazda heç vaxt işə salınmayıb (ekran qoruması, SecureStore, LiveKit native, 3D performansı).
- İstehsal: Supabase layihəsi yoxdur, heç nə deploy olunmayıb. `deploy-backend.yml` və `deploy-web.yml` yazılıb, amma heç vaxt işə salınmayıb (sirlər hələ yoxdur).
- Real SMS, real e-poçt çatdırılması, LiveKit Cloud.
- Yük: yalnız lokal ölçmə (2026-11-04, `docs/PERFORMANCE.md`).

## Davam edən iş: pilot (10-a yaxın tələbə)

Məqsəd: mağazasız sınaq. Veb tətbiq GitHub Pages-də, Android üçün APK, giriş yalnız e-poçtla. Addımlar və sirlərin siyahısı: `docs/DEPLOYMENT.md`, "Pilot" bölməsi.

| Addım | Vəziyyət |
| --- | --- |
| Android APK yığımı (`android-apk.yml`) | Yığım işləyir: 3-cü cəhd (2026-11-15, run 43701066192) uğurlu oldu, təxminən 30 dəqiqə. R8 kiçiltməsi söndürülüb (2-ci cəhd R8 addımında dayanmışdı, dəqiq xəta oxunmayıb). Bu APK placeholder server ünvanı ilə yığılıb və heç bir cihazda quraşdırılıb açılmayıb. Sirlərdən sonra yenidən yığılmalı, "pilot" buraxılışına əlavə olunmalı və real telefonda yoxlanmalıdır |
| Sahib: Supabase layihəsi, e-poçt göndərən hesab, LiveKit Cloud, GitHub sirləri | Gözlənilir |
| Server deploy, veb deploy | Sirlərdən sonra; ilk işə salınmada xətalar gözlənilir (bax "Risklər") |
| İlk admin (SQL), müəllim rolları (admin otağından) | Deploydan sonra |
| Məzmun idxalı | Aşağıda |

Risklər (ilk deployda yoxla): Edge Functions-ın `packages/core` və `_vendor`-u `--use-api` ilə düzgün paketləməsi; `pg_cron` migrasiyası pulsuz planda; Auth e-poçt şablonlarının OTP kodu göstərməsi; veb tətbiqin alt qovluqda (`/Kariyeram-Accademy/`) marşrutları; Pages-in aktivləşməsi.

## Məzmun (repoya yazılmır)

Mənbə sahibin Google Drive qovluğudur (fənlər üzrə alt qovluqlar). 2026-11-15-də baxılıb:

- İnformatika: 16 mövzu üzrə test PDF-ləri və ayrıca "test izah" PDF-ləri (hər mövzuda təxminən 50 sual; izah faylında `nömrə → hərf ona görə ki ...` formatı), konspektlər (PDF və Word).
- Qanunvericilik: 20 test PDF-i, test izahları, konspektlər. Azərbaycan dili: test, test izahı, konspekt. Dünyagörüşü: müsahibə materialları. Məntiq: boşdur.
- Test PDF-lərinin mətn çıxarışı keyfiyyətsizdir (skan): üst indekslər itir (2³⁶ → "236"), bəzi variantlar və sual mətnləri düşür, sıra qarışır. Avtomatik çevirmə etibarlı deyil. Üsul: yalnız mətni və dörd variantı tam oxunan sualı götür, cavabı izah faylı ilə (hesablama suallarında özün hesablayaraq) təsdiqlə, şübhəli sualı kənarda saxla, heç nə uydurma.
- İnformatika 1-ci mövzu ("İnformatikanın əsasları") bu üsulla hazırlanıb: 50 sualdan 39-u; `--dry-run` validasiyadan keçib, bazaya hələ yazılmayıb.
- Heç bir sual hələ bazaya idxal olunmayıb. İdxal üçün test PDF-i (sual və variantlar) izah PDF-i ilə (düzgün cavab və izah) birləşdirilib `docs/templates/suallar-sablon.csv` formatına salınmalıdır; fayl repodan kənarda saxlanılır. Variant üzrə ayrıca izah mənbədə yoxdur, yalnız ümumi izah var.
- Müəllif hüququ: materialların müəllifi fayllarda göstərilib; şirkətə məxsus olduğunun yazılı təsdiqi hələ alınmayıb (`docs/MANAGER.md`).

## Qərarlar (sahib təsdiqləyib)

- Ad hər yerdə "Karyeram Accademy"; mağaza identifikatoru `az.karyeram.accademy`.
- Sahibin istəmədən əlavə olunmuş funksiyalar (admin otağı, TOTP, PDF möhürü, şərəf lövhəsi, medallar, FSRS) qalır.
- Giriş: həm telefon, həm e-poçt; pilotda yalnız e-poçt (`EXPO_PUBLIC_AUTH_METHODS=email`).
- Dizayn: dəhliz gecə, otağın içi işıqlı sinif. Canlı dərs ekranı tünd qalır. 3D dəhliz və 3D sinifə toxunulmayıb.
- Mağazalara çıxış 2027 yanvara planlaşdırılır; Apple Developer və Google Play ödənişləri ondan əvvəl.

## Bilinən problemlər və borclar

- Loqo: tətbiqdəki nişan (`Brand.tsx`) və ikonlar loqonun əl ilə çəkilmiş vektor surətidir. Rəsmi fayl (SVG və ya şəffaf PNG) gələndə əvəz olunmalıdır.
- Hüquqi mətnlər yazılmayıb, amma razılıq toplanır (R-02, kritik). Pilotdan əvvəl ən azı qaralama lazımdır.
- Sual bankının ekrandan çəkilməsinin tam qarşısı alınmır (R-01); su nişanı və ekran qoruması azaldır.
- Müəllim və admin otaqlarının quruluşu köhnədir (yalnız yeni rəng, şrift, ikon).
- `tests/e2e` telefon OTP ilə işləyir; yalnız e-poçt rejimi üçün ayrıca E2E yoxdur.
- Gitleaks: tarixçədəki yeganə tapıntı RFC 6238 test açarıdır (`.gitleaksignore`); istisna tam tarixçə üzərində lokal yoxlanmayıb.
- `.claude/skills/`-də üçüncü tərəf skill-ləri var (təxminən 10 MB); tətbiq koduna aid deyil.

## Əsas fayllar

- Dizayn: `apps/app/src/theme.ts`, `src/components/ui.tsx`, `Theme.tsx`, `Text.tsx`, `Icon.tsx`, `Brand.tsx`, `Door.tsx`, `RoomScene.tsx`.
- Ekranlar: `apps/app/app/` (`index` zal, `sign-in`, `room/[subject]`, `test/[session]`, `result/[session]`, `live/[id]`, `teacher`, `admin`, `profile`).
- Server: `supabase/functions/_shared/handlers.ts` (API), `router.ts`, `live.ts`, `staff.ts`, `admin.ts`; `supabase/migrations/`.
- Deploy: `.github/workflows/`, `.github/scripts/`, `supabase/prod/base.sql`, `docs/DEPLOYMENT.md`.
- Sahibin addımları: `docs/MANAGER.md`.
