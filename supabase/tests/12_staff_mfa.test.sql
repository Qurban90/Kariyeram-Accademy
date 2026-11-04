-- Müəllim MFA: sual bankını birbaşa oxumaq (RLS) aal2 tələb edir, əgər faktor qoşulubsa və ya admin məcburi edibsə.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
-- Supabase-də auth.mfa_factors var; test klasterində təqlid edirik.
create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000012a1', 'mfa-t@test.az', '{"display_name":"Müəllim MFA"}'),
  ('00000000-0000-0000-0000-0000000012a2', 'mfa-a@test.az', '{"display_name":"Admin MFA"}');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-0000000012a1';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000012a2';
insert into public.subjects (id, name) values ('m12', 'MFA');
insert into public.topics (id, subject_id, name) values ('12000000-0000-0000-0000-000000000001', 'm12', 'M');
insert into public.questions (topic_id, stem, options, answer_index, status)
values ('12000000-0000-0000-0000-000000000001', 'MFA sualı', '["a","b"]', 0, 'review');
grant select on auth.mfa_factors to authenticated;

create function pg_temp.visible(p_aal text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000012a1', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-0000-0000-0000000012a1', 'aal', p_aal)::text, true);
  set local role authenticated;
  select count(*) into n from public.questions where stem = 'MFA sualı';
  reset role;
  return n;
end $$;

do $$ begin
  perform tests.ok(pg_temp.visible('aal1') = 1, 'faktor yoxdur, məcburi deyil: müəllim aal1 ilə oxuyur');
  insert into auth.mfa_factors (user_id, status) values ('00000000-0000-0000-0000-0000000012a1', 'unverified');
  perform tests.ok(pg_temp.visible('aal1') = 1, 'təsdiqlənməmiş faktor tələb yaratmır');
  update auth.mfa_factors set status = 'verified' where user_id = '00000000-0000-0000-0000-0000000012a1';
  perform tests.ok(pg_temp.visible('aal1') = 0, 'faktor qoşulubsa aal1 ilə sual bankı görünmür');
  perform tests.ok(pg_temp.visible('aal2') = 1, 'aal2 ilə görünür');
  delete from auth.mfa_factors;

  perform tests.ok(public.admin_set_config('00000000-0000-0000-0000-0000000012a1', null, null, null, true)->>'error' = 'forbidden', 'müəllim məcburiyyəti aça bilmir');
  perform tests.ok((public.admin_set_config('00000000-0000-0000-0000-0000000012a2', null, null, null, true)->>'staff_mfa_required')::boolean, 'admin hamı üçün məcburi edir');
  perform tests.ok(pg_temp.visible('aal1') = 0, 'məcburi olanda faktorsuz müəllim də aal1 ilə görmür');
  perform tests.ok(pg_temp.visible('aal2') = 1, 'məcburi olanda aal2 ilə görür');
  perform tests.ok(exists (select 1 from public.audit_events where kind = 'admin_config' and detail->'to'->>'staff_mfa_required' = 'true'), 'audit-də');
  perform public.admin_set_config('00000000-0000-0000-0000-0000000012a2', null, null, null, false);
  perform tests.ok(pg_temp.visible('aal1') = 1, 'söndürüləndə yenə oxuyur');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
