# ADR 0007: Miqyas təməli (tətbiq böyüyəndə nə dəyişməməli, nə dəyişə bilər)

Status: Qəbul edildi · 2026-11-04

## Kontekst
Məqsəd: istifadəçi sayı yüzlərdən on minlərə çıxanda arxitekturanı yenidən yazmamaq. Lokal ölçmə (PERFORMANCE.md) göstərdi ki, darboğaz verilənlər bazası yox, Edge Runtime-ın CPU-su və şəbəkə gedişləridir. Mobil tətbiqdə əlavə çətinlik: köhnə versiyalar illərlə istifadəçilərin telefonunda qalır.

## Qərarlar

1. **Vəziyyətsiz API.** Edge Function heç bir istifadəçi vəziyyəti saxlamır (yalnız 30 saniyəlik konfiqurasiya keşi). Üfüqi miqyas platformanın işidir; kodda dəyişiklik lazım deyil.
2. **Bütün biznes qaydası verilənlər bazasında, bir əməliyyatda.** Hər yazma bir `security definer` RPC-dir: tranzaksiya, kilid və icazə bir yerdədir. Yarış vəziyyətləri (iki cihazdan eyni cavab, eyni anda kod istifadəsi) DB səviyyəsində bağlanır.
3. **JWT GoTrue-da yoxlanır** (yerli imza yoxlaması yox). Bir şəbəkə gedişi bahadır, amma "bütün cihazlardan çıxış", hesab silinməsi və admin qadağası dərhal işləyir. Yük artanda ilk dəyişiklik: asimmetrik JWT açarları (JWKS) ilə yerli yoxlama + sessiya ləğvi siyahısı. Bu dəyişiklik yalnız `supabase.ts/getUser`-ə toxunur.
4. **Köhnə klient idarəsi.** Klient hər sorğuda `x-app-version` göndərir; `app_config.min_version` köhnə versiyanı `426 upgrade_required` ilə dayandırır. API-də geriyə uyğunluğu pozan dəyişiklik edilməzdən əvvəl minimum versiya qaldırılır. Texniki iş rejimi (`503 maintenance`) miqrasiya və hadisə zamanı bütün yazmaları bağlayır.
5. **Məhdud böyümə.** Böyüyən cədvəllərin saxlama müddəti var (DATABASE.md), gündəlik pg_cron işi hissə-hissə silir. Hər xarici açarın indeksi var. Bütün siyahılar limitlidir.
6. **Limitlər hər istifadəçiyə**: gündəlik sual limiti, saatda 60 test, chat 10 saniyədə 5, kod cəhdi saatda 10, klient siqnalları gündə 50. IP səviyyəsində limit platformadadır (R-06).
7. **Canlı dərs ayrı sistemdir** (LiveKit SFU). Video trafiki heç vaxt bizim serverdən keçmir; bizim server yalnız token verir və webhook qəbul edir.
8. **3D yalnız klientdədir.** Teksturalar prosedur generasiya olunur (şəkil faylı yoxdur, CDN xərci yoxdur), partalar InstancedMesh ilə 2 çəkiliş çağırışıdır.

## Böyümə pilləkəni (nə vaxt nə etmək)

| Əlamət | Addım |
| --- | --- |
| p95 > 400 ms, DB CPU > 60% | Supabase compute tier artırmaq (kod dəyişmir) |
| Edge Function soyuq başlanğıcları | Region tələbələrə yaxın; `api` funksiyasını isti saxlamaq |
| GoTrue sorğuları darboğaz | Qərar 3: JWKS ilə yerli JWT yoxlaması |
| `answers` > 50 milyon sətir | Aylıq bölmə (`partition by range (answered_at)`), köhnə bölmələr ayrıca saxlanılır |
| Şərəf lövhəsi sorğusu yavaş | Həftəlik nəticələri materialized view-a çıxarmaq (pg_cron ilə yeniləmə) |
| 50+ eyni vaxtlı canlı dərs | LiveKit Cloud planı; otaq başına tutum artıq məkan səviyyəsində məhduddur |

## Nəticələr
- Yeni funksiya əlavə edən developer üçün qayda: yazma = yeni RPC (service_role), siyahı = limit + indeks, böyüyən cədvəl = saxlama qaydası, API dəyişikliyi = minimum versiyanı düşün.
- Bu ADR istehsal yük testini əvəz etmir (PERF-001..003 istehsalda ölçülməlidir).
