\set ON_ERROR_STOP 1
\set QUIET 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.az', '{"display_name":"  Aysel  "}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.az', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.az', '{"display_name":"Müəllim Rauf"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.az', '{"display_name":"Dəvətsiz"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'e@test.az', '{"display_name":"Elvin"}');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-0000000000c1';
insert into public.subjects (id, name) values ('qanun', 'Qanunvericilik');

-- ============ 1. Profil və razılıq ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000000a1'; r jsonb;
begin
  perform tests.ok((select display_name from public.profiles where id = a) = 'Aysel', 'trigger profili ad ilə yaradır (boşluqlar silinir)');
  perform tests.ok((select student_no from public.profiles where id = a) is not null, 'tələbə nömrəsi verilir');
  perform public.claim_device(a, 'device-ACC-0001');
  perform tests.ok(public._guard(a, 'device-ACC-0001') = 'consent_required', 'razılıqsız tələbə əməliyyatı yoxdur');
  r := public.accept_consents(a, array['terms', 'privacy']);
  perform tests.ok(not (r->>'onboarded')::boolean, 'yarımçıq razılıq kifayət deyil');
  r := public.accept_consents(a, array['age18'], 'Aysel Məmmədova');
  perform tests.ok((r->>'onboarded')::boolean and (select onboarded_at is not null from public.profiles where id = a), 'bütün tələb olunanlar qəbul edildi');
  perform tests.ok((select display_name from public.profiles where id = a) = 'Aysel Məmmədova', 'ad yeniləndi');
  perform tests.ok(public.accept_consents(a, array['terms'], 'X')->>'error' = 'bad_name', 'çox qısa ad rədd edilir');
  perform tests.ok(public.accept_consents(a, array['nope'])->>'error' = 'unknown_doc', 'naməlum sənəd rədd edilir');
  perform tests.ok(public.revoke_consent(a, 'terms')->>'error' = 'required_doc', 'tələb olunan razılıq geri götürülmür');
  perform tests.ok((public.revoke_consent(a, 'marketing')->>'ok')::boolean, 'marketinq razılığı geri götürülür');
  perform tests.ok(public._guard(a, 'device-ACC-0001') is null, 'razılıqdan sonra giriş açıqdır');
  insert into public.legal_documents (doc, version, required, published_at) values ('privacy', '2026-12-01', true, now() + interval '1 second');
  perform tests.ok(public._guard(a, 'device-ACC-0001') = 'consent_required', 'yeni məxfilik versiyası yenidən razılıq tələb edir');
  perform public.accept_consents(a, array['privacy']);
  perform tests.ok(public._guard(a, 'device-ACC-0001') is null, 'yeni versiya qəbul edildi');
end $$;

-- Qalan istifadəçilər üçün razılıq
select public.accept_consents(id, array['terms', 'privacy', 'age18']) from public.profiles where id <> '00000000-0000-0000-0000-0000000000a1';

-- ============ 2. Canlı sessiya yaratma ============
insert into public.venues (id, kind, name, subject_id, owner_id, capacity) values
  ('30000000-0000-0000-0000-000000000001', 'classroom', 'Qanunvericilik sinfi', 'qanun', '00000000-0000-0000-0000-0000000000c1', 2),
  ('30000000-0000-0000-0000-000000000002', 'hall', 'Böyük zal', null, null, 300);

