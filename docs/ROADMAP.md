# Yol xəritəsi

Müddətlər təxminidir və bir developer + Claude üçündür. Hər mərhələnin "bitdi" şərti var.

| Mərhələ | Nə | Bitdi şərti |
| --- | --- | --- |
| M0 Təməl ✅ | Alqoritmlər, DB sxemi, RLS, qorunan sual RPC-ləri, API qatı, testlər | Vahid və DB testləri keçir |
| M1 Tətbiq qabığı 🟡 | Expo tətbiqi, telefon/e-poçt OTP, razılıqlar, cihaz və kod, 2D məktəb zalı, fənn otaqları, test, nəticə və izahlar, səhvlərim, gündəlik, kabinet, ekran qoruması. **Hazırdır və veb E2E ilə yoxlanıb.** Qalan: native build, real cihaz testi, real məzmun, 3D dəhliz | 5 pilot tələbə Android-də real suallarla işləyir |
| M2 Məzmun və müəllim paneli 🟡 (CSV idxalı hazırdır) | Word/PDF/Excel idxalı, yoxlama və dərc, sual analizi paneli, kod idarəsi, qiymət və qeyd | Bir fənnin bankı tam yüklənib, müəllim analizləri görür |
| M3 Motivasiya | İmtahan zalı, Müəllimə sual, şərəf lövhəsi, medallar, bildirişlər | Həftəlik lövhə real məlumatla işləyir |
| M4 Canlı dərs 🟡 | LiveKit, əl qaldırma, icazə, yalnız host danışır, chat, davamiyyət (API). **2D oxu zalı hazırdır və real LiveKit ilə E2E yoxlanıb.** Qalan: 3D sinif, dərs yazısı, davamiyyət UI-si, native ekran paylaşma, yük testi | 1 pilot dərs 20+ tələbə ilə |
| M5 Biznes | Ödəniş, abunə müddəti, otaq kirayəsi, mağazalara çıxış | İlk ödənişli tələbələr, Play/App Store-da tətbiq |
| M6 Möhkəmlik | 500 virtual istifadəçi ilə yük testi, monitorinq, xəta izləmə | Yük testində hədəf gecikmələr |

İlk real addım (M1-in sonu): İnformatika bankını yükləyib 5–10 tələbə ilə sınamaq.

## Növbəti addımlar (prioritet sırası ilə)

1. Hüquqi mətnlər, SMS provayderi, Supabase regionu (müdirin qərarları) — buraxılış bloklayıcılarıdır.
2. EAS development build və real Android/iPhone-da yoxlama (ekran qoruması, LiveKit, SecureStore).
3. ~~Sual idxalı~~ (CSV hazırdır: `npm run import:questions`) → müəllimin yoxlama və dərc ekranı.
4. İstehsal Supabase + LiveKit Cloud (bax: DEPLOYMENT.md), pilot.
5. Müəllim paneli: kod idarəsi, qiymət/qeyd, sual analizi.
6. 3D dəhliz və sinif (ayrıca rejim).
