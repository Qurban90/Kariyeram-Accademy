# ADR 0008: 3D gəzinti defolt görünüşdür

Status: Qəbul edildi · 2026-11-15 (ADR 0006-nı dəyişir)

## Kontekst
Sahibin ilkin prototipində (claude.ai artefaktı "Karyeram Academy", 2026-11-03) tələbə birinci şəxs kimi dəhlizdə joystiklə gəzir, sinfə girir, partaya oturur və pəncərə açılır. Tətbiqdə isə defolt 2D səhifə idi, 3D yalnız istəyə bağlı kiçik pəncərə idi və qapı düymə ilə seçilirdi. Müdirin gözləntisi prototipdəki interaktivlikdir; sponsorlara göstəriləcək əsas fərq də budur.

## Qərar
- Tətbiq 3D məktəblə açılır: tam ekran dəhliz, sol tərəfdə joystik (yerimək), sağ tərəfdə baxış, kompüterdə W A S D və siçan.
- Tələbə istədiyi fənn qapısına yaxınlaşıb içəri keçir; sinifdə istədiyi partaya (12 parta) yaxınlaşıb və ya üstünə toxunub oturur; pəncərə (mövzular, test, konspekt) partada açılır.
- 2D "Sadə görünüş" qalır: menyudan seçilir, WebGL açılmayan cihazda avtomatik işə düşür, ekran oxuyucusu ilə istifadə üçün əsas yoldur. Kadr sürəti aşağıdırsa "Yüngül rejim" özü açılır.
- Marşrutlar dəyişmir (`/` dəhliz, `/room/[subject]` sinif, `/test/[session]`): 3D yalnız görünüş qatıdır, bütün icazə və məzmun məntiqi əvvəlki kimidir.

## Nəticələr
- Gəzinti məntiqi saf moduldadır (`apps/app/src/school3d/walk.ts`) və vahid testlərlə yoxlanır; veb E2E joystiki, qapıya girişi, oturmanı və pəncərəni yoxlayır.
- Native-də (expo-gl) 3D heç bir cihazda yoxlanmayıb: real telefonda sınaq pilotun şərtidir. Açılmasa tətbiq sadə görünüşə keçir.
- Canlı dərsin 3D sinfi (`Classroom3D`) dəyişməyib: orada yer nömrəsini server verir.
