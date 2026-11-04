# Performans (lokal ölçmə)

**Bu, istehsal göstəricisi deyil.** Bütün stek (Postgres, PostgREST, GoTrue, Kong, Edge Runtime) bir maşında Docker-də işləyir: 4 nüvə, 15 GB RAM, 2026-11-04. İstehsal Supabase-də Edge Functions üfüqi miqyaslanır və verilənlər bazası ayrıdır; orada ölçmə ayrıca aparılmalıdır (PERF-001..003).

Skript: `tests/load/load.mjs`. Hər virtual tələbə real axını keçir: qeydiyyat → razılıq → cihaz → 20 suallıq test (`question/next` + `answer`) → bitirmə. Tətbiqin təkrar siyasəti (bax `apps/app/src/lib/api.ts`) eynilə təqlid olunur ki, istifadəçinin görəcəyi xəta ölçülsün.

```bash
VUS=100 QUESTIONS=20 node tests/load/load.mjs
```

## Nəticələr (gecikmə, ms)

| Eyni vaxtda tələbə | Uğurlu axın | Ötürmə | `question/next` p50 / p95 | `answer` p50 / p95 |
| --- | --- | --- | --- | --- |
| 20 | 20/20 | 133 sorğu/san | 88 / 146 | 110 / 173 |
| 50 | 50/50 | 140 sorğu/san | 180 / 381 | 293 / 560 |
| 100 | 100/100 | 148 sorğu/san | 298 / 688 | 563 / 1139 |
| 150 (hamısı eyni saniyədə qeydiyyat) | 100/150 | 139 sorğu/san | 282 / 834 | 589 / 1347 |
| 100 (təkrar: konfiqurasiya, qadağa və MFA qapılarından sonra) | 100/100 | 142 sorğu/san | 303 / 721 | 576 / 1154 |

## Nə öyrəndik

1. **Tavan ~140–150 sorğu/san** (bu maşında). Darboğaz: Edge Runtime işçilərinin CPU limiti və Kong-a gedən bağlantılar.
2. **Tapılıb düzəldilmiş problemlər:**
   - Yük altında Edge Runtime işçini yeniləyəndə sorğu koda çatmadan `500 WorkerAlreadyRetired` alırdı. Klient indi təkrar edilə bilən marşrutları təkrar edir; `answer` üçün bu təhlükəsizdir (`out_of_order` → növbəti sual).
   - Edge → Kong bağlantısı qırılırdı (`connection reset`). `restDb` şəbəkə səviyyəsindəki xətada bir dəfə təkrar edir; HTTP cavabı alınıbsa təkrar edilmir.
3. **150 eyni anda qeydiyyat** lokal steki doyurur: üçdə bir axın qeydiyyat/cihaz mərhələsində uğursuz olur. Real istifadədə qeydiyyat zamana yayılır; istehsalda ölçülməlidir.
4. **PERF-001 hədəfi (p95 < 400 ms)** lokalda 50 tələbəyə qədər `question/next` üçün qarşılanır, 100-də yox. Bu rəqəm istehsal üçün nəticə deyil.

## Hələ ölçülməyib

- İstehsal Supabase (Edge Functions, Pro plan verilənlər bazası) üzərində eyni skript.
- Canlı dərs: 30–50 iştirakçılı LiveKit otağı (PERF-003). LiveKit Cloud-un öz yük alətləri ilə ölçülməlidir.

## İndeks yoxlaması (xarici açarlar)

Hər xarici açarın ilk sütunu ilə başlayan indeksi olmalıdır (hesab silinməsi və kaskad əməliyyatları böyük cədvəli skan etməsin). 2026-11-04 yoxlamasında 24 açar indekssiz idi; `20261104000013_scale.sql` istifadəçi, sual və canlı dərs açarlarını bağladı. Qalanları kiçik sorğu cədvəllərinə (`subjects`, `legal_documents`, `venues`) istinaddır. Yoxlama sorğusu:

```sql
select c.conrelid::regclass, a.attname, c.confrelid::regclass
from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1] and i.indpred is null);
```

Miqyas qərarları və böyümə pilləkəni: [adr/0007-scale-foundation.md](adr/0007-scale-foundation.md).

## PDF su nişanı (R-13)

`node --experimental-transform-types tests/load/stamp-bench.mts` (bu maşında, Node; Deno runtime-da E2E zamanı real konspekt 74 ms):

| Fayl | Səhifə | Su nişanı müddəti | Yaddaş (RSS) |
| --- | --- | --- | --- |
| 0,15 MB mətn | 120 | 99–132 ms | ~200 MB proses |
| 14 MB (sıxılmayan məlumat) | 120 | 176 ms | ~250 MB proses |

Nəticə: 15 MB limit daxilində bir açılış ~0,2 s CPU-dur (Supabase Edge limiti 2 s). Limitlər: fayl ≤ 15 MB, tələbəyə gündə 200 açılış.
