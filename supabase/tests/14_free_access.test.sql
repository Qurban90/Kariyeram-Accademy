-- Pulsuz mərhələ (app_config.free_access): bütün mövzular və mətn konspektləri açılır, PDF və canlı dərs abunəli qalır.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000014a1', 'f14@test.az', '{"display_name":"Abunəsiz"}'),
  ('00000000-0000-0000-0000-0000000014c1', 't14@test.az', '{"display_name":"Müəllim"}');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-0000000014c1';
select public.accept_consents(id, array['terms', 'privacy', 'age18']) from public.profiles where id::text like '00000000-0000-0000-0000-0000000014%';
insert into public.subjects (id, name) values ('f14', 'Pulsuz');
insert into public.topics (id, subject_id, name, free) values ('14000000-0000-0000-0000-000000000001', 'f14', 'Ödənişli mövzu', false);
insert into public.questions (id, topic_id, stem, options, answer_index, explanation, status)
select md5('f14q' || i)::uuid, '14000000-0000-0000-0000-000000000001', 'Sual ' || i, '["A","B","C","D"]'::jsonb, 0::smallint, 'İzah', 'published'
from generate_series(1, 3) i;

do $$
declare s uuid := '00000000-0000-0000-0000-0000000014a1'; t uuid := '00000000-0000-0000-0000-0000000014c1';
        v_text uuid; v_pdf uuid;
begin
  v_text := (public.staff_library_add(t, 'f14', null, 'Mətn', 'text', false, 'Mövzunun izahı')->>'id')::uuid;
  v_pdf := (public.staff_library_add(t, 'f14', null, 'PDF', 'pdf', false, null, 'f14/0b8f6c2e-1d2a-4c3b-9e4f-5a6b7c8d9e0f.pdf', 1000)->>'id')::uuid;

  update public.app_config set free_access = false;
  perform tests.ok((select count(*) from public.candidates(s, 'f14')) = 0, 'bayraq sönülü: ödənişli mövzu bağlıdır');
  perform tests.ok(public.library_open(s, v_text)->>'error' = 'forbidden', 'bayraq sönülü: ödənişli mətn bağlıdır');

  update public.app_config set free_access = true;
  perform tests.ok((select count(*) from public.candidates(s, 'f14')) = 3, 'pulsuz mərhələ: ödənişli mövzunun sualları açılır');
  perform tests.ok(public.library_open(s, v_text)->>'body' = 'Mövzunun izahı', 'pulsuz mərhələ: mətn konspekti açılır');
  perform tests.ok(public.library_open(s, v_pdf)->>'error' = 'forbidden', 'pulsuz mərhələ: PDF (kurs materialı) yenə bağlıdır');
  perform tests.ok(not has_function_privilege('authenticated', 'public._free_access()', 'execute'), 'bayraq funksiyası klientə açıq deyil');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
