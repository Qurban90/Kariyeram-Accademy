# Karyeram Academy

Virtual məktəb: özünü öyrənmə otaqları, canlı dərs, qorunan test bankı. Dövlət qulluğu və magistratura hazırlığı ilə başlayır.

## Vəziyyət

M0 (təməl) hazırdır: alqoritmlər, verilənlər bazası, qorunan sual API-si və testlər. Tətbiq (Expo) növbəti mərhələdir. Bax: [yol xəritəsi](docs/ROADMAP.md), [arxitektura](docs/ARCHITECTURE.md).

## İşə salmaq

```bash
npm install
npm test          # alqoritm və API testləri (Vitest)
npm run db:test   # SQL sxemi, RLS və RPC testləri (lokal Postgres 16 və ya DATABASE_URL)
```

## Sənədlər

- [Arxitektura və təhlükəsizlik](docs/ARCHITECTURE.md)
- [Yol xəritəsi](docs/ROADMAP.md)
- [Developer rolu və öyrənmə planı](docs/DEVELOPER.md)
- [Müdirdən lazım olanlar](docs/MANAGER.md)

Real sual bankı heç vaxt repoya yazılmır.
