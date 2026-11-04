# Edge API

Ünvan: `POST {SUPABASE_URL}/functions/v1/api/<marşrut>`

- Başlıqlar: `Authorization: Bearer <istifadəçi JWT>`, `apikey: <anon açar>`, `Content-Type: application/json`.
- Gövdə: JSON obyekt, ən çox 64 KB. İstifadəçi ID-si **heç vaxt** gövdədən götürülmür (tokendən gəlir).
- Cavab: uğurda JSON; xətada `{ "error": "<kod>", "requestId": "<id>" }`. `x-request-id` başlığı loglarla əlaqə üçündür.
- Klient: `apps/app/src/lib/api.ts`. Xəta kodlarının Azərbaycan mətni: `apps/app/src/i18n/az.ts`.
- Mənbə: `supabase/functions/_shared/router.ts` (validasiya), `handlers.ts`, `live.ts`, `account.ts`.

## Marşrutlar

`device` sahəsi = tətbiqin cihaz ID-si (`[A-Za-z0-9_-]{8,128}`).

| Marşrut | Gövdə | Cavab | Qeyd |
| --- | --- | --- | --- |
| `account/consent` | `docs: string[1..5]`, `displayName?` | `{onboarded}` | Cari versiyalar qeyd olunur |
| `account/revoke` | `doc: marketing\|recording` | `{ok}` | Məcburi sənədlər geri götürülmür |
| `account/export` | — | şəxsi məlumat JSON | Cavab açarları daxil deyil |
| `account/delete` | `confirm: "SİL"` | `{ok}` | Şəxsi məlumat silinir, audit anonim qalır |
| `client/event` | `kind: screenshot\|screen_recording`, `context?` | `{ok, recorded}` | Gündə 50; siqnaldır, sübut deyil |
| `device/claim` | `device` | `{replaced}` | Köhnə cihaz bağlanır, audit |
| `code/redeem` | `code` | `{subject_id, access_until}` | Saatda 10 yanlış cəhd |
| `session/start` | `device, subject, mode: topic\|mixed\|mistakes\|exam, topicIds?, size?: 10\|20\|30\|50\|100` | `{session_id, total}` | Bir aktiv sessiya |
| `question/next` | `device, session` | sual və ya `{done, time_up?}` | Gündəlik limit, sürət yoxlaması |
| `answer` | `device, session, question, chosen: 0..5\|null, ms, chars` | `{accepted, done, correct?, correct_display?, explanation?, option_explanations?, law_ref?, trap?}` | İmtahanda yalnız `accepted, done` |
| `session/finish` | `session` | nəticə (`already: true` təkrar çağırışda) | İdempotent |
| `session/review` | `session` | `{watermark, items[]}` | Yalnız bitmiş sessiya, görülmüş suallar |
| `live/create` | `venue, title, startsAt, endsAt, access, subject?, description?` | `{session_id}` | Məkan sahibi müəllim və ya admin; ≤ 12 saat |
| `live/join` | `session` | `{url, token, role, seat, title, state, canPublish, canPublishScreen, chatEnabled, onlyHostAudio}` | 15 dəq əvvəldən; tutum |
| `live/leave` | `session` | `{ok}` | |
| `live/hand/raise`, `live/hand/lower` | `session` | `{position}` / `{ok}` | Host əl qaldırmır |
| `live/hands` | `session` | `{hands[]}` | Yalnız host |
| `live/role` | `session, target, role: speaker\|audience\|cohost` | `{role, canPublish}` | Köməkçini yalnız əsas host təyin edir |
| `live/settings` | `session, onlyHostAudio?, chatEnabled?` | `{onlyHostAudio, chatEnabled, silenced}` | Rejim açılanda danışanlar susdurulur |
| `live/ban` | `session, target` | `{ok}` | Otaqdan çıxarılır |
| `live/state` | `session, state: live\|ended\|cancelled` | `{state, room: closed\|pending\|skipped}` | Bitəndə LiveKit otağı silinir |
| `live/chat` | `session, body: 1..500` | `{id}` | 10 saniyədə 5 mesaj |
| `live/attendance` | `session` | `{rows[]}` | Yalnız host |

## Xəta kodları və HTTP statusu

| Status | Kodlar |
| --- | --- |
| 400 | `bad_*`, `invalid_code`, `not_viewed`, `not_finished`, `bad_json`, `confirm_required` və s. |
| 401 | `unauthorized` (token yoxdur və ya etibarsızdır) |
| 403 | `forbidden`, `suspended`, `device_not_active`, `banned`, `consent_required` |
| 404 | `not_found`, `no_profile`, `no_questions`, `no_mistakes`, `no_venue` |
| 405 | `method` |
| 409 | `session_closed`, `out_of_order`, `full`, `too_early`, `code_used`, `bad_transition` |
| 413 | `too_large` |
| 429 | `daily_limit`, `rate_limited`, `too_many_attempts` |
| 500 | `internal` (detal yalnız server logunda) |
| 502 | `live_partial_failure` |
| 503 | `live_not_configured` |

## Webhook

`POST {SUPABASE_URL}/functions/v1/livekit-webhook` — LiveKit tərəfindən. JWT doğrulaması söndürülüb (`verify_jwt=false`), əvəzinə LiveKit imzası yoxlanır: `iss = API key`, gövdənin sha256-sı, `createdAt` ≤ 300 san. Hadisə ID-si ilə idempotentdir. Uğursuz emalda 500 qaytarır ki, LiveKit təkrar göndərsin.

## Birbaşa (RLS ilə) oxunan cədvəllər

Tətbiq bunları Supabase klienti ilə oxuyur: `subjects`, `topics`, `profiles` (özü), `enrollments` (özü), `diary_entries` (özü), `consents` (özü), `legal_documents`, `venues`, `live_sessions` (icazəli olanlar), `live_participants`, `live_chat` (iştirakçılar), `live_hands` (özü və ya host). `questions` tələbə üçün bağlıdır.
