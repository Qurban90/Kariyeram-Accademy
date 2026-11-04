-- PDF konspektlər artıq klientə birbaşa ünvanla verilmir: server hər açılışda tələbə nömrəsi ilə su nişanı vurur (R-13).
-- Su nişanı Edge Function-da yaddaşda edilir, ona görə yükləmə limiti 25 MB-dan 15 MB-a endirilir (ölçmə: docs/PERFORMANCE.md).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    update storage.buckets set file_size_limit = 15728640 where id = 'library';
  end if;
end $$;

-- Hər açılış serverdə CPU tələb edir (su nişanı): tələbə başına gündə 200 açılış (audit qeydləri ilə sayılır, indeks: audit_student_kind).
-- Müəllim/admin limitsizdir (yoxlama üçün).
create or replace function public.library_open(p_user uuid, p_item uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i public.library_items; pr public.profiles; v_today int;
begin
  select * into pr from public.profiles where id = p_user;
  if not found then return jsonb_build_object('error', 'no_profile'); end if;
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
revoke execute on function public.library_open(uuid, uuid) from public, anon, authenticated;
grant execute on function public.library_open(uuid, uuid) to service_role;
