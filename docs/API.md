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
| `library/open` | `item` | mətn: `{kind, title, watermark, body}`; PDF: `{kind, title, watermark}` (fayl ünvanı yoxdur) | Pulsuz və ya abunə; audit; tələbəyə gündə 200 açılış |
| `library/pdf` | `item` | **`application/pdf` baytları** (JSON deyil) | Server faylı oxuyur, hər səhifəyə və metadataya `Karyeram Accademy - Telebe No N - tarix` yazır; ≤ 15 MB; şifrəli/pozuq PDF `422 pdf_unreadable`; audit |
| `staff/library/upload-url` | `subject` | `{path, token}` | Yol serverdə: `<fənn>/<uuid>.pdf`; birdəfəlik yükləmə tokeni |
| `staff/library/add` | `subject, title, kind: text\|pdf, free, body? (≤200 000), path?, bytes?` | `{id}` | Bu marşrut üçün gövdə limiti 900 KB |
| `staff/library/delete` | `item` | `{ok}` | Metadata, sonra fayl |
| `board` | `subject?` | `{since, minTotal, top[]: rank, name, score, total, me; me}` | Bu həftə; yalnız razılıq verənlər + özü |
| `account/board` | `show: boolean` | `{show}` | Lövhədə görünmə razılığı (defolt: yox) |
| `staff/codes` | `subject, count: 1..200, days: 1..730` | `{codes[], subject, days}` | Yalnız müəllim/admin; kodlar yalnız bu cavabda açıq görünür |
| `staff/analysis` | `subject` | `{items[]: questionId, stem, topic, n, p, discrimination, pointBiserial, distractors, flags}` | Yalnız müəllim/admin; tələbə kimliyi yoxdur; açar şübhəsi önə |
| `staff/codes/list` | `subject?` | `{codes[]: id, subject_id, days, state, ...}` | Açıq mətn kod yoxdur; müəllim öz kodlarını, admin hamısını görür |
| `staff/codes/revoke` | `code: uuid` | `{ok}` | İstifadə olunmuş kod ləğv olunmur; audit |
| `staff/diary` | `studentNo, kind: grade\|note, title, grade?, text?` | `{id, student_name}` | Tələbənin gündəliyinə yazılır |
| `staff/question/status` | `question, status: draft\|review\|published\|retired` | `{id, status, changed}` | Yalnız müəllim/admin; audit |
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
| `admin/users/find` | `query: 1..120` | `{users[]: id, student_no, display_name, role, suspended_until, suspension_reason, email (maskalı), phone (maskalı)}` | Yalnız admin; tələbə №, telefonun son ≥5 rəqəmi, dəqiq e-poçt və ya ad parçası; ən çox 20 |
| `admin/users/suspend` | `user, hours: 1..87600, reason: 3..300` | `{ok, until, authBan}` | DB + GoTrue qadağası; adminə və özünə tətbiq olunmur; audit |
| `admin/users/unsuspend` | `user` | `{ok, authBan}` | Audit |
| `admin/users/role` | `user, role: student\|teacher` | `{ok, unchanged?}` | Admin təyinatı yalnız DB sahibi tərəfindən |
| `admin/audit` | `kind?, user?, before?` | `{events[]: id, at, kind, detail, student_no, display_name}` | 50-lik səhifə, `before` = son görülən id |
| `admin/config` | `minVersion?, maintenance?, message?, staffMfaRequired?` | `{min_version, maintenance, message, staff_mfa_required}` | Texniki iş, minimum klient versiyası, müəllimlər üçün məcburi MFA; audit |

### Hər sorğuda ümumi yoxlamalar (marşrutdan əvvəl)

1. **Texniki iş rejimi** (`app_config.maintenance`): `503 maintenance` (+ `message`). İstisna: `admin/*`, `account/export`, `account/delete`.
2. **Minimum versiya**: klient `x-app-version` başlığı göndərir (app.json `version`). `app_config.min_version`-dan köhnədirsə və ya başlıq yoxdursa `426 upgrade_required`. İstisna: `account/export`, `account/delete`.
3. **JWT**: GoTrue `/auth/v1/user` (silinmiş, çıxış etmiş və ya **qadağan olunmuş** istifadəçi `401`).
4. **MFA** (aal JWT claim-dən): `admin/*` həmişə `aal2`; `staff/*` və `live/create` — `app_config.staff_mfa_required` **defolt açıqdır** (fail-closed): istifadəçi TOTP qoşubsa və ya məcburiyyət açıqdırsa `aal2`. Yalnız admin açıq şəkildə söndürə bilər. Əks halda `403 mfa_required`.
5. Konfiqurasiya izolyatda 30 saniyə keşlənir; oxuna bilməsə son məlum dəyər saxlanılır, o da yoxdursa `staffMfaRequired: true` (fail-closed), qalan sahələr açıq defoltla.

## Xəta kodları və HTTP statusu

| Status | Kodlar |
| --- | --- |
| 400 | `bad_*`, `invalid_code`, `not_viewed`, `not_finished`, `bad_json`, `confirm_required` və s. |
| 401 | `unauthorized` (token yoxdur və ya etibarsızdır) |
| 403 | `forbidden`, `suspended`, `device_not_active`, `banned`, `consent_required`, `self` (admin özünə), `mfa_required` |
| 404 | `not_found`, `no_profile`, `no_questions`, `no_mistakes`, `no_venue` |
| 405 | `method` |
| 409 | `session_closed`, `out_of_order`, `full`, `too_early`, `code_used`, `bad_transition`, `time_up` |
| 426 | `upgrade_required` |
| 413 | `too_large` |
| 422 | `pdf_unreadable` |
| 429 | `daily_limit`, `rate_limited`, `too_many_attempts` |
| 500 | `internal` (detal yalnız server logunda) |
| 502 | `live_partial_failure` |
| 503 | `live_not_configured`, `maintenance` |

## Webhook

`POST {SUPABASE_URL}/functions/v1/livekit-webhook` — LiveKit tərəfindən. JWT doğrulaması söndürülüb (`verify_jwt=false`), əvəzinə LiveKit imzası yoxlanır: `iss = API key`, gövdənin sha256-sı, `createdAt` ≤ 300 san. Hadisə ID-si ilə idempotentdir. Uğursuz emalda 500 qaytarır ki, LiveKit təkrar göndərsin.

## Birbaşa (RLS ilə) oxunan cədvəllər

Tətbiq bunları Supabase klienti ilə oxuyur: `subjects`, `topics`, `profiles` (özü), `enrollments` (özü), `diary_entries` (özü), `consents` (özü), `legal_documents`, `venues`, `live_sessions` (icazəli olanlar), `live_participants`, `live_chat` (iştirakçılar), `live_hands` (özü və ya host), `test_sessions` (yalnız öz sətirləri və yalnız açıq sütunlar: `id, student_id, mode, subject_id, cursor, state, time_limit_s, started_at, finished_at, result, total`). `questions` tələbə üçün bağlıdır; `answers` klientə tam bağlıdır (baxış yalnız `session/review` RPC ilə); `test_sessions.seed` və `question_ids` sütun-səviyyəli GRANT ilə bağlıdır — sessiya uzunluğu üçün `total` oxunur.
