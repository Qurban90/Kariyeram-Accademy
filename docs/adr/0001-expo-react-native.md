# ADR 0001: Expo (React Native), PWA-first yox

Status: Qəbul edildi · 2026-11-03

## Kontekst
Məhsul mobil tətbiqdir; Android-də ekran şəkli qadağası (FLAG_SECURE), iOS-da aşkarlama, kamera/mikrofon, mağazada mövcudluq lazımdır. Sahib PWA ilə başlamamağı açıq şəkildə tələb etdi.

## Qərar
Expo SDK (React Native, expo-router, TypeScript), bir kod bazası: Android, iOS, veb.

## Nəticələr
- Native imkanlar (expo-screen-capture, SecureStore, LiveKit React Native SDK) mövcuddur.
- Veb versiya eyni koddan gəlir, amma orada ekran qoruması yoxdur (yalnız su nişanı).
- Native build-lər EAS və real cihaz tələb edir; bu sessiyada edilməyib.
