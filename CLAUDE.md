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

- Tələbə joystiklə dəhlizdə gəzir, qapıdan sinfə girir, istədiyi partaya oturur, pəncərə partada açılır. Kod: `apps/app/src/school3d/` (`walk.ts` saf məntiq, `Corridor3D`/`SchoolCorridor` dəhliz, `Room3D` oturulan məkan (sinif `StudyRoom`, oxu zalı `Auditorium`), `walls.tsx` qapı yeri açıq divarlar, `WalkPad` giriş, `Hud` düymələr və keçid pərdəsi).
- Qapıdan keçid portal olmamalıdır: qapı açılanda arxasında o tayın öz interyeri çəkilir və tələbə qapıdan yeriyib keçir. Yeni məkan əlavə edəndə bu qaydanı saxla.
- Telefonda (native) defolt sadə görünüşdür: 3D real Android-də donub, səbəb tapılana qədər yalnız sınaq düyməsi ilə açılır və donarsa özü söndürülür (`use3dGuard`). Native 3D-ni real cihazda yoxlamadan defolt etmə.
- Sadə (2D) görünüş həmişə işlək qalmalıdır (`src/lib/view3d.ts`): WebGL açılmayan cihaz və ekran oxuyucusu üçün yeganə yoldur. Yeni funksiya hər iki görünüşdə əlçatan olmalıdır.
- 3D-də şəkil və şrift faylı yüklənmir (prosedur teksturalar, `texgen.ts`); mətn ekran üstü qatda (HUD) göstərilir.

## Dizayn sistemi (dəyişmə, genişləndir)

- Mənbə: `apps/app/src/theme.ts`. İki palitra: `colors` (gecə: dəhliz, giriş, canlı dərs) və `roomColors` (işıqlı sinif: fənn otağı, test, nəticə, konspekt). Qızılı yalnız seçimi və növbəti addımı göstərir.
- Komponentlər yalnız `apps/app/src/components/ui.tsx`-dən: `Screen`, `Section`, `Card`, `Group`, `ListRow`, `SelectRow`, `Sheet` (modal), `Button`, `Chip`, `Segmented`, `Field`, `Badge`, `Stat`, `Bar`. Kart içində kart qoyma.
- Rəng: komponent daxilində `usePalette()`, stil cədvəli `useSheet(makeStyles)`. Sabit hex yazma.
- Mətn: `react-native`-in `Text`-i yox, `src/components/Text.tsx` (şrift çəkisini düzgün fayla çevirir). Şriftlər: Fraunces (başlıq), Hanken Grotesk (mətn).
- İkon: emoji yox, `Icon` (`src/components/Icon.tsx`).
- Ad hər yerdə "Karyeram Accademy" (iki C, loqodakı kimi).

## İşin gedişi (addım-addım)

Bu bölmə görülən işlərin sıra ilə qısa xülasəsidir ki, yeni sessiya (başqa model də ola bilər) haradan davam edəcəyini bilsin. Təfərrüat, rəqəmlər və açıq problemlər `docs/AI_HANDOFF.md`-dədir; ikisi ziddiyyət təşkil etsə, kodu və git tarixçəsini əsas götür və hər iki faylı düzəlt.

### Hazırkı vəziyyət (2026-11-16)

- **Veb işləyir:** https://qurban90.github.io/Kariyeram-Accademy/ (3D məktəb defolt). Sahib real e-poçt kodu ilə daxil olub; görünüşü yalnız sahib təsdiqləyə bilər (bulud sessiyasından sayt açılmır).
- **Android APK işləmir:** girişdən sonra, əsas (zal) ekranı çəkilərkən tətbiq bağlanır. Səbəb tapılmayıb. Son yığım (`7d0351e`) diaqnostikalıdır; sahib onu telefonda sınayıb "etdim" yazmalıdır, sonra izlər server jurnalından oxunmalıdır (aşağıda "Növbəti addım").
- `main` = `7d0351e`. İş budağı `karyeram/foundation` ondan irəlidədir (yalnız sənədlər).

### Görülən işlər, sıra ilə

