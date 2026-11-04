-- Xəta düzəlişləri (yoxlama nəticəsində):
-- 1) submit_answer imtahan vaxtı bitəndən sonra cavab qəbul edirdi (son sualı açıq saxlayıb gec göndərmək mümkün idi).
-- 2) live_join: canlı dərs bitmə vaxtını keçəndə qopan tələbə geri qoşula bilmirdi.
-- 3) live_webhook_event: gecikmiş participant_left yenidən qoşulmuş iştirakçını "ayrılıb" edirdi.

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
  -- Vaxt bitibsə cavab qəbul edilmir (5 san. şəbəkə güzəşti); sessiya bağlanır.
  if s.time_limit_s is not null and now() > s.started_at + make_interval(secs => s.time_limit_s + 5) then
    perform public.finish_session(p_student, p_session);
    return jsonb_build_object('error', 'time_up');
  end if;
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
  -- Dərs uzana bilər: canlı ikən bitmə vaxtı keçsə də yenidən qoşulmaq olur.
  if s.host_id is distinct from p_user and s.state <> 'live' and now() > s.ends_at then return jsonb_build_object('error', 'session_closed'); end if;

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
    where session_id = v_session and user_id = p_identity and left_at is null and joined_at is not null
      and joined_at <= p_at; -- gecikmiş hadisə yenidən qoşulmanı ləğv etməməlidir
    update public.live_hands set resolved_at = p_at, resolution = 'lowered' where session_id = v_session and user_id = p_identity and resolved_at is null and raised_at <= p_at;
  elsif p_kind = 'room_finished' then
    update public.live_participants
    set left_at = p_at, total_seconds = total_seconds + greatest(0, extract(epoch from p_at - joined_at)::int)
    where session_id = v_session and left_at is null and joined_at is not null;
    update public.live_sessions set state = 'ended' where id = v_session and state = 'live';
  end if;
  return jsonb_build_object('ok', true);
end $$;
