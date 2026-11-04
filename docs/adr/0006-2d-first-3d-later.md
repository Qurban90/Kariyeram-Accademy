# ADR 0006: Əvvəl 2D məktəb, 3D sonra

Status: Qəbul edildi · 2026-11-04

## Kontekst
Konsepsiya "məktəb binası": qapılar, siniflər, lövhə, partalar. 3D (react-three-fiber) zəif Android cihazlarda performans riski daşıyır və canlı video ilə birlikdə yükü artırır.

## Qərar
V1-də məktəb metaforası 2D komponentlərlə: dəhlizdə açılan qapılar, lövhədə müəllim videosu/ekranı, nömrəli partalarda iştirakçılar, danışanın işıqlanması. 3D sonrakı mərhələdə ayrıca rejim kimi; zəif cihazda 2D qalır.

## Nəticələr
- Bütün funksiyalar 3D-dən asılı deyil; 3D yalnız vizual qatdır.
- 3D üçün performans büdcəsi və cihaz testləri sonra.
