# Developer: rolun və öyrənmə planın

## Rolun

Sən layihənin **texniki sahibisən**. Claude kod, test və sənəd yazır, amma qərar, keyfiyyət və real dünya sənin üzərindədir:

- Repo, budaqlar, kod nəzarəti (review): birləşdirməzdən əvvəl kodu oxuyub başa düşmək.
- Hesablar və sirlər: Supabase, LiveKit, Expo, Apple, Google. Sirlər heç vaxt repoya yazılmır.
- Real cihazlarda yoxlama: zəif Android, orta Android, iPhone.
- Buraxılışlar: EAS Build, mağaza göndərişləri, verilənlər bazası migrasiyaları.
- Müdir və müəllimlərlə əlaqə: tələbi texniki tapşırığa çevirmək, prioritet.
- İstehsalda nəzarət: xəta izləmə, audit qeydləri, ehtiyat nüsxə.

## Öyrənmə planı (ehtiyac sırası ilə)

1. **TypeScript**: tiplər, generics, narrowing, async/await. Məşq: `packages/core`-u oxu və bir funksiya əlavə et.
2. **React → React Native + Expo**: komponentlər, hooks, expo-router, development build, EAS Build.
3. **SQL və Postgres**: join, index, tranzaksiya, plpgsql, **RLS**. Məşq: `supabase/migrations`-u oxu, `supabase/tests`-ə bir test əlavə et.
4. **Supabase**: Auth, RLS, Edge Functions (Deno), Realtime, Storage, CLI ilə migrasiya.
5. **Təhlükəsizlik**: JWT, OWASP Mobile Top 10, sirlərin idarəsi, rate limit.
6. **3D**: Three.js əsasları, sonra react-three-fiber. Performans: draw call, instancing, tekstur ölçüsü.
7. **WebRTC və LiveKit**: SFU, track, simulcast, icazələr, egress (yazı).
8. **Test**: Vitest, SQL testləri, mobil E2E (Maestro), yük testi (k6).
9. **Git və CI**: budaq, PR, review, GitHub Actions.
10. **Məhsul**: analitika, xəta izləmə (Sentry), mağaza qaydaları.

Rəsmi sənədlər əsas mənbədir: Expo, Supabase, React Native, Three.js, LiveKit, PostgreSQL docs.

## Birgə iş qaydası

- Hər iş ayrıca budaqda, kiçik addımlarla. Hər dəyişiklikdə testlər keçməlidir (`npm test`, `npm run db:test`).
- Qərarlar `docs/`-a yazılır ki, sonra "niyə belə etdik" sualı qalmasın.
- Hər həftə: real cihazda demo, müdirə qısa hesabat.
