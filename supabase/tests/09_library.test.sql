-- Konspekt şkafı: icazə, gövdənin gizliliyi, müəllim əməliyyatları.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000009a1', 'l1@test.az', '{"display_name":"Müəllim L"}'),
  ('00000000-0000-0000-0000-0000000009a2', 'l2@test.az', '{"display_name":"Abunəli"}'),
  ('00000000-0000-0000-0000-0000000009a3', 'l3@test.az', '{"display_name":"Abunəsiz"}');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-0000000009a1';
select public.accept_consents(id, array['terms', 'privacy', 'age18']) from public.profiles where id::text like '00000000-0000-0000-0000-0000000009a%';
insert into public.subjects (id, name) values ('lib9', 'Kitabxana');
insert into public.enrollments (student_id, subject_id, access_until) values ('00000000-0000-0000-0000-0000000009a2', 'lib9', now() + interval '30 days');

do $$
declare t uuid := '00000000-0000-0000-0000-0000000009a1'; a uuid := '00000000-0000-0000-0000-0000000009a2'; b uuid := '00000000-0000-0000-0000-0000000009a3';
        v_free uuid; v_paid uuid; v_pdf uuid; r jsonb; v_ok boolean := false; v_n int;
begin
  perform tests.ok(public.staff_library_add(a, 'lib9', null, 'X', 'text', true, 'b')->>'error' = 'forbidden', 'tələbə şkafa əlavə edə bilmir');
  perform tests.ok(public.staff_library_add(t, 'lib9', null, 'X', 'text', true, '')->>'error' = 'bad_body', 'boş mətn olmur');
  perform tests.ok(public.staff_library_add(t, 'lib9', null, 'X', 'pdf', true, null, '../etc/passwd')->>'error' = 'bad_path', 'yol keçidi (..) qəbul olunmur');
  perform tests.ok(public.staff_library_add(t, 'lib9', null, 'X', 'pdf', true, null, 'other/0b8f6c2e-1d2a-4c3b-9e4f-5a6b7c8d9e0f.pdf')->>'error' = 'bad_path', 'başqa fənnin qovluğu qəbul olunmur');
  v_free := (public.staff_library_add(t, 'lib9', null, 'Pulsuz konspekt', 'text', true, 'Açıq mətn')->>'id')::uuid;
  v_paid := (public.staff_library_add(t, 'lib9', null, 'Abunə konspekti', 'text', false, 'Gizli mətn')->>'id')::uuid;
  v_pdf := (public.staff_library_add(t, 'lib9', null, 'PDF', 'pdf', false, null, 'lib9/0b8f6c2e-1d2a-4c3b-9e4f-5a6b7c8d9e0f.pdf', 1000)->>'id')::uuid;
  perform tests.ok(v_free is not null and v_paid is not null and v_pdf is not null, 'müəllim mətn və PDF əlavə edir');

  r := public.library_open(b, v_free);
  perform tests.ok(r->>'body' = 'Açıq mətn' and (r->>'watermark') is not null, 'pulsuz konspekti hamı oxuyur (su nişanı ilə)');
  perform tests.ok(public.library_open(b, v_paid)->>'error' = 'forbidden', 'abunəsiz tələbə ödənişli konspekti oxuya bilmir');
  perform tests.ok(public.library_open(a, v_paid)->>'body' = 'Gizli mətn', 'abunəli tələbə oxuyur');
  r := public.library_open(a, v_pdf);
  perform tests.ok(r->>'kind' = 'pdf' and r->>'storage_path' = 'lib9/0b8f6c2e-1d2a-4c3b-9e4f-5a6b7c8d9e0f.pdf', 'PDF üçün yol qaytarılır (URL-i server imzalayır)');
  perform tests.ok(exists (select 1 from public.audit_events where student_id = a and kind = 'library_open'), 'açılış audit-ə yazılır');

  -- Klient (authenticated) gövdəni birbaşa oxuya bilmir, metadata-nı oxuyur
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;
  select count(*) into v_n from public.library_items where subject_id = 'lib9';
  begin
    perform 1 from public.library_bodies;
    v_ok := (select count(*) from public.library_bodies) = 0;
  exception when insufficient_privilege then v_ok := true;
  end;
  reset role;
  perform tests.ok(v_n = 3, 'metadata (başlıq) hamıya görünür');
  perform tests.ok(v_ok, 'mətn gövdəsi klientə bağlıdır');

  perform tests.ok(public.staff_library_delete(a, v_paid)->>'error' = 'forbidden', 'tələbə silə bilmir');
  r := public.staff_library_delete(t, v_pdf);
  perform tests.ok((r->>'ok')::boolean and r->>'storage_path' = 'lib9/0b8f6c2e-1d2a-4c3b-9e4f-5a6b7c8d9e0f.pdf', 'silmə faylın yolunu qaytarır (Storage-dan da silinir)');
  perform tests.ok(public.library_open(a, v_pdf)->>'error' = 'not_found', 'silinmiş material açılmır');

  -- Gündəlik limit (su nişanı serverdə CPU tələb edir): tələbəyə 200, müəllimə limit yoxdur.
  insert into public.audit_events (student_id, kind, detail) select a, 'library_open', '{}'::jsonb from generate_series(1, 200);
  perform tests.ok(public.library_open(a, v_paid)->>'error' = 'daily_limit', 'gündə 200 açılışdan sonra limit');
  insert into public.audit_events (student_id, kind, detail) select t, 'library_open', '{}'::jsonb from generate_series(1, 200);
  perform tests.ok(public.library_open(t, v_paid) ? 'kind', 'müəllim limitsizdir');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
