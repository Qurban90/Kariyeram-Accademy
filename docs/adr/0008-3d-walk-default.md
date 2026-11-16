# ADR 0008: 3D gəzinti defolt görünüşdür

Status: Qəbul edildi · 2026-11-15 (ADR 0006-nı dəyişir)

## Kontekst
Sahibin ilkin prototipində (claude.ai artefaktı "Karyeram Academy", 2026-11-03) tələbə birinci şəxs kimi dəhlizdə joystiklə gəzir, sinfə girir, partaya oturur və pəncərə açılır. Tətbiqdə isə defolt 2D səhifə idi, 3D yalnız istəyə bağlı kiçik pəncərə idi və qapı düymə ilə seçilirdi. Müdirin gözləntisi prototipdəki interaktivlikdir; sponsorlara göstəriləcək əsas fərq də budur.

## Qərar
- Tətbiq 3D məktəblə açılır: tam ekran dəhliz, sol tərəfdə joystik (yerimək), sağ tərəfdə baxış, kompüterdə W A S D və siçan.
- Tələbə istədiyi fənn qapısına yaxınlaşıb içəri keçir; sinifdə istədiyi partaya (12 parta) yaxınlaşıb və ya üstünə toxunub oturur; pəncərə (mövzular, test, konspekt) partada açılır.
- 2D "Sadə görünüş" qalır: menyudan seçilir, WebGL açılmayan cihazda avtomatik işə düşür, ekran oxuyucusu ilə istifadə üçün əsas yoldur. Kadr sürəti aşağıdırsa "Yüngül rejim" özü açılır.
- Marşrutlar dəyişmir (`/` dəhliz, `/room/[subject]` sinif, `/test/[session]`): 3D yalnız görünüş qatıdır, bütün icazə və məzmun məntiqi əvvəlki kimidir.

## Əlavə (2026-11-16): qapıdan keçid və oxu zalı
Sahibin ilk rəyi: otağa girəndə və çıxanda keçid "portal" kimi hiss olunurdu; oxu zalı universitet auditoriyası kimi pilləli olmalıdır.
- Divarlar qapı yerləri açıq parçalardan yığılır (`walls.tsx`). Qapı açılanda arxasında həmin sinfin və ya zalın öz interyeri çəkilir, tələbə qapıdan yeriyib keçir; səhnə dəyişən anı qısa yumşaq pərdə örtür, o tayda tələbə eyni yerdən içəri addımlamağa davam edir. Çıxışda eyni qayda: qapının arxasında dəhliz görünür, dəhlizdə tələbə həmin qapıdan çıxır.
- Oxu zalı pilləli auditoriyadır (`Auditorium.tsx`): 9 sıra × 14 yer (126), giriş yuxarı meydançadan, keçidlərlə enilir, böyük lövhə səhnədədir. Zalda da istədiyin yerə oturursan, pəncərədə dərslərin siyahısı açılır. Zalda keçən canlı dərsin 3D görünüşü də bu auditoriyadır (yer nömrəsini server verir).

## Əlavə (2026-11-16): native-də defolt sadə görünüş
İlk real Android sınağında 3D dəhliz açılanda tətbiq dondu ("App isn't responding"). Səbəb cihaz jurnalı olmadan tapılmayıb. Ona görə 3D yalnız vebdə defoltdur; native-də tətbiq sadə görünüşlə açılır, 3D "sınaq" düyməsi ilə yandırılır və donma olarsa növbəti açılışda avtomatik söndürülür. Native 3D real cihazda sabit işlədiyi təsdiqlənəndə defolt geri qaytarıla bilər.

## Əlavə (2026-11-16, ikinci): native-də 3D söndürüldü
Cihaz izləri göstərdi: telefonda 3D modulu yüklənəndə tətbiq `undefined is not a function` ilə çökür (ilk APK-dakı çökmənin də səbəbi budur). 3D yalnız vebdə işləyir; native-də düymə göstərilmir və modul yüklənmir (`view3dSupported`). Native 3D səbəbi tapılıb real cihazda yoxlanana qədər geri qaytarılmır.

## Nəticələr
- Gəzinti məntiqi saf moduldadır (`apps/app/src/school3d/walk.ts`) və vahid testlərlə yoxlanır; veb E2E joystiki, qapıya girişi, oturmanı və pəncərəni yoxlayır.
- Native-də (expo-gl) 3D heç bir cihazda yoxlanmayıb: real telefonda sınaq pilotun şərtidir. Açılmasa tətbiq sadə görünüşə keçir.
- Canlı dərsin 3D sinfi (`Classroom3D`) dəyişməyib: orada yer nömrəsini server verir.