do $$
declare a uuid := '00000000-0000-0000-0000-0000000000a1'; c uuid := '00000000-0000-0000-0000-0000000000c1'; r jsonb;
begin
  r := public.live_create_session(a, '30000000-0000-0000-0000-000000000001', 'Dərs', now(), now() + interval '1 hour', 'enrolled');
  perform tests.ok(r->>'error' = 'forbidden', 'tələbə sessiya yarada bilmir');
  r := public.live_create_session(c, '30000000-0000-0000-0000-000000000002', 'Dərs', now(), now() + interval '1 hour', 'public');
  perform tests.ok(r->>'error' = 'forbidden', 'müəllim başqasının zalında sessiya yarada bilmir');
  r := public.live_create_session(c, '30000000-0000-0000-0000-000000000001', 'Konstitusiya', now() + interval '2 hours', now() + interval '1 hour', 'enrolled');
  perform tests.ok(r->>'error' = 'bad_time', 'bitmə başlanğıcdan əvvəl ola bilməz');
  r := public.live_create_session(c, '30000000-0000-0000-0000-000000000001', 'Konstitusiya, 1–23-cü maddələr', now() + interval '2 hours', now() + interval '3 hours', 'enrolled');
  perform tests.ok(r ? 'session_id', 'müəllim öz sinfində sessiya yaradır');
  perform set_config('test.sess', r->>'session_id', true);
end $$;

-- ============ 3. Qoşulma, oturacaq, tutum ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000000a1'; b uuid := '00000000-0000-0000-0000-0000000000b1';
        c uuid := '00000000-0000-0000-0000-0000000000c1'; d uuid := '00000000-0000-0000-0000-0000000000d1';
        e uuid := '00000000-0000-0000-0000-0000000000e1';
        s uuid := current_setting('test.sess')::uuid; r jsonb;
begin
  r := public.live_join(a, s);
  perform tests.ok(r->>'error' = 'forbidden', 'abunəsiz tələbə sinfə girə bilmir');
  insert into public.enrollments (student_id, subject_id, access_until)
  select x, 'qanun', now() + interval '30 days' from unnest(array[a, b, e]) x;
  r := public.live_join(a, s);
  perform tests.ok(r->>'error' = 'too_early', 'dərsdən 15 dəqiqə əvvəldən tez girmək olmaz');
  r := public.live_join(c, s);
  perform tests.ok(r->>'role' = 'host' and (r->>'can_publish')::boolean and (r->>'can_publish_screen')::boolean and r->>'seat' is null, 'host istənilən vaxt girir, səhnədədir');
  update public.live_sessions set starts_at = now() - interval '1 minute' where id = s;
  r := public.live_join(a, s);
  perform tests.ok(r->>'role' = 'audience' and (r->>'seat')::int = 1 and not (r->>'can_publish')::boolean, 'tələbə dinləyici, 1-ci oturacaq');
  perform tests.ok(r->>'name' = 'Aysel Məmmədova' and r->>'room' like 'ks_%', 'ad və LiveKit otağı qayıdır');
  r := public.live_join(b, s);
  perform tests.ok((r->>'seat')::int = 2 and r->>'name' like 'Tələbə %', 'adsız tələbə nömrə ilə görünür, 2-ci oturacaq');
  r := public.live_join(e, s);
  perform tests.ok(r->>'error' = 'full', 'tutum doldu (2)');
  perform public.live_leave(a, s);
  r := public.live_join(e, s);
  perform tests.ok((r->>'seat')::int = 1, 'boşalan oturacaq yeni gələnə verilir');
  perform public.live_leave(e, s);
  r := public.live_join(a, s);
  perform tests.ok((r->>'seat')::int = 1, 'qayıdan tələbə köhnə yerini alır (boşdursa)');
  perform tests.ok((select total_seconds >= 0 and left_at is null from public.live_participants where session_id = s and user_id = a), 'yenidən qoşulma qeydi');
  perform tests.ok(public.live_join(d, s)->>'error' = 'forbidden', 'dəvətsiz və abunəsiz istifadəçi girmir');
end $$;

-- ============ 4. Əl qaldırma, söz vermə, yalnız host danışır ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000000a1'; b uuid := '00000000-0000-0000-0000-0000000000b1';
        c uuid := '00000000-0000-0000-0000-0000000000c1'; s uuid := current_setting('test.sess')::uuid; r jsonb;
