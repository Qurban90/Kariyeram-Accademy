-- Sərtləşdirmə migrasiyasının (20261120000001) testləri: cavab açarı/toxum gizliliyi, server vaxtı,
-- fail-closed MFA, dayandırma qapıları, silmə icazəsi, canlı rol, atomik FSRS, yol və kod limitləri.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000013a1', 's13a@test.az', '{"display_name":"Tələbə A"}'),
  ('00000000-0000-0000-0000-0000000013a2', 's13b@test.az', '{"display_name":"Tələbə B"}'),
  ('00000000-0000-0000-0000-0000000013c1', 't13a@test.az', '{"display_name":"Müəllim 1"}'),
  ('00000000-0000-0000-0000-0000000013c2', 't13b@test.az', '{"display_name":"Müəllim 2"}'),
  ('00000000-0000-0000-0000-0000000013ad', 'ad13@test.az', '{"display_name":"Admin"}');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-0000000013c1', '00000000-0000-0000-0000-0000000013c2');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000013ad';
select public.accept_consents(id, array['terms', 'privacy', 'age18']) from public.profiles where id::text like '00000000-0000-0000-0000-0000000013%';
insert into public.subjects (id, name) values ('h13', 'Sərtləşdirmə'), ('h.13', 'Nöqtəli fənn');
insert into public.topics (id, subject_id, name, free) values ('13000000-0000-0000-0000-000000000001', 'h13', 'Əsas', true);
insert into public.questions (id, topic_id, stem, options, answer_index, explanation, status, trap)
select md5('h13q' || i)::uuid, '13000000-0000-0000-0000-000000000001', 'Sual ' || i,
       '["A","B","C","D"]'::jsonb, (i % 4)::smallint, 'İzah ' || i, 'published', i = 2
from generate_series(1, 6) i;

-- ============ 1. total sütunu və sütun icazələri ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000013a1'; d text := 'device-H13-A1';
        ids uuid[] := array[md5('h13q1')::uuid, md5('h13q2')::uuid, md5('h13q3')::uuid];
        r jsonb; s uuid; v_n int; v_ok boolean;
begin
  perform public.claim_device(a, d);
  r := public.create_session(a, d, 'topic', 'h13', ids, 7);
  s := (r->>'session_id')::uuid;
  perform tests.ok((r->>'total')::int = 3, 'create_session total qaytarır');
  perform tests.ok((select total from public.test_sessions where id = s) = 3, 'total RPC-də yazılır');
  perform set_config('test.s13', s::text, true);
  insert into public.test_sessions (student_id, mode, subject_id, question_ids, state)
  values (a, 'topic', 'h13', ids, 'finished');
  perform tests.ok((select total from public.test_sessions where student_id = a and state = 'finished' order by started_at desc limit 1) = 3,
    'birbaşa INSERT-də total trigger ilə dolur');

  -- Klient (authenticated) yalnız açıq sütunları oxuyur.
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  select count(*) into v_n from public.test_sessions where student_id = auth.uid();
  perform tests.ok(v_n = 2, 'RLS: yalnız öz sessiyaları');
  select total into v_n from public.test_sessions where id = s;
  perform tests.ok(v_n = 3, 'klient total oxuyur');
  v_ok := false;
  begin
    perform seed from public.test_sessions where id = s;
  exception when insufficient_privilege then v_ok := true;
  end;
  perform tests.ok(v_ok, 'klient seed oxuya bilmir');
  v_ok := false;
  begin
    perform question_ids from public.test_sessions where id = s;
  exception when insufficient_privilege then v_ok := true;
  end;
  perform tests.ok(v_ok, 'klient question_ids oxuya bilmir');
  v_ok := false;
  begin
    perform 1 from public.answers;
  exception when insufficient_privilege then v_ok := true;
  end;
  perform tests.ok(v_ok, 'klient answers cədvəlini heç oxuya bilmir');
  v_ok := false;
  begin
    perform secret from private.perm_secret;
  exception when insufficient_privilege then v_ok := true;
  end;
  perform tests.ok(v_ok, 'klient variant sirrini oxuya bilmir');
  reset role;
  perform tests.ok(not has_function_privilege('authenticated', 'public._perm(bigint,uuid,int)', 'execute'), 'klient _perm çağıra bilmir');
  perform tests.ok(not has_function_privilege('authenticated', 'public.srs_apply(uuid,uuid,jsonb,boolean,jsonb)', 'execute'), 'klient srs_apply çağıra bilmir');
