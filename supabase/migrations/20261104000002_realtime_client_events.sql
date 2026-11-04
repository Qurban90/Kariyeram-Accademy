-- Canlı chat üçün Supabase Realtime (RLS tətbiq olunur: yalnız iştirakçılar görür).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_chat;
  end if;
end $$;

-- Klientin bildirdiyi təhlükəsizlik hadisələri (iOS ekran şəkli, ekran yazısı).
-- Klient yalan deyə bilər: bu, sübut deyil, yalnız siqnaldır. Spam qarşısı: gündə 50 hadisə.
create or replace function public.report_client_event(p_user uuid, p_kind text, p_context text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if p_kind not in ('screenshot', 'screen_recording') then return jsonb_build_object('error', 'bad_kind'); end if;
  if not exists (select 1 from public.profiles where id = p_user) then return jsonb_build_object('error', 'no_profile'); end if;
  select count(*) into v_n from public.audit_events
   where student_id = p_user and kind like 'client_%' and at >= public._day_start();
  if v_n >= 50 then return jsonb_build_object('ok', true, 'recorded', false); end if;
  insert into public.audit_events (student_id, kind, detail)
  values (p_user, 'client_' || p_kind, jsonb_build_object('context', left(coalesce(p_context, ''), 64)));
  return jsonb_build_object('ok', true, 'recorded', true);
end $$;

revoke execute on function public.report_client_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_client_event(uuid, text, text) to service_role;