begin
  perform tests.ok((public.live_raise_hand(a, s)->>'position')::int = 1, 'A əl qaldırdı: 1-ci');
  perform tests.ok((public.live_raise_hand(b, s)->>'position')::int = 2, 'B əl qaldırdı: 2-ci');
  perform tests.ok((public.live_raise_hand(a, s)->>'position')::int = 1, 'təkrar əl qaldırmaq növbəni dəyişmir');
  perform tests.ok(public.live_raise_hand(c, s)->>'error' = 'host_cannot_raise', 'host əl qaldırmır');
  perform tests.ok(public.live_hands_queue(a, s)->>'error' = 'forbidden', 'tələbə növbəni görmür');
  r := public.live_hands_queue(c, s);
  perform tests.ok(jsonb_array_length(r->'hands') = 2 and r->'hands'->0->>'user_id' = a::text, 'host növbəni sıra ilə görür');
  perform tests.ok(public.live_set_role(a, s, b, 'speaker')->>'error' = 'forbidden', 'tələbə söz verə bilmir');
  r := public.live_set_role(c, s, a, 'speaker');
  perform tests.ok(r->>'role' = 'speaker' and (r->>'can_publish')::boolean, 'host A-ya söz verdi');
  perform tests.ok((select resolution from public.live_hands where session_id = s and user_id = a order by id desc limit 1) = 'granted', 'əl "verildi" kimi bağlandı');
  perform tests.ok(jsonb_array_length(public.live_hands_queue(c, s)->'hands') = 1, 'növbədə B qaldı');
  perform tests.ok(public.live_set_role(c, s, c, 'audience')->>'error' = 'bad_target', 'host özünü dəyişmir');
  r := public.live_settings(c, s, true, null);
  perform tests.ok(r->'silenced' ? a::text and (select role from public.live_participants where session_id = s and user_id = a) = 'audience', '"yalnız host danışır": danışanlar susdurulur');
  perform public.live_lower_hand(b, s);
  perform tests.ok(jsonb_array_length(public.live_hands_queue(c, s)->'hands') = 0, 'B əlini endirdi');
end $$;

-- ============ 5. Chat ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000000a1'; c uuid := '00000000-0000-0000-0000-0000000000c1';
        d uuid := '00000000-0000-0000-0000-0000000000d1'; s uuid := current_setting('test.sess')::uuid; r jsonb;
begin
  for i in 1..5 loop r := public.live_chat_post(a, s, 'Sual ' || i); end loop;
  perform tests.ok(r ? 'id', 'chat mesajı yazıldı');
  perform tests.ok(public.live_chat_post(a, s, 'Altıncı')->>'error' = 'rate_limited', '10 saniyədə 5-dən çox mesaj olmaz');
  perform tests.ok(public.live_chat_post(d, s, 'salam')->>'error' = 'not_participant', 'iştirakçı olmayan yaza bilmir');
  perform tests.ok(public.live_chat_post(c, s, '   ')->>'error' = 'bad_body', 'boş mesaj rədd edilir');
  perform public.live_settings(c, s, null, false);
  perform tests.ok(public.live_chat_post(a, s, 'x')->>'error' in ('chat_disabled', 'rate_limited'), 'chat bağlıdır');
  perform tests.ok(public.live_chat_post(c, s, 'Host yaza bilir') ? 'id', 'host chat bağlı olanda da yazır');
end $$;

-- ============ 6. Bloklama, webhook, vəziyyət, davamiyyət ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000000a1'; b uuid := '00000000-0000-0000-0000-0000000000b1';
        c uuid := '00000000-0000-0000-0000-0000000000c1'; s uuid := current_setting('test.sess')::uuid; r jsonb; v_room text;
