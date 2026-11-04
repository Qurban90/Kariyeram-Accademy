# Verilənlər bazası

Migrasiyalar (`supabase/migrations`), ardıcıllıqla:

| Fayl | Məzmun |
| --- | --- |
| `20261103000001_core.sql` | Profil, fənn, mövzu, sual, abunə, kod, cihaz, test sessiyası, cavab, baxış, FSRS kartı, gündəlik, audit; köməkçi funksiyalar; qorunan sual RPC-ləri; RLS |
| `20261104000001_accounts_live.sql` | Profil trigger-i, hüquqi sənədlər və razılıqlar, hesab silmə/ixrac, məkanlar, canlı sessiyalar, iştirakçılar, əllər, chat, webhook hadisələri və RPC-ləri |
| `20261104000002_realtime_client_events.sql` | `live_chat` Realtime nəşri, `report_client_event` |
| `20261104000003_finish_idempotent.sql` | `finish_session` təkrar çağırışda `already: true` |
| `20261104000004_staff.sql` | `staff_create_codes`, `staff_set_question_status` (audit ilə) |
| `20261104000005_item_analysis.sql` | `staff_item_responses` (sual analizi üçün anonim xam məlumat) |
| `20261104000007_bugfixes.sql` | İmtahan vaxtı aşımı, canlı dərs uzanması, gecikmiş webhook düzəlişləri |
| `20261104000008_questions_readonly_staff.sql` | Müəllim `questions`-ı REST ilə yalnız oxuyur |
| `20261104000009_session_rate_limit.sql` | Saatda 60 test sessiyası |
| `20261104000010_staff_more.sql` | `staff_list_codes`, `staff_revoke_code`, `staff_diary_add` |
| `20261104000011_library.sql` | Konspekt şkafı: `library_items`, `library_bodies` (klientə bağlı), `library_open`, `staff_library_add/delete`, şəxsi `library` bucket-i |
| `20261104000006_honor_board.sql` | `profiles.show_on_board`, `set_board_visibility`, `board_rows`, `_short_name` |
| `20261104000012_admin.sql` | `is_admin`, dayandırılmış müəllim `is_staff` deyil; `admin_find_users` (maskalı əlaqə), `admin_suspend/unsuspend`, `admin_set_role` (yalnız tələbə ↔ müəllim), `admin_audit` (açar-dəst səhifələmə) |
| `20261104000014_pdf_stamp.sql` | PDF limiti 15 MB (bucket), `library_open`-a tələbə üçün gündə 200 açılış limiti |
| `20261104000015_staff_mfa.sql` | `app_config.staff_mfa_required`, `_staff_aal_ok()`, sual bankında məhdudlaşdırıcı RLS siyasəti (aal2), `admin_set_config` yeni parametrlə |
| `20261104000013_scale.sql` | Çatışmayan xarici açar indeksləri, `maintenance_cleanup` (saxlama siyasəti, pg_cron ilə gündəlik), `app_config` (minimum versiya, texniki iş), `admin_set_config` |

## Prinsiplər

- Bütün yazma əməliyyatları `security definer` RPC-lərdir, yalnız `service_role` icra edir (`revoke execute ... from public, anon, authenticated`). Edge API istifadəçi ID-sini tokendən ötürür.
- Klient yalnız RLS ilə icazə verilən cədvəlləri **oxuyur** (siyahı: [API.md](API.md)).
- Vaxt qaydaları Bakı vaxtı ilə (`_day_start()`).
- Hesab silinəndə: profil kaskadla silinir; istifadə olunmuş kodlar, sual müəllifliyi, gündəlik müəllifliyi `on delete set null` ilə qalır; audit şəxsi məlumatsız (`user_hash`).
- `NULL` müqayisələri üçün `is distinct from` / `coalesce` istifadə olunur (icazə yoxlamalarında üç dəyərli məntiq boşluğu bağlanıb).

## Əsas RPC-lər

