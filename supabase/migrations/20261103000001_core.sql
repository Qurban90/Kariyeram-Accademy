-- Karyeram Academy: əsas sxem
-- Prinsip: tələbə sual cədvəlini HEÇ VAXT birbaşa oxumur. Suallar yalnız RPC ilə, bir-bir verilir;
-- cavab açarı serverdə qalır, cavab serverdə yoxlanılır. Bütün RPC-lər yalnız service_role
-- (Edge Functions) tərəfindən çağırılır; Edge Function istifadəçinin JWT-sini yoxlayıb p_student ötürür.

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('student', 'teacher', 'admin');
create type public.question_status as enum ('draft', 'review', 'published', 'stale', 'retired');
create type public.session_mode as enum ('topic', 'mixed', 'mistakes', 'exam');
create type public.session_state as enum ('active', 'finished', 'abandoned');

-- ============ CƏDVƏLLƏR ============

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  -- Su nişanı üçün ictimai nömrə. Giriş kodu deyil, sızsa hesabı açmır.
  student_no bigint generated always as identity unique,
  role public.app_role not null default 'student',
  daily_question_limit int not null default 400 check (daily_question_limit between 0 and 5000),
  suspended_until timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now()
);

create table public.subjects (
  id text primary key,
  name text not null,
  sort int not null default 0
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id) on delete cascade,
  name text not null,
  sort int not null default 0,
  -- Pulsuz sınaq mövzusu: abunəsiz tələbə də işləyə bilər.
  free boolean not null default false,
  unique (subject_id, name)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete restrict,
  stem text not null check (length(stem) > 0),
  -- Variant mətnləri (sətir massivi), kanonik sırada.
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  answer_index smallint not null,
  -- Hər variant üçün izah (niyə düz / niyə yanlış), options ilə eyni uzunluqda.
  option_explanations jsonb not null default '[]'::jsonb check (jsonb_typeof(option_explanations) = 'array'),
  explanation text not null default '',
  level smallint not null default 2 check (level between 1 and 3),
  trap boolean not null default false,
  law_ref text,
  status public.question_status not null default 'draft',
  version int not null default 1,
  author_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (answer_index >= 0 and answer_index < jsonb_array_length(options))
);
create index questions_topic_published on public.questions (topic_id) where status = 'published';

create table public.enrollments (
  student_id uuid not null references public.profiles (id) on delete cascade,
  subject_id text not null references public.subjects (id) on delete cascade,
  access_until timestamptz not null,
  source text not null default 'code',
  primary key (student_id, subject_id)
);

-- Giriş kodu: abunəni aktivləşdirir (hesaba giriş deyil). Yalnız hash saxlanılır.
create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  subject_id text not null references public.subjects (id),
  days int not null check (days between 1 and 730),
  created_by uuid references public.profiles (id),
  redeemed_by uuid references public.profiles (id),
  redeemed_at timestamptz,
  revoked boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Tək aktiv cihaz qaydası.
create table public.devices (
  student_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null check (length(device_id) between 8 and 128),
  active boolean not null default true,
  claimed_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (student_id, device_id)
);
create unique index devices_one_active on public.devices (student_id) where active;

create table public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  mode public.session_mode not null,
  subject_id text not null references public.subjects (id),
  question_ids uuid[] not null check (cardinality(question_ids) between 1 and 200),
  cursor int not null default 0,
  state public.session_state not null default 'active',
  -- Variant sırasının qarışdırılması üçün toxum.
  seed bigint not null default 0,
  time_limit_s int check (time_limit_s is null or time_limit_s between 30 and 21600),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb
);
create index test_sessions_student on public.test_sessions (student_id, started_at desc);

create table public.answers (
  session_id uuid not null references public.test_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  position int not null,
  -- Kanonik variant indeksi (göstərilən sıra deyil), boşdursa null.
  chosen smallint,
  correct boolean not null,
  ms int not null default 0 check (ms >= 0),
  answered_at timestamptz not null default now(),
  primary key (session_id, question_id)
);
create index answers_question on public.answers (question_id);
create index answers_recent on public.answers (answered_at desc);

-- Hər açılan sual qeyd olunur: gündəlik limit və sızma izlənməsi üçün.
create table public.question_views (
  student_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  session_id uuid not null references public.test_sessions (id) on delete cascade,
  device_id text not null,
  viewed_at timestamptz not null default now()
);
create index question_views_student_day on public.question_views (student_id, viewed_at desc);
create index question_views_session on public.question_views (session_id, question_id);