end $$;

-- ============ 2. _perm: sirr qarışığı ============
do $$
declare q uuid := '00000000-0000-0000-0000-000000000123'; p int[]; v_before text; v_changed int := 0; i int;
begin
  p := public._perm(12345, q, 5);
  perform tests.ok((select array_agg(x order by x) from unnest(p) x) = array[0, 1, 2, 3, 4], '_perm permutasiyası qorunur');
  perform tests.ok(public._perm(7, q, 4) = public._perm(7, q, 4), 'eyni toxum + sual + sirr = eyni sıra');
  select string_agg(public._perm(s, q, 4)::text, ',') into v_before from generate_series(1, 10) s;
  update private.perm_secret set secret = 'test-sirri-2' where id;
  select count(*) into v_changed from generate_series(1, 10) s
   where public._perm(s, q, 4)::text <> (string_to_array(v_before, ','))[s];
  perform tests.ok(v_changed >= 5, format('sirr dəyişəndə sıra dəyişir (%s/10)', v_changed));
  update private.perm_secret set secret = encode(extensions.gen_random_bytes(32), 'hex') where id;
  select count(*) into i from generate_series(1, 200) s where (public._perm(s, q, 4))[1] = 0;
  perform tests.ok(i between 20 and 80, format('düzgün variantın yeri əzbərlənə bilmir (%s/200)', i));
end $$;

-- ============ 3. Server cavab vaxtı ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000013a1'; d text := 'device-H13-A1';
        s uuid := current_setting('test.s13')::uuid; q jsonb; r jsonb; v_ms int; v_server int;
begin
  q := public.next_question(a, d, s);
  perform tests.ok(q->>'stem' = 'Sual 1', 'sual verildi');
  update public.question_views set viewed_at = now() - interval '3 seconds'
   where session_id = s and question_id = (q->>'question_id')::uuid;
  r := public.submit_answer(a, d, s, (q->>'question_id')::uuid, 0::smallint, 50);
  perform tests.ok(r ? 'accepted', 'cavab qəbul olundu');
  select ms, server_ms into v_ms, v_server from public.answers where session_id = s and question_id = (q->>'question_id')::uuid;
  perform tests.ok(v_ms = 50, 'klient ms analitika üçün saxlanılır');
  perform tests.ok(v_server between 2500 and 10000, format('server_ms viewed_at-dan hesablanır (%s)', v_server));
end $$;

-- ============ 4. Pace yoxlaması server vaxtına baxır ============
do $$
declare b uuid := '00000000-0000-0000-0000-0000000013a2'; d text := 'device-H13-B1';
        r jsonb; s uuid; q jsonb; v_legacy uuid := '20000000-0000-0000-0000-000000001301';
begin
  perform public.claim_device(b, d);
  r := public.create_session(b, d, 'topic', 'h13', array[md5('h13q4')::uuid, md5('h13q5')::uuid], 4);
  s := (r->>'session_id')::uuid;
  -- 20 ayrıca (qaralama) sual: answers PK (session_id, question_id) təkrara icazə vermir.
  insert into public.questions (id, topic_id, stem, options, answer_index, status)
  select md5('h13x' || i)::uuid, '13000000-0000-0000-0000-000000000001', 'X' || i, '["a","b"]'::jsonb, 0, 'draft'
  from generate_series(1, 20) i;
  insert into public.test_sessions (id, student_id, mode, subject_id, question_ids, state)
  values (v_legacy, b, 'topic', 'h13', (select array_agg(md5('h13x' || i)::uuid) from generate_series(1, 20) i), 'finished');
  -- Klient ms çox kiçikdir, amma server vaxtı normaldır → dayandırma OLMAMALIDIR.
  insert into public.answers (session_id, question_id, position, chosen, correct, ms, server_ms, answered_at)
  select v_legacy, md5('h13x' || i)::uuid, i, 0, false, 100, 9000, now() - make_interval(secs => 40 + i)
  from generate_series(1, 20) i;
  q := public.next_question(b, d, s);
  perform tests.ok(q ? 'stem', 'saxta klient ms ilə dayandırma olmur (server vaxtı normal)');
  -- İndi server vaxtı da sürətlidir → dayandırma.
  update public.answers set server_ms = 500, answered_at = now() - make_interval(secs => position)
   where session_id = v_legacy;
  q := public.next_question(b, d, s);
  perform tests.ok(q->>'error' = 'suspended', 'server medianı < 1.5s olduqda dayandırılır');
  perform tests.ok((select suspension_reason from public.profiles where id = b) = 'pace', 'səbəb pace');