| Qrup | Funksiyalar |
| --- | --- |
| Test | `_guard`, `claim_device`, `create_codes`, `redeem_code`, `candidates`, `create_session`, `next_question`, `submit_answer`, `finish_session`, `session_review`, `upsert_card`, `card_of` |
| Müəllim | `staff_create_codes`, `staff_set_question_status`, `staff_item_responses` |
| Hesab | `accept_consents`, `revoke_consent`, `export_my_data`, `prepare_account_deletion`, `report_client_event` |
| Admin | `is_admin`, `admin_find_users`, `admin_suspend`, `admin_unsuspend`, `admin_set_role`, `admin_audit`, `admin_set_config` |
| Xidmət | `maintenance_cleanup` (pg_cron: `karyeram-cleanup`, hər gün 00:17 UTC) |
| Canlı | `live_create_session`, `live_join`, `live_leave`, `live_set_state`, `live_settings`, `live_raise_hand`, `live_lower_hand`, `live_hands_queue`, `live_set_role`, `live_ban`, `live_chat_post`, `live_webhook_event`, `live_attendance` |

## Saxlama siyasəti

| Məlumat | Müddət | Səbəb |
| --- | --- | --- |
| `question_views` | 35 gün | Gündəlik limit və sürət yoxlaması yalnız son günlərə baxır |
| Yarımçıq test (`active`) | 7 gündən sonra `abandoned` | Nəticəyə təsir etmir; köhnə kursorlar yığılmasın |
| `live_events` (webhook təkrar qoruması) | 30 gün | Təkrar hadisə pəncərəsi dəqiqələrdir |
| `live_chat` | Dərs bitəndən 90 gün sonra | Mübahisə halları üçün kifayətdir |
| `audit_events` | Klient siqnalları 180 gün, qalanı 400 gün | Bir illik təhlükəsizlik araşdırması |
| Cavablar, gündəlik, FSRS kartları | Hesab silinənə qədər | Tələbənin öz tarixçəsi |

Silmə 20 000 sətirlik hissələrlə gedir (uzun kilid yoxdur). Əl ilə: `select public.maintenance_cleanup();`

## Miqyas qeydləri

- Hər xarici açarın indeksi var (hesab silinməsi və admin dayandırması böyük cədvəlləri skan etmir). Yoxlama sorğusu: `docs/PERFORMANCE.md`.
- Ən sürətli böyüyən cədvəllər: `answers`, `question_views`, `audit_events`. `answers` 50 milyon sətirə çatanda aylıq bölmələrə (partition) keçid planlaşdırılır (ADR-0007).
- Bütün siyahı RPC-ləri limitlidir (20–500 sətir); audit açar-dəst səhifələmə ilə.

## Məzmun

Real sual bankı repoya yazılmır (`/content/`, `supabase/seed.private.sql` gitignore-dadır). `supabase/seed.sql` yalnız `[DEMO]` etiketli nümunə suallar və məkanlardır.

Sual formatı: `options` (2–6 sətir massivi), `answer_index`, `option_explanations` (hər variant üçün izah), `explanation`, `level` (1–3), `trap`, `law_ref`, `status` (`draft → review → published → retired`).

## Sual idxalı (CSV)

Şablon: [templates/suallar-sablon.csv](templates/suallar-sablon.csv) (Excel-də açın, doldurun, "CSV UTF-8" kimi saxlayın; ayırıcı `;` və ya `,` ola bilər).

| Sütun | Məcburi | Qayda |
| --- | --- | --- |
| Fənn | bəli | Mövcud fənn kodu (`informatika`, `az-dili`, `qanun`) |
| Mövzu | bəli | Yoxdursa yaradılır (pulsuz deyil) |
| Sual | bəli | ≤ 4000 simvol |
| A … F | A, B məcburi | Ardıcıl, boşluqsuz, təkrarsız |
| Düzgün | bəli | Mövcud variantın hərfi |
| İzah, İzah A … İzah F | xeyr | Boşdursa xəbərdarlıq verilir |
| Çətinlik | xeyr | 1/2/3 və ya asan/orta/çətin (defolt orta) |
| Tələ | xeyr | bəli/xeyr |
| İstinad | xeyr | Qanun maddəsi və s. |

```bash
npm run import:questions -- suallar.csv --dry-run
```

```bash
npm run import:questions -- suallar.csv --db "$DATABASE_URL"
```

Hər hansı sətirdə xəta varsa heç nə yazılmır (sətir nömrəsi ilə siyahı çıxır). Eyni mövzuda eyni mətnli sual təkrar yazılmır, ona görə yenidən işə salmaq təhlükəsizdir. Defolt status `review` (tələbə görmür); pilot üçün `--status published`. Dərc etmə: tətbiqdə Kabinet → Müəllim otağı.
