-- Karyeram Academy: hesab həyat dövrü (razılıq, silinmə, ixrac) və canlı oxu zalı.

-- ============ HESAB ============

alter table public.profiles add column if not exists onboarded_at timestamptz;

-- Hesab silinəndə istinadlar silinməni bloklamamalıdır.
alter table public.access_codes drop constraint if exists access_codes_redeemed_by_fkey,
  add constraint access_codes_redeemed_by_fkey foreign key (redeemed_by) references public.profiles (id) on delete set null;
alter table public.access_codes drop constraint if exists access_codes_created_by_fkey,
  add constraint access_codes_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.questions drop constraint if exists questions_author_id_fkey,
  add constraint questions_author_id_fkey foreign key (author_id) references public.profiles (id) on delete set null;
alter table public.diary_entries drop constraint if exists diary_entries_created_by_fkey,
  add constraint diary_entries_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

-- auth istifadəçisi yarananda profil.
create or replace function public._on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), ''), 80))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public._on_auth_user_created();

-- Hüquqi sənədlərin versiyaları. Tələb olunan sənədin yeni versiyası dərc olunanda yenidən razılıq lazımdır.
create table public.legal_documents (
  doc text not null check (doc in ('terms', 'privacy', 'age18', 'marketing', 'recording')),
  version text not null,
  required boolean not null,
  published_at timestamptz not null default now(),
  primary key (doc, version)
);
insert into public.legal_documents (doc, version, required) values
  ('terms', '2026-11-01', true), ('privacy', '2026-11-01', true), ('age18', '2026-11-01', true),
  ('marketing', '2026-11-01', false), ('recording', '2026-11-01', false);

create table public.consents (
  user_id uuid not null references public.profiles (id) on delete cascade,
  doc text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, doc, version),
  foreign key (doc, version) references public.legal_documents (doc, version)
);

create or replace function public._current_version(p_doc text) returns text
language sql stable as $$
  select version from public.legal_documents where doc = p_doc order by published_at desc, version desc limit 1
$$;

-- Tələb olunan bütün sənədlərin cari versiyası qəbul olunubmu?
create or replace function public._consented(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from (select distinct doc from public.legal_documents where required) d
    where not exists (
      select 1 from public.consents c
      where c.user_id = p_user and c.doc = d.doc and c.version = public._current_version(d.doc) and c.revoked_at is null))
$$;