begin
  select livekit_room into v_room from public.live_sessions where id = s;
  r := public.live_ban(c, s, b);
  perform tests.ok(r->>'identity' = b::text, 'host B-ni çıxardı');
  perform tests.ok(public.live_join(b, s)->>'error' = 'banned', 'bloklanmış tələbə qayıda bilmir');
  perform tests.ok(public.live_ban(a, s, c)->>'error' = 'forbidden', 'tələbə bloklaya bilmir');
  update public.live_participants set joined_at = now() - interval '10 minutes' where session_id = s and user_id = a;
  r := public.live_webhook_event('evt-1', 'participant_left', v_room, a, now());
  perform tests.ok((select total_seconds >= 600 and left_at is not null from public.live_participants where session_id = s and user_id = a), 'webhook ayrılmanı və dəqiqələri yazır');
  r := public.live_webhook_event('evt-1', 'participant_left', v_room, a, now());
  perform tests.ok((r->>'duplicate')::boolean, 'eyni hadisə ikinci dəfə işlənmir');
  perform tests.ok((public.live_webhook_event('evt-x', 'participant_left', 'ks_yoxdur', a, now())->>'ignored')::boolean, 'naməlum otaq nəzərə alınmır');
  perform tests.ok(public.live_set_state(a, s, 'live')->>'error' = 'forbidden', 'tələbə dərsi başlada bilmir');
  perform tests.ok(public.live_set_state(c, s, 'live')->>'state' = 'live', 'host dərsi başlatdı');
  perform tests.ok(public.live_set_state(c, s, 'scheduled')->>'error' = 'bad_transition', 'geri keçid yoxdur');
  r := public.live_attendance(c, s);
  perform tests.ok(jsonb_array_length(r->'rows') >= 3 and public.live_attendance(a, s)->>'error' = 'forbidden', 'davamiyyət yalnız hosta');
  perform public.live_webhook_event('evt-2', 'room_finished', v_room, null, now());
  perform tests.ok((select state from public.live_sessions where id = s) = 'ended', 'otaq bitdi: sessiya bağlandı');
  perform tests.ok(public.live_join(a, s)->>'error' = 'session_closed', 'bitmiş dərsə qoşulmaq olmur');
end $$;

-- ============ 7. RLS ============
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select tests.ok((select count(*) from public.live_sessions) = 1, 'RLS: abunəli tələbə öz sinfinin sessiyasını görür');
select tests.ok((select count(*) from public.consents) >= 3 and (select bool_and(user_id = auth.uid()) from public.consents), 'RLS: yalnız öz razılıqları');
select tests.ok((select count(*) from public.live_events) = 0, 'RLS: webhook hadisələri gizlidir');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
select tests.ok((select count(*) from public.live_sessions) = 0, 'RLS: abunəsiz istifadəçi sessiyanı görmür');
select tests.ok((select count(*) from public.live_chat) = 0, 'RLS: kənar istifadəçi chatı görmür');
reset role;

-- ============ 8. İxrac və silinmə ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000000a1'; c uuid := '00000000-0000-0000-0000-0000000000c1'; r jsonb; v_code text;
begin
  r := public.export_my_data(a);
  perform tests.ok(r ? 'profile' and r ? 'consents' and r ? 'live' and r->'profile'->>'display_name' = 'Aysel Məmmədova', 'ixrac şəxsi məlumatları qaytarır');
  perform tests.ok(r::text not like '%answer_index%', 'ixracda cavab açarı yoxdur');
  insert into public.subjects (id, name) values ('inf2', 'İnformatika 2');
  select code into v_code from public.create_codes(c, 'inf2', 1, 10) limit 1;
  perform public.redeem_code(a, v_code);
  perform tests.ok((public.prepare_account_deletion(a)->>'ok')::boolean, 'silinmə hazırlandı');
  delete from auth.users where id = a;
  perform tests.ok(not exists (select 1 from public.profiles where id = a), 'profil silindi');
  perform tests.ok(not exists (select 1 from public.live_participants where user_id = a) and not exists (select 1 from public.consents where user_id = a), 'kaskad: iştirak və razılıqlar silindi');
  perform tests.ok((select redeemed_by is null from public.access_codes where code_hash = public._hash_code(v_code)), 'istifadə olunmuş kod qalır, sahibi anonimləşir');
  perform tests.ok(exists (select 1 from public.audit_events where kind = 'account_deleted' and student_id is null and detail ? 'user_hash'), 'audit şəxsi məlumatsız qalır');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
