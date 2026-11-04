# Təhlükəsizlik

Versiya 0.1 · 2026-11-04. Bu sənəd heç bir şeyin "100% təhlükəsiz" olduğunu iddia etmir. Hər nəzarət üçün necə yoxlandığı yazılıb; yoxlanmayanlar açıq qeyd olunub.

## 1. Qorunan aktivlər

| Aktiv | Niyə dəyərlidir |
| --- | --- |
| Sual bankı (sual, variant, cavab açarı, izahlar) | Şirkətin əsas intellektual mülkiyyəti; sızsa biznes dəyəri düşür |
| Şəxsi məlumat (ad, telefon, e-poçt, test tarixçəsi) | Qanuni öhdəlik, etibar |
| Abunə kodları | Birbaşa gəlir |
| Canlı dərs (görüntü, səs, chat) | Ödənişli məzmun və iştirakçıların məxfiliyi |
| `service_role` açarı, LiveKit API sirri, SMS provayder tokeni | Bütün sistemə tam giriş |

## 2. Etibar sərhədləri

1. Tətbiq (etibarsız: istifadəçi istənilən sorğunu göndərə bilər).
2. Edge API (etibarlı: JWT-ni GoTrue-da yoxlayır, istifadəçi ID-sini tokendən götürür).
3. Postgres (etibarlı: RLS + yalnız `service_role` icra edə bilən RPC-lər).
4. LiveKit (etibarlı: yalnız serverin imzaladığı tokenlərə inanır).

## 3. STRIDE

