# AI təhvil sənədi

Son yeniləmə: 2026-11-21. Dəyişməyən qaydalar `CLAUDE.md`-dədir; burada yalnız vəziyyət, qərarlar və növbəti işlər var. İşi bitirəndə bu faylı yenilə, köhnəlmiş sətirləri sil.

## Budaqlar

- `main`: buraxılış budağı. `karyeram/foundation`: iş budağı. Köhnə "Pillə" tətbiqi silinib (yalnız git tarixçəsindədir).
- 2026-11-21: `main` = `3e11346` (sahibin commit-i: kinematik 3D giriş, pulsuz giriş, sərtləşdirmə). Bundan sonrakı iş `claude/blissful-goldberg-116p9n` budağındadır (2.5D səhnə, serverdə pulsuz bayraq), `main`-ə birləşdirilməyib.
- 2026-11-16-da `main` = `af8190f` (APK bu commit-dən, veb `ce091f1`-dən yığılıb; fərq yalnız native davranışdır). Ondan sonrakı commit-lər yalnız `foundation`-dadır. `main`-ə push üçün sahibdən icazə al.

## Hazır olanlar (testlə təsdiqlənib)

Son yoxlama 2026-11-21, lokal mühit: tip yoxlaması xətasız, vahid 147/147, DB 14 fayl (334 yoxlama), veb E2E 34/34 (yeni 2.5D səhnə addımı daxil). İnteqrasiya sonuncu dəfə 2026-11-15-də 11/11. Native kod yolu (səhnə daxil) heç bir testlə yoxlanmır.

- **2.5D məktəb səhnəsi (defolt, ADR 0009, 2026-11-21, müdirin tələbi):** bina girişi (açılışda bir dəfə, "Keç"), dəhliz (qapı lövhələri + siyahı), fənnə toxunanda kamera qapıya yeriyir və qapı açılır, sinifdə müəllim və 11 tələbə, adı yazılmış boş partaya avtomatik oturma, partanın üstündə "Dərsin izahı" / "Testi yazmaq istəyirəm" və kurs stikeri. Test: mövzuya bir toxunuş (`/practice/[subject]`). Dərsin izahı: yazılı izah varsa açılır, yoxdursa həmin mövzudan test (`/lesson/[subject]`); PDF tələbəyə göstərilmir. WebGL yoxdur (SVG + transform). Kod: `apps/app/src/scene/`. Vebdə telefon (390×844) və enli ekran (1280×720) ekran şəkilləri ilə yoxlanıb.
- **Pulsuz mərhələ serverdə (FR-056):** `app_config.free_access` (miqrasiya `20261121000001`, `true` qoyur). Əvvəl yalnız klientdə idi: ödənişli mövzu açıq görünür, server testi rədd edirdi. Canlı dərs (`enrolled`) və PDF abunəli qalır.

- Giriş: telefon və e-poçt OTP (parolsuz), razılıqlar, hesab silmə və ixrac, ikinci giriş üsulu bağlama.
- 3D məktəb (defolt görünüş, ADR 0008): tam ekran dəhlizdə joystiklə gəzinti, qapının yanında "Daxil ol", fənn sinfində 12 partadan istədiyinə oturma (yaxınlaşıb və ya üstünə toxunub), partada açılan pəncərə (mövzular, test, konspekt), ayağa qalxma, dəhlizə çıxış; testdən sonra tələbə oturduğu partaya qayıdır. Menyuda sadə (2D) görünüş və yüngül rejim.
- Qapıdan keçid (2026-11-16, sahibin rəyi ilə): qapı açılanda arxasında sinfin/zalın özü görünür, tələbə qapıdan yeriyib keçir, çıxanda dəhliz görünür və dəhlizdə həmin qapıdan çıxır.
- Oxu zalı pilləli auditoriyadır (126 yer): yuxarıdan giriş, keçidlə eniş, istədiyin yerə oturma, pəncərədə dərslərin siyahısı. Zaldakı canlı dərsin 3D görünüşü də bu auditoriyadır.
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
| Android APK | Yığım işləyir (R8 kiçiltməsi söndürülüb: 2-ci cəhd R8 addımında dayanmışdı, dəqiq xəta oxunmayıb). "pilot" buraxılışındakı fayl 2026-11-16 08:33 UTC yığımıdır (`af8190f`: native-də defolt sadə görünüş, 3D donma qoruması): https://github.com/Qurban90/Kariyeram-Accademy/releases/tag/pilot . Əvvəlki yığım (`ce091f1`) sahibin telefonunda razılıqlardan sonra çökdü; bu yığımın telefonda nəticəsi hələ bilinmir |
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

