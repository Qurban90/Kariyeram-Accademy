-- Təhlükəsizlik sənədindəki (docs/SECURITY.md) əlavə iddiaların testləri.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000004a1', 'h1@test.az', '{"display_name":"Host"}'),
  ('00000000-0000-0000-0000-0000000004a2', 'h2@test.az', '{"display_name":"Tələbə A"}'),
  ('00000000-0000-0000-0000-0000000004a3', 'h3@test.az', '{"display_name":"Tələbə B"}');
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-0000000004a1';
select public.accept_consents(id, array['terms', 'privacy', 'age18']) from public.profiles where id::text like '00000000-0000-0000-0000-0000000004a%';

-- ============ Variant sırasının qarışdırılması ============
do $$
declare p int[]; v_distinct int; i int;
begin
  p := public._perm(12345, gen_random_uuid(), 5);
  perform tests.ok((select array_agg(x order by x) from unnest(p) x) = array[0, 1, 2, 3, 4], '_perm 0..n-1 permutasiyasıdır');
  perform tests.ok(public._perm(7, '00000000-0000-0000-0000-000000000123', 4) = public._perm(7, '00000000-0000-0000-0000-000000000123', 4), 'eyni toxum və sual eyni sıranı verir (cavab yoxlaması sabitdir)');
  select count(distinct public._perm(s, '00000000-0000-0000-0000-000000000123', 4)::text) into v_distinct from generate_series(1, 40) s;
  perform tests.ok(v_distinct >= 8, format('fərqli sessiyalarda sıra dəyişir (%s fərqli sıra / 40)', v_distinct));
  select count(*) into i from generate_series(1, 200) s where (public._perm(s, '00000000-0000-0000-0000-000000000999', 4))[1] = 0;
  perform tests.ok(i between 20 and 80, format('düzgün variantın yeri əzbərlənə bilmir (ilk yerdə %s/200)', i));
end $$;

-- ============ Kod brute-force ============
do $$
declare a uuid := '00000000-0000-0000-0000-0000000004a2'; t uuid := '00000000-0000-0000-0000-0000000004a1'; v_code text; i int; r jsonb;
begin
  insert into public.subjects (id, name) values ('hard', 'Sərtləşdirmə');
  select code into v_code from public.create_codes(t, 'hard', 1, 30) limit 1;
  for i in 1..10 loop perform public.redeem_code(a, 'ZZZZ-ZZZZ-ZZZ' || i); end loop;
  r := public.redeem_code(a, v_code);
  perform tests.ok(r->>'error' = 'too_many_attempts', 'saatda 10 yanlış cəhddən sonra düzgün kod da bloklanır');
  perform tests.ok(not exists (select 1 from public.enrollments where student_id = a and subject_id = 'hard'), 'blok zamanı abunə açılmır');
  update public.audit_events set at = now() - interval '2 hours' where student_id = a and kind = 'code_fail';
  r := public.redeem_code(a, v_code);
  perform tests.ok(r->>'subject_id' = 'hard', 'bir saatdan sonra yenidən cəhd etmək olur');
end $$;

-- ============ Köməkçi host (cohost) ============
insert into public.venues (id, kind, name, owner_id, capacity) values
  ('30000000-0000-0000-0000-0000000004f1', 'hall', 'Sərtləşdirmə zalı', '00000000-0000-0000-0000-0000000004a1', 20);
do $$
declare h uuid := '00000000-0000-0000-0000-0000000004a1'; a uuid := '00000000-0000-0000-0000-0000000004a2'; b uuid := '00000000-0000-0000-0000-0000000004a3';
        s uuid; r jsonb;
begin
  s := (public.live_create_session(h, '30000000-0000-0000-0000-0000000004f1', 'Köməkçi testi', now(), now() + interval '1 hour', 'public')->>'session_id')::uuid;
  perform public.live_join(h, s); perform public.live_join(a, s); perform public.live_join(b, s);
  r := public.live_set_role(h, s, a, 'cohost');
  perform tests.ok(r->>'role' = 'cohost', 'əsas host köməkçi təyin edir');
  perform tests.ok(public._live_is_host(a, s), 'köməkçi host səlahiyyəti alır');
  r := public.live_set_role(a, s, b, 'cohost');
  perform tests.ok(r->>'error' = 'forbidden', 'köməkçi başqasını köməkçi edə bilmir');
  r := public.live_set_role(a, s, b, 'speaker');
  perform tests.ok(r->>'role' = 'speaker', 'köməkçi söz verə bilir');
  perform tests.ok(public.live_set_role(a, s, h, 'audience')->>'error' = 'bad_target', 'əsas hostun rolu dəyişdirilmir');
  perform tests.ok(public.live_ban(a, s, h)->>'error' = 'bad_target', 'əsas host bloklanmır');
end $$;

rollback;
\echo 'BÜTÜN DB TESTLƏRİ KEÇDİ'
