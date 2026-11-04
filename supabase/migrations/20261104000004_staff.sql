-- Müəllim paneli üçün RPC-lər: toplu kod yaratma və sual statusu (audit ilə).
-- create_codes xəta zamanı exception atır; API üçün aydın xəta kodları qaytaran sarğı lazımdır.

create or replace function public.staff_create_codes(p_staff uuid, p_subject text, p_count int, p_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_codes text[];
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_count is null or p_count not between 1 and 200 then return jsonb_build_object('error', 'bad_count'); end if;
  if p_days is null or p_days not between 1 and 730 then return jsonb_build_object('error', 'bad_days'); end if;
  if not exists (select 1 from public.subjects where id = p_subject) then return jsonb_build_object('error', 'not_found'); end if;
  select array_agg(c.code) into v_codes from public.create_codes(p_staff, p_subject, p_count, p_days) c;
  insert into public.audit_events (student_id, kind, detail)
  values (p_staff, 'codes_created', jsonb_build_object('subject', p_subject, 'count', p_count, 'days', p_days));
  -- Kodlar yalnız bu cavabda açıq mətnlə görünür; bazada yalnız hash qalır.
  return jsonb_build_object('codes', to_jsonb(v_codes), 'subject', p_subject, 'days', p_days);
end $$;

create or replace function public.staff_set_question_status(p_staff uuid, p_question uuid, p_status public.question_status) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_old public.question_status;
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  select status into v_old from public.questions where id = p_question for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_old = p_status then return jsonb_build_object('id', p_question, 'status', p_status, 'changed', false); end if;
  update public.questions set status = p_status where id = p_question;
  insert into public.audit_events (student_id, kind, detail)
  values (p_staff, 'question_status', jsonb_build_object('question', p_question, 'from', v_old, 'to', p_status));
  return jsonb_build_object('id', p_question, 'status', p_status, 'changed', true);
end $$;

revoke execute on function public.staff_create_codes(uuid, text, int, int) from public, anon, authenticated;
revoke execute on function public.staff_set_question_status(uuid, uuid, public.question_status) from public, anon, authenticated;
grant execute on function public.staff_create_codes(uuid, text, int, int) to service_role;
grant execute on function public.staff_set_question_status(uuid, uuid, public.question_status) to service_role;
