\set ON_ERROR_STOP 1
\set QUIET 1
begin;

-- ============ Fixtures ============
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Tələbə A', 'student'),
  ('00000000-0000-0000-0000-00000000000b', 'Tələbə B', 'student'),
  ('00000000-0000-0000-0000-00000000000c', 'Müəllim', 'teacher');
insert into public.subjects (id, name) values ('inf', 'İnformatika');
insert into public.topics (id, subject_id, name, free) values
  ('10000000-0000-0000-0000-000000000001', 'inf', 'Excel 2019', true),
  ('10000000-0000-0000-0000-000000000002', 'inf', 'Şəbəkələr', false);
insert into public.questions (id, topic_id, stem, options, answer_index, option_explanations, explanation, status, trap)
select md5('q' || i)::uuid,
       case when i <= 6 then '10000000-0000-0000-0000-000000000001'::uuid else '10000000-0000-0000-0000-000000000002'::uuid end,
       'Sual ' || i, '["A","B","C","D"]'::jsonb, (i % 4)::smallint,
       '["izah A","izah B","izah C","izah D"]'::jsonb, 'Ümumi izah ' || i,
       'published', i = 2
from generate_series(1, 12) i;
insert into public.questions (topic_id, stem, options, answer_index, status)
values ('10000000-0000-0000-0000-000000000002', 'Qaralama', '["x","y"]', 0, 'draft');

-- ============ 1. Tək aktiv cihaz ============
do $$
declare a uuid := '00000000-0000-0000-0000-00000000000a'; r jsonb;
begin
  r := public.claim_device(a, 'device-AAAA-1');
  perform tests.ok(not (r->>'replaced')::boolean, 'ilk cihaz qeydiyyatdan keçir');
  r := public.claim_device(a, 'device-AAAA-2');
  perform tests.ok((r->>'replaced')::boolean, 'ikinci cihaz birincini əvəz edir');
  perform tests.ok(public._guard(a, 'device-AAAA-1') = 'device_not_active', 'köhnə cihaz bloklanır');
  perform tests.ok(public._guard(a, 'device-AAAA-2') is null, 'yeni cihaz aktivdir');
  perform tests.ok((select count(*) from public.audit_events where student_id = a and kind = 'device_replaced') = 1, 'cihaz dəyişimi audit-ə yazılır');
end $$;

-- ============ 2. Giriş: pulsuz mövzu, kodla abunə ============
do $$
declare a uuid := '00000000-0000-0000-0000-00000000000a'; b uuid := '00000000-0000-0000-0000-00000000000b';
        c uuid := '00000000-0000-0000-0000-00000000000c'; v_code text; r jsonb; paid uuid := md5('q9')::uuid;