1. **Baza (11-03, 11-04).** Köhnə "Pillə" tətbiqi silindi, təməl yazıldı: alqoritmlər (`packages/core`), qorunan sual bankı və Edge API, giriş (OTP), fənn otaqları, test, gündəlik, canlı dərs (LiveKit), müəllim və admin otaqları, sənədlər və ADR-lər.
2. **Yenidən yoxlama və dizayn (11-12).** `karyeram/foundation` `main` oldu. Bütün test qatları işə salındı. Loqoya uyğun dizayn sistemi: gecə palitrası, işıqlı sinif palitrası, `ui.tsx` komponentləri, Fraunces + Hanken Grotesk, SVG ikonlar. Ad hər yerdə "Karyeram Accademy" oldu.
3. **Təhvil sənədləri (11-15).** Bu fayl və `docs/AI_HANDOFF.md` yaradıldı.
4. **Pilot infrastrukturu (11-15).** GitHub Actions axınları: `deploy-backend.yml` (migrasiyalar, əsas məlumat, Auth ayarları, funksiyalar), `deploy-web.yml` (GitHub Pages), `android-apk.yml` (APK, "pilot" buraxılışına yüklənir). Hamısı əl ilə işə salınır (`workflow_dispatch`, `main`-dən). Çıxan və düzəldilən xətalar: olmayan `adaptive-icon.png`, R8 addımında dayanma (R8 söndürüldü), Supabase tokeninin formatı, `db push` üçün `--remote`.
5. **Server və məzmun (11-15).** Supabase layihəsi yerləşdirildi (Frankfurt, pulsuz plan), SMTP qoşuldu. Sahibin Drive qovluğundan 247 sual yükləndi (İnformatika 39, Konstitusiya 106 + 102); alətlər `scripts/content/law_parse.py` və `scripts/import-questions-api.mts`. Məzmun repoya yazılmır. Sahibin hesabı (tələbə № 1) admin edildi.
6. **3D gəzinti (11-15).** Sahibin prototipi (claude.ai artefaktı "Karyeram Academy") əsasında: dəhlizdə joystiklə gəzinti, qapıdan sinfə giriş, istədiyin partaya oturma, partada açılan pəncərə. 3D vebdə defolt oldu (ADR 0008).
7. **Qapıdan keçid və auditoriya (11-16).** Sahibin rəyi ilə: divarlarda qapı yerləri açıldı, qapı açılanda arxasında o tayın öz interyeri görünür və tələbə yeriyib keçir; oxu zalı 126 yerlik pilləli auditoriya oldu.
8. **Telefon sınağı və çökmə (11-16).** Sahib APK-nı quraşdırdı; qeydiyyat və kod işlədi, ondan sonra tətbiq bağlandı.
   - Birinci fərziyyə "3D donur" idi və **yanlış çıxdı**: native-də defolt sadə görünüş edildi (`af8190f`), amma o yığım da eyni yerdə bağlandı.
   - Server jurnalı və baza göstərdi: kod təsdiqi, profil, cihaz qeydi və zal ekranının bütün sorğuları uğurludur (200); yenidən açanda da eyni. Yəni giriş, sessiya, şəbəkə, server sağlamdır; çökmə `app/index.tsx` məlumatla çəkiləndə olur.
   - Statik analiz (RN-in Android qradiyent mənbələri, auth axını, sorğular, Hermes-də olmayan API-lər) konkret səbəb vermədi.
   - Diaqnostika əlavə olundu (`src/lib/diag.ts`): mərhələ izləri, JS xətası ekranı, mərhələli açılış, ən sadə ekran (`SafeHall`). Yığım `7d0351e`.

### Növbəti addım (buradan davam et)

1. Sahibdən soruş: diaqnostikalı APK-nı quraşdırıb 3 dəfə açdımı, nə gördü, telefonun modeli və Android versiyası nədir.
2. İzləri oxu (bulud sessiyasında Supabase Management API-nin açarı proksi tərəfindən əlavə olunur, başlıqda yer tutucu yazılır):

