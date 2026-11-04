-- Yoxlama zamanı tapılmış xətaların reqressiya testləri.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007a1', 'x1@test.az', '{"display_name":"İmtahan"}'),
  ('00000000-0000-0000-0000-0000000007a2', 'x2@test.az', '{"display_name":"Host"}');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-0000000007a2';
select public.accept_consents(id, array['terms', 'privacy', 'age18']) from public.profiles where id::text like '00000000-0000-0000-0000-0000000007a%';
insert into public.subjects (id, name) values ('bf7', 'Düzəliş');
insert into public.topics (id, subject_id, name, free) values ('70000000-0000-0000-0000-000000000001', 'bf7', 'M', true);
insert into public.questions (id, topic_id, stem, options, answer_index, status) values
  ('70000000-0000-0000-0000-0000000000f1', '70000000-0000-0000-0000-000000000001', 'S1', '["a","b"]', 0, 'published'),
  ('70000000-0000-0000-0000-0000000000f2', '70000000-0000-0000-0000-000000000001', 'S2', '["a","b"]', 0, 'published');

-- 1) İmtahan vaxtı bitəndən sonra cavab qəbul edilmir
do $$
declare a uuid := '00000000-0000-0000-0000-0000000007a1'; r jsonb; v_s uuid; q jsonb;
begin
  perform public.claim_device(a, 'device-BF7-0001');
  r := public.create_session(a, 'device-BF7-0001', 'exam', 'bf7', array['70000000-0000-0000-0000-0000000000f1', '70000000-0000-0000-0000-0000000000f2']::uuid[], 1, 60);
  v_s := (r->>'session_id')::uuid;
  q := public.next_question(a, 'device-BF7-0001', v_s);
  update public.test_sessions set started_at = now() - interval '2 hours' where id = v_s;  -- son sual açıq qaldı, vaxt bitdi
  r := public.submit_answer(a, 'device-BF7-0001', v_s, (q->>'question_id')::uuid, 0::smallint, 5000);
  perform tests.ok(r->>'error' = 'time_up', 'vaxt bitəndən sonra cavab rədd edilir');
  perform tests.ok((select state from public.test_sessions where id = v_s) = 'finished', 'sessiya avtomatik bitir');
  perform tests.ok(not exists (select 1 from public.answers where session_id = v_s), 'gec cavab yazılmayıb');
end $$;

-- 2) Canlı dərs uzananda yenidən qoşulma; 3) gecikmiş webhook
insert into public.venues (id, kind, name, owner_id, capacity) values ('30000000-0000-0000-0000-0000000007f1', 'hall', 'BF zal', '00000000-0000-0000-0000-0000000007a2', 10);
do $$
declare h uuid := '00000000-0000-0000-0000-0000000007a2'; a uuid := '00000000-0000-0000-0000-0000000007a1'; s uuid; r jsonb; v_room text;
begin
  s := (public.live_create_session(h, '30000000-0000-0000-0000-0000000007f1', 'Uzanan dərs', now() - interval '2 hours', now() - interval '1 hour', 'public')->>'session_id')::uuid;
  update public.live_sessions set state = 'live' where id = s;
  r := public.live_join(a, s);
  perform tests.ok(r ? 'room' and (r->>'seat')::int = 1, 'canlı dərs bitmə vaxtını keçsə də qoşulmaq olur');
  update public.live_sessions set state = 'scheduled' where id = s;
  perform tests.ok(public.live_join(a, s)->>'error' = 'session_closed', 'başlamamış və vaxtı keçmiş dərs bağlıdır');
  update public.live_sessions set state = 'live' where id = s;
  select livekit_room into v_room from public.live_sessions where id = s;
  -- Tələbə yenidən qoşulub; sonra köhnə bağlantının gecikmiş "ayrıldı" hadisəsi gəlir
  perform public.live_join(a, s);
  perform public.live_raise_hand(a, s);
  perform public.live_webhook_event('EV_LATE_1', 'participant_left', v_room, a, now() - interval '10 minutes');
  perform tests.ok((select left_at is null from public.live_participants where session_id = s and user_id = a), 'gecikmiş webhook yenidən qoşulanı çıxarmır');
  perform tests.ok(exists (select 1 from public.live_hands where session_id = s and user_id = a and resolved_at is null), 'gecikmiş webhook yeni əli endirmir');
  perform public.live_webhook_event('EV_NOW_1', 'participant_left', v_room, a, now() + interval '1 second');
  perform tests.ok((select left_at is not null from public.live_participants where session_id = s and user_id = a), 'təzə webhook ayrılmanı qeyd edir');
end $$;

-- 4) Müəllim sualı yalnız oxuyur, birbaşa dəyişə bilmir
do $$
declare v_n int; v_ok boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000007a2', true);
  set local role authenticated;
  select count(*) into v_n from public.questions where id = '70000000-0000-0000-0000-0000000000f1';
  begin
    update public.questions set answer_index = 1 where id = '70000000-0000-0000-0000-0000000000f1';
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  perform tests.ok(v_n = 1, 'müəllim sualları oxuyur');
  perform tests.ok(v_ok and (select answer_index from public.questions where id = '70000000-0000-0000-0000-0000000000f1') = 0, 'müəllim cavab açarını birbaşa dəyişə bilmir');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
