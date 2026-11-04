# ADR 0004: Canlı dərs üçün LiveKit

Status: Qəbul edildi · 2026-11-04

## Kontekst
Zoom kimi dərs tətbiqin içində olmalıdır: host video/ekran, iştirakçılar dinləyir, əl qaldırır, icazə ilə danışır.

## Qərar
LiveKit (açıq mənbə SFU; Cloud və ya öz server). Tokenlər yalnız Edge API-də rola görə imzalanır: auditoriya yalnız qəbul edir, söz verilən yalnız mikrofon, host/köməkçi kamera+mikrofon+ekran. Rol dəyişikliyi əvvəl DB-də, sonra LiveKit server API ilə (UpdateParticipant). Əl növbəsi, chat, davamiyyət DB-dədir (data kanalında deyil), çünki audit və icazə yoxlaması lazımdır.

## Alternativlər
Jitsi (iframe, UI nəzarəti zəif), Zoom/Meet SDK (lisenziya, brendinq, tətbiq daxili təcrübə məhdud), Agora/Daily (qapalı, qiymət).

## Nəticələr
- Real LiveKit dev serverinə qarşı inteqrasiya və E2E testləri var.
- Native ekran paylaşma əlavə iş tələb edir (iOS broadcast extension).
- Yük (30–50 nəfərlik sinif) ölçülməyib.
