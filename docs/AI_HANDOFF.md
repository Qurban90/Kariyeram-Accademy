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
- Real SMS, real e-poçt çatdırılması, LiveKit Cloud.
- Yük: yalnız lokal ölçmə (2026-11-04, `docs/PERFORMANCE.md`).

## Pilot (2026-11-15-də yerləşdirildi)

Mağazasız sınaq, 10-a yaxın tələbə. Giriş yalnız e-poçtla. Addımlar və sirlər: `docs/DEPLOYMENT.md`, "Pilot" bölməsi.

| Hissə | Vəziyyət |
| --- | --- |
| Server (Supabase, pulsuz plan, Frankfurt) | `deploy-backend.yml` uğurlu. Management API ilə yoxlanıb: 16 migrasiya, 5 fənn, 6 məkan, cron işi, storage bucket, Auth-da SMTP və OTP şablonları, TOTP aktiv, iki funksiya ACTIVE |
| Veb | `deploy-web.yml` uğurlu: https://qurban90.github.io/Kariyeram-Accademy/ . Səhifənin açıldığını və girişin işlədiyini AI yoxlaya bilməyib (şəbəkə məhdudiyyəti); sahibin təsdiqi gözlənilir |
| E-poçt kodu | SMTP (Gmail) ayarlanıb; real məktubun çatması hələ təsdiqlənməyib |
| Android APK | Yığım işləyir (R8 kiçiltməsi söndürülüb: 2-ci cəhd R8 addımında dayanmışdı, dəqiq xəta oxunmayıb). Real serverli yığım `main`-də işə salınıb; nəticə və "pilot" buraxılışı (Releases) yoxlanmalıdır. Heç bir cihazda açılmayıb |
| İlk admin | Hələ heç kim qeydiyyatdan keçməyib. Sahib daxil olandan sonra SQL ilə admin edilməlidir (`docs/DEPLOYMENT.md`) |
| LiveKit | Sirlər funksiyalara yazılıb; real dərs sınanmayıb. Webhook LiveKit panelində hələ təyin olunmayıb (davamiyyət üçün) |
| `APP_ORIGINS` | Dəyişən təyin olunmayıbsa CORS hər mənbəyə açıqdır (R-08); deploy jurnalındakı xəbərdarlığa bax |

İlk deployda çıxan və düzəldilən xətalar: `adaptive-icon.png` yox idi; Supabase tokeninin formatı (`sbp_` ilə başlamalıdır); Supabase CLI 3-də `db push` üçün `--remote` lazımdır.

## Məzmun (repoya yazılmır)

Mənbə sahibin Google Drive qovluğudur (fənlər üzrə alt qovluqlar). 2026-11-15-də baxılıb:

- İnformatika: 16 mövzu üzrə test PDF-ləri və ayrıca "test izah" PDF-ləri (hər mövzuda təxminən 50 sual; izah faylında `nömrə → hərf ona görə ki ...` formatı), konspektlər (PDF və Word).
- Qanunvericilik: 20 test PDF-i, test izahları, konspektlər. Azərbaycan dili: test, test izahı, konspekt. Dünyagörüşü: müsahibə materialları. Məntiq: boşdur.
- Test PDF-lərinin mətn çıxarışı keyfiyyətsizdir (skan): üst indekslər itir (2³⁶ → "236"), bəzi variantlar və sual mətnləri düşür, sıra qarışır. Avtomatik çevirmə etibarlı deyil. Üsul: yalnız mətni və dörd variantı tam oxunan sualı götür, cavabı izah faylı ilə (hesablama suallarında özün hesablayaraq) təsdiqlə, şübhəli sualı kənarda saxla, heç nə uydurma.
- Bazada (dərc olunub, mövzular pulsuzdur): İnformatika "İnformatikanın əsasları" 39 sual (50-dən; skan PDF, əl ilə təmizlənib); Qanunvericilik "Konstitusiya: maddə 1–23" 106 sual və "Konstitusiya: maddə 24–51" 102 sual (hamısı; cavab açarı izah faylı ilə üst-üstə düşür). Variant üzrə izah yoxdur, yalnız ümumi izah.
- Qanunvericilik PDF-ləri təmiz mətnlidir və `scripts/content/law_parse.py` ilə avtomatik çevrilir (etalon cavabı izah faylı ilə tutuşdurur, uyğun gəlməyəni atır). İdxal: `scripts/import-questions-api.mts` (Management API, HTTPS). Qalan 18 Qanunvericilik faylı eyni üsulla yüklənə bilər.
- İnformatikanın qalan 15 mövzusu skandır: hər biri əl ilə təmizlənməlidir.
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