| Təhdid | Ssenari | Nəzarət | Yoxlama |
| --- | --- | --- | --- |
| **S**poofing | Başqasının adından sorğu | JWT GoTrue `/auth/v1/user` ilə yoxlanır; istifadəçi ID-si gövdədən götürülmür | Vitest (IDOR testi), inteqrasiya (401) |
| S | Saxta LiveKit tokeni | Token yalnız serverdə HS256 ilə imzalanır | İnteqrasiya: saxta token real LiveKit-də rədd olunur |
| S | Saxta webhook | JWT imzası, gövdənin sha256-sı, 300 san. təzəlik | Vitest |
| S | OTP-ni təxmin etmək | GoTrue rate limit, 6 rəqəm, müddət | GoTrue-nun öz nəzarəti; bizdə yük testi edilməyib |
| **T**ampering | Cavabı dəyişmək, başqa suala cavab | `submit_answer` növbəni və sualın görülməsini yoxlayır; cavab serverdə hesablanır | DB testləri |
| T | Öz rolunu metadata ilə qaldırmaq | `canUpdateOwnMetadata=false`; rol DB-də | Vitest |
| T | Variant sırasını əzbərləmək | Hər sessiyada `_perm` ilə qarışdırma | DB testi |
| **R**epudiation | "Mən etməmişəm" | `audit_events`: cihaz dəyişimi, kod səhvi, dayandırma, ban, silinmə, ekran şəkli siqnalı | DB testləri |
| **I**nformation disclosure | Sual bankını birbaşa oxumaq | `questions` üçün tələbə RLS siyasəti yoxdur; RPC-lər `authenticated` üçün bağlıdır | İnteqrasiya: REST `[]` qaytarır, birbaşa RPC rədd olunur |
| I | Cavab açarı sualla gəlir | `next_question` açarı qaytarmır; E2E səhifədə `answer_index` axtarır | DB + E2E |
| I | İmtahanda nəticəni əvvəlcədən görmək | İmtahanda `submit_answer` yalnız `accepted` qaytarır | DB testi |
| I | Bankı skreypinq (avtomat) | Gündəlik limit (Bakı günü), sürət medianı < 1.5 san → 1 saat dayandırma, bir aktiv sessiya, tək cihaz | DB testləri |
| I | Ekran şəkli ilə sızma | Android: FLAG_SECURE; iOS: aşkarlanma + audit; su nişanı (`student_no`) | **Native cihazda yoxlanmayıb** (yalnız kod) |
| I | Ödənişli konspekti abunəsiz oxumaq | Gövdə klientə bağlı cədvəldə; `library_open` icazə yoxlayır; PDF şəxsi bucket-də, yalnız 5 dəq imzalı URL | DB + E2E (imzasız URL rədd) |
| T | Yükləmə yolu ilə başqa fayla yazmaq | Yolu server yaradır, DB `<fənn>/<uuid>.pdf` formatını tələb edir | DB testi |
| I | Başqasının chat/iştirakçı məlumatı | RLS: yalnız iştirakçı və host | İnteqrasiya + E2E (Realtime) |
| I | Sirlərin repoya düşməsi | `.env*` gitignore, CI-də gitleaks | gitleaks konfiqurasiya olunub, **CI-də hələ işləməyib** |
| **D**enial of service | Böyük gövdə | 64 KB limit | Kod |
| D | Chat spam | 10 saniyədə 5 mesaj, 500 simvol | DB testi |
| D | Boş test sessiyaları ilə DB-ni doldurmaq | Saatda ən çox 60 sessiya | DB testi |
| D | Kod brute-force | Saatda 10 yanlış cəhd | DB testi |
| D | API-yə kütləvi sorğu | Supabase platforma limitləri; bizdə ayrıca IP rate limit **yoxdur** | Risk R-06 |
| **E**levation of privilege | Tələbə canlı dərs yaradır, söz götürür | `live_create_session`, `live_set_role` yalnız host/admin; NULL sahib boşluğu bağlanıb | DB testləri |
| E | Köməkçi host başqasını köməkçi edir | Yalnız əsas host | DB testi |
| E | Müəllim cavab açarını REST ilə iz qoymadan dəyişir | Müəllimə `questions` yalnız oxumaq üçün açıqdır; status dəyişikliyi audit ilə RPC-dən | DB testi |
| T | İmtahan vaxtı bitəndən sonra cavab | `submit_answer` vaxtı yoxlayır (+5 san.), sessiyanı bağlayır | DB testi |
| E | Müəllim başqasının məkanında dərs yaradır | Məkan sahibi və ya admin | DB testi |
| E | Ələ keçirilmiş admin digər adminləri bloklayır və ya özünə admin yaradır | Admin özünə və başqa adminə toxuna bilmir; admin rolu API ilə verilmir (yalnız DB sahibi) | DB testi |
| E | Dayandırılmış müəllim kod yaradır, sual dərc edir | `is_staff` dayandırılmışı istisna edir | DB testi |
| S | Dayandırılmış istifadəçi köhnə tokenlə davam edir | GoTrue qadağası: köhnə access token dərhal 401, refresh və yeni giriş bloklanır (`user_banned`) | İnteqrasiya testi (real GoTrue) |
| I | Admin axtarışı ilə əlaqə məlumatlarının toplu çıxarılması | Maskalı e-poçt/telefon, ən çox 20 nəticə, LIKE simvolları qaçırılır | DB testi |
| R | Admin əməliyyatı inkar olunur | Hər admin əməliyyatı audit-də, `detail.by` ilə | DB testi |
| D | Köhnə klient yeni API ilə səhv işləyir | `x-app-version` + `app_config.min_version` → `426 upgrade_required` | İnteqrasiya testi |

## 4. Risk reyestri