end $$;

-- ============ 5. result yalnız aqreqatdır; imtahanda trap gizlidir ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000013a1'; d text := 'device-H13-A1';
        s uuid := current_setting('test.s13')::uuid; r jsonb; q jsonb; v_exam uuid; k text;
begin
  r := public.finish_session(a, s);
  perform tests.ok(not (r ? 'seed') and not (r ? 'question_ids') and not (r ? 'items'), 'result-də toxum/sual siyahısı yoxdur');
  for k in select jsonb_object_keys(r->'by_topic') loop
    perform tests.ok(not ((r->'by_topic'->k) ? 'question_id') and (r->'by_topic'->k) ? 'total', 'by_topic yalnız aqreqatdır');
  end loop;
  r := public.create_session(a, d, 'exam', 'h13', array[md5('h13q2')::uuid, md5('h13q3')::uuid], 9, 600);
  v_exam := (r->>'session_id')::uuid;
  q := public.next_question(a, d, v_exam);
  perform tests.ok(q->>'trap' = 'false', 'imtahanda cavabdan əvvəl trap=false');
  perform public.submit_answer(a, d, v_exam, md5('h13q2')::uuid, 0::smallint, 5000);
  r := public.create_session(a, d, 'topic', 'h13', array[md5('h13q2')::uuid], 9);
  q := public.next_question(a, d, (r->>'session_id')::uuid);
  perform tests.ok((q->>'trap')::boolean, 'məşq rejimində trap görünür');
end $$;

-- ============ 6. Dayandırılmış hesab: library / board / client event ============
do $$
declare b uuid := '00000000-0000-0000-0000-0000000013a2'; t uuid := '00000000-0000-0000-0000-0000000013c1'; v_item uuid;
begin
  v_item := (public.staff_library_add(t, 'h13', null, 'Konspekt', 'text', true, 'Mətn')->>'id')::uuid;
  perform tests.ok((select suspended_until > now() from public.profiles where id = b), 'B dayandırılıb (pace)');
  perform tests.ok(public.library_open(b, v_item)->>'error' = 'suspended', 'library_open dayandırılmışı buraxmır');
  perform tests.ok(public.set_board_visibility(b, true)->>'error' = 'suspended', 'set_board_visibility dayandırılmışı buraxmır');
  perform tests.ok(public.report_client_event(b, 'screenshot')->>'error' = 'suspended', 'report_client_event dayandırılmışı buraxmır');
  perform tests.ok(public.library_open('00000000-0000-0000-0000-0000000013a1', v_item) ? 'kind', 'normal tələbə oxuyur');
end $$;

-- ============ 7. Konspekt silmə: yaradan və ya admin ============
do $$
declare t uuid := '00000000-0000-0000-0000-0000000013c1'; t2 uuid := '00000000-0000-0000-0000-0000000013c2';
        ad uuid := '00000000-0000-0000-0000-0000000013ad'; v1 uuid; v2 uuid;
begin
  v1 := (public.staff_library_add(t, 'h13', null, 'Müəllim 1 materialı', 'text', true, 'x')->>'id')::uuid;
  v2 := (public.staff_library_add(ad, 'h13', null, 'Admin materialı', 'text', true, 'y')->>'id')::uuid;
  perform tests.ok(public.staff_library_delete(t2, v1)->>'error' = 'forbidden', 'başqa müəllim silə bilmir');
  perform tests.ok(public.staff_library_delete(t2, v2)->>'error' = 'forbidden', 'müəllim admin materialını silə bilmir');
  perform tests.ok((public.staff_library_delete(t, v1)->>'ok')::boolean, 'yaradan silir');
  perform tests.ok((public.staff_library_delete(ad, v2)->>'ok')::boolean, 'admin silir');
  perform tests.ok(public.staff_library_delete(t, v1)->>'error' = 'not_found', 'silinmiş material not_found');
end $$;

