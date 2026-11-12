# Karyeram Accademy

Virtual məktəb: özünü öyrənmə otaqları, canlı dərs, qorunan test bankı. Dövlət qulluğu və magistratura hazırlığı ilə başlayır.

## Vəziyyət

Hazırdır və lokal stekdə testlə yoxlanıb:

- Backend: qorunan sual bankı, test, FSRS təkrar, gündəlik, abunə kodları, razılıqlar, hesab silmə/ixrac, canlı dərs API-si (LiveKit).
- Tətbiq (Expo): telefon/e-poçt OTP girişi, məktəb zalı, fənn otaqları, qorunan test, nəticə və izahlar, gündəlik, kabinet, oxu zalı (müəllim lövhədə, tələbələr partalarda, əl qaldırma, söz vermə, chat).

Hələ yoxdur: native build-lər real cihazda, istehsal deploy, hüquqi mətnlər, real məzmun, 3D, müəllim paneli, ödəniş. Bax: [yol xəritəsi](docs/ROADMAP.md), [tələblər və statuslar](docs/REQUIREMENTS.md).

## İşə salmaq

```bash
npm install
npm test          # alqoritm və API testləri (Vitest)
npm run db:test   # SQL sxemi, RLS və RPC testləri (lokal Postgres 16 və ya DATABASE_URL)
npm run typecheck # core + tətbiq
```

Lokal Supabase, LiveKit, inteqrasiya və brauzer E2E testləri: [docs/TESTING.md](docs/TESTING.md).

## Sənədlər

- [Tələblər (SRS) və statuslar](docs/REQUIREMENTS.md)
- [Arxitektura](docs/ARCHITECTURE.md), [qərarlar (ADR)](docs/adr/)
- [Təhlükəsizlik: STRIDE və risklər](docs/SECURITY.md)
- [API](docs/API.md), [verilənlər bazası](docs/DATABASE.md)
- [Testlər](docs/TESTING.md), [istehsala çıxış](docs/DEPLOYMENT.md)
- [Yol xəritəsi](docs/ROADMAP.md)
- [Developer rolu və öyrənmə planı](docs/DEVELOPER.md)
- [Müdirdən lazım olanlar](docs/MANAGER.md)

Real sual bankı heç vaxt repoya yazılmır.