create or replace function public.accept_consents(p_user uuid, p_docs text[], p_display_name text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d text;
begin
  if p_display_name is not null then
    if length(trim(p_display_name)) not between 2 and 80 then return jsonb_build_object('error', 'bad_name'); end if;
    update public.profiles set display_name = trim(p_display_name) where id = p_user;
  end if;
  foreach d in array p_docs loop
    if public._current_version(d) is null then return jsonb_build_object('error', 'unknown_doc'); end if;
    insert into public.consents (user_id, doc, version) values (p_user, d, public._current_version(d))
    on conflict (user_id, doc, version) do update set revoked_at = null, accepted_at = now();
  end loop;
  if public._consented(p_user) then
    update public.profiles set onboarded_at = coalesce(onboarded_at, now()) where id = p_user;
  end if;
  return jsonb_build_object('onboarded', public._consented(p_user));
end $$;

create or replace function public.revoke_consent(p_user uuid, p_doc text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.legal_documents where doc = p_doc and required) then
    return jsonb_build_object('error', 'required_doc'); -- tələb olunan razılıq geri götürülmür, hesab silinir
  end if;
  update public.consents set revoked_at = now() where user_id = p_user and doc = p_doc and revoked_at is null;
  return jsonb_build_object('ok', true);
end $$;

-- _guard yenilənir: razılıq olmadan tələbə əməliyyatı yoxdur.
create or replace function public._guard(p_student uuid, p_device text) returns text
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = p_student;
  if not found then return 'no_profile'; end if;
  if p.suspended_until is not null and p.suspended_until > now() then return 'suspended'; end if;
  if not public._consented(p_student) then return 'consent_required'; end if;
  update public.devices set last_seen = now() where student_id = p_student and device_id = p_device and active;
  if not found then return 'device_not_active'; end if;
  return null;
end $$;

-- Silinmə: audit qeydi (şəxsi məlumatsız), sonra Edge Function auth istifadəçisini silir və kaskad işləyir.
create or replace function public.prepare_account_deletion(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.profiles where id = p_user) then return jsonb_build_object('error', 'no_profile'); end if;
  insert into public.audit_events (student_id, kind, detail)
  values (null, 'account_deleted', jsonb_build_object('user_hash', encode(extensions.digest(p_user::text, 'sha256'), 'hex')));
  return jsonb_build_object('ok', true);
end $$;

-- ============ CANLI OXU ZALI ============

create type public.venue_kind as enum ('classroom', 'hall');
create type public.live_access as enum ('enrolled', 'invite', 'public');
create type public.live_state as enum ('scheduled', 'live', 'ended', 'cancelled');
create type public.live_role as enum ('host', 'cohost', 'speaker', 'audience');

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  kind public.venue_kind not null,
  name text not null check (length(name) between 1 and 80),
  subject_id text references public.subjects (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  capacity int not null default 50 check (capacity between 1 and 500),
  door_label text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  host_id uuid references public.profiles (id) on delete set null,
  title text not null check (length(title) between 1 and 140),
  description text not null default '' check (length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state public.live_state not null default 'scheduled',
  access public.live_access not null default 'enrolled',
  subject_id text references public.subjects (id),
  only_host_audio boolean not null default true,
  chat_enabled boolean not null default true,
  recording_enabled boolean not null default false,
  livekit_room text not null unique default ('ks_' || replace(gen_random_uuid()::text, '-', '')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (access <> 'enrolled' or subject_id is not null)
);
create index live_sessions_upcoming on public.live_sessions (starts_at) where state in ('scheduled', 'live');

create table public.live_invites (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (session_id, user_id)
);

create table public.live_participants (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.live_role not null default 'audience',
  seat int check (seat is null or seat >= 1),
  joined_at timestamptz,
  left_at timestamptz,
  total_seconds int not null default 0 check (total_seconds >= 0),
  banned boolean not null default false,
  primary key (session_id, user_id)
);
-- Aktiv iştirakçılar arasında oturacaq unikaldır.
create unique index live_participants_seat on public.live_participants (session_id, seat) where left_at is null and seat is not null;

create table public.live_hands (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  raised_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (resolution in ('granted', 'dismissed', 'lowered'))
);
create unique index live_hands_open on public.live_hands (session_id, user_id) where resolved_at is null;

create table public.live_chat (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index live_chat_session on public.live_chat (session_id, id);

-- Webhook hadisələri: təkrar emalın qarşısı (idempotentlik).
create table public.live_events (
  event_id text primary key,
  session_id uuid references public.live_sessions (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create or replace function public._live_is_host(p_user uuid, p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.live_sessions s where s.id = p_session and s.host_id = p_user)
      or exists (select 1 from public.live_participants p where p.session_id = p_session and p.user_id = p_user and p.role = 'cohost' and not p.banned)
      or exists (select 1 from public.profiles where id = p_user and role = 'admin')
$$;

create or replace function public._live_is_participant(p_user uuid, p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.live_participants p
                 where p.session_id = p_session and p.user_id = p_user and p.left_at is null and p.joined_at is not null and not p.banned)
$$;

create or replace function public._live_can_access(p_user uuid, s public.live_sessions) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(s.host_id = p_user, false)
      or exists (select 1 from public.profiles where id = p_user and role = 'admin')
      or (s.access = 'public')
      or (s.access = 'invite' and exists (select 1 from public.live_invites i where i.session_id = s.id and i.user_id = p_user))
      or (s.access = 'enrolled' and exists (select 1 from public.enrollments e where e.student_id = p_user and e.subject_id = s.subject_id and e.access_until > now()))
$$;

create or replace function public.live_create_session(
  p_host uuid, p_venue uuid, p_title text, p_starts timestamptz, p_ends timestamptz,
  p_access public.live_access, p_subject text default null, p_description text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.venues; v_id uuid;
begin
  select * into v from public.venues where id = p_venue;
  if not found then return jsonb_build_object('error', 'no_venue'); end if;
  if not coalesce(public.is_staff(p_host) and (v.owner_id is not distinct from p_host and v.owner_id is not null
                  or exists (select 1 from public.profiles where id = p_host and role = 'admin')), false) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_ends <= p_starts or p_ends - p_starts > interval '12 hours' then return jsonb_build_object('error', 'bad_time'); end if;
  insert into public.live_sessions (venue_id, host_id, title, description, starts_at, ends_at, access, subject_id)
  values (p_venue, p_host, p_title, coalesce(p_description, ''), p_starts, p_ends, p_access, coalesce(p_subject, v.subject_id))
  returning id into v_id;
  return jsonb_build_object('session_id', v_id);
end $$;

-- Qoşulma: icazə, tutum, oturacaq. LiveKit tokeni Edge Function bu nəticəyə görə verir.
create or replace function public.live_join(p_user uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.live_sessions; v public.venues; p public.live_participants; pr public.profiles;
  v_role public.live_role; v_seat int; v_active int; v_had boolean;
begin
  select * into pr from public.profiles where id = p_user;
  if not found then return jsonb_build_object('error', 'no_profile'); end if;
  if pr.suspended_until is not null and pr.suspended_until > now() then return jsonb_build_object('error', 'suspended'); end if;
  if not public._consented(p_user) then return jsonb_build_object('error', 'consent_required'); end if;
  select * into s from public.live_sessions where id = p_session for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if s.state in ('ended', 'cancelled') then return jsonb_build_object('error', 'session_closed'); end if;
  if not public._live_can_access(p_user, s) then return jsonb_build_object('error', 'forbidden'); end if;
  select * into p from public.live_participants where session_id = p_session and user_id = p_user;
  v_had := found;
  if v_had and p.banned then return jsonb_build_object('error', 'banned'); end if;
  if s.host_id is distinct from p_user and now() < s.starts_at - interval '15 minutes' then return jsonb_build_object('error', 'too_early'); end if;
  if s.host_id is distinct from p_user and now() > s.ends_at then return jsonb_build_object('error', 'session_closed'); end if;

  v_role := case when s.host_id = p_user then 'host'::public.live_role
                 when v_had and p.role in ('cohost', 'speaker') then p.role
                 else 'audience'::public.live_role end;
  select * into v from public.venues where id = s.venue_id;
  if v_role = 'audience' then
    select count(*) into v_active from public.live_participants
    where session_id = p_session and left_at is null and joined_at is not null and role = 'audience' and user_id <> p_user;
    if v_active >= v.capacity then return jsonb_build_object('error', 'full'); end if;
  end if;

  -- Oturacaq: əvvəlki yer boşdursa saxlanılır, yoxsa ən kiçik boş nömrə (öndən arxaya). Host səhnədədir (seat null).
  v_seat := null;
  if v_role <> 'host' then
    if v_had and p.seat is not null and not exists (
      select 1 from public.live_participants o where o.session_id = p_session and o.seat = p.seat and o.left_at is null and o.user_id <> p_user) then
      v_seat := p.seat;
    else
      select min(g) into v_seat from generate_series(1, v.capacity + 10) g
      where not exists (select 1 from public.live_participants o where o.session_id = p_session and o.seat = g and o.left_at is null and o.joined_at is not null and o.user_id <> p_user);
    end if;
  end if;

  insert into public.live_participants (session_id, user_id, role, seat, joined_at, left_at)
  values (p_session, p_user, v_role, v_seat, now(), null)
  on conflict (session_id, user_id) do update set role = excluded.role, seat = excluded.seat, joined_at = now(), left_at = null;

  return jsonb_build_object(
    'room', s.livekit_room, 'identity', p_user, 'name', coalesce(nullif(pr.display_name, ''), 'Tələbə ' || pr.student_no),
    'role', v_role, 'seat', v_seat, 'title', s.title, 'state', s.state,
    'can_publish', v_role in ('host', 'cohost') or (v_role = 'speaker' and not s.only_host_audio),
    'can_publish_screen', v_role in ('host', 'cohost'),
    'chat_enabled', s.chat_enabled, 'only_host_audio', s.only_host_audio);
end $$;

create or replace function public.live_leave(p_user uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.live_participants
  set left_at = now(), total_seconds = total_seconds + greatest(0, extract(epoch from now() - joined_at)::int)
  where session_id = p_session and user_id = p_user and left_at is null and joined_at is not null;
  update public.live_hands set resolved_at = now(), resolution = 'lowered' where session_id = p_session and user_id = p_user and resolved_at is null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.live_set_state(p_user uuid, p_session uuid, p_state public.live_state) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.live_sessions;
begin
  if not public._live_is_host(p_user, p_session) then return jsonb_build_object('error', 'forbidden'); end if;
  select * into s from public.live_sessions where id = p_session for update;
  if s.state in ('ended', 'cancelled') then return jsonb_build_object('error', 'session_closed'); end if;
  if not ((s.state = 'scheduled' and p_state in ('live', 'cancelled')) or (s.state = 'live' and p_state = 'ended')) then
    return jsonb_build_object('error', 'bad_transition');
  end if;
  update public.live_sessions set state = p_state where id = p_session;
  if p_state in ('ended', 'cancelled') then
    update public.live_participants
    set left_at = now(), total_seconds = total_seconds + greatest(0, extract(epoch from now() - joined_at)::int)
    where session_id = p_session and left_at is null and joined_at is not null;
    update public.live_hands set resolved_at = now(), resolution = 'dismissed' where session_id = p_session and resolved_at is null;
  end if;
  return jsonb_build_object('state', p_state, 'room', s.livekit_room);
end $$;

create or replace function public.live_settings(p_user uuid, p_session uuid, p_only_host_audio boolean, p_chat_enabled boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.live_sessions; v_silenced jsonb;
begin
  if not public._live_is_host(p_user, p_session) then return jsonb_build_object('error', 'forbidden'); end if;
  update public.live_sessions set only_host_audio = coalesce(p_only_host_audio, only_host_audio), chat_enabled = coalesce(p_chat_enabled, chat_enabled)
  where id = p_session returning * into s;
  -- "Yalnız host danışır": danışan tələbələr dinləyiciyə qaytarılır. Edge Function onların LiveKit icazəsini bağlayır.
  if s.only_host_audio then
    with d as (
      update public.live_participants set role = 'audience'
      where session_id = p_session and role = 'speaker' and left_at is null returning user_id)
    select coalesce(jsonb_agg(user_id), '[]'::jsonb) into v_silenced from d;
  end if;
  return jsonb_build_object('room', s.livekit_room, 'only_host_audio', s.only_host_audio, 'chat_enabled', s.chat_enabled,
    'silenced', coalesce(v_silenced, '[]'::jsonb));
end $$;

create or replace function public.live_raise_hand(p_user uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pos int;
begin
  if not public._live_is_participant(p_user, p_session) then return jsonb_build_object('error', 'not_participant'); end if;
  if public._live_is_host(p_user, p_session) then return jsonb_build_object('error', 'host_cannot_raise'); end if;
  insert into public.live_hands (session_id, user_id) values (p_session, p_user) on conflict do nothing;
  select x.pos into v_pos from (
    select h.user_id, row_number() over (order by h.raised_at, h.id) as pos
    from public.live_hands h where h.session_id = p_session and h.resolved_at is null) x
  where x.user_id = p_user;
  return jsonb_build_object('position', v_pos);
end $$;

create or replace function public.live_lower_hand(p_user uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.live_hands set resolved_at = now(), resolution = 'lowered' where session_id = p_session and user_id = p_user and resolved_at is null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.live_hands_queue(p_user uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._live_is_host(p_user, p_session) then return jsonb_build_object('error', 'forbidden'); end if;
  return jsonb_build_object('hands', (
    select coalesce(jsonb_agg(jsonb_build_object('user_id', h.user_id, 'name', coalesce(nullif(pr.display_name, ''), 'Tələbə ' || pr.student_no),
                                                 'seat', lp.seat, 'raised_at', h.raised_at) order by h.raised_at, h.id), '[]')
    from public.live_hands h join public.profiles pr on pr.id = h.user_id
    left join public.live_participants lp on lp.session_id = h.session_id and lp.user_id = h.user_id
    where h.session_id = p_session and h.resolved_at is null));
end $$;

-- Host söz verir (speaker) və ya geri alır (audience). Edge Function LiveKit icazəsini buna uyğun dəyişir.
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
    'can_publish', p_role = 'cohost' or (p_role = 'speaker'), 'can_publish_screen', p_role = 'cohost');
end $$;

create or replace function public.live_ban(p_user uuid, p_session uuid, p_target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.live_sessions;
begin
  if not public._live_is_host(p_user, p_session) then return jsonb_build_object('error', 'forbidden'); end if;
  select * into s from public.live_sessions where id = p_session;
  if s.host_id = p_target then return jsonb_build_object('error', 'bad_target'); end if;
  insert into public.live_participants (session_id, user_id, banned, left_at) values (p_session, p_target, true, now())
  on conflict (session_id, user_id) do update set banned = true, role = 'audience', seat = null,
    total_seconds = public.live_participants.total_seconds + case when public.live_participants.left_at is null and public.live_participants.joined_at is not null
      then greatest(0, extract(epoch from now() - public.live_participants.joined_at)::int) else 0 end,
    left_at = coalesce(public.live_participants.left_at, now());
  update public.live_hands set resolved_at = now(), resolution = 'dismissed' where session_id = p_session and user_id = p_target and resolved_at is null;
  insert into public.audit_events (student_id, kind, detail) values (p_target, 'live_banned', jsonb_build_object('session', p_session, 'by', p_user));
  return jsonb_build_object('room', s.livekit_room, 'identity', p_target);
end $$;

create or replace function public.live_chat_post(p_user uuid, p_session uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.live_sessions; v_recent int; v_id bigint; v_body text := trim(p_body);
begin
  if not public._live_is_participant(p_user, p_session) then return jsonb_build_object('error', 'not_participant'); end if;
  select * into s from public.live_sessions where id = p_session;
  if not s.chat_enabled and not public._live_is_host(p_user, p_session) then return jsonb_build_object('error', 'chat_disabled'); end if;
  if v_body is null or length(v_body) = 0 or length(v_body) > 500 then return jsonb_build_object('error', 'bad_body'); end if;
  select count(*) into v_recent from public.live_chat where session_id = p_session and user_id = p_user and created_at > now() - interval '10 seconds';
  if v_recent >= 5 then return jsonb_build_object('error', 'rate_limited'); end if;
  insert into public.live_chat (session_id, user_id, body) values (p_session, p_user, v_body) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- LiveKit webhook (imza Edge Function-da yoxlanır). Eyni hadisə ID-si ikinci dəfə işlənmir.
create or replace function public.live_webhook_event(p_event_id text, p_kind text, p_room text, p_identity uuid, p_at timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session uuid;
begin
  select id into v_session from public.live_sessions where livekit_room = p_room;
  insert into public.live_events (event_id, session_id, kind, payload) values (p_event_id, v_session, p_kind, jsonb_build_object('identity', p_identity, 'at', p_at))
  on conflict (event_id) do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;
  if v_session is null then return jsonb_build_object('ignored', true); end if;
  if p_kind = 'participant_left' and p_identity is not null then
    update public.live_participants
    set left_at = p_at, total_seconds = total_seconds + greatest(0, extract(epoch from p_at - joined_at)::int)
    where session_id = v_session and user_id = p_identity and left_at is null and joined_at is not null;
    update public.live_hands set resolved_at = p_at, resolution = 'lowered' where session_id = v_session and user_id = p_identity and resolved_at is null;
  elsif p_kind = 'room_finished' then
    update public.live_participants
    set left_at = p_at, total_seconds = total_seconds + greatest(0, extract(epoch from p_at - joined_at)::int)
    where session_id = v_session and left_at is null and joined_at is not null;
    update public.live_sessions set state = 'ended' where id = v_session and state = 'live';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Davamiyyət hesabatı (host üçün).
create or replace function public.live_attendance(p_user uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._live_is_host(p_user, p_session) then return jsonb_build_object('error', 'forbidden'); end if;
  return jsonb_build_object('rows', (
    select coalesce(jsonb_agg(jsonb_build_object('user_id', lp.user_id, 'name', pr.display_name, 'student_no', pr.student_no, 'role', lp.role,
      'minutes', round((lp.total_seconds + case when lp.left_at is null and lp.joined_at is not null then extract(epoch from now() - lp.joined_at) else 0 end) / 60.0, 1),
      'banned', lp.banned) order by pr.display_name), '[]')
    from public.live_participants lp join public.profiles pr on pr.id = lp.user_id where lp.session_id = p_session));
end $$;

-- Məlumat ixracı: istifadəçinin öz məlumatları (sual mətnləri və cavab açarları daxil deyil).
create or replace function public.export_my_data(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'suspension_reason' from public.profiles p where p.id = p_user),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.consents c where c.user_id = p_user),
    'enrollments', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from public.enrollments e where e.student_id = p_user),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('device_id', d.device_id, 'active', d.active, 'claimed_at', d.claimed_at, 'last_seen', d.last_seen)), '[]') from public.devices d where d.student_id = p_user),
    'tests', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'mode', s.mode, 'subject', s.subject_id, 'started_at', s.started_at, 'finished_at', s.finished_at, 'result', s.result) order by s.started_at), '[]') from public.test_sessions s where s.student_id = p_user),
    'diary', (select coalesce(jsonb_agg(jsonb_build_object('title', d.title, 'kind', d.kind, 'payload', d.payload, 'created_at', d.created_at) order by d.created_at), '[]') from public.diary_entries d where d.student_id = p_user),
    'live', (select coalesce(jsonb_agg(jsonb_build_object('session_id', lp.session_id, 'role', lp.role, 'joined_at', lp.joined_at, 'total_seconds', lp.total_seconds)), '[]') from public.live_participants lp where lp.user_id = p_user)
  )
$$;


-- ============ RLS ============
alter table public.legal_documents enable row level security;
alter table public.consents enable row level security;
alter table public.venues enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_invites enable row level security;
alter table public.live_participants enable row level security;
alter table public.live_hands enable row level security;
alter table public.live_chat enable row level security;
alter table public.live_events enable row level security;

create policy legal_read on public.legal_documents for select to anon, authenticated using (true);
create policy consents_self on public.consents for select to authenticated using (user_id = auth.uid());
create policy venues_read on public.venues for select to authenticated using (true);
create policy live_sessions_read on public.live_sessions for select to authenticated using (public._live_can_access(auth.uid(), live_sessions));
create policy live_participants_read on public.live_participants for select to authenticated
  using (public._live_is_participant(auth.uid(), session_id) or public._live_is_host(auth.uid(), session_id));
create policy live_chat_read on public.live_chat for select to authenticated
  using (deleted_at is null and (public._live_is_participant(auth.uid(), session_id) or public._live_is_host(auth.uid(), session_id)));
create policy live_hands_read on public.live_hands for select to authenticated
  using (user_id = auth.uid() or public._live_is_host(auth.uid(), session_id));
-- live_invites, live_events: yalnız server.

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public._live_can_access(uuid, public.live_sessions) to authenticated;
grant execute on function public._live_is_participant(uuid, uuid) to authenticated;
grant execute on function public._live_is_host(uuid, uuid) to authenticated;
