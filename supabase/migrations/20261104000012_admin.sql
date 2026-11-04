-- Admin (FR-064): istifadəçi axtarışı, dayandırma/bərpa, rol (tələbə ↔ müəllim), audit jurnalı.
-- Prinsiplər:
--  * Hər əməliyyat audit_events-ə yazılır, kim etdiyi detail.by-dadır.
--  * Admin özünə və başqa adminə toxuna bilməz; admin yalnız verilənlər bazası sahibi tərəfindən təyin olunur
--    (bir admin hesabı ələ keçirilsə, digər adminləri bloklayıb sistemi tutmaq mümkün olmasın).
--  * Dayandırılmış müəllim/admin müəllim səlahiyyətlərini dərhal itirir (is_staff).
--  * E-poçt və telefon adminə maskalı göstərilir (məlumatın minimallaşdırılması).

create or replace function public.is_staff(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p and role in ('teacher', 'admin')
                 and (suspended_until is null or suspended_until <= now()))
$$;

create or replace function public.is_admin(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p and role = 'admin'
                 and (suspended_until is null or suspended_until <= now()))
$$;

create index if not exists audit_at on public.audit_events (at desc, id desc);
create index if not exists audit_kind_at on public.audit_events (kind, at desc, id desc);

create or replace function public._mask_email(e text) returns text
language sql immutable as $$
  select case when e is null or position('@' in e) = 0 then null
              else left(split_part(e, '@', 1), 2) || '***@' || split_part(e, '@', 2) end
$$;

create or replace function public._mask_phone(p text) returns text
language sql immutable as $$
  select case when p is null or length(p) < 6 then null else '+' || left(p, 5) || repeat('*', greatest(length(p) - 7, 0)) || right(p, 2) end
$$;

create or replace function public._admin_row(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'id', pr.id, 'student_no', pr.student_no, 'display_name', pr.display_name, 'role', pr.role,
    'suspended_until', case when pr.suspended_until > now() then pr.suspended_until end,
    'suspension_reason', case when pr.suspended_until > now() then pr.suspension_reason end,
    'created_at', pr.created_at,
    'email', public._mask_email(u.email), 'phone', public._mask_phone(u.phone))
  from public.profiles pr join auth.users u on u.id = pr.id where pr.id = p_id
$$;

-- Axtarış: tələbə № (rəqəm), telefonun son rəqəmləri, dəqiq e-poçt və ya ad parçası. Ən çox 20 nəticə.
create or replace function public.admin_find_users(p_admin uuid, p_query text) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare q text := trim(coalesce(p_query, '')); v_like text;
begin
  if not public.is_admin(p_admin) then return jsonb_build_object('error', 'forbidden'); end if;
  if length(q) > 120 or (length(q) < 3 and q !~ '^[0-9]+$') then return jsonb_build_object('error', 'bad_query'); end if;
  if q ~ '^\+?[0-9]{1,15}$' then
    q := ltrim(q, '+');
    return jsonb_build_object('users', coalesce((
      select jsonb_agg(public._admin_row(pr.id) order by pr.created_at desc) from (
        select pr.id, pr.created_at from public.profiles pr join auth.users u on u.id = pr.id
        -- Tələbə № dəqiq; telefon yalnız ən azı 5 son rəqəmlə (geniş uyğunluq olmasın).
        where (length(q) <= 10 and pr.student_no = q::bigint) or (length(q) >= 5 and u.phone like '%' || q)
        order by pr.created_at desc limit 20) pr), '[]'::jsonb));
  elsif position('@' in q) > 0 then
    return jsonb_build_object('users', coalesce((
      select jsonb_agg(public._admin_row(pr.id)) from public.profiles pr join auth.users u on u.id = pr.id
      where lower(u.email) = lower(q)), '[]'::jsonb));
  else
    -- LIKE xüsusi simvolları qaçırılır ki, "%" ilə bütün bazanı çəkmək olmasın.
    v_like := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    return jsonb_build_object('users', coalesce((
      select jsonb_agg(public._admin_row(pr.id) order by pr.created_at desc) from (
        select id, created_at from public.profiles where display_name ilike v_like order by created_at desc limit 20) pr), '[]'::jsonb));
  end if;
end $$;

