# Karyeram Academy — Tələblər spesifikasiyası (SRS)

Versiya 0.3 · 2026-11-04. Status sütunu: **Hazır** (kod + test var), **Qismən**, **Plan** (hələ yoxdur). Status yalnız repoda yoxlanıla bilən koda əsaslanır.

## 1. Biznes məqsədi və problem

Onlayn hazırlıq kursları quru siyahılardan ibarətdir (video, fayl, test), tələbə motivasiyanı itirir. Karyeram Academy telefonda və kompüterdə **virtual məktəb binası** təqdim edir: zal, otaqlar, sinif, oxu zalı. İki rejim:

1. **Özünü öyrənmə otaqları:** fənn otağında konspekt, qorunan test bankı, səhvlərin təkrarı, gündəlik.
2. **Oxu zalı (canlı):** müəllim (host) səhnədə/lövhədə, iştirakçılar oturacaqlarda; video, səs, ekran paylaşma, əl qaldırma, yalnız host danışır rejimi.

İlk versiya: Azərbaycan dili, dövlət qulluğu, magistratura (Qanunvericilik, İnformatika, Azərbaycan dili). Sonra: başqa fənlər, kirayəçi müəllimlər, ümumi seminar və tədbirlər (psixoloq, stand-up, startup), başqa dillər.

## 2. Rollar

| Rol | Təsvir | V1 |
| --- | --- | --- |
| Qonaq | Qeydiyyatsız: tanıtım, pulsuz mövzu üçün qeydiyyata dəvət | Bəli |
| Tələbə | Testlər, otaqlar, canlı dərsə qoşulma, gündəlik | Bəli |
| Müəllim | Öz otağı, sual bankı, kodlar, canlı dərsin hostu, qiymət və qeyd | Bəli |
| Admin | Məzmun və istifadəçi idarəsi, audit | Bəli (minimal) |
| Valideyn, moderator, dəstək | Sonrakı mərhələ | Xeyr |

## 3. Fərziyyələr (cavab gələnə qədər təhlükəsiz seçim)

- A-1: Giriş parolsuzdur: e-poçt OTP və telefon SMS OTP. Bir hesaba hər ikisi bağlana bilər. (Müdir: "həm telefon, həm e-poçt".)
- A-2: SMS provayderi Supabase Auth-un dəstəklədiyi provayderlərdən biri olacaq (Twilio/Vonage/MessageBird). Lokalda sabit test kodu.
- A-3: Canlı video LiveKit (Cloud və ya öz server). Zoom/Meet SDK lisenziyası tələb olunmur.
- A-4: İlk hədəf auditoriya 18+ (dövlət qulluğu, magistratura). Yetkinlik yaşına çatmayanlar üçün qeydiyyat bloklanır, valideyn rejimi sonra.
- A-5: Ödəniş V1-də kodla aktivləşdirmədir (müəllim kodu verir). Onlayn ödəniş M5-dədir və mağaza qaydaları yoxlanacaq.
- A-6: Məlumat Supabase regionunda saxlanılır. Azərbaycan qanunvericiliyi baxımından hüquqi rəy gözlənilir.

## 4. Funksional tələblər

Prioritet: M (Must), S (Should), C (Could).

### Hesab və giriş

| ID | Tələb | P | Qəbul meyarı | Status |
| --- | --- | --- | --- | --- |
| FR-001 | E-poçtla 6 rəqəmli OTP ilə qeydiyyat/giriş | M | Kod 1 dəfəlik, müddətli; yanlış kod rədd edilir | Hazır (lokal GoTrue + Mailpit inteqrasiya testi; real SMTP yoxlanmayıb) |
| FR-002 | Telefonla SMS OTP qeydiyyat/giriş | M | +994 formatı yoxlanır, kod 1 dəfəlik | Qismən (klient + lokal test nömrəsi; SMS provayderi qoşulmayıb) |
| FR-003 | Hesaba ikinci identifikator (telefon/e-poçt) bağlamaq | S | Təsdiqdən sonra hər ikisi ilə giriş | Plan |
| FR-004 | Qeydiyyatda şərtlər və məxfilik siyasətinə razılıq, yaş təsdiqi (18+) | M | Razılıq versiyası və vaxtı bazada | Hazır (DB + UI); hüquqi mətnlər yazılmayıb (R-02) |
| FR-005 | Profil avtomatik yaradılır, tələbə nömrəsi (su nişanı) verilir | M | auth istifadəçisi yarananda profil var | Hazır |
| FR-006 | Hesab silmə (real backend prosesi) | M | Şəxsi məlumat silinir/anonimləşir, audit qalır | Hazır (DB + API + UI, E2E) |
| FR-007 | Məlumat ixracı (JSON) | S | Tələbə öz məlumatını yükləyir | Hazır (DB + API + UI, E2E) |
| FR-008 | Tək aktiv cihaz, cihaz dəyişimi audit | M | Köhnə cihaz bloklanır | Hazır (DB + UI) |
| FR-009 | Bütün cihazlardan çıxış | S | Sessiyalar ləğv | Hazır (refresh tokenlər serverdə ləğv, E2E) |

