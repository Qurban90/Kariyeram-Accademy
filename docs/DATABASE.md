# Verilənlər bazası

Migrasiyalar (`supabase/migrations`), ardıcıllıqla:

| Fayl | Məzmun |
| --- | --- |
| `20261103000001_core.sql` | Profil, fənn, mövzu, sual, abunə, kod, cihaz, test sessiyası, cavab, baxış, FSRS kartı, gündəlik, audit; köməkçi funksiyalar; qorunan sual RPC-ləri; RLS |
| `20261104000001_accounts_live.sql` | Profil trigger-i, hüquqi sənədlər və razılıqlar, hesab silmə/ixrac, məkanlar, canlı sessiyalar, iştirakçılar, əllər, chat, webhook hadisələri və RPC-ləri |
| `20261104000002_realtime_client_events.sql` | `live_chat` Realtime nəşri, `report_client_event` |
| `20261104000003_finish_idempotent.sql` | `finish_session` təkrar çağırışda `already: true` |

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
| Hesab | `accept_consents`, `revoke_consent`, `export_my_data`, `prepare_account_deletion`, `report_client_event` |
| Canlı | `live_create_session`, `live_join`, `live_leave`, `live_set_state`, `live_settings`, `live_raise_hand`, `live_lower_hand`, `live_hands_queue`, `live_set_role`, `live_ban`, `live_chat_post`, `live_webhook_event`, `live_attendance` |

## Məzmun

Real sual bankı repoya yazılmır (`/content/`, `supabase/seed.private.sql` gitignore-dadır). `supabase/seed.sql` yalnız `[DEMO]` etiketli nümunə suallar və məkanlardır.

Sual formatı: `options` (2–6 sətir massivi), `answer_index`, `option_explanations` (hər variant üçün izah), `explanation`, `level` (1–3), `trap`, `law_ref`, `status` (`draft → review → published → retired`).
