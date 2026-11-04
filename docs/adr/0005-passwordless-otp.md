# ADR 0005: Parolsuz giriş (telefon SMS OTP və e-poçt OTP)

Status: Qəbul edildi · 2026-11-04

## Kontekst
Müdir həm telefon, həm e-poçt ilə giriş istədi. Parollar unudulur, paylaşılır və sızır.

## Qərar
Supabase Auth: telefon üçün SMS OTP (+994 mobil prefiksləri klientdə yoxlanır), e-poçt üçün 6 rəqəmli kod (keçid yox, çünki mobil tətbiqdə kod daha etibarlıdır). Yeni istifadəçi avtomatik yaranır; profil DB trigger-i ilə.

## Nəticələr
- SMS xərci və provayder seçimi lazımdır (R-05).
- Hesaba ikinci identifikator bağlamaq (FR-003) hələ yoxdur.
- Hesab paylaşımı tək aktiv cihaz qaydası ilə məhdudlaşdırılır.
