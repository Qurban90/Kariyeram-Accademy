# Yol xəritəsi

Müddətlər təxminidir və bir developer + Claude üçündür. Hər mərhələnin "bitdi" şərti var.

| Mərhələ | Nə | Bitdi şərti |
| --- | --- | --- |
| M0 Təməl ✅ | Alqoritmlər, DB sxemi, RLS, qorunan sual RPC-ləri, API qatı, testlər | Vahid və DB testləri keçir |
| M1 Tətbiq qabığı 🟡 | Expo tətbiqi, telefon/e-poçt OTP, razılıqlar, cihaz və kod, 2D məktəb zalı, fənn otaqları, test, nəticə və izahlar, səhvlərim, gündəlik, kabinet, ekran qoruması. **Hazırdır və veb E2E ilə yoxlanıb.** Qalan: real cihaz testi (3D gəzinti daxil), real məzmunun qalanı | 5 pilot tələbə Android-də real suallarla işləyir |
| M2 Məzmun və müəllim paneli 🟡 (CSV idxalı, dərc ekranı, toplu kod hazırdır) | Word/PDF/Excel idxalı, yoxlama və dərc, sual analizi paneli, kod idarəsi, qiymət və qeyd | Bir fənnin bankı tam yüklənib, müəllim analizləri görür |
| M3 Motivasiya 🟡 (şərəf lövhəsi hazırdır) | İmtahan zalı, Müəllimə sual, şərəf lövhəsi, medallar, bildirişlər | Həftəlik lövhə real məlumatla işləyir |
| M4 Canlı dərs 🟡 | LiveKit, əl qaldırma, icazə, yalnız host danışır, chat, davamiyyət (API). **2D oxu zalı hazırdır və real LiveKit ilə E2E yoxlanıb.** Qalan: 3D sinif, dərs yazısı, davamiyyət UI-si, native ekran paylaşma, yük testi | 1 pilot dərs 20+ tələbə ilə |
| M5 Biznes | Ödəniş, abunə müddəti, otaq kirayəsi, mağazalara çıxış | İlk ödənişli tələbələr, Play/App Store-da tətbiq |
| M6 Möhkəmlik 🟡 (miqyas təməli, admin, MFA, saxlama siyasəti, PDF su nişanı hazırdır) | 500 virtual istifadəçi ilə yük testi, monitorinq, xəta izləmə | Yük testində hədəf gecikmələr |

İlk real addım (M1-in sonu): İnformatika bankını yükləyib 5–10 tələbə ilə sınamaq.

## Növbəti addımlar (prioritet sırası ilə)

Kodda istifadəçi/müdir olmadan görülə bilən işlər bitib (2026-11-04). Qalanların hamısı hesab, cihaz, hüquqi mətn və ya qərar tələb edir:

1. **Hüquqi mətnlər** (şərtlər, məxfilik, dərs yazısı razılığı) → `legal_documents`-ə versiya. Buraxılış bloklayıcısı (R-02).
2. **Hesablar**: Supabase Pro (region qərarı), SMS provayderi, SMTP + domen, LiveKit Cloud, Apple Developer, Google Play.
3. **İstehsala çıxış**: DEPLOYMENT.md addımları (miqrasiyalar, sirlər, TOTP MFA aktiv, ilk admin + MFA, pg_cron yoxlaması).
4. **Real cihaz**: EAS development build; Android/iPhone-da ekran qoruması, LiveKit, SecureStore, 3D (expo-gl), PDF açılışı, MFA girişi.
5. **Məzmun**: İnformatika bankını CSV ilə idxal (`npm run import:questions`), müəllim yoxlaması və dərc, 5–10 pilot tələbə.
6. **İstehsalda ölçmə**: yük testi (PERF-001..003), LiveKit 30–50 iştirakçı.
7. Sonra (M4–M5): dərs yazısı (LiveKit Egress, razılıqla), native 3D-də lövhəyə video, ödəniş, mağaza buraxılışı, gizli (görünməz) PDF nişanı, MFA bərpa kodları.
