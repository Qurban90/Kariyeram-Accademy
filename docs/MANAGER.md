# Müdirdən lazım olanlar

## Hesablar və xərclər (qiymətlər yoxlanılmalıdır)

- Apple Developer: ildə 99 dollar. Şirkət adına hesab üçün D-U-N-S nömrəsi tələb oluna bilər.
- Google Play Console: bir dəfəlik 25 dollar.
- Supabase: pulsuz plan inkişaf üçün, istehsal üçün ödənişli plan.
- Expo EAS: pulsuz plan başlanğıc üçün, çox build lazım olsa ödənişli.
- LiveKit: canlı dərs mərhələsində (Cloud və ya öz server).
- Domen.

## Avadanlıq

- 1 zəif Android (2–3 GB RAM), 1 orta Android, 1 iPhone. 3D və performans real cihazda yoxlanmalıdır.

## Məzmun

- Sualların strukturlu ixracı: fənn, mövzu, sual, variantlar, düzgün cavab, **hər variant üçün izah**, çətinlik, tələli işarəsi, qanun istinadı. Şablonu biz hazırlayacağıq.
- İlk sınaq üçün 100 suallıq bir paket (İnformatika təklif olunur).
- Sualların və izahların müəllif hüququnun sizə məxsus olduğunun təsdiqi.

## Hüquqi

- Məxfilik siyasəti, istifadə şərtləri, canlı dərsin yazılmasına razılıq, yetkinlik yaşına çatmayanlar qaydası.
- "Karyeram Accademy" adının yazılışı və ticarət nişanı yoxlaması.
- Ödəniş və mağazalar üçün hüquqi şəxs.

## İnsanlar və vaxt

- 5–10 pilot tələbə, canlı dərs pilotu üçün 1–2 müəllim.
- Həftədə 1 saat: demo və qərarlar.
- İstəyə bağlı: 3D dizayner (müəllim avatarı, sinif modelləri) üçün büdcə.

## Xidmətlər (giriş və canlı dərs üçün qoşulmalıdır)

| Xidmət | Nə üçün | Vəziyyət |
| --- | --- | --- |
| SMS provayderi (Twilio, Vonage və ya MessageBird; Azərbaycan nömrələrinə çatdırılma yoxlanmalı) | Telefonla giriş kodu | Kod hazırdır, hesab lazımdır |
| SMTP (məs. Resend, Postmark, şirkət poçtu) + domen SPF/DKIM | E-poçtla giriş kodu | Şablon hazırdır, hesab lazımdır |
| Supabase (Pro) | Baza, giriş, API | Lokal işləyir, layihə açılmalıdır |
| LiveKit Cloud (və ya öz server) | Canlı dərs | Lokal işləyir, hesab lazımdır |
| Apple Developer, Google Play | Mağazalar | Lazımdır |

## Gözlənilən qərarlar

1. ~~Giriş üsulu~~ — qərar verildi: həm telefon (SMS kodu), həm e-poçt (kod). Hər ikisi hazırdır.
2. Məlumatın saxlanma yeri tələbi varmı?
3. Qiymət və paketlər (yalnız test, test + canlı dərs).
4. Ad: "Accademy" qəsdəndirmi?
