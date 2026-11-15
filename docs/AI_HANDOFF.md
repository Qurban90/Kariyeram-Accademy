# AI təhvil sənədi

Son yeniləmə: 2026-11-15. Dəyişməyən qaydalar `CLAUDE.md`-dədir; burada yalnız vəziyyət, qərarlar və növbəti işlər var. İşi bitirəndə bu faylı yenilə, köhnəlmiş sətirləri sil.

## Budaqlar

- `main`: buraxılış budağı. `karyeram/foundation`: iş budağı. Köhnə "Pillə" tətbiqi silinib (yalnız git tarixçəsindədir).
- 2026-11-15 axşamı `foundation` `main`-dən irəlidədir: 3D gəzinti (aşağıda), məzmun alətləri, sənədlər. Veb və APK `main`-dən yığılır, yəni sahib 3D-ni yalnız `main`-ə push və yenidən deploydan sonra görəcək. `main`-ə push üçün sahibdən icazə al.

## Hazır olanlar (testlə təsdiqlənib)

Son tam yoxlama 2026-11-15 (3D gəzintidən sonra), lokal mühit: tip yoxlaması xətasız, vahid 114/114, DB 277 yoxlama (12 fayl), inteqrasiya 11/11 (real lokal Supabase + LiveKit), veb E2E 32/32 addım (brauzer proqram renderi ilə, real telefon deyil).

- Giriş: telefon və e-poçt OTP (parolsuz), razılıqlar, hesab silmə və ixrac, ikinci giriş üsulu bağlama.
- 3D məktəb (defolt görünüş, ADR 0008): tam ekran dəhlizdə joystiklə gəzinti, qapının yanında "Daxil ol", fənn sinfində 12 partadan istədiyinə oturma (yaxınlaşıb və ya üstünə toxunub), partada açılan pəncərə (mövzular, test, konspekt), ayağa qalxma, dəhlizə çıxış; testdən sonra tələbə oturduğu partaya qayıdır. Menyuda sadə (2D) görünüş və yüngül rejim.
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
| Veb | `deploy-web.yml` uğurlu: https://qurban90.github.io/Kariyeram-Accademy/ . Sahib 2026-11-15-də real e-poçt kodu ilə qeydiyyatdan keçdi və razılıqları verdi (bazada təsdiqlənib). AI səhifəni özü aça bilmir (şəbəkə məhdudiyyəti), ona görə görünüş yalnız sahibin sözü ilə təsdiqlənir |
| E-poçt kodu | SMTP (Gmail) işləyir: sahibin qeydiyyatı real kodla keçdi |
| Android APK | Yığım işləyir (R8 kiçiltməsi söndürülüb: 2-ci cəhd R8 addımında dayanmışdı, dəqiq xəta oxunmayıb). Real serverli yığım uğurlu (2026-11-15 15:20 UTC), fayl "pilot" buraxılışındadır: https://github.com/Qurban90/Kariyeram-Accademy/releases/tag/pilot . Bu fayl 3D gəzintidən əvvəlki koddur (köhnə 2D zal): `main` yenilənəndən sonra yenidən yığılmalıdır. Heç bir cihazda açılmayıb |
| İlk admin | Sahibin hesabı (tələbə № 1) SQL ilə admin edilib. Admin otağı TOTP tələb edir: sahib Kabinetdən iki mərhələli qorumanı qoşmalıdır |
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
- Dizayn: sadə görünüşdə dəhliz gecə, otağın içi işıqlı sinif. Canlı dərs ekranı tünd qalır.
- 3D gəzinti defoltdur (2026-11-15, ADR 0008). Səbəb: sahibin prototipi (claude.ai artefaktı "Karyeram Academy") və müdirin tələbi: tələbə özü gəzsin, istədiyi otağa girsin, istədiyi partaya otursun, pəncərə açılsın. Prototipdən götürülən məntiq: sol joystik / sağ baxış, toxunuşla əşya seçimi, özü yeriyən keçidlər, oturanda məhdud baxış, yüngül rejim, WebGL-siz ehtiyat. Prototipdən fərq: bir ümumi sinif yox, hər fənnin öz sinfi; suallar yalnız serverdən gəlir.
- Mağazalara çıxış 2027 yanvara planlaşdırılır; Apple Developer və Google Play ödənişləri ondan əvvəl.

## Bilinən problemlər və borclar

- 3D native-də (Android/iOS, expo-gl) heç vaxt işə salınmayıb. APK-da 3D açılmasa tətbiq sadə görünüşə keçməlidir, amma bu da cihazda yoxlanmayıb. İlk APK sınağında ilk baxılacaq şey budur.
- 3D-də prototipdəki bəzi əşyalar yoxdur: fəxri məzunlar, müsahibə otağı (105), sinifdə digər tələbələrin avatarları. Qapı lövhəciyində yalnız nömrə var (3D şrifti yalnız rəqəm çəkir); fənnin adı "Daxil ol" düyməsində yazılır.
- Canlı dərsin 3D sinfində yeri server verir; tələbə orada partanı özü seçmir.

- Loqo: tətbiqdəki nişan (`Brand.tsx`) və ikonlar loqonun əl ilə çəkilmiş vektor surətidir. Rəsmi fayl (SVG və ya şəffaf PNG) gələndə əvəz olunmalıdır.
- Hüquqi mətnlər yazılmayıb, amma razılıq toplanır (R-02, kritik). Pilotdan əvvəl ən azı qaralama lazımdır.
- Sual bankının ekrandan çəkilməsinin tam qarşısı alınmır (R-01); su nişanı və ekran qoruması azaldır.
- Müəllim və admin otaqlarının quruluşu köhnədir (yalnız yeni rəng, şrift, ikon).
- `tests/e2e` telefon OTP ilə işləyir; yalnız e-poçt rejimi üçün ayrıca E2E yoxdur.
- Gitleaks: tarixçədəki yeganə tapıntı RFC 6238 test açarıdır (`.gitleaksignore`); istisna tam tarixçə üzərində lokal yoxlanmayıb.
- `.claude/skills/`-də üçüncü tərəf skill-ləri var (təxminən 10 MB); tətbiq koduna aid deyil.

## Əsas fayllar

- 3D məktəb: `apps/app/src/school3d/` (`walk.ts` məntiq və test, `Corridor3D.tsx`, `SchoolCorridor.tsx`, `Room3D.tsx`, `StudyRoom.tsx`, `WalkPad.tsx`, `Rig.tsx`, `Hud.tsx`), `src/lib/view3d.ts`, `src/room/RoomPanel.tsx`.
- Dizayn: `apps/app/src/theme.ts`, `src/components/ui.tsx`, `Theme.tsx`, `Text.tsx`, `Icon.tsx`, `Brand.tsx`, `Door.tsx`, `RoomScene.tsx`.
- Ekranlar: `apps/app/app/` (`index` zal, `sign-in`, `room/[subject]`, `test/[session]`, `result/[session]`, `live/[id]`, `teacher`, `admin`, `profile`).
- Server: `supabase/functions/_shared/handlers.ts` (API), `router.ts`, `live.ts`, `staff.ts`, `admin.ts`; `supabase/migrations/`.
- Deploy: `.github/workflows/`, `.github/scripts/`, `supabase/prod/base.sql`, `docs/DEPLOYMENT.md`.
- Sahibin addımları: `docs/MANAGER.md`.