-- FSRS kartları (@karyeram/core hesablayır, burada saxlanılır).
create table public.srs_cards (
  student_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  card jsonb not null,
  last_correct boolean,
  last_seen timestamptz not null default now(),
  primary key (student_id, question_id)
);

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('test', 'grade', 'note')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index diary_student on public.diary_entries (student_id, created_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  student_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index audit_student_kind on public.audit_events (student_id, kind, at desc);

-- Sual məzmunu dəyişəndə versiya artır.
create or replace function public._questions_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if (new.stem, new.options, new.answer_index) is distinct from (old.stem, old.options, old.answer_index) then
    new.version := old.version + 1;
  end if;
  return new;
end $$;
create trigger questions_touch before update on public.questions for each row execute function public._questions_touch();

-- ============ KÖMƏKÇİLƏR ============

create or replace function public.is_staff(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p and role in ('teacher', 'admin'))
$$;

-- Bakı vaxtı ilə günün başlanğıcı.
create or replace function public._day_start() returns timestamptz
language sql stable as $$
  select (date_trunc('day', now() at time zone 'Asia/Baku')) at time zone 'Asia/Baku'
$$;

-- Göstərilən sıra: kanonik indekslərin sessiya toxumuna görə qarışığı. perm[d+1] = kanonik indeks.
create or replace function public._perm(p_seed bigint, p_q uuid, p_n int) returns int[]
language sql immutable as $$
  select array_agg(i order by md5(p_seed::text || p_q::text || i::text)) from generate_series(0, p_n - 1) as g (i)
$$;

create or replace function public._reorder(p_arr jsonb, p_perm int[]) returns jsonb
language sql immutable as $$
  select case
    when jsonb_array_length(p_arr) <> coalesce(array_length(p_perm, 1), 0) then '[]'::jsonb
    else (select coalesce(jsonb_agg(p_arr -> o order by ord), '[]'::jsonb) from unnest(p_perm) with ordinality as u (o, ord))
  end
$$;

create or replace function public._hash_code(p_code text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$$;

create or replace function public._gen_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(12);
  r text := '';
begin
  for i in 0..11 loop
    r := r || substr(a, (get_byte(b, i) % 32) + 1, 1);
    if i in (3, 7) then r := r || '-'; end if;
  end loop;
  return r;
end $$;

-- Null: hər şey qaydasındadır. Əks halda xəta kodu.
create or replace function public._guard(p_student uuid, p_device text) returns text
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = p_student;
  if not found then return 'no_profile'; end if;
  if p.suspended_until is not null and p.suspended_until > now() then return 'suspended'; end if;
  update public.devices set last_seen = now() where student_id = p_student and device_id = p_device and active;
  if not found then return 'device_not_active'; end if;
  return null;
end $$;

-- ============ RPC: cihaz, giriş kodu ============

create or replace function public.claim_device(p_student uuid, p_device text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.devices set active = false where student_id = p_student and active and device_id <> p_device;
  get diagnostics n = row_count;
  insert into public.devices (student_id, device_id, active) values (p_student, p_device, true)
  on conflict (student_id, device_id) do update set active = true, claimed_at = now(), last_seen = now();
  if n > 0 then
    insert into public.audit_events (student_id, kind, detail) values (p_student, 'device_replaced', jsonb_build_object('device', p_device));
  end if;
  return jsonb_build_object('replaced', n > 0);
end $$;

create or replace function public.create_codes(p_staff uuid, p_subject text, p_count int, p_days int, p_expires_at timestamptz default null)
returns table (code text)
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_staff(p_staff) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_count not between 1 and 500 then raise exception 'bad_count'; end if;
  for i in 1..p_count loop
    c := public._gen_code();
    insert into public.access_codes (code_hash, subject_id, days, created_by, expires_at)
    values (public._hash_code(c), p_subject, p_days, p_staff, p_expires_at);
    code := c;
    return next;
  end loop;
end $$;

create or replace function public.redeem_code(p_student uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.access_codes; v_until timestamptz; v_fails int;
begin
  select count(*) into v_fails from public.audit_events where student_id = p_student and kind = 'code_fail' and at > now() - interval '1 hour';
  if v_fails >= 10 then return jsonb_build_object('error', 'too_many_attempts'); end if;
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

-- ============ RPC: test sessiyası ============

-- Test yığma alqoritmi (@karyeram/core) üçün namizədlər: yalnız metadata, mətn və cavab yoxdur.
create or replace function public.candidates(p_student uuid, p_subject text, p_topic_ids uuid[] default null)
returns table (id uuid, topic_id uuid, level smallint, trap boolean, card jsonb, last_correct boolean, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, q.topic_id, q.level, q.trap, c.card, c.last_correct, c.last_seen
  from public.questions q
  join public.topics t on t.id = q.topic_id
  left join public.srs_cards c on c.student_id = p_student and c.question_id = q.id
  where q.status = 'published'
    and t.subject_id = p_subject
    and (p_topic_ids is null or q.topic_id = any (p_topic_ids))
    and (t.free or exists (
      select 1 from public.enrollments e
      where e.student_id = p_student and e.subject_id = p_subject and e.access_until > now()))
$$;

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
  if (select count(distinct x) from unnest(p_question_ids) as u (x)) <> n then return jsonb_build_object('error', 'duplicate_questions'); end if;
  select count(*) into v_ok from public.candidates(p_student, p_subject, null) c where c.id = any (p_question_ids);
  if v_ok <> n then return jsonb_build_object('error', 'invalid_questions'); end if;
  -- Eyni anda bir aktiv sessiya: paralel köçürməni çətinləşdirir.
  update public.test_sessions set state = 'abandoned' where student_id = p_student and state = 'active';
  insert into public.test_sessions (student_id, mode, subject_id, question_ids, seed, time_limit_s)
  values (p_student, p_mode, p_subject, p_question_ids, p_seed, p_time_limit_s)
  returning id into v_id;
  return jsonb_build_object('session_id', v_id, 'total', n);
end $$;

create or replace function public.finish_session(p_student uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.test_sessions; v_total int; v_correct int; v_wrong int; v_by jsonb; v_res jsonb; v_subject text;
begin
  select * into s from public.test_sessions where id = p_session for update;
  if not found or s.student_id <> p_student then return jsonb_build_object('error', 'not_found'); end if;
  if s.state = 'finished' then return s.result; end if;
  v_total := cardinality(s.question_ids);
  select count(*) filter (where a.correct), count(*) filter (where a.chosen is not null and not a.correct)
    into v_correct, v_wrong
  from public.answers a where a.session_id = p_session;
  select coalesce(jsonb_object_agg(x.topic_id, jsonb_build_object(
           'name', x.name, 'total', x.total, 'correct', x.correct, 'wrong', x.wrong, 'blank', x.total - x.correct - x.wrong)), '{}'::jsonb)
    into v_by
  from (
    select t.id::text as topic_id, t.name, count(*) as total,
           count(*) filter (where a.correct) as correct,
           count(*) filter (where a.chosen is not null and not a.correct) as wrong
    from unnest(s.question_ids) as u (qid)
    join public.questions q on q.id = u.qid
    join public.topics t on t.id = q.topic_id
    left join public.answers a on a.session_id = p_session and a.question_id = u.qid
    group by t.id, t.name
  ) x;
  v_res := jsonb_build_object(
    'total', v_total, 'correct', v_correct, 'wrong', v_wrong, 'blank', v_total - v_correct - v_wrong,
    'percent', round(100.0 * v_correct / v_total, 1), 'by_topic', v_by, 'mode', s.mode);
  update public.test_sessions set state = 'finished', finished_at = now(), result = v_res where id = p_session;
  select name into v_subject from public.subjects where id = s.subject_id;
  insert into public.diary_entries (student_id, kind, title, payload)
  values (p_student, 'test',
          v_subject || ' · ' || case s.mode when 'exam' then 'Sınaq' when 'mistakes' then 'Səhvlərim' when 'mixed' then 'Qarışıq test' else 'Mövzu testi' end,
          v_res || jsonb_build_object('session_id', p_session));
  return v_res;
end $$;

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

  -- Sürət yoxlaması: son 20 cavabın medianı 1.5 saniyədən azdırsa, bank köçürülür (skreyp) şübhəsi.
  select count(*), percentile_cont(0.5) within group (order by x.ms) into v_cnt, v_median
  from (select a.ms from public.answers a join public.test_sessions t on t.id = a.session_id
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

create or replace function public.submit_answer(
  p_student uuid, p_device text, p_session uuid, p_question uuid, p_chosen smallint, p_ms int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.test_sessions; q public.questions; v_err text; v_perm int[]; v_orig smallint; v_ok boolean; v_done boolean;
begin
  v_err := public._guard(p_student, p_device);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  select * into s from public.test_sessions where id = p_session for update;
  if not found or s.student_id <> p_student then return jsonb_build_object('error', 'not_found'); end if;
  if s.state <> 'active' then return jsonb_build_object('error', 'session_closed'); end if;
  if s.cursor >= cardinality(s.question_ids) or s.question_ids[s.cursor + 1] <> p_question then
    return jsonb_build_object('error', 'out_of_order');
  end if;
  if not exists (select 1 from public.question_views where session_id = p_session and question_id = p_question) then
    return jsonb_build_object('error', 'not_viewed');
  end if;
  select * into q from public.questions where id = p_question;
  v_perm := public._perm(s.seed, p_question, jsonb_array_length(q.options));
  if p_chosen is not null and (p_chosen < 0 or p_chosen >= array_length(v_perm, 1)) then
    return jsonb_build_object('error', 'bad_choice');
  end if;
  v_orig := case when p_chosen is null then null else v_perm[p_chosen + 1] end;
  v_ok := v_orig is not null and v_orig = q.answer_index;
  insert into public.answers (session_id, question_id, position, chosen, correct, ms)
  values (p_session, p_question, s.cursor + 1, v_orig, v_ok, greatest(0, least(coalesce(p_ms, 0), 3600000)));
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

-- Bitmiş testin tam icmalı: seçilən, düzgün variant və izahlar (yalnız görülmüş suallar).
create or replace function public.session_review(p_student uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.test_sessions;
begin
  select * into s from public.test_sessions where id = p_session;
  if not found or s.student_id <> p_student then return jsonb_build_object('error', 'not_found'); end if;
  if s.state <> 'finished' then return jsonb_build_object('error', 'not_finished'); end if;
  return jsonb_build_object('watermark', (select student_no from public.profiles where id = p_student), 'items', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'position', u.ord, 'question_id', q.id, 'topic', t.name, 'stem', q.stem,
      'options', public._reorder(q.options, pm.perm),
      'chosen_display', case when a.chosen is null then null else array_position(pm.perm, a.chosen::int) - 1 end,
      'correct_display', array_position(pm.perm, q.answer_index::int) - 1,
      'correct', coalesce(a.correct, false),
      'explanation', q.explanation,
      'option_explanations', public._reorder(q.option_explanations, pm.perm),
      'trap', q.trap, 'law_ref', q.law_ref) order by u.ord), '[]'::jsonb)
    from unnest(s.question_ids) with ordinality as u (qid, ord)
    join public.questions q on q.id = u.qid
    join public.topics t on t.id = q.topic_id
    left join public.answers a on a.session_id = s.id and a.question_id = q.id
    cross join lateral (select public._perm(s.seed, q.id, jsonb_array_length(q.options)) as perm) pm
    where u.ord <= greatest(s.cursor, 0) or a.question_id is not null));
end $$;

create or replace function public.upsert_card(p_student uuid, p_question uuid, p_card jsonb, p_last_correct boolean) returns void
language sql security definer set search_path = public as $$
  insert into public.srs_cards (student_id, question_id, card, last_correct, last_seen)
  values (p_student, p_question, p_card, p_last_correct, now())
  on conflict (student_id, question_id) do update
  set card = excluded.card, last_correct = excluded.last_correct, last_seen = now()
$$;

-- ============ RLS ============

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.enrollments enable row level security;
alter table public.access_codes enable row level security;
alter table public.devices enable row level security;
alter table public.test_sessions enable row level security;
alter table public.answers enable row level security;
alter table public.question_views enable row level security;
alter table public.srs_cards enable row level security;
alter table public.diary_entries enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy subjects_read on public.subjects for select to authenticated using (true);
create policy topics_read on public.topics for select to authenticated using (true);
-- Suallar: tələbə üçün heç bir siyasət yoxdur, yalnız müəllim/admin.
create policy questions_staff on public.questions for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy enrollments_self on public.enrollments for select to authenticated using (student_id = auth.uid());
create policy sessions_self on public.test_sessions for select to authenticated using (student_id = auth.uid());
create policy answers_self on public.answers for select to authenticated
  using (exists (select 1 from public.test_sessions s where s.id = session_id and s.student_id = auth.uid()));
create policy cards_self on public.srs_cards for select to authenticated using (student_id = auth.uid());
create policy diary_read on public.diary_entries for select to authenticated
  using (student_id = auth.uid() or public.is_staff(auth.uid()));
-- access_codes, devices, question_views, audit_events: klient siyasəti yoxdur (yalnız server).

-- ============ İCAZƏLƏR ============
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.is_staff(uuid) to authenticated;

-- FSRS kartını oxumaq (Edge Function üçün).
create or replace function public.card_of(p_student uuid, p_question uuid)
returns table (card jsonb) language sql stable security definer set search_path = public as $$
  select card from public.srs_cards where student_id = p_student and question_id = p_question
$$;
revoke execute on function public.card_of(uuid, uuid) from public, anon, authenticated;
grant execute on function public.card_of(uuid, uuid) to service_role;