- 2026-11-21: telefonda avtomatik giriş 2.5D çəkilmiş səhnədir (3D yox), hər yerdə defolt. 3D gəzinti vebdə menyuda qalır. Müdirin tələbləri: maksimum sadə, 3 toxunuş, oyun girişi kimi animasiya, PDF tətbiqdə yox (yalnız kurs tələbələrinə), tətbiq ilk vaxtlar pulsuz, reklam: canlı dərsə qoşulub material almaq üçün kursa yazılmaq (nömrə `010 375 85 93`).

- Ad hər yerdə "Karyeram Accademy"; mağaza identifikatoru `az.karyeram.accademy`.
- Sahibin istəmədən əlavə olunmuş funksiyalar (admin otağı, TOTP, PDF möhürü, şərəf lövhəsi, medallar, FSRS) qalır.
- Giriş: həm telefon, həm e-poçt; pilotda yalnız e-poçt (`EXPO_PUBLIC_AUTH_METHODS=email`).
- Dizayn: sadə görünüşdə dəhliz gecə, otağın içi işıqlı sinif. Canlı dərs ekranı tünd qalır.
- 3D gəzinti vebdə defoltdur (2026-11-15, ADR 0008); native-də donma düzələnə qədər defolt sadə görünüşdür (2026-11-16). Səbəb: sahibin prototipi (claude.ai artefaktı "Karyeram Academy") və müdirin tələbi: tələbə özü gəzsin, istədiyi otağa girsin, istədiyi partaya otursun, pəncərə açılsın. Prototipdən götürülən məntiq: sol joystik / sağ baxış, toxunuşla əşya seçimi, özü yeriyən keçidlər, oturanda məhdud baxış, yüngül rejim, WebGL-siz ehtiyat. Prototipdən fərq: bir ümumi sinif yox, hər fənnin öz sinfi; suallar yalnız serverdən gəlir.
- Mağazalara çıxış 2027 yanvara planlaşdırılır; Apple Developer və Google Play ödənişləri ondan əvvəl.

## Bilinən problemlər və borclar

- **Sahibin commit-i (3e11346) üzrə rəy, 2026-11-21:** (1) `config.freeAccess` yalnız klientdə idi, server ödənişli mövzunu bağlayırdı: düzəldildi (FR-056). (2) Kinematik giriş three.js ilə idi və telefonda (native) sinifdə defolt açılırdı, bu ADR 0008-in "native-də 3D defolt deyil" qaydasına zidd idi: 2.5D səhnə ilə əvəz olundu, `Cinema`/`Exterior3D` silindi. (3) `staff_mfa_required` defolt `true` oldu: E2E müəllimi TOTP-suz dərs planlaya bilmirdi, E2E-də bayraq söndürüldü (MFA DB testlərində yoxlanır). İstehsalda müəllim/admin TOTP qoşmalıdır, yoxsa müəllim əməliyyatları rədd olunur. (4) Konspekt şkafı otaqdan çıxarılmışdı, E2E köhnə idi: mətn izahı indi "Dərsin izahı"ndadır, test uyğunlaşdırıldı.
- **2.5D səhnə telefonda yoxlanmayıb.** Vebdə axıcıdır; Android-də SVG + native driver transformu ilə işləməlidir, amma real cihazda baxılmalıdır (kadr sürəti, yazıların kəskinliyi). Yeni APK yığılmayıb.
- Səhnədə qapı lövhələrində uzun fənn adı kəsilir ("İnform…"); siyahıda tam yazılır.

- **Android-də girişdən sonra tətbiq bağlanır (açıq problem, səbəb tapılmayıb).** Faktlar (server jurnalı və baza, 2026-11-16): (1) `ce091f1` APK (defolt 3D): razılıqlardan sonra "App isn't responding", tətbiq bağlandı; (2) `af8190f` APK (native-də defolt sadə görünüş; buraxılışdakı fayl 1 dəfə endirilib): 08:48 UTC-də OTP təsdiqi uğurlu, profil, fənlər, mövzular, abunələr, canlı dərslər və aktiv test sorğularının hamısı 200 qaytarıb, cihaz qeydə alınıb, ondan sonra tətbiq bağlanıb; yenidən açanda eyni sorğular yenə 200 gəlib və yenə bağlanıb. Nəticə: giriş, sessiya, şəbəkə və server sağlamdır; çökmə zal ekranı (`app/index.tsx`) məlumatla çəkiləndə baş verir və 3D-dən asılı deyil (əvvəlki "3D donur" fərziyyəsi yanlış idi). Statik analizdə (RN Android qradiyent/kölgə mənbələri, auth axını, sorğular) konkret səbəb tapılmayıb. Cihaz jurnalı yoxdur; bu mühitdə emulyator işə salmaq mümkün deyil (KVM yoxdur, `dl.google.com` bağlıdır).
- **Diaqnostika (müvəqqəti, `src/lib/diag.ts`).** Native tətbiq hər mərhələdə iz buraxır: `app_config`-ə `message=eq.diag|<yığım>|<işə salma>|<sıra>|<mərhələ>|<təfərrüat>` süzgəcli oxuma sorğusu; iz Supabase giriş jurnalında qalır (şəxsi məlumat, kod, token yoxdur). Oxumaq: Management API `GET /v1/projects/{ref}/analytics/endpoints/logs?sql=select timestamp, event_message from logs where event_message like '%diag%' ...` (köhnə `logs.all` silinib; cədvəlin adı `logs`-dur). Tutulmayan JS xətası tətbiqi bağlamır: xəta ekranı göstərilir və `js_fatal` izi gedir. Zal ekranı sabit vəziyyətə (5 san) çatmadan tətbiq bağlansa növbəti açılışda ekran hissə-hissə açılır (`stage_next_N` izləri: son iz çökən hissəni göstərir), ikinci uğursuzluqdan sonra ən sadə ekran (`SafeHall`) göstərilir. Səbəb tapılıb düzəldiləndən sonra mərhələli açılış silinə bilər; iz və xəta ekranı qalmalıdır.