create or replace function public._admin_target(p_admin uuid, p_target uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_role public.app_role;
begin
  if not public.is_admin(p_admin) then return 'forbidden'; end if;
  if p_admin = p_target then return 'self'; end if;
  select role into v_role from public.profiles where id = p_target;
  if not found then return 'not_found'; end if;
  if v_role = 'admin' then return 'forbidden'; end if;
  return null;
end $$;

create or replace function public.admin_suspend(p_admin uuid, p_target uuid, p_hours int, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_err text; v_until timestamptz; v_rooms jsonb;
begin
  v_err := public._admin_target(p_admin, p_target);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if p_hours is null or p_hours not between 1 and 87600 then return jsonb_build_object('error', 'bad_hours'); end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 300 then return jsonb_build_object('error', 'bad_reason'); end if;
  v_until := now() + make_interval(hours => p_hours);
  update public.profiles set suspended_until = v_until, suspension_reason = 'admin: ' || trim(p_reason) where id = p_target;
  -- Canlı dərsdən çıxarılır (yenidən qoşulmaq live_join-də suspended ilə rədd olunur).
  -- LiveKit qoşulmuş iştirakçının tokenini özü yeniləyir, ona görə otaqlar qaytarılır və Edge onları LiveKit-dən də çıxarır.
  select coalesce(jsonb_agg(distinct s.livekit_room), '[]'::jsonb) into v_rooms
    from public.live_participants lp join public.live_sessions s on s.id = lp.session_id
   where lp.user_id = p_target and lp.left_at is null and s.livekit_room is not null;
  update public.live_participants set left_at = now() where user_id = p_target and left_at is null;
  insert into public.audit_events (student_id, kind, detail)
  values (p_target, 'admin_suspended', jsonb_build_object('by', p_admin, 'hours', p_hours, 'reason', trim(p_reason)));
  return jsonb_build_object('ok', true, 'until', v_until, 'rooms', v_rooms);
end $$;

create or replace function public.admin_unsuspend(p_admin uuid, p_target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_err text;
begin
  v_err := public._admin_target(p_admin, p_target);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update public.profiles set suspended_until = null, suspension_reason = null where id = p_target;
  insert into public.audit_events (student_id, kind, detail) values (p_target, 'admin_unsuspended', jsonb_build_object('by', p_admin));
  return jsonb_build_object('ok', true);
end $$;

-- Rol: yalnız tələbə ↔ müəllim. Admin təyinatı bu funksiya ilə mümkün deyil.
create or replace function public.admin_set_role(p_admin uuid, p_target uuid, p_role public.app_role) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_err text; v_old public.app_role;
begin
  v_err := public._admin_target(p_admin, p_target);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if p_role is null or p_role = 'admin' then return jsonb_build_object('error', 'forbidden'); end if;
  select role into v_old from public.profiles where id = p_target for update;
  if v_old = p_role then return jsonb_build_object('ok', true, 'unchanged', true); end if;
  update public.profiles set role = p_role where id = p_target;
  insert into public.audit_events (student_id, kind, detail)
  values (p_target, 'admin_role', jsonb_build_object('by', p_admin, 'from', v_old, 'to', p_role));
  return jsonb_build_object('ok', true);
end $$;

-- Audit jurnalı: ən yenidən köhnəyə, açar-dəst səhifələmə (p_before = son görülən id). Ən çox 100 sətir.
create or replace function public.admin_audit(p_admin uuid, p_kind text default null, p_target uuid default null,
                                              p_before bigint default null, p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100); v_rows jsonb;
begin
  if not public.is_admin(p_admin) then return jsonb_build_object('error', 'forbidden'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'at', a.at, 'kind', a.kind, 'detail', a.detail,
           'student_no', pr.student_no, 'display_name', pr.display_name) order by a.id desc), '[]'::jsonb)
    into v_rows
  from (select * from public.audit_events
        where (p_kind is null or kind = p_kind) and (p_target is null or student_id = p_target)
          and (p_before is null or id < p_before)
        order by id desc limit v_lim) a
  left join public.profiles pr on pr.id = a.student_id;
  return jsonb_build_object('events', v_rows);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.is_admin(uuid)', 'public._admin_row(uuid)', 'public.admin_find_users(uuid, text)',
    'public._admin_target(uuid, uuid)', 'public.admin_suspend(uuid, uuid, int, text)', 'public.admin_unsuspend(uuid, uuid)',
    'public.admin_set_role(uuid, uuid, public.app_role)', 'public.admin_audit(uuid, text, uuid, bigint, int)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
