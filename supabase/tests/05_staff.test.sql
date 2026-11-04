-- Müəllim paneli RPC-ləri.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 't5@test.az'),
  ('00000000-0000-0000-0000-0000000005a2', 's5@test.az');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-0000000005a1';
insert into public.subjects (id, name) values ('st5', 'Staff testi');
insert into public.topics (id, subject_id, name) values ('50000000-0000-0000-0000-000000000001', 'st5', 'Mövzu');
insert into public.questions (id, topic_id, stem, options, answer_index, status)
values ('50000000-0000-0000-0000-0000000000f1', '50000000-0000-0000-0000-000000000001', 'S', '["a","b"]', 0, 'review');

do $$
declare t uuid := '00000000-0000-0000-0000-0000000005a1'; s uuid := '00000000-0000-0000-0000-0000000005a2';
        q uuid := '50000000-0000-0000-0000-0000000000f1'; r jsonb; v_code text;
begin
  perform tests.ok(public.staff_create_codes(s, 'st5', 5, 30)->>'error' = 'forbidden', 'tələbə kod yarada bilmir');
  perform tests.ok(public.staff_create_codes(t, 'st5', 0, 30)->>'error' = 'bad_count', 'say 1–200');
  perform tests.ok(public.staff_create_codes(t, 'st5', 201, 30)->>'error' = 'bad_count', 'say 200-dən çox ola bilməz');
  perform tests.ok(public.staff_create_codes(t, 'st5', 5, 0)->>'error' = 'bad_days', 'gün 1–730');
  perform tests.ok(public.staff_create_codes(t, 'yoxdur', 5, 30)->>'error' = 'not_found', 'naməlum fənn');
  r := public.staff_create_codes(t, 'st5', 3, 90);
  perform tests.ok(jsonb_array_length(r->'codes') = 3, 'müəllim 3 kod yaradır');
  perform tests.ok((select count(*) from public.access_codes where subject_id = 'st5' and days = 90 and created_by = t) = 3, 'kodlar bazada (hash ilə)');
  perform tests.ok(not exists (select 1 from public.access_codes where code_hash = r->'codes'->>0), 'açıq mətn kod saxlanmır');
  perform tests.ok(exists (select 1 from public.audit_events where student_id = t and kind = 'codes_created' and (detail->>'count')::int = 3), 'kod yaratma audit-ə yazılır');
  v_code := r->'codes'->>1;
  perform tests.ok(public.redeem_code(s, v_code)->>'subject_id' = 'st5', 'yaradılan kod tələbədə işləyir');

  perform tests.ok(public.staff_set_question_status(s, q, 'published')->>'error' = 'forbidden', 'tələbə sualı dərc edə bilmir');
  perform tests.ok(public.staff_set_question_status(t, gen_random_uuid(), 'published')->>'error' = 'not_found', 'naməlum sual');
  r := public.staff_set_question_status(t, q, 'published');
  perform tests.ok((r->>'changed')::boolean and (select status from public.questions where id = q) = 'published', 'müəllim sualı dərc edir');
  perform tests.ok(not (public.staff_set_question_status(t, q, 'published')->>'changed')::boolean, 'eyni status: dəyişiklik yoxdur');
  perform tests.ok(exists (select 1 from public.audit_events where kind = 'question_status' and detail->>'to' = 'published' and detail->>'from' = 'review'), 'status dəyişikliyi audit-ə yazılır');
  perform tests.ok(not has_function_privilege('authenticated', 'public.staff_create_codes(uuid,text,int,int)', 'execute'), 'authenticated birbaşa çağıra bilmir');
end $$;

-- ============ Sual analizi üçün xam məlumat ============
do $$
declare t uuid := '00000000-0000-0000-0000-0000000005a1'; s uuid := '00000000-0000-0000-0000-0000000005a2';
        q uuid := '50000000-0000-0000-0000-0000000000f1'; v_sess uuid; r jsonb;
begin
  insert into public.test_sessions (student_id, mode, subject_id, question_ids, state, result)
  values (s, 'topic', 'st5', array[q], 'finished', '{"percent": 80}') returning id into v_sess;
  insert into public.answers (session_id, question_id, position, chosen, correct, ms) values (v_sess, q, 1, 0, true, 5000);
  insert into public.test_sessions (student_id, mode, subject_id, question_ids, state) values (s, 'topic', 'st5', array[q], 'abandoned') returning id into v_sess;
  insert into public.answers (session_id, question_id, position, chosen, correct, ms) values (v_sess, q, 1, 1, false, 5000);
  perform tests.ok(public.staff_item_responses(s, 'st5')->>'error' = 'forbidden', 'tələbə analizi görə bilmir');
  r := public.staff_item_responses(t, 'st5');
  perform tests.ok(jsonb_array_length(r->'items') = 1 and (r->'items'->0->>'answer_index')::int = 0 and (r->'items'->0->>'option_count')::int = 2, 'analiz: dərc olunmuş sual qaytarılır');
  perform tests.ok(jsonb_array_length(r->'items'->0->'responses') = 1, 'yalnız bitmiş sessiyaların cavabları sayılır');
  perform tests.ok(r::text not like '%' || s::text || '%', 'tələbə kimliyi qaytarılmır');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