-- ============ 8. live_set_role: can_publish ============
insert into public.venues (id, kind, name, owner_id, capacity) values
  ('30000000-0000-0000-0000-0000000013f1', 'hall', 'H13 zalı', '00000000-0000-0000-0000-0000000013c1', 20);
do $$
declare t uuid := '00000000-0000-0000-0000-0000000013c1'; a uuid := '00000000-0000-0000-0000-0000000013a1';
        s uuid; r jsonb;
begin
  s := (public.live_create_session(t, '30000000-0000-0000-0000-0000000013f1', 'H13 dərs', now(), now() + interval '1 hour', 'public')->>'session_id')::uuid;
  perform public.live_join(t, s);
  perform public.live_join(a, s);
  r := public.live_set_role(t, s, a, 'speaker');
  perform tests.ok(r->>'role' = 'speaker' and not (r->>'can_publish')::boolean, 'only_host_audio ikən speaker yayım edə bilmir');
  perform public.live_settings(t, s, false, null);
  r := public.live_set_role(t, s, a, 'speaker');
  perform tests.ok((r->>'can_publish')::boolean, 'səs açıq olanda speaker yayım edir');
  r := public.live_set_role(t, s, a, 'cohost');
  perform tests.ok((r->>'can_publish')::boolean and (r->>'can_publish_screen')::boolean, 'cohost həmişə yayım edir');
end $$;

-- ============ 9. srs_apply: atomik (CAS) yeniləmə ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000013a1'; q uuid := md5('h13q1')::uuid; v_prev jsonb;
begin
  perform tests.ok(public.srs_apply(a, q, '{"v":1}'::jsonb, true, null), 'ilk kart yazılır');
  perform tests.ok(not public.srs_apply(a, q, '{"v":2}'::jsonb, true, null), 'mövcud kartı null prev ilə əvəz etmək olmur');
  select card into v_prev from public.card_of(a, q);
  perform tests.ok(public.srs_apply(a, q, '{"v":3}'::jsonb, false, v_prev), 'cari prev ilə yenilənir');
  perform tests.ok(not public.srs_apply(a, q, '{"v":4}'::jsonb, false, v_prev), 'köhnə prev ilə yenilənmir (itki yoxdur)');
  perform tests.ok((select card->>'v' from public.srs_cards where student_id = a and question_id = q) = '3', 'son yazı qalır');
end $$;

-- ============ 10. Yol prefiksi: regex metasımbolları ============
do $$
declare t uuid := '00000000-0000-0000-0000-0000000013c1'; r jsonb;
begin
  r := public.staff_library_add(t, 'h.13', null, 'X', 'pdf', true, null, 'hX13/0b8f6c2e-1d2a-4c3b-9e4f-5a6b7c8d9e0f.pdf');
  perform tests.ok(r->>'error' = 'bad_path', 'nöqtə wildcard kimi işləmir (dəqiq prefiks)');
  -- Dəqiq prefiks RPC yoxlamasından keçir; cədvəlin storage_path məhdudiyyəti
  -- nöqtəli qovluğa icazə vermədiyi üçün ayrıca check_violation atır (bad_path deyil).
  begin
    r := public.staff_library_add(t, 'h.13', null, 'X', 'pdf', true, null, 'h.13/0b8f6c2e-1d2a-4c3b-9e4f-5a6b7c8d9e0f.pdf');
    perform tests.ok(r ? 'id', 'dəqiq fənn qovluğu qəbul olunur');
  exception when check_violation then
    perform tests.ok(true, 'dəqiq prefiks RPC yol yoxlamasından keçir');
  end;
end $$;

-- ============ 11. Qlobal kod limiti ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000013a1'; t uuid := '00000000-0000-0000-0000-0000000013c1'; v_code text; r jsonb;
begin
  select code into v_code from public.create_codes(t, 'h13', 1, 30) limit 1;
  insert into public.audit_events (student_id, kind, at) select null, 'code_fail', now() from generate_series(1, 200);
  r := public.redeem_code(a, v_code);
  perform tests.ok(r->>'error' = 'too_many_attempts', 'qlobal saatlıq limit çox hesablı brute-force-u bloklayır');
  delete from public.audit_events where kind = 'code_fail' and student_id is null;
  r := public.redeem_code(a, v_code);
  perform tests.ok(r->>'subject_id' = 'h13', 'limit sıfırlananda düzgün kod işləyir');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'