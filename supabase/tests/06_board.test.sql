-- Şərəf lövhəsi: məxfilik (razılıq), qısa ad, həftə filtri.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000006a1', 'b1@test.az', '{"display_name":"Aysel Məmmədova"}'),
  ('00000000-0000-0000-0000-0000000006a2', 'b2@test.az', '{"display_name":"Elvin"}'),
  ('00000000-0000-0000-0000-0000000006a3', 'b3@test.az', '{"display_name":"Gizli Tələbə"}');
insert into public.subjects (id, name) values ('b6', 'Lövhə');
insert into public.topics (id, subject_id, name) values ('60000000-0000-0000-0000-000000000001', 'b6', 'M');
insert into public.questions (id, topic_id, stem, options, answer_index, status)
values ('60000000-0000-0000-0000-0000000000f1', '60000000-0000-0000-0000-000000000001', 'S', '["a","b"]', 0, 'published');

do $$
declare a uuid := '00000000-0000-0000-0000-0000000006a1'; b uuid := '00000000-0000-0000-0000-0000000006a2'; h uuid := '00000000-0000-0000-0000-0000000006a3';
        q uuid := '60000000-0000-0000-0000-0000000000f1'; u uuid; v_sess uuid; r jsonb;
begin
  foreach u in array array[a, b, h] loop
    insert into public.test_sessions (student_id, mode, subject_id, question_ids) values (u, 'topic', 'b6', array[q]) returning id into v_sess;
    insert into public.answers (session_id, question_id, position, chosen, correct, ms) values (v_sess, q, 1, 0, true, 4000);
  end loop;
  -- Keçən həftənin cavabı sayılmır
  insert into public.test_sessions (student_id, mode, subject_id, question_ids) values (a, 'topic', 'b6', array[q]) returning id into v_sess;
  insert into public.answers (session_id, question_id, position, chosen, correct, ms, answered_at) values (v_sess, q, 1, 1, false, 4000, now() - interval '8 days');

  perform tests.ok(public._short_name('Aysel Məmmədova', 1) = 'Aysel M.' and public._short_name('Elvin', 2) = 'Elvin' and public._short_name('', 7) = 'Tələbə 7', 'ad qısaldılır');
  r := public.board_rows(a, 'b6');
  perform tests.ok(jsonb_array_length(r->'rows') = 1 and (r->'rows'->0->>'me')::boolean, 'razılıq yoxdursa yalnız özünü görür');
  perform public.set_board_visibility(b, true);
  perform public.set_board_visibility(a, true);
  r := public.board_rows(a, 'b6');
  perform tests.ok(jsonb_array_length(r->'rows') = 2, 'razılıq verənlər görünür, gizli tələbə görünmür');
  perform tests.ok(r::text not like '%Gizli%' and r::text not like '%' || h::text || '%' and r::text not like '%' || b::text || '%', 'gizli tələbənin adı və heç kimin ID-si qaytarılmır');
  perform tests.ok((select (x->>'total')::int from jsonb_array_elements(r->'rows') x where x->>'name' = 'Aysel M.') = 1, 'keçən həftənin cavabı sayılmır');
  perform tests.ok(jsonb_array_length(public.board_rows(a, 'yoxdur')->'rows') = 0, 'fənn filtri');
  perform tests.ok(public.set_board_visibility('00000000-0000-0000-0000-00000000dead', true)->>'error' = 'no_profile', 'profilsiz istifadəçi');
  perform tests.ok(not has_function_privilege('authenticated', 'public.board_rows(uuid,text)', 'execute'), 'authenticated birbaşa çağıra bilmir');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
