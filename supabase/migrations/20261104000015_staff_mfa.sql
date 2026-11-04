-- Müəllim və admin üçün iki mərhələli qoruma (TOTP MFA, risk R-11).
-- Qayda:
--   * admin/* marşrutları həmişə aal2 tələb edir (Edge Function yoxlayır).
--   * staff/* marşrutları və sual bankının birbaşa oxunması aal2 tələb edir, əgər
--     (a) istifadəçi MFA qoşubsa (qoşubsa, ondan istifadə etməlidir) və ya
--     (b) admin hamı üçün məcburi edibsə (app_config.staff_mfa_required).
-- aal JWT-dədir (GoTrue yazır); Edge GoTrue yoxlamasından sonra oxuyur, PostgREST isə request.jwt.claims-dən.

alter table public.app_config add column if not exists staff_mfa_required boolean not null default false;

-- Cari sorğunun aal səviyyəsi və istifadəçinin təsdiqlənmiş MFA faktoru olub-olmaması.
create or replace function public._staff_aal_ok() returns boolean
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_required boolean;
  v_has boolean := false;
begin
  if coalesce(v_claims->>'aal', '') = 'aal2' then return true; end if;
  select staff_mfa_required into v_required from public.app_config where id;
  if coalesce(v_required, false) then return false; end if;
  -- auth.mfa_factors Supabase-də var; adi Postgres test klasterində yoxdur.
  if to_regclass('auth.mfa_factors') is not null then
    execute 'select exists (select 1 from auth.mfa_factors where user_id = $1 and status = ''verified'')' into v_has using auth.uid();
  end if;
  return not v_has;
end $$;
revoke execute on function public._staff_aal_ok() from public, anon;
grant execute on function public._staff_aal_ok() to authenticated, service_role;

-- Məhdudlaşdırıcı siyasət: icazə verən siyasətlərlə AND olunur. Tələbənin onsuz da oxuma siyasəti yoxdur.
drop policy if exists questions_staff_mfa on public.questions;
create policy questions_staff_mfa on public.questions as restrictive for select to authenticated using (public._staff_aal_ok());

-- Konfiqurasiya: staff MFA məcburiyyəti də admin tərəfindən (audit ilə).
drop function if exists public.admin_set_config(uuid, text, boolean, text);
create or replace function public.admin_set_config(p_admin uuid, p_min_version text, p_maintenance boolean, p_message text,
                                                   p_staff_mfa boolean default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_old public.app_config;
begin
  if not public.is_admin(p_admin) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_min_version is not null and p_min_version !~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$' then return jsonb_build_object('error', 'bad_version'); end if;
  if length(coalesce(p_message, '')) > 500 then return jsonb_build_object('error', 'bad_message'); end if;
  select * into v_old from public.app_config where id for update;
  update public.app_config set
    min_version = coalesce(p_min_version, min_version),
    maintenance = coalesce(p_maintenance, maintenance),
    message = case when p_message is null then message else nullif(trim(p_message), '') end,
    staff_mfa_required = coalesce(p_staff_mfa, staff_mfa_required),
    updated_at = now(), updated_by = p_admin
  where id;
  insert into public.audit_events (student_id, kind, detail) values (p_admin, 'admin_config', jsonb_build_object(
    'by', p_admin,
    'from', jsonb_build_object('min_version', v_old.min_version, 'maintenance', v_old.maintenance, 'staff_mfa_required', v_old.staff_mfa_required),
    'to', jsonb_build_object('min_version', coalesce(p_min_version, v_old.min_version), 'maintenance', coalesce(p_maintenance, v_old.maintenance),
                             'staff_mfa_required', coalesce(p_staff_mfa, v_old.staff_mfa_required))));
  return (select jsonb_build_object('min_version', min_version, 'maintenance', maintenance, 'message', message, 'staff_mfa_required', staff_mfa_required)
          from public.app_config where id);
end $$;
revoke execute on function public.admin_set_config(uuid, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_config(uuid, text, boolean, text, boolean) to service_role;
