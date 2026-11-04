-- Admin: axtarış (maskalı), dayandırma/bərpa, rol, audit, admin toxunulmazlığı, dayandırılmış müəllim.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email, phone, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a0a1', 'boss@test.az', null, '{"display_name":"Baş Admin"}'),
  ('00000000-0000-0000-0000-00000000a0a2', 'boss2@test.az', null, '{"display_name":"İkinci Admin"}'),
  ('00000000-0000-0000-0000-00000000a0a3', 'aysel.mammadova@test.az', '994501112233', '{"display_name":"Aysel Məmmədova"}'),
  ('00000000-0000-0000-0000-00000000a0a4', 'mu@test.az', null, '{"display_name":"Müəllim A"}');
update public.profiles set role = 'admin' where id in ('00000000-0000-0000-0000-00000000a0a1', '00000000-0000-0000-0000-00000000a0a2');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000a0a4';

do $$
declare a uuid := '00000000-0000-0000-0000-00000000a0a1'; a2 uuid := '00000000-0000-0000-0000-00000000a0a2';
        s uuid := '00000000-0000-0000-0000-00000000a0a3'; t uuid := '00000000-0000-0000-0000-00000000a0a4';
        r jsonb; v_no bigint; v_first bigint;
begin
  select student_no into v_no from public.profiles where id = s;

  -- Axtarış
  perform tests.ok(public.admin_find_users(s, 'Aysel')->>'error' = 'forbidden', 'tələbə axtarış edə bilmir');
  perform tests.ok(public.admin_find_users(t, 'Aysel')->>'error' = 'forbidden', 'müəllim admin deyil');
  perform tests.ok(public.admin_find_users(a, 'ab')->>'error' = 'bad_query', 'qısa sorğu rədd');
  r := public.admin_find_users(a, 'aysel');
  perform tests.ok(jsonb_array_length(r->'users') = 1 and r->'users'->0->>'student_no' = v_no::text, 'ad parçası ilə tapılır');
  perform tests.ok(r->'users'->0->>'email' = 'ay***@test.az' and r->'users'->0->>'phone' = '+99450*****33', 'e-poçt və telefon maskalıdır');
  perform tests.ok(r::text not like '%mammadova@%' and r::text not like '%501112233%', 'tam əlaqə məlumatı qaytarılmır');
  perform tests.ok(jsonb_array_length(public.admin_find_users(a, v_no::text)->'users') >= 1, 'tələbə № ilə tapılır');
  perform tests.ok(jsonb_array_length(public.admin_find_users(a, '1112233')->'users') = 1, 'telefonun son rəqəmləri ilə tapılır');
  perform tests.ok(jsonb_array_length(public.admin_find_users(a, 'AYSEL.MAMMADOVA@test.az')->'users') = 1, 'e-poçt (böyük-kiçik hərfə həssas deyil)');
  perform tests.ok(jsonb_array_length(public.admin_find_users(a, '%%%')->'users') = 0, 'LIKE simvolları ilə bütün bazanı çəkmək olmur');

  -- Dayandırma
  perform tests.ok(public.admin_suspend(a, a, 24, 'özüm')->>'error' = 'self', 'admin özünü dayandıra bilmir');
  perform tests.ok(public.admin_suspend(a, a2, 24, 'çevriliş')->>'error' = 'forbidden', 'admin başqa adminə toxuna bilmir');
  perform tests.ok(public.admin_suspend(t, s, 24, 'səbəb')->>'error' = 'forbidden', 'müəllim dayandıra bilmir');
  perform tests.ok(public.admin_suspend(a, s, 0, 'səbəb')->>'error' = 'bad_hours', 'saat aralığı');
  perform tests.ok(public.admin_suspend(a, s, 24, ' ')->>'error' = 'bad_reason', 'səbəb məcburidir');
  perform tests.ok(public.admin_suspend(a, '00000000-0000-0000-0000-00000000dead', 24, 'yoxdur')->>'error' = 'not_found', 'naməlum istifadəçi');
  r := public.admin_suspend(a, s, 24, 'Sualları kopyalayıb paylaşır');
  perform tests.ok((r->>'ok')::boolean and jsonb_typeof(r->'rooms') = 'array', 'tələbə dayandırılır, canlı otaqların siyahısı qaytarılır');
  perform tests.ok(public._guard(s, 'dev') = 'suspended', 'dayandırılmış tələbə test işləyə bilmir (_guard)');
  perform tests.ok(exists (select 1 from public.audit_events where student_id = s and kind = 'admin_suspended' and detail->>'by' = a::text), 'dayandırma audit-dədir, kim etdiyi ilə');
  perform tests.ok(public.admin_find_users(a, 'aysel')->'users'->0->>'suspension_reason' like 'admin:%', 'axtarışda dayandırma görünür');

  -- Dayandırılmış müəllim səlahiyyətini itirir
  perform tests.ok(public.is_staff(t), 'müəllim əvvəlcə staff-dır');
  perform public.admin_suspend(a, t, 2, 'Yoxlama');
  perform tests.ok(not public.is_staff(t), 'dayandırılmış müəllim staff deyil');
  perform tests.ok(public.staff_create_codes(t, 'x', 1, 30)->>'error' = 'forbidden', 'dayandırılmış müəllim kod yarada bilmir');
  perform public.admin_unsuspend(a, t);
  perform tests.ok(public.is_staff(t), 'bərpadan sonra yenə staff');

  -- Bərpa
  perform tests.ok((public.admin_unsuspend(a, s)->>'ok')::boolean, 'tələbə bərpa olunur');
  perform tests.ok((select suspended_until is null from public.profiles where id = s), 'dayandırma silinib');

  -- Rol
  perform tests.ok(public.admin_set_role(a, s, 'admin')->>'error' = 'forbidden', 'admin təyinatı API ilə mümkün deyil');
  perform tests.ok(public.admin_set_role(a, a2, 'student')->>'error' = 'forbidden', 'başqa adminin rolu dəyişmir');
  -- Qeyd: is_staff STABLE-dir, eyni ifadədə əvvəlki snapşotu görür; ona görə ayrıca ifadələr.
  perform tests.ok((public.admin_set_role(a, s, 'teacher')->>'ok')::boolean, 'rol dəyişir');
  perform tests.ok(public.is_staff(s), 'tələbə müəllim olur');
  perform tests.ok((public.admin_set_role(a, s, 'teacher')->>'unchanged')::boolean, 'eyni rol: dəyişiklik yoxdur');
  perform tests.ok((public.admin_set_role(a, s, 'student')->>'ok')::boolean, 'rol geri dəyişir');
  perform tests.ok(not public.is_staff(s), 'müəllim tələbəyə qaytarılır');
  perform tests.ok((select count(*) from public.audit_events where student_id = s and kind = 'admin_role') = 2, 'rol dəyişiklikləri audit-dədir');

  -- Audit jurnalı
  perform tests.ok(public.admin_audit(t)->>'error' = 'forbidden', 'müəllim audit-i görmür');
  r := public.admin_audit(a, null, s, null, 2);
  perform tests.ok(jsonb_array_length(r->'events') = 2, 'limit işləyir');
  v_first := (r->'events'->1->>'id')::bigint;
  perform tests.ok(((r->'events'->0->>'id')::bigint) > v_first, 'yenidən köhnəyə');
  r := public.admin_audit(a, null, s, v_first, 100);
  perform tests.ok(jsonb_array_length(r->'events') >= 1 and (select bool_and((x->>'id')::bigint < v_first) from jsonb_array_elements(r->'events') x), 'növbəti səhifə (açar-dəst)');
  perform tests.ok(jsonb_array_length(public.admin_audit(a, 'admin_role')->'events') = 2, 'növə görə filtr');
  perform tests.ok(jsonb_array_length(public.admin_audit(a, null, null, null, 100000)->'events') <= 100, 'ən çox 100 sətir');

  perform tests.ok(not has_function_privilege('authenticated', 'public.admin_suspend(uuid,uuid,int,text)', 'execute'), 'authenticated birbaşa çağıra bilmir');
  perform tests.ok(not has_function_privilege('anon', 'public.admin_audit(uuid,text,uuid,bigint,int)', 'execute'), 'anon birbaşa çağıra bilmir');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
