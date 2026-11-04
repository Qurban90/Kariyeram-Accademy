# Arxitektura

Karyeram Academy iki rejimli virtual məktəbdir:

1. **Özünü öyrənmə (oflayn otaqlar):** hər fənnin otağı var. Tələbə girir, şkafdan konspekt götürür, test işləyir, səhvlərini təkrarlayır. Müəllim lazım deyil.
2. **Canlı dərs (onlayn):** müəllim lövhənin qarşısındadır (host), qoşulan tələbələr partalarda oturmuş görünür. Video, səs, ekran paylaşma, əl qaldırma, icazə ilə danışma.

## Texnologiya

| Qat | Seçim | Səbəb |
| --- | --- | --- |
| Tətbiq | Expo (React Native) + expo-router, TypeScript | Bir kod: Android, iOS, veb. Native imkanlar (ekran şəkli qadağası) |
| 3D | react-three-fiber (mobil: `@react-three/fiber/native`, veb: DOM) | Three.js ekosistemi, prototip artıq Three.js ilədir |
| Backend | Supabase: Postgres, Auth, RLS, Edge Functions, Realtime, Storage | İdarə olunan Postgres, RLS ilə sətir səviyyəsində təhlükəsizlik |
| Canlı dərs | LiveKit (açıq mənbə SFU; Cloud və ya öz serverimiz) | Zoom/Meet API almadan video, səs, ekran, icazələr, yazma |
| Alqoritmlər | `packages/core` (saf TypeScript) | Həm Edge Function-da, həm tətbiqdə eyni kod |

## Repo quruluşu

```
apps/app            Expo tətbiqi (növbəti mərhələ)
packages/core       Alqoritmlər: FSRS, test yığma, nəticə, sual analizi, reytinq, medallar
supabase/migrations SQL sxem, RLS, RPC-lər
supabase/functions  Edge Function API (api/) və test olunan məntiq (_shared/)
supabase/tests      Real Postgres-də DB testləri
docs/               Bu sənədlər
```

## Sual bankının qorunması (hazırdır, testlidir)

- Tələbə `questions` cədvəlini birbaşa oxuya bilməz (RLS). Bütün tələbə əməliyyatları `api` Edge Function-dan keçir, o JWT-ni yoxlayır və `service_role` ilə SQL RPC çağırır. RPC-lər `authenticated` rolu üçün bağlıdır.
- Sual bir-bir verilir (`next_question`). Cavab açarı və izah sualla gəlmir.
- Cavab serverdə yoxlanır (`submit_answer`). Növbədən kənar cavab və görülməmiş suala cavab qəbul edilmir.
- Variant sırası hər sessiyada qarışdırılır (`_perm`), "həmişə B" kimi yadda saxlamaq işləmir.
- Gündəlik sual limiti (Bakı vaxtı ilə), eyni sualı yenidən açmaq limiti artırmır.
- Sürət aşkarlama: son 20 cavabın medianı 1.5 saniyədən azdırsa hesab 1 saatlıq dayandırılır, audit qeydi yazılır.
- Tək aktiv cihaz: yeni cihaz köhnəni bağlayır, audit-ə yazılır.
- Eyni anda bir aktiv test sessiyası.
- Su nişanı: `student_no` (ictimai nömrə). Giriş məlumatı deyil, sızan şəkil hesabı açmır.
- Giriş kodları: yalnız SHA-256 hash saxlanılır, `XXXX-XXXX-XXXX`, saatda 10 yanlış cəhddən sonra blok.
- Tətbiqdə (növbəti mərhələ): `expo-screen-capture` ilə Android-də ekran şəkli və yazma bağlanır, iOS-da aşkarlanıb serverə bildirilir. Kopyalama bağlıdır, su nişanı sualın üstündədir.
- 100% qorunma yoxdur (başqa telefonla çəkmək olar). Məqsəd: köçürməni yavaş, çətin və izlənən etmək.

## Alqoritmlər (`packages/core`)

- **FSRS** (ts-fsrs 5.4.2, sabit versiya): hər sual üçün yaddaş sabitliyi və çətinlik. Cavab doğruluğu və sürətindən qiymət çıxır (Again/Hard/Good/Easy). Unudulma ehtimalı (retrievability) hesablanır.
- **Test yığma:** mövzu, qarışıq (20/30/50), "yalnız səhvlərim", imtahan. Qarışıq testdə zəif mövzular daha çox pay alır (`1 + (1 − mənimsəmə)`), paylar Hamilton (largest remainder) metodu ilə bölünür, mövzular növbələnir (interleaving). İmtahanda blueprint payı və çətinlik qarışığı, eyni toxum eyni test verir.
- **Nəticə:** düz, səhv, boş, faiz, mövzu üzrə; konfiqurasiya olunan səhv cəzası; "səhvlərim harada çoxdur".
- **Sual analizi:** çətinlik (p), yuxarı-aşağı 27% diskriminasiya, nöqtə-biserial korrelyasiya, distraktor analizi. Avtomatik bayraqlar: tələli sual, çox asan, çox çətin, fərqləndirmir, **cavab açarı şübhəlidir**. Müəllim paneli bunu göstərəcək.
- **Şərəf lövhəsi:** Wilson aşağı sərhədi; az cavabla təsadüfən yüksək faiz önə keçmir, minimum cavab sayı var.
- **Medallar:** ardıcıl günlər, düz cavab sayı, mövzu ustası (≥50 cavab, ≥90%).

## Canlı dərs dizaynı (mərhələ 4)

- Hər sinif bir LiveKit otağıdır. Token `api` funksiyasında rol və abunəyə görə verilir: müəllim video, səs və ekran yayımlayır; tələbə əvvəlcə yalnız qəbul edir.
- **Əl qaldırma və chat:** LiveKit data kanalı. Müəllim icazə verəndə server tələbənin `canPublish` icazəsini açır, tələbənin mikrofonu aktivləşir.
- **3D sinif:** müəllimin videosu lövhənin yanında ekrana (VideoTexture), ekran paylaşması lövhəyə çəkilir. Hər tələbə öz partasında avatar kimi oturur: oturma yeri qoşulma sırası ilə öndən mərkəzə doğru, tələbənin ID-sinə görə sabit. Danışanın avatarı səs səviyyəsinə görə işıqlanır, əl qaldıranın əli qalxır.
- **Davamiyyət:** LiveKit webhook-larından qoşulma və ayrılma vaxtları, dəqiqə ilə.
- **Yazı:** LiveKit Egress, Supabase Storage, sonra şkafda görünür. Yazma üçün iştirakçı razılığı lazımdır.
- **Kiçik qruplar:** ayrıca LiveKit otaqları.
- Bir sinifdə 30–50 nəfər hədəfdir. 500 nəfər bir neçə sinfə bölünür.

## Açıq məsələlər

- Məlumatın saxlanma yeri (Supabase regionu) və Azərbaycan qanunu: yoxlanılmayıb.
- Tətbiq içi ödəniş: App Store və Google Play qaydaları rəqəmsal məzmun üçün öz ödəniş sistemini tələb edə bilər. Yerli kartla ödəniş əvvəlcə veb üzərindən planlaşdırılır, qayda yoxlanmalıdır.
- Sualların və izahların müəllif hüququ, kirayəçi müəllimlərlə məzmun razılaşması.
- Edge Function-un `packages/core`-u nisbi yolla import etməsi ilk deploy-da yoxlanmalıdır (Supabase CLI bundling).
