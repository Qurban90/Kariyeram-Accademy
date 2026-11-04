-- Kod siyahısı/ləğvi və müəllim qiyməti/qeydi.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000008a1', 'm8@test.az', '{"display_name":"Müəllim 8"}'),
  ('00000000-0000-0000-0000-0000000008a2', 'k8@test.az', '{"display_name":"Başqa müəllim"}'),
  ('00000000-0000-0000-0000-0000000008a3', 's8@test.az', '{"display_name":"Tələbə 8"}');
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-0000000008a1', '00000000-0000-0000-0000-0000000008a2');
insert into public.subjects (id, name) values ('s8', 'Səkkiz');

do $$
declare t uuid := '00000000-0000-0000-0000-0000000008a1'; o uuid := '00000000-0000-0000-0000-0000000008a2'; s uuid := '00000000-0000-0000-0000-0000000008a3';
        r jsonb; v_codes jsonb; v_id uuid; v_used uuid; v_no bigint;
begin
  v_codes := public.staff_create_codes(t, 's8', 2, 30)->'codes';
  perform public.redeem_code(s, v_codes->>0);
  r := public.staff_list_codes(t, 's8');
  perform tests.ok(jsonb_array_length(r->'codes') = 2, 'müəllim öz kodlarını görür');
  perform tests.ok(r::text not like '%' || (v_codes->>1) || '%', 'siyahıda açıq mətn kod yoxdur');
  perform tests.ok(jsonb_array_length(public.staff_list_codes(o, 's8')->'codes') = 0, 'başqa müəllimin kodları görünmür');
  perform tests.ok(public.staff_list_codes(s, 's8')->>'error' = 'forbidden', 'tələbə siyahını görmür');
  select (x->>'id')::uuid into v_used from jsonb_array_elements(r->'codes') x where x->>'state' = 'redeemed';
  select (x->>'id')::uuid into v_id from jsonb_array_elements(r->'codes') x where x->>'state' = 'unused';
  perform tests.ok(public.staff_revoke_code(o, v_id)->>'error' = 'forbidden', 'başqa müəllim ləğv edə bilmir');
  perform tests.ok(public.staff_revoke_code(t, v_used)->>'error' = 'code_used', 'istifadə olunmuş kod ləğv olunmur');
  perform tests.ok((public.staff_revoke_code(t, v_id)->>'ok')::boolean, 'istifadə olunmamış kod ləğv olunur');
  perform tests.ok(public.redeem_code(s, v_codes->>1)->>'error' = 'invalid_code', 'ləğv olunmuş kod işləmir');
  perform tests.ok(exists (select 1 from public.audit_events where kind = 'code_revoked' and student_id = t), 'ləğv audit-ə yazılır');

  select student_no into v_no from public.profiles where id = s;
  r := public.staff_diary_add(t, v_no, 'grade', 'Konstitusiya: şifahi sorğu', '9', 'Əla hazırlaşıb');
  perform tests.ok(r ? 'id' and r->>'student_name' = 'Tələbə 8', 'müəllim qiymət yazır');
  perform tests.ok(exists (select 1 from public.diary_entries where student_id = s and kind = 'grade' and payload->>'grade' = '9' and created_by = t), 'qiymət tələbənin gündəliyindədir');
  perform tests.ok(public.staff_diary_add(t, v_no, 'grade', 'X', null, null)->>'error' = 'bad_grade', 'qiymətsiz qiymət yazısı olmur');
  perform tests.ok(public.staff_diary_add(t, v_no, 'test', 'X', null, null)->>'error' = 'bad_kind', 'yalnız qiymət və qeyd');
  perform tests.ok(public.staff_diary_add(t, 99999999, 'note', 'X', null, 'y')->>'error' = 'not_found', 'naməlum tələbə nömrəsi');
  perform tests.ok(public.staff_diary_add(s, v_no, 'note', 'X', null, 'y')->>'error' = 'forbidden', 'tələbə gündəliyə yaza bilmir');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
