-- Saxlama siyasəti (köhnə silinir, yeni qalır) və tətbiq konfiqurasiyası (anon oxuyur, yalnız admin dəyişir).
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000011a1', 'adm11@test.az', '{"display_name":"Admin 11"}'),
  ('00000000-0000-0000-0000-0000000011a2', 's11@test.az', '{"display_name":"Tələbə 11"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000011a1';
insert into public.subjects (id, name) values ('s11', 'On bir');
insert into public.topics (id, subject_id, name) values ('11000000-0000-0000-0000-000000000001', 's11', 'M');
insert into public.questions (id, topic_id, stem, options, answer_index, status)
values ('11000000-0000-0000-0000-0000000000f1', '11000000-0000-0000-0000-000000000001', 'S', '["a","b"]', 0, 'published');

do $$
declare a uuid := '00000000-0000-0000-0000-0000000011a1'; s uuid := '00000000-0000-0000-0000-0000000011a2';
        q uuid := '11000000-0000-0000-0000-0000000000f1'; v_old uuid; v_new uuid; r jsonb;
begin
  insert into public.test_sessions (student_id, mode, subject_id, question_ids, started_at) values (s, 'topic', 's11', array[q], now() - interval '8 days') returning id into v_old;
  insert into public.test_sessions (student_id, mode, subject_id, question_ids) values (s, 'topic', 's11', array[q]) returning id into v_new;
  insert into public.question_views (student_id, question_id, session_id, device_id, viewed_at) values
    (s, q, v_old, 'd', now() - interval '40 days'), (s, q, v_new, 'd', now() - interval '1 day');
  insert into public.audit_events (student_id, kind, at) values
    (s, 'client_screenshot', now() - interval '200 days'), (s, 'client_screenshot', now() - interval '10 days'),
    (s, 'device_replaced', now() - interval '200 days'), (s, 'device_replaced', now() - interval '500 days');

  r := public.maintenance_cleanup(1);  -- kiçik hissə ölçüsü: dövr bir neçə dəfə işləməlidir
  perform tests.ok((r->>'abandoned')::int = 1 and (select state from public.test_sessions where id = v_old) = 'abandoned', '7 gündən köhnə yarımçıq test abandoned olur');
  perform tests.ok((select state from public.test_sessions where id = v_new) = 'active', 'yeni test toxunulmur');
  perform tests.ok((select count(*) from public.question_views where student_id = s) = 1 and (r->>'question_views')::int = 1, 'köhnə baxışlar silinir, yeniləri qalır');
  perform tests.ok((select count(*) from public.audit_events where student_id = s and kind = 'client_screenshot') = 1, 'klient siqnalı 180 gündən sonra silinir');
  perform tests.ok((select count(*) from public.audit_events where student_id = s and kind = 'device_replaced') = 1, 'digər audit 400 gün saxlanılır');
  perform tests.ok((public.maintenance_cleanup()->>'question_views')::int = 0, 'təkrar işə salma təhlükəsizdir');

  -- Konfiqurasiya
  perform tests.ok(public.admin_set_config(s, '1.0.0', null, null)->>'error' = 'forbidden', 'tələbə konfiqurasiyanı dəyişə bilmir');
  perform tests.ok(public.admin_set_config(a, '1.0', null, null)->>'error' = 'bad_version', 'versiya formatı');
  r := public.admin_set_config(a, '1.2.0', true, 'Saat 03:00-a qədər texniki iş');
  perform tests.ok(r->>'min_version' = '1.2.0' and (r->>'maintenance')::boolean, 'admin dəyişir');
  r := public.admin_set_config(a, null, false, null);
  perform tests.ok(r->>'min_version' = '1.2.0' and not (r->>'maintenance')::boolean and r->>'message' like 'Saat%', 'null = dəyişmə');
  perform tests.ok(exists (select 1 from public.audit_events where kind = 'admin_config' and detail->>'by' = a::text), 'audit-ə yazılır');
end $$;

set local role anon;
do $$ begin perform tests.ok((select count(*) from public.app_config) = 1, 'anon konfiqurasiyanı oxuyur (girişdən əvvəl)'); end $$;
do $$ begin
  begin
    update public.app_config set maintenance = true;
    perform tests.ok(false, 'anon dəyişə bilməməlidir');
  exception when insufficient_privilege then perform tests.ok(true, 'anon dəyişə bilmir');
  end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    update public.app_config set min_version = '9.9.9';
    perform tests.ok(false, 'authenticated dəyişə bilməməlidir');
  exception when insufficient_privilege then perform tests.ok(true, 'authenticated dəyişə bilmir');
  end;
end $$;
reset role;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
