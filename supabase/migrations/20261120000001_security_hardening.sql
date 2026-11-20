-- Təhlükəsizlik sərtləşdirməsi (audit tapıntıları).
-- C1: cavab açarı / toxum sızmasının qarşısı:
--   * test_sessions.seed və question_ids klientə bağlıdır (sütun səviyyəsində SELECT icazəsi); klient `total` oxuyur.
--   * answers cədvəli klientə tam bağlıdır (icmal yalnız session_review RPC ilə).
--   * _perm server sirri ilə qarışdırılır: seed sızsa belə variant sırası proqnozlaşdırılmır.
-- H6: staff_mfa_required defolt TRUE (fail-closed); admin açıq söndürə bilər.
-- H7: cavab vaxtı serverdə ölçülür (question_views.viewed_at); skreyp (pace) yoxlaması klient ms-inə etibar etmir.
-- M9: library_open / set_board_visibility / report_client_event dayandırılmış hesabları buraxmır.
-- M10: staff_library_delete yalnız yaradan və ya admin.
-- M11: live_set_role can_publish live_join məntiqi ilə eynidir (speaker + only_host_audio = yayım yoxdur).
-- M12: srs_apply — FSRS kartının atomik (müqayisə-et-və-dəyiş) yenilənməsi, paralel itkinin qarşısı.
-- L16: staff_library_add yol prefiksi dəqiq müqayisə olunur (regex inyeksiyası yoxdur).
-- L20: redeem_code qlobal saatlıq limit (bütün hesablar üzrə).

-- ============ C1.1: test_sessions.total + sütun icazələri ============
alter table public.test_sessions add column if not exists total int;
update public.test_sessions set total = cardinality(question_ids) where total is null;

-- Birbaşa INSERT-lərdə (testlər, idxal) total avtomatik dolur; RPC onsuz da açıq göndərir.
create or replace function public._test_sessions_total() returns trigger
language plpgsql as $$
begin
  if new.total is null then new.total := cardinality(new.question_ids); end if;
  return new;
end $$;
drop trigger if exists test_sessions_total on public.test_sessions;
create trigger test_sessions_total before insert on public.test_sessions
  for each row execute function public._test_sessions_total();
alter table public.test_sessions alter column total set not null;

-- sessions_self RLS siyasəti qalır; əlavə olaraq seed/question_ids sütunları klientə verilmir.
-- result yalnız aqreqat nəticələrdir (total/correct/wrong/blank/percent/by_topic/mode) — sual açarı yoxdur.
revoke select on public.test_sessions from anon, authenticated;
grant select (id, student_id, mode, subject_id, cursor, state, time_limit_s, started_at, finished_at, result, total)
  on public.test_sessions to authenticated;

