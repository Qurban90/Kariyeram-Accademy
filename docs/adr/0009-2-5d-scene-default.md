# ADR 0009: 2.5D avtomatik məktəb səhnəsi defolt görünüşdür

Status: Qəbul edildi · 2026-11-21 (ADR 0008-in defolt hissəsini dəyişir; 3D gəzinti seçim kimi qalır)

## Kontekst
Müdirin tələbi (2026-11-20): interfeys maksimum sadə və avtomatik olsun. Tələbə binadan girir, dəhliz açılır, özü fənn otağına girir, sinifdə tələbələr və müəllim var, özü adı yazılmış partaya oturur, partada iki seçim var ("Dərsin izahı", "Testi yazmaq istəyirəm"), seçiləndə tam ekran açılır. Məqsədə 3 toxunuşla çatmaq. Giriş oyun girişi kimi özü oynasın.

Əvvəlki cəhd (3e11346) bunu three.js ilə qurmuşdu. 3D real Android-də donub (ADR 0008 əlavəsi), səbəb tapılmayıb, cihaz jurnalı yoxdur və bu mühitdə emulyator işləmir. Telefonda işləməyən defolt qəbul edilə bilməz.

## Qərar
- Defolt görünüş "səhnə"dir (`apps/app/src/scene/`): WebGL yoxdur. Səhnə SVG ilə çəkilir, kamera isə qatların transformudur: hər qat bir dərinlikdədir və kamera irəli gedəndə, yana keçəndə, oturanda perspektivə uyğun böyüyür və sürüşür (`plan.ts`, saf riyaziyyat, vahid testlərlə). Hərəkət yalnız transform və şəffaflıqdır, telefonda native driver ilə JS-dən asılı olmadan axır.
- Axın: tətbiq hər açılışda bir dəfə bina girişini göstərir (7 s, "Keç" ilə dayandırılır) → dəhliz (qapılar və aşağıda siyahı) → fənnə toxunuş (1) → kamera qapıya yeriyir, qapı açılır → sinif (müəllim, 11 tələbə, boş parta) → özü oturur → partanın üstü → "Testi yazmaq istəyirəm" (2) → mövzuya toxunuş (3) test başlayır.
- Görünüş üç rejimlidir (`src/lib/view3d.ts`): `scene` (defolt), `3d` (joystiklə gəzinti, yalnız vebdə menyuda), `simple` (animasiyasız siyahı). "Azaldılmış hərəkət" və telefonda ekran oxuyucusu açıqdırsa səhnə animasiyasız birbaşa son vəziyyətə keçir.
- Qapıdan keçid portal deyil: tələbə qapıya yeriyir, qapı perspektivlə açılır, arxada sinfin işığı və lövhəsi görünür, sinif eyni işıqla başlayır.
- PDF materiallar tələbəyə göstərilmir (kurs materialıdır); yazılı izah "Dərsin izahı" səhifəsindədir. Hər səhifədə akademiyanın reklamı: zəng və WhatsApp.

## Nəticələr
- Telefonda risk azalır (WebGL yoxdur), amma native səhnə də real cihazda hələ yoxlanmayıb.
- 3D kod (`school3d/`) qalır və E2E ilə yoxlanır; canlı dərsin 3D sinfi dəyişməyib.
- Səhnə illüstrasiyadır: rənglər `theme.ts`-də `scene` palitrasıdır, şəkil və şrift faylı yüklənmir.