| ID | Risk | Ehtimal | Təsir | Səviyyə | Plan |
| --- | --- | --- | --- | --- | --- |
| R-01 | Sual bankı başqa telefonla ekrandan çəkilərək köçürülür | Yüksək | Yüksək | **Kritik** | Tam qarşısı alınmır. Su nişanı mənbəni göstərir, limitlər həcmi azaldır, müqavilədə cərimə bəndi (hüquqi) |
| R-02 | Hüquqi mətnlər (şərtlər, məxfilik) hələ yazılmayıb, amma razılıq toplanır | Yüksək | Yüksək | **Kritik** | İstehsala çıxmazdan əvvəl hüquqşünas mətnləri yazmalı, versiya `legal_documents`-ə əlavə olunmalı. Bu, buraxılış bloklayıcısıdır |
| R-03 | Məlumatın saxlanma yeri qanuna uyğun deyil | Orta | Yüksək | **Yüksək** | Hüquqi rəy; Supabase regionu buna görə seçiləcək |
| R-04 | Native build-lər (iOS/Android) heç vaxt işə salınmayıb | Yüksək | Yüksək | **Yüksək** | EAS development build, real cihazda yoxlama (ekran qoruması, LiveKit, SecureStore) |
| R-05 | SMS provayderi qoşulmayıb, SMS dəyəri və çatdırılma | Orta | Yüksək | **Yüksək** | Provayder seçimi (müdir), sınaq, e-poçt alternativ kimi qalır |
| R-06 | IP səviyyəsində rate limit yoxdur | Orta | Orta | Orta | Supabase/edge limitləri ölçülməli, lazım olsa WAF |
| R-07 | Yük testi yalnız lokal edilib (PERF-001..003, bax PERFORMANCE.md) | Yüksək | Orta | Orta | k6 skriptləri, LiveKit Cloud yük testi |
| R-08 | `APP_ORIGINS` boşdursa CORS `*` | Orta | Aşağı | Aşağı | İstehsalda mütləq təyin edilməli (DEPLOYMENT.md). Token olmadan API işləmir |
| R-09 | Veb versiyada ekran qoruması yoxdur | Yüksək | Orta | Orta | Vebdə yalnız su nişanı; istəyə görə test vebdə bağlana bilər |
| R-10 | Asılılıq zəiflikləri (npm) | Orta | Orta | Orta | 2026-11-04 `npm audit --omit=dev`: 6 orta (glob/minimatch, Expo build alətlərində, işləyən tətbiqdə deyil). Avtomatik düzəliş Expo-nu köhnə versiyaya endirir, ona görə Expo yeniləmələri izlənir. Dependabot (plan) |
| R-12 | Vebdə sessiya tokeni `localStorage`-dadır (XSS olarsa oğurlana bilər) | Aşağı | Yüksək | Orta | Üçüncü tərəf skript yoxdur; istehsalda CSP başlığı; native-də SecureStore |
| R-13 | PDF konspekt brauzerdə açılır: su nişanı yoxdur, imzalı keçid 5 dəqiqə ərzində başqasına ötürülə bilər | Orta | Orta | Orta | Mətn konspektləri tətbiqdə su nişanı ilə; PDF üçün plan: serverdə tələbə nömrəsi ilə möhürləmə və ya tətbiq daxili görüntüləyici |
| R-11 | Müəllim/admin hesabının ələ keçirilməsi | Aşağı | Yüksək | Orta | Staff üçün MFA (Supabase Auth MFA) — plan. Zərər məhdudlaşdırılıb: admin digər adminlərə toxuna bilmir, hər əməliyyat audit-dədir |
| R-14 | Dayandırılmış istifadəçi PostgREST ilə öz məlumatını oxumağa davam edir (JWT yerli yoxlanır, ≤ 1 saat) | Orta | Aşağı | Aşağı | Yazma əməliyyatlarının hamısı Edge API-dən keçir və dərhal bağlanır; yalnız öz məlumatı oxunur |

## 5. Sirlər

| Sir | Harada | Kim görür |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function mühiti (Supabase avtomatik verir) | Yalnız server |
| `LIVEKIT_API_KEY/SECRET` | `supabase secrets set` | Yalnız server |
| SMS provayder tokeni | Supabase Auth ayarları | Yalnız Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Tətbiq paketi | **İctimai** (sir deyil, RLS qoruyur) |

Repoda heç bir real sir yoxdur. Lokal test açarları (`devkey/secret`, Supabase lokal açarları) yalnız lokal stek üçündür.

## 6. Hadisəyə reaksiya (qısa)

1. Sızma şübhəsi: `audit_events`-də `client_screenshot`, `suspended_pace`, `device_replaced` axtar; su nişanındakı nömrə ilə tələbəni tap.
2. Sir sızıbsa: dərhal rotasiya (Supabase panel, LiveKit panel), sonra `supabase secrets set`, funksiyaları yenidən deploy.
3. Hesab bloklama: **Admin otağı → İstifadəçilər → Dayandır** (səbəb məcburidir, audit-ə yazılır; GoTrue qadağası ilə dərhal qüvvəyə minir). Canlı dərsdə `live/ban`.
4. Kütləvi problem (məs. məlumat sızması, səhv buraxılış): **Admin otağı → Tətbiq → Texniki iş rejimi** bütün API-ni bağlayır (ixrac/silmə istisna); köhnə tətbiq versiyası üçün minimum versiyanı qaldırın.