```bash
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node -e '
const u=new URL("https://api.supabase.com/v1/projects/ccnwynpcjqtilngounvd/analytics/endpoints/logs");
u.searchParams.set("sql","select timestamp, event_message from logs where event_message like \"%diag%\" order by timestamp limit 300");
u.searchParams.set("iso_timestamp_start","2026-11-16T13:40:00Z");u.searchParams.set("iso_timestamp_end","2026-11-17T00:00:00Z");
fetch(u,{headers:{Authorization:"Bearer sbp_placeholder"}}).then(async r=>console.log(r.status,(await r.text()).slice(0,6000)))'
```

   Sorğular arasında 6 saniyədən çox gözlə (429 verir). Cədvəlin adı `logs`-dur; `select *` qadağandır. İzin formatı: `diag|yığım|işə salma|sıra|mərhələ|təfərrüat`.
3. İzləri belə oxu:
   - `js_fatal` / `js_stack` varsa: səbəb JS xətasıdır, mətn izdədir.
   - Son iz `stage_next_N` olub ardınca heç nə gəlmirsə: çökən zal ekranının N-ci hissəsidir (`app/index.tsx`-də `STAGES`: 1 başlıq, 2 salam, 3 bölmə və çip, 4 ilk qapı, 5 qalan qapılar, 6 zal qapısı, 7 siyahı). O hissənin komponentini sadələşdirib yenidən yığ.
   - `hall_rendered sade` və `hall_stable` varsa: ən sadə ekran işləyir, problem dizayn komponentlərindən birindədir.
   - Ən sadə ekranda da bağlanırsa: səbəb ekran deyil (naviqasiya, native modul, yaddaş); o halda cihaz jurnalı (`adb logcat`) lazımdır.
4. Səbəb tapılıb düzələndən sonra: fənn otağı, test və nəticə ekranlarını da telefonda yoxlat (heç vaxt açılmayıblar), sonra mərhələli açılışı sil (izlər və xəta ekranı qalsın).

### Bulud sessiyasının məhdudiyyətləri

- Android emulyatoru işə salmaq olmur (KVM yoxdur, `dl.google.com` bağlıdır). Telefonda yoxlamanı yalnız sahib edə bilər; "telefonda işləyir" demə, sahib təsdiqləməyibsə.
- `*.supabase.co` və `qurban90.github.io` buradan açılmır; yalnız Management API (`api.supabase.com`) əlçatandır.
- Lokal test steki hər sessiyada (bəzən sessiya ortasında da) sönür, yenidən qaldırmaq lazımdır:

```bash
(nohup dockerd > /tmp/dockerd.log 2>&1 &); sleep 5; SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN=local-dummy npx supabase start -x studio,logflare,vector,imgproxy,supavisor,postgres-meta
```

```bash
docker run -d --name lk --network supabase_network_karyeram -p 7880:7880 livekit/livekit-server:v1.9.11 --dev --bind 0.0.0.0
```

```bash
nohup npx supabase functions serve --env-file supabase/functions/.env.local > /tmp/functions.log 2>&1 &
```

- GitHub əməliyyatları MCP alətləri ilədir (`gh` yoxdur). APK yığımı 22–30 dəqiqə, veb deploy 2 dəqiqə çəkir.
- Veb E2E proqram renderində gedir: bir dəfə "3D məktəb: joystiklə dəhlizdə gəzinti" addımı səbəbi bilinmədən düşüb, təkrar qaçışlarda keçib. Düşsə `FAIL.png`-ə və brauzer xətalarına bax, kor-koranə təkrar etmə.

### Təkrarlanmamalı səhvlər

- Cihazda yoxlanmamış fərziyyəni səbəb kimi təqdim etmə. "3D donur" fərziyyəsi bir APK dövrünə (30 dəqiqə və sahibin vaxtı) başa gəldi. Əvvəl sübut (server jurnalı, baza), sonra düzəliş.
- Shell-də sənəd yazanda dırnaqsız heredoc (`<<EOF`) işlətmə: əks dırnaq içindəki mətn əmr kimi icra olunur və fayl korlanır. `<<'EOF'` yaz.
- Dəhliz və sinif ekranları eyni vaxtda yaddaşda qalır: `testID`-lər ekranlar arasında təkrarlanmamalıdır.
- Animasiyanın sonunda çağırılan funksiya köhnə render-in dəyərlərini görür: orada React vəziyyətinə yox, canlı obyektə (`walker.mode`) bax.
- Hər `main` push-u və hər yığım üçün sahibdən ayrıca icazə al; əvvəlki icazə növbətiyə keçmir.