- 3D-də prototipdəki bəzi əşyalar yoxdur: fəxri məzunlar, müsahibə otağı (105), sinifdə digər tələbələrin avatarları. Qapı lövhəciyində yalnız nömrə var (3D şrifti yalnız rəqəm çəkir); fənnin adı "Daxil ol" düyməsində yazılır.
- Canlı dərsdə yeri server verir; tələbə orada yeri özü seçmir (zalın girişində isə sərbəst oturur). Canlı dərs ekranı defolt 2D-dir, 3D düymə ilə açılır.
- Auditoriyanın yan divarları sadədir (pəncərə, panel yoxdur); zalda digər tələbələrin fiqurları yalnız canlı dərsdə görünür.

- Loqo: tətbiqdəki nişan (`Brand.tsx`) və ikonlar loqonun əl ilə çəkilmiş vektor surətidir. Rəsmi fayl (SVG və ya şəffaf PNG) gələndə əvəz olunmalıdır.
- Hüquqi mətnlər yazılmayıb, amma razılıq toplanır (R-02, kritik). Pilotdan əvvəl ən azı qaralama lazımdır.
- Sual bankının ekrandan çəkilməsinin tam qarşısı alınmır (R-01); su nişanı və ekran qoruması azaldır.
- Müəllim və admin otaqlarının quruluşu köhnədir (yalnız yeni rəng, şrift, ikon).
- `tests/e2e` telefon OTP ilə işləyir; yalnız e-poçt rejimi üçün ayrıca E2E yoxdur.
- Gitleaks: tarixçədəki yeganə tapıntı RFC 6238 test açarıdır (`.gitleaksignore`); istisna tam tarixçə üzərində lokal yoxlanmayıb.
- `.claude/skills/`-də üçüncü tərəf skill-ləri var (təxminən 10 MB); tətbiq koduna aid deyil.

## Əsas fayllar

- 2.5D səhnə: `apps/app/src/scene/` (`plan.ts` + test, `Stage.tsx`, `Exterior.tsx`, `Corridor.tsx`, `DoorFront.tsx`, `Classroom.tsx`, `DeskView.tsx`, `SchoolScene.tsx`, `ClassScene.tsx`, `SceneMenu.tsx`), `src/components/Promo.tsx`, `app/practice/[subject].tsx`, `app/lesson/[subject].tsx`.

- 3D məktəb: `apps/app/src/school3d/` (`walk.ts` məntiq və test, `Corridor3D.tsx`, `SchoolCorridor.tsx`, `Room3D.tsx`, `StudyRoom.tsx`, `Auditorium.tsx`, `walls.tsx`, `WalkPad.tsx`, `Rig.tsx`, `Hud.tsx`), `src/lib/view3d.ts`, `src/room/RoomPanel.tsx`, `src/live/LiveListPanel.tsx`.
- Dizayn: `apps/app/src/theme.ts`, `src/components/ui.tsx`, `Theme.tsx`, `Text.tsx`, `Icon.tsx`, `Brand.tsx`, `Door.tsx`, `RoomScene.tsx`.
- Ekranlar: `apps/app/app/` (`index` zal, `sign-in`, `room/[subject]`, `test/[session]`, `result/[session]`, `live/[id]`, `teacher`, `admin`, `profile`).
- Server: `supabase/functions/_shared/handlers.ts` (API), `router.ts`, `live.ts`, `staff.ts`, `admin.ts`; `supabase/migrations/`.
- Deploy: `.github/workflows/`, `.github/scripts/`, `supabase/prod/base.sql`, `docs/DEPLOYMENT.md`.
- Sahibin addımları: `docs/MANAGER.md`.