### Özünü öyrənmə

| ID | Tələb | P | Qəbul meyarı | Status |
| --- | --- | --- | --- | --- |
| FR-020 | Fənn və mövzu seçimi, mövzu testi | M | Yalnız icazəli suallar | Hazır (API + UI, E2E) |
| FR-021 | 10/20/30/50/100 qarışıq sual | M | Zəif mövzular daha çox pay alır | Hazır (API + UI) |
| FR-022 | Nəticə: düz, səhv, boş, faiz, mövzu üzrə | M | Server hesablayır | Hazır (API + UI) |
| FR-023 | Hər sual üçün seçilən, düzgün variant, hər variantın izahı | M | Yalnız görülmüş suallar | Hazır (API + UI, E2E) |
| FR-024 | Tələli sualların rənglə seçilməsi (imtahanda gizli) | S | `trap` bayrağı | Hazır (API + UI) |
| FR-025 | "Yalnız səhvlərimi təkrar işlə" | M | Son cavabı səhv olanlar | Hazır (API + UI) |
| FR-026 | FSRS aralıqlı təkrar | S | Hər cavabdan sonra kart yenilənir | Hazır |
| FR-027 | Gündəlik: test nəticələri, müəllim qiymətləri, qeydlər | M | Test bitəndə avtomatik | Hazır (test avtomatik, qiymət/qeyd müəllimdən) |
| FR-028 | "Səhvlərim harada çoxdur" | S | Mövzu üzrə səhv payı | Hazır (core + UI) |
| FR-029 | Pulsuz sınaq mövzusu | M | Abunəsiz yalnız `free` mövzular | Hazır (DB + UI, E2E) |
| FR-030 | Kodla abunə aktivləşdirmə | M | Kod bir dəfəlik, hash | Hazır (DB + UI) |
| FR-031 | Konspekt kitabxanası (şkaf) | S | İcazəli PDF/mətn | Plan |
| FR-032 | İmtahan zalı: vaxtlı DİM formatlı sınaq | S | Server vaxtı, sonda nəticə | Hazır (API + UI, taymer) |

### Oxu zalı (canlı)

| ID | Tələb | P | Qəbul meyarı | Status |
| --- | --- | --- | --- | --- |
| FR-040 | Məkanlar: sinif (məktəb) və zal (seminar), tutum | M | Məkan tipi və sahibi | Hazır (DB) |
| FR-041 | Canlı sessiya planlaşdırma: başlıq, vaxt, host, giriş qaydası | M | Host və ya admin yaradır | Hazır (API + UI forması, E2E) |
| FR-042 | Qoşulma: icazə yoxlanır, LiveKit token server tərəfindən | M | Abunəsiz/dəvətsiz qoşula bilmir | Hazır (API + UI, real LiveKit E2E) |
| FR-043 | Host: video, səs, ekran paylaşma | M | Token icazəsi | Qismən (kamera E2E-də yoxlanıb; ekran paylaşma yalnız vebdə, avtomat yoxlanmayıb) |
| FR-044 | İştirakçı əvvəlcə yalnız dinləyir | M | `canPublish=false` | Hazır (E2E) |
| FR-045 | Əl qaldırma növbəsi, host söz verir/alır | M | İcazə serverdə dəyişir | Hazır (API + UI, E2E) |
| FR-046 | "Yalnız host danışır" rejimi | M | Bütün iştirakçıların səsi bağlanır | Hazır (API + UI, E2E) |
| FR-047 | Chat | S | Uzunluq limiti, rate limit | Hazır (API + Realtime + UI, E2E) |
| FR-048 | Davamiyyət: qoşulma/ayrılma, dəqiqə | S | Webhook əsasında | Hazır (API/DB + host panelində UI, E2E) |
| FR-049 | Dərsin yazılması və şkafa düşməsi | C | Razılıqla | Plan |
| FR-050 | 3D zal/sinif: iştirakçılar oturacaqlarda, host səhnədə | S | Zəif cihazda 2D | Qismən (2D sinif: lövhə + partalar; 3D yoxdur) |
| FR-051 | İştirakçını çıxarmaq/bloklamaq | M | Host/admin | Hazır (API + UI) |

### Motivasiya

| ID | Tələb | P | Qəbul meyarı | Status |
| --- | --- | --- | --- | --- |
| FR-070 | Şərəf lövhəsi (həftəlik, fənn üzrə) | S | Wilson aşağı sərhədi, min 30 cavab; yalnız razılıq verənlər, qısa ad, ID yoxdur | Hazır (DB + API + UI, E2E) |
| FR-071 | Medallar və ardıcıl günlər | C | Alqoritm | Hazır (core + gündəlik UI; son 100 test əsasında) |

### Müəllim və admin