-- create_session: total açıq yazılır (20261104000009 versiyası əsasında).
create or replace function public.create_session(
  p_student uuid, p_device text, p_mode public.session_mode, p_subject text,
  p_question_ids uuid[], p_seed bigint, p_time_limit_s int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_err text; v_ok int; v_id uuid; n int := coalesce(cardinality(p_question_ids), 0);
begin
  v_err := public._guard(p_student, p_device);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if n = 0 or n > 200 then return jsonb_build_object('error', 'bad_size'); end if;
  -- Spam qarşısı: saatda ən çox 60 test sessiyası (normal istifadə bunun çox altındadır).
  if (select count(*) from public.test_sessions where student_id = p_student and started_at > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  if (select count(distinct x) from unnest(p_question_ids) as u (x)) <> n then return jsonb_build_object('error', 'duplicate_questions'); end if;
  select count(*) into v_ok from public.candidates(p_student, p_subject, null) c where c.id = any (p_question_ids);
  if v_ok <> n then return jsonb_build_object('error', 'invalid_questions'); end if;
  -- Eyni anda bir aktiv sessiya: paralel köçürməni çətinləşdirir.
  update public.test_sessions set state = 'abandoned' where student_id = p_student and state = 'active';
  insert into public.test_sessions (student_id, mode, subject_id, question_ids, seed, time_limit_s, total)
  values (p_student, p_mode, p_subject, p_question_ids, p_seed, p_time_limit_s, n)
  returning id into v_id;
  return jsonb_build_object('session_id', v_id, 'total', n);
end $$;

-- ============ C1.2: answers klientə bağlıdır ============
-- Klient heç vaxt answers-ı birbaşa oxumur: icmal session_review, lövhə board_rows, analiz staff_item_responses (definer).
drop policy if exists answers_self on public.answers;
revoke select on public.answers from anon, authenticated;

-- ============ C1.3: variant sırası server sirri ilə ============
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.perm_secret (
  id boolean primary key default true check (id),
  secret text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
insert into private.perm_secret (id) values (true) on conflict (id) do nothing;
revoke all on private.perm_secret from public, anon, authenticated;

-- stable (immutable deyil): sirr oxunur. Bütün çağırışlar security definer RPC-lər içindədir (owner = postgres).
create or replace function public._perm(p_seed bigint, p_q uuid, p_n int) returns int[]
language sql stable security definer set search_path = public as $$
  select array_agg(i order by md5(p_seed::text || p_q::text || i::text || (select s.secret from private.perm_secret s where s.id)))
  from generate_series(0, p_n - 1) as g (i)
$$;

-- ============ H7: server tərəfli cavab vaxtı ============
alter table public.answers add column if not exists server_ms int check (server_ms is null or server_ms between 0 and 3600000);

-- submit_answer: viewed_at-dan keçən vaxt serverdə hesablanır; klient ms yalnız analitika üçün saxlanılır.
create or replace function public.submit_answer(
  p_student uuid, p_device text, p_session uuid, p_question uuid, p_chosen smallint, p_ms int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.test_sessions; q public.questions; v_err text; v_perm int[]; v_orig smallint; v_ok boolean; v_done boolean;
  v_viewed timestamptz; v_server_ms int;
begin
  v_err := public._guard(p_student, p_device);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  select * into s from public.test_sessions where id = p_session for update;
  if not found or s.student_id <> p_student then return jsonb_build_object('error', 'not_found'); end if;
  if s.state <> 'active' then return jsonb_build_object('error', 'session_closed'); end if;
  -- Vaxt bitibsə cavab qəbul edilmir (5 san. şəbəkə güzəşti); sessiya bağlanır.
  if s.time_limit_s is not null and now() > s.started_at + make_interval(secs => s.time_limit_s + 5) then
    perform public.finish_session(p_student, p_session);
    return jsonb_build_object('error', 'time_up');
  end if;
  if s.cursor >= cardinality(s.question_ids) or s.question_ids[s.cursor + 1] <> p_question then
    return jsonb_build_object('error', 'out_of_order');
  end if;
  select viewed_at into v_viewed from public.question_views
   where session_id = p_session and question_id = p_question order by viewed_at desc limit 1;
  if not found then return jsonb_build_object('error', 'not_viewed'); end if;
  v_server_ms := greatest(0, least(3600000, round(extract(epoch from now() - v_viewed) * 1000)::int));
  select * into q from public.questions where id = p_question;
  v_perm := public._perm(s.seed, p_question, jsonb_array_length(q.options));
  if p_chosen is not null and (p_chosen < 0 or p_chosen >= array_length(v_perm, 1)) then
    return jsonb_build_object('error', 'bad_choice');
  end if;
  v_orig := case when p_chosen is null then null else v_perm[p_chosen + 1] end;
  v_ok := v_orig is not null and v_orig = q.answer_index;
  insert into public.answers (session_id, question_id, position, chosen, correct, ms, server_ms)
  values (p_session, p_question, s.cursor + 1, v_orig, v_ok, greatest(0, least(coalesce(p_ms, 0), 3600000)), v_server_ms);
  update public.test_sessions set cursor = cursor + 1 where id = p_session;
  v_done := s.cursor + 1 >= cardinality(s.question_ids);
  if s.mode = 'exam' then
    -- İmtahanda nəticə yalnız sonda.
    return jsonb_build_object('accepted', true, 'done', v_done);
  end if;
  return jsonb_build_object(
    'accepted', true, 'done', v_done, 'correct', v_ok,
    'correct_display', array_position(v_perm, q.answer_index::int) - 1,
    'explanation', q.explanation,
    'option_explanations', public._reorder(q.option_explanations, v_perm),
    'law_ref', q.law_ref,
    'trap', q.trap);
end $$;

-- next_question: pace yoxlaması server vaxtına əsaslanır (köhnə sətirlərdə server_ms yoxdursa ms).
create or replace function public.next_question(p_student uuid, p_device text, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.test_sessions; q public.questions; v_err text; v_qid uuid; v_perm int[];
  v_seen boolean; v_today int; v_limit int; v_cnt int; v_median numeric;
begin
  v_err := public._guard(p_student, p_device);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  select * into s from public.test_sessions where id = p_session for update;
  if not found or s.student_id <> p_student then return jsonb_build_object('error', 'not_found'); end if;
  if s.state <> 'active' then return jsonb_build_object('error', 'session_closed'); end if;
  if s.time_limit_s is not null and now() > s.started_at + make_interval(secs => s.time_limit_s) then
    perform public.finish_session(p_student, p_session);
    return jsonb_build_object('done', true, 'time_up', true);
  end if;
  if s.cursor >= cardinality(s.question_ids) then return jsonb_build_object('done', true); end if;

  -- Sürət yoxlaması: son 20 cavabın SERVER medianı 1.5 saniyədən azdırsa, bank köçürülür (skreyp) şübhəsi.
  -- Klient ms saxta ola bilər; server_ms sualın verilmə anından (question_views.viewed_at) hesablanır.
  select count(*), percentile_cont(0.5) within group (order by x.ms) into v_cnt, v_median
  from (select coalesce(a.server_ms, a.ms) as ms from public.answers a join public.test_sessions t on t.id = a.session_id
        where t.student_id = p_student order by a.answered_at desc limit 20) x;
  if v_cnt >= 20 and v_median < 1500 then
    update public.profiles set suspended_until = now() + interval '1 hour', suspension_reason = 'pace' where id = p_student;
    insert into public.audit_events (student_id, kind, detail) values (p_student, 'suspended_pace', jsonb_build_object('median_ms', v_median));
    return jsonb_build_object('error', 'suspended');
  end if;

  v_qid := s.question_ids[s.cursor + 1];
  select exists (select 1 from public.question_views where student_id = p_student and question_id = v_qid and viewed_at >= public._day_start()) into v_seen;
  if not v_seen then
    select count(distinct question_id) into v_today from public.question_views where student_id = p_student and viewed_at >= public._day_start();
    select daily_question_limit into v_limit from public.profiles where id = p_student;
    if v_today >= v_limit then
      insert into public.audit_events (student_id, kind) values (p_student, 'daily_limit');
      return jsonb_build_object('error', 'daily_limit');
    end if;
  end if;
  insert into public.question_views (student_id, question_id, session_id, device_id) values (p_student, v_qid, p_session, p_device);

  select * into q from public.questions where id = v_qid;
  v_perm := public._perm(s.seed, v_qid, jsonb_array_length(q.options));
  return jsonb_build_object(
    'done', false,
    'position', s.cursor + 1,
    'total', cardinality(s.question_ids),
    'question_id', v_qid,
    'stem', q.stem,
    'options', public._reorder(q.options, v_perm),
    'level', q.level,
    'trap', case when s.mode = 'exam' then false else q.trap end,
    'mode', s.mode,
    'watermark', (select student_no from public.profiles where id = p_student),
    'time_left_s', case when s.time_limit_s is null then null
                        else greatest(0, s.time_limit_s - extract(epoch from now() - s.started_at)::int) end);
end $$;

-- ============ H6: staff MFA defolt məcburi (fail-closed) ============
alter table public.app_config alter column staff_mfa_required set default true;
update public.app_config set staff_mfa_required = true where not staff_mfa_required;

create or replace function public._staff_aal_ok() returns boolean
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_required boolean;
  v_has boolean := false;
begin
  if coalesce(v_claims->>'aal', '') = 'aal2' then return true; end if;
  select staff_mfa_required into v_required from public.app_config where id;
  -- Konfiqurasiya sətiri yoxdursa fail-closed: məcburi sayılır.
  if coalesce(v_required, true) then return false; end if;
  -- auth.mfa_factors Supabase-də var; adi Postgres test klasterində yoxdur.
  if to_regclass('auth.mfa_factors') is not null then
    execute 'select exists (select 1 from auth.mfa_factors where user_id = $1 and status = ''verified'')' into v_has using auth.uid();
  end if;
  return not v_has;
end $$;

-- ============ M9: dayandırılmış hesab qapıları ============
create or replace function public.library_open(p_user uuid, p_item uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i public.library_items; pr public.profiles; v_today int;
begin
  select * into pr from public.profiles where id = p_user;
  if not found then return jsonb_build_object('error', 'no_profile'); end if;
  if pr.suspended_until is not null and pr.suspended_until > now() then return jsonb_build_object('error', 'suspended'); end if;
  if not public._consented(p_user) then return jsonb_build_object('error', 'consent_required'); end if;
  select * into i from public.library_items where id = p_item;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if not public._library_access(p_user, p_item) then return jsonb_build_object('error', 'forbidden'); end if;
  if not public.is_staff(p_user) then
    select count(*) into v_today from public.audit_events
     where student_id = p_user and kind = 'library_open' and at >= public._day_start();
    if v_today >= 200 then return jsonb_build_object('error', 'daily_limit'); end if;
  end if;
  insert into public.audit_events (student_id, kind, detail) values (p_user, 'library_open', jsonb_build_object('item', p_item));
  return jsonb_build_object('kind', i.kind, 'title', i.title, 'watermark', pr.student_no, 'storage_path', i.storage_path,
    'body', case when i.kind = 'text' then (select body from public.library_bodies where item_id = p_item) end);
end $$;

create or replace function public.set_board_visibility(p_user uuid, p_show boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  select * into pr from public.profiles where id = p_user;
  if not found then return jsonb_build_object('error', 'no_profile'); end if;
  if pr.suspended_until is not null and pr.suspended_until > now() then return jsonb_build_object('error', 'suspended'); end if;
  update public.profiles set show_on_board = coalesce(p_show, false) where id = p_user;
  return jsonb_build_object('show', coalesce(p_show, false));
end $$;

create or replace function public.report_client_event(p_user uuid, p_kind text, p_context text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if p_kind not in ('screenshot', 'screen_recording') then return jsonb_build_object('error', 'bad_kind'); end if;
  if not exists (select 1 from public.profiles where id = p_user) then return jsonb_build_object('error', 'no_profile'); end if;
  if exists (select 1 from public.profiles where id = p_user and suspended_until is not null and suspended_until > now()) then
    return jsonb_build_object('error', 'suspended');
  end if;
  select count(*) into v_n from public.audit_events
   where student_id = p_user and kind like 'client_%' and at >= public._day_start();
  if v_n >= 50 then return jsonb_build_object('ok', true, 'recorded', false); end if;
  insert into public.audit_events (student_id, kind, detail)
  values (p_user, 'client_' || p_kind, jsonb_build_object('context', left(coalesce(p_context, ''), 64)));
  return jsonb_build_object('ok', true, 'recorded', true);
end $$;

-- ============ M10: konspekt silmə yalnız yaradan və ya admin ============
create or replace function public.staff_library_delete(p_staff uuid, p_item uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_path text; v_by uuid;
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  select created_by into v_by from public.library_items where id = p_item;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_by is distinct from p_staff and not public.is_admin(p_staff) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  delete from public.library_items where id = p_item returning storage_path into v_path;
  insert into public.audit_events (student_id, kind, detail) values (p_staff, 'library_delete', jsonb_build_object('item', p_item));
  return jsonb_build_object('ok', true, 'storage_path', v_path);
end $$;

-- ============ M11: live_set_role can_publish ============
create or replace function public.live_set_role(p_user uuid, p_session uuid, p_target uuid, p_role public.live_role) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.live_sessions;
begin
  if not public._live_is_host(p_user, p_session) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_role not in ('speaker', 'audience', 'cohost') then return jsonb_build_object('error', 'bad_role'); end if;
  if p_role = 'cohost' and not exists (select 1 from public.live_sessions where id = p_session and host_id = p_user)
     and not exists (select 1 from public.profiles where id = p_user and role = 'admin') then
    return jsonb_build_object('error', 'forbidden'); -- yalnız əsas host köməkçi təyin edir
  end if;
  select * into s from public.live_sessions where id = p_session;
  if s.host_id is not distinct from p_target then return jsonb_build_object('error', 'bad_target'); end if;
  update public.live_participants set role = p_role where session_id = p_session and user_id = p_target and left_at is null and not banned;
  if not found then return jsonb_build_object('error', 'not_participant'); end if;
  update public.live_hands set resolved_at = now(), resolution = case when p_role = 'speaker' then 'granted' else 'dismissed' end
  where session_id = p_session and user_id = p_target and resolved_at is null;
  return jsonb_build_object('room', s.livekit_room, 'identity', p_target, 'role', p_role,
    'can_publish', p_role = 'cohost' or (p_role = 'speaker' and not s.only_host_audio), 'can_publish_screen', p_role = 'cohost');
end $$;

-- ============ M12: FSRS kartının atomik yenilənməsi ============
-- Edge handler kartı oxuyur, TS-də hesablayır və p_prev (köhnə kart) ilə göndərir.
-- Kart bu arada dəyişibsə UPDATE tutmur → false; handler yenidən oxuyub təkrarlayır (optimistik retry).
create or replace function public.srs_apply(p_student uuid, p_question uuid, p_card jsonb, p_last_correct boolean, p_prev jsonb default null)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_prev is null then
    insert into public.srs_cards (student_id, question_id, card, last_correct, last_seen)
    values (p_student, p_question, p_card, p_last_correct, now())
    on conflict (student_id, question_id) do nothing;
    return found;
  end if;
  update public.srs_cards set card = p_card, last_correct = p_last_correct, last_seen = now()
  where student_id = p_student and question_id = p_question and card = p_prev;
  return found;
end $$;
revoke execute on function public.srs_apply(uuid, uuid, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.srs_apply(uuid, uuid, jsonb, boolean, jsonb) to service_role;
revoke execute on function public._test_sessions_total() from public, anon, authenticated;

-- ============ L16: konspekt yolu — dəqiq prefiks (regex inyeksiyası yox) ============
create or replace function public.staff_library_add(p_staff uuid, p_subject text, p_topic uuid, p_title text, p_kind text,
                                                    p_free boolean, p_body text default null, p_storage_path text default null, p_bytes int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  if not exists (select 1 from public.subjects where id = p_subject) then return jsonb_build_object('error', 'not_found'); end if;
  if p_topic is not null and not exists (select 1 from public.topics where id = p_topic and subject_id = p_subject) then return jsonb_build_object('error', 'bad_topic'); end if;
  if length(trim(coalesce(p_title, ''))) not between 1 and 140 then return jsonb_build_object('error', 'bad_title'); end if;
  if p_kind = 'text' and length(coalesce(p_body, '')) not between 1 and 200000 then return jsonb_build_object('error', 'bad_body'); end if;
  -- Yol yalnız serverin yaratdığı formatda ola bilər: <fənn>/<uuid>.pdf.
  -- Prefiks dəqiq müqayisə olunur: fənn adındakı regex metasımbolları (. + * və s.) nümunəni genişləndirə bilmir.
  if p_kind = 'pdf' and (p_storage_path is null
      or left(p_storage_path, length(p_subject) + 1) <> p_subject || '/'
      or substr(p_storage_path, length(p_subject) + 2) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$') then
    return jsonb_build_object('error', 'bad_path');
  end if;
  if p_kind not in ('text', 'pdf') then return jsonb_build_object('error', 'bad_kind'); end if;
  insert into public.library_items (subject_id, topic_id, title, kind, free, storage_path, bytes, created_by)
  values (p_subject, p_topic, trim(p_title), p_kind, coalesce(p_free, false), case when p_kind = 'pdf' then p_storage_path end, p_bytes, p_staff)
  returning id into v_id;
  if p_kind = 'text' then insert into public.library_bodies (item_id, body) values (v_id, p_body); end if;
  insert into public.audit_events (student_id, kind, detail) values (p_staff, 'library_add', jsonb_build_object('item', v_id));
  return jsonb_build_object('id', v_id);
end $$;

-- ============ L20: kod brute-force — qlobal limit ============
-- Kod 60 bitdir (12 simvol × 5 bit); saatda 10 cəhd/hesab + 200 cəhd/qlobal saatda axtarışı praktik olaraq mümkünsüz edir.
create index if not exists audit_code_fail_at on public.audit_events (at) where kind = 'code_fail';

create or replace function public.redeem_code(p_student uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.access_codes; v_until timestamptz; v_fails int;
begin
  select count(*) into v_fails from public.audit_events where student_id = p_student and kind = 'code_fail' and at > now() - interval '1 hour';
  if v_fails >= 10 then return jsonb_build_object('error', 'too_many_attempts'); end if;
  -- Qlobal limit: çox hesablı paralel brute-force da bloklanır.
  if (select count(*) from public.audit_events where kind = 'code_fail' and at > now() - interval '1 hour') >= 200 then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;
  select * into v from public.access_codes where code_hash = public._hash_code(p_code) for update;
  if not found or v.revoked or (v.expires_at is not null and v.expires_at < now()) then
    insert into public.audit_events (student_id, kind) values (p_student, 'code_fail');
    return jsonb_build_object('error', 'invalid_code');
  end if;
  if v.redeemed_by is not null then
    if v.redeemed_by = p_student then
      return jsonb_build_object('subject_id', v.subject_id, 'already', true);
    end if;
    insert into public.audit_events (student_id, kind, detail) values (p_student, 'code_fail', jsonb_build_object('reason', 'used'));
    return jsonb_build_object('error', 'code_used');
  end if;
  update public.access_codes set redeemed_by = p_student, redeemed_at = now() where id = v.id;
  insert into public.enrollments (student_id, subject_id, access_until, source)
  values (p_student, v.subject_id, now() + make_interval(days => v.days), 'code')
  on conflict (student_id, subject_id)
  do update set access_until = greatest(public.enrollments.access_until, now()) + make_interval(days => v.days)
  returning access_until into v_until;
  return jsonb_build_object('subject_id', v.subject_id, 'access_until', v_until);
end $$;