begin
  perform tests.ok((select count(*) from public.candidates(a, 'inf')) = 6, 'abunəsiz yalnız pulsuz mövzu (6 sual), qaralama yoxdur');
  r := public.create_session(a, 'device-AAAA-2', 'topic', 'inf', array[paid], 1);
  perform tests.ok(r->>'error' = 'invalid_questions', 'abunəsiz ödənişli sualla sessiya açılmır');
  select code into v_code from public.create_codes(c, 'inf', 1, 30) limit 1;
  perform tests.ok(v_code ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$', 'kod formatı XXXX-XXXX-XXXX');
  perform tests.ok((select count(*) from public.access_codes where code_hash = public._hash_code(v_code)) = 1, 'kod yalnız hash kimi saxlanılır');
  r := public.redeem_code(a, lower(replace(v_code, '-', ' ')));
  perform tests.ok(r->>'subject_id' = 'inf', 'kod böyük-kiçik hərf və boşluqdan asılı olmayaraq aktivləşir');
  r := public.redeem_code(b, v_code);
  perform tests.ok(r->>'error' = 'code_used', 'istifadə olunmuş kod başqasına keçmir');
  r := public.redeem_code(b, 'AAAA-BBBB-CCCC');
  perform tests.ok(r->>'error' = 'invalid_code', 'yanlış kod rədd edilir');
  perform tests.ok((select count(*) from public.candidates(a, 'inf')) = 12, 'abunədən sonra 12 sual');
  begin
    perform public.create_codes(a, 'inf', 1, 30);
    raise exception 'FAIL: tələbə kod yarada bildi';
  exception when insufficient_privilege then raise notice 'ok: tələbə kod yarada bilmir';
  end;
end $$;

-- ============ 3. Məşq axını: sual, cavab, izah, nəticə, icmal ============
do $$
declare a uuid := '00000000-0000-0000-0000-00000000000a'; d text := 'device-AAAA-2';
        ids uuid[] := array[md5('q7')::uuid, md5('q8')::uuid, md5('q9')::uuid];
        r jsonb; s uuid; q jsonb; v_disp int; v_ans int;
begin
  r := public.create_session(a, d, 'topic', 'inf', ids, 7);
  s := (r->>'session_id')::uuid;
  perform tests.ok((r->>'total')::int = 3, 'sessiya yaradıldı');

  q := public.next_question(a, d, s);
  perform tests.ok(q->>'stem' = 'Sual 7' and jsonb_array_length(q->'options') = 4, 'sual verilir');
  perform tests.ok(not (q ? 'answer_index') and not (q ? 'correct_display') and not (q ? 'explanation'), 'cavab açarı və izah sualla gəlmir');
  perform tests.ok((q->>'watermark')::bigint = (select student_no from public.profiles where id = a), 'su nişanı tələbə nömrəsidir');

  r := public.submit_answer(a, d, s, ids[2], 0::smallint, 5000);
  perform tests.ok(r->>'error' = 'out_of_order', 'növbədən kənar cavab qəbul olunmur');

  select answer_index into v_ans from public.questions where id = ids[1];
  v_disp := array_position(public._perm(7, ids[1], 4), v_ans) - 1;
  r := public.submit_answer(a, d, s, ids[1], v_disp::smallint, 6000);
  perform tests.ok((r->>'correct')::boolean and (r->>'correct_display')::int = v_disp, 'düz cavab serverdə yoxlanır');
  perform tests.ok(jsonb_array_length(r->'option_explanations') = 4, 'hər variant üçün izah qayıdır');

  q := public.next_question(a, d, s);
  select answer_index into v_ans from public.questions where id = ids[2];
  v_disp := array_position(public._perm(7, ids[2], 4), v_ans) - 1;
  r := public.submit_answer(a, d, s, ids[2], ((v_disp + 1) % 4)::smallint, 7000);
  perform tests.ok(not (r->>'correct')::boolean, 'səhv cavab');

  q := public.next_question(a, d, s);
  r := public.submit_answer(a, d, s, ids[3], null, 3000);
  perform tests.ok((r->>'done')::boolean, 'boş cavab, test bitdi');

  q := public.next_question(a, d, s);
  perform tests.ok((q->>'done')::boolean, 'sual qalmadı');

  r := public.finish_session(a, s);
  perform tests.ok((r->>'correct')::int = 1 and (r->>'wrong')::int = 1 and (r->>'blank')::int = 1 and (r->>'percent')::numeric = 33.3, 'nəticə: 1 düz, 1 səhv, 1 boş, 33.3%');
  perform tests.ok(public.finish_session(a, s) = r, 'bitirmə idempotentdir');
  perform tests.ok((select count(*) from public.diary_entries where student_id = a and kind = 'test') = 1, 'nəticə gündəliyə düşdü');

  r := public.session_review(a, s);
  perform tests.ok(jsonb_array_length(r->'items') = 3, 'icmalda 3 sual');
  perform tests.ok((r->'items'->0->>'chosen_display') = (r->'items'->0->>'correct_display'), 'icmal: seçilən və düzgün variant uyğun');
  perform tests.ok((r->'items'->2->>'chosen_display') is null, 'icmal: boş cavab null');
  perform tests.ok(public.session_review('00000000-0000-0000-0000-00000000000b', s)->>'error' = 'not_found', 'başqası icmala baxa bilmir');
end $$;

-- ============ 4. İmtahan rejimi və vaxt ============
do $$
declare a uuid := '00000000-0000-0000-0000-00000000000a'; d text := 'device-AAAA-2'; r jsonb; s uuid; q jsonb;
begin
  r := public.create_session(a, d, 'exam', 'inf', array[md5('q2')::uuid, md5('q3')::uuid], 9, 600);
  s := (r->>'session_id')::uuid;
  q := public.next_question(a, d, s);
  perform tests.ok(not (q->>'trap')::boolean, 'imtahanda tələli sual işarəsi gizlədilir');
  r := public.submit_answer(a, d, s, md5('q2')::uuid, 1::smallint, 9000);
  perform tests.ok(r ? 'accepted' and not (r ? 'correct') and not (r ? 'explanation'), 'imtahanda cavabdan sonra nəticə göstərilmir');
  update public.test_sessions set started_at = now() - interval '11 minutes' where id = s;
  q := public.next_question(a, d, s);
  perform tests.ok((q->>'time_up')::boolean, 'vaxt bitdi');
  perform tests.ok((select state from public.test_sessions where id = s) = 'finished', 'vaxt bitəndə test avtomatik bitir');
end $$;

-- ============ 5. Gündəlik limit ============
do $$
declare b uuid := '00000000-0000-0000-0000-00000000000b'; d text := 'device-BBBB-1'; r jsonb; s uuid; q jsonb;
begin
  perform public.claim_device(b, d);
  update public.profiles set daily_question_limit = 1 where id = b;
  r := public.create_session(b, d, 'topic', 'inf', array[md5('q1')::uuid, md5('q2')::uuid], 3);
  s := (r->>'session_id')::uuid;
  q := public.next_question(b, d, s);
  perform tests.ok(q->>'stem' = 'Sual 1', 'limit daxilində sual');
  perform tests.ok(public.next_question(b, d, s)->>'stem' = 'Sual 1', 'eyni sualı yenidən açmaq limiti artırmır');
  perform public.submit_answer(b, d, s, md5('q1')::uuid, 0::smallint, 8000);
  q := public.next_question(b, d, s);
  perform tests.ok(q->>'error' = 'daily_limit', 'gündəlik limit dolanda yeni sual verilmir');
end $$;

-- ============ 6. Sürət (skreyp) aşkarlama ============
do $$
declare b uuid := '00000000-0000-0000-0000-00000000000b'; d text := 'device-BBBB-1'; r jsonb; s uuid; q jsonb;
begin
  update public.profiles set daily_question_limit = 400 where id = b;
  r := public.create_session(b, d, 'topic', 'inf', array[md5('q3')::uuid, md5('q4')::uuid], 4);
  s := (r->>'session_id')::uuid;
  insert into public.test_sessions (id, student_id, mode, subject_id, question_ids, state)
  values ('20000000-0000-0000-0000-000000000001', b, 'topic', 'inf', (select array_agg(md5('q' || i)::uuid) from generate_series(1, 12) i), 'finished');
  insert into public.answers (session_id, question_id, position, chosen, correct, ms, answered_at)
  select '20000000-0000-0000-0000-000000000001', md5('q' || i)::uuid, i, 0, false, 600, now() - make_interval(secs => i)
  from generate_series(1, 12) i;
  insert into public.test_sessions (id, student_id, mode, subject_id, question_ids, state)
  values ('20000000-0000-0000-0000-000000000002', b, 'topic', 'inf', (select array_agg(md5('q' || i)::uuid) from generate_series(1, 12) i), 'finished');
  insert into public.answers (session_id, question_id, position, chosen, correct, ms, answered_at)
  select '20000000-0000-0000-0000-000000000002', md5('q' || i)::uuid, i, 0, false, 700, now() - make_interval(secs => 20 + i)
  from generate_series(1, 12) i;
  q := public.next_question(b, d, s);
  perform tests.ok(q->>'error' = 'suspended', 'çox sürətli cavablarda hesab müvəqqəti dayandırılır');
  perform tests.ok((select suspended_until > now() and suspension_reason = 'pace' from public.profiles where id = b), 'dayandırma bazada qalır');
  perform tests.ok((select count(*) from public.audit_events where student_id = b and kind = 'suspended_pace') = 1, 'audit qeydi var');
end $$;

-- ============ 7. RLS: birbaşa cədvəl girişi ============
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select tests.ok((select count(*) from public.questions) = 0, 'RLS: tələbə sual cədvəlini görmür');
select tests.ok((select count(*) from public.access_codes) = 0, 'RLS: tələbə kodları görmür');
select tests.ok((select count(*) from public.diary_entries) = 2 and (select bool_and(student_id = auth.uid()) from public.diary_entries), 'RLS: tələbə yalnız öz gündəliyini görür (2 qeyd)');
select tests.ok((select count(*) from public.profiles) = 1, 'RLS: tələbə yalnız öz profilini görür');
select tests.ok((select count(*) from public.test_sessions where student_id <> auth.uid()) = 0, 'RLS: başqasının testləri görünmür');
do $$ begin
  perform public.next_question(auth.uid(), 'device-AAAA-2', gen_random_uuid());
  raise exception 'FAIL: tələbə RPC-ni birbaşa çağıra bildi';
exception when insufficient_privilege then raise notice 'ok: RPC-lər yalnız server (service_role) üçündür';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
select tests.ok((select count(*) from public.questions) = 13, 'RLS: müəllim sualları görür');
reset role;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
