-- Klient təhlükəsizlik hadisələri (ekran şəkli) və realtime nəşri.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'e1@karyeram.test');

do $$
declare u uuid := '00000000-0000-0000-0000-0000000000e1'; r jsonb; i int;
begin
  r := public.report_client_event(u, 'screenshot', 'test');
  perform tests.ok((r->>'recorded')::boolean, 'ekran şəkli audit-ə yazılır');
  perform tests.ok(exists (select 1 from public.audit_events where student_id = u and kind = 'client_screenshot' and detail->>'context' = 'test'), 'hadisə növü və konteksti saxlanılır');
  r := public.report_client_event(u, 'drop_table', null);
  perform tests.ok(r->>'error' = 'bad_kind', 'naməlum növ rədd edilir');
  r := public.report_client_event('00000000-0000-0000-0000-00000000dead', 'screenshot', null);
  perform tests.ok(r->>'error' = 'no_profile', 'profilsiz istifadəçi rədd edilir');
  for i in 1..60 loop perform public.report_client_event(u, 'screen_recording', repeat('x', 200)); end loop;
  perform tests.ok((select count(*) from public.audit_events where student_id = u and kind like 'client_%') = 50, 'gündəlik 50 hadisə limiti');
  perform tests.ok((select max(length(detail->>'context')) from public.audit_events where student_id = u) <= 64, 'kontekst 64 simvolla kəsilir');
  perform tests.ok(not has_function_privilege('authenticated', 'public.report_client_event(uuid,text,text)', 'execute'), 'authenticated birbaşa çağıra bilmir');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