| ID | Tələb | P | Qəbul meyarı | Status |
| --- | --- | --- | --- | --- |
| FR-060 | Kod yaratma (toplu), ləğv | M | Yalnız müəllim/admin | Hazır (yaratma, siyahı, ləğv: DB + API + UI, E2E) |
| FR-061 | Sual analizi: tələli, şübhəli açar, asan/çətin | S | Min 30 cavab | Hazır (core + API + müəllim otağı UI, E2E) |
| FR-062 | Sual statusu: qaralama, yoxlama, dərc, köhnəlmiş | M | Tələbə yalnız dərc olunanı görür | Hazır (DB + müəllim otağı UI, E2E) |
| FR-063 | Qiymət və qeyd gündəliyə | S | Dərhal tələbədə görünür | Hazır (tələbə № ilə; DB + API + UI, E2E) |
| FR-064 | Admin: istifadəçi dayandırma, audit | M | Hər əməliyyat audit-ə | Qismən |

## 5. Qeyri-funksional tələblər

| ID | Tələb | Ölçü | Status |
| --- | --- | --- | --- |
| NFR-001 | Platformalar: Android, iOS, veb bir kod bazası | Expo | Qismən (veb build + E2E; native build yoxlanmayıb) |
| NFR-002 | Dil: Azərbaycan (i18n strukturu ilə) | Bütün mətnlər bir yerdə | Hazır (apps/app/src/i18n/az.ts; yalnız konfiqurasiya xətası mətni config.ts-dədir) |
| NFR-003 | Zəif cihaz dəstəyi: 3D söndürülə bilir | 2D rejim | Hazır (hazırda yalnız 2D var) |
| PERF-001 | API p95 < 400 ms (normal yük) | k6 ilə ölçüləcək | Ölçülməyib |
| PERF-002 | 500 eyni vaxtlı istifadəçi (test və gündəlik) | k6 yük testi | Ölçülməyib |
| PERF-003 | Canlı sinifdə 30–50 iştirakçı | LiveKit SFU | Ölçülməyib |
| SEC-001 | Tələbə sual cədvəlini birbaşa oxuya bilmir | RLS testi | Hazır |
| SEC-002 | Cavab açarı klientə yalnız cavabdan sonra | DB testi | Hazır |
| SEC-003 | Bütün RPC-lər yalnız service_role | DB testi | Hazır |
| SEC-004 | Gündəlik sual limiti, sürət aşkarlama | DB testi | Hazır |
| SEC-005 | LiveKit icazələri yalnız serverdə | Vitest | Hazır |
| SEC-006 | Webhook imzası və təkrar qorunması | Vitest | Hazır |
| SEC-007 | Sirlər repoda yoxdur, CI-də secret scanning | gitleaks | Qismən (gitignore; CI-də gitleaks konfiqurasiya olunub, hələ işləməyib) |
| SEC-008 | Android ekran şəkli qadağası, iOS aşkarlama | expo-screen-capture | Qismən (kod var; native cihazda yoxlanmayıb) |
| PRIV-001 | Minimal məlumat: ad, e-poçt və/və ya telefon | Sxem | Hazır |
| PRIV-002 | Silinmə və ixrac | DB testi | Hazır |
| PRIV-003 | Razılıq versiyaları saxlanılır | DB | Hazır |
| TEST-001 | Alqoritm vahid testləri | Vitest | Hazır |
| TEST-002 | DB/RLS testləri real Postgres-də | psql | Hazır |
| TEST-003 | Lokal Supabase ilə end-to-end API testi | supabase start | Hazır (8 inteqrasiya testi) |
| TEST-004 | Brauzerdə tətbiq E2E (real stek) | Playwright | Hazır (26 addım) |
| TEST-005 | Native cihazlarda E2E | Maestro/Detox | Plan |
| NFR-004 | Əlçatanlıq: toxunma sahəsi ≥ 44, ARIA rolları və vəziyyətləri, azaldılmış hərəkət | Ekran oxuyucu ilə yoxlama | Qismən (kod; ekran oxuyucu ilə yoxlanmayıb) |

## 6. Kritik ssenarilər və istisnalar

- Tələbə testin ortasında tətbiqi bağlayır: sessiya aktiv qalır, kursor serverdədir, davam edir.
- İkinci telefondan giriş: köhnə cihaz növbəti sorğuda `device_not_active` alır.
- Gündəlik limit doldu: aydın mesaj, sabah davam.
- İnternet kəsildi: cavab göndərilmədisə yenidən göndərilir (idempotent deyil: server növbəni yoxlayır, təkrar cavab `out_of_order` qaytarır və klient növbəti suala keçir).
- Canlı dərsdə host çıxdı: otaq açıq qalır, iştirakçılara bildiriş.
- Webhook təkrar gəldi: hadisə ID-si ilə bir dəfə işlənir.

## 7. Açıq suallar

1. Telefon üçün SMS provayderi və büdcə.
2. Supabase regionu və məlumat qanunu.
3. Yazılan dərslərin saxlanma müddəti.
4. "Accademy" yazılışı (kodda brend adı konfiqurasiyadadır).
