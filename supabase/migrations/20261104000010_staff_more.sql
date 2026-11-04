-- Müəllim: kod siyahısı və ləğvi (FR-060), gündəliyə qiymət və qeyd (FR-063).

-- Kodların açıq mətni saxlanmır, siyahıda yalnız vəziyyət görünür. Ləğv ID ilə.
create or replace function public.staff_list_codes(p_staff uuid, p_subject text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  return jsonb_build_object('codes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'subject_id', c.subject_id, 'days', c.days, 'created_at', c.created_at, 'expires_at', c.expires_at,
      'state', case when c.revoked then 'revoked' when c.redeemed_at is not null then 'redeemed'
                    when c.expires_at is not null and c.expires_at < now() then 'expired' else 'unused' end,
      'redeemed_at', c.redeemed_at) order by c.created_at desc)
    from (select * from public.access_codes
          where (p_subject is null or subject_id = p_subject)
            and (created_by = p_staff or exists (select 1 from public.profiles where id = p_staff and role = 'admin'))
          order by created_at desc limit 300) c), '[]'::jsonb));
end $$;

create or replace function public.staff_revoke_code(p_staff uuid, p_code uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.access_codes;
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  select * into c from public.access_codes where id = p_code for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  -- Müəllim yalnız öz kodunu, admin istənilən kodu ləğv edir.
  if c.created_by is distinct from p_staff and not exists (select 1 from public.profiles where id = p_staff and role = 'admin') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if c.redeemed_at is not null then return jsonb_build_object('error', 'code_used'); end if;
  update public.access_codes set revoked = true where id = p_code;
  insert into public.audit_events (student_id, kind, detail) values (p_staff, 'code_revoked', jsonb_build_object('code_id', p_code));
  return jsonb_build_object('ok', true);
end $$;

-- Müəllim tələbəni nömrəsi ilə tapır (su nişanındakı və profildəki "Tələbə №").
create or replace function public.staff_diary_add(p_staff uuid, p_student_no bigint, p_kind text, p_title text, p_grade text default null, p_text text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_id uuid;
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_kind not in ('grade', 'note') then return jsonb_build_object('error', 'bad_kind'); end if;
  if length(trim(coalesce(p_title, ''))) not between 1 and 140 then return jsonb_build_object('error', 'bad_title'); end if;
  if p_kind = 'grade' and (p_grade is null or length(trim(p_grade)) not between 1 and 10) then return jsonb_build_object('error', 'bad_grade'); end if;
  if length(coalesce(p_text, '')) > 2000 then return jsonb_build_object('error', 'bad_text'); end if;
  select id into v_student from public.profiles where student_no = p_student_no;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  insert into public.diary_entries (student_id, kind, title, payload, created_by)
  values (v_student, p_kind, trim(p_title),
          jsonb_strip_nulls(jsonb_build_object('grade', nullif(trim(coalesce(p_grade, '')), ''), 'text', nullif(trim(coalesce(p_text, '')), ''))), p_staff)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'student_name', (select display_name from public.profiles where id = v_student));
end $$;

revoke execute on function public.staff_list_codes(uuid, text) from public, anon, authenticated;
revoke execute on function public.staff_revoke_code(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.staff_diary_add(uuid, bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.staff_list_codes(uuid, text) to service_role;
grant execute on function public.staff_revoke_code(uuid, uuid) to service_role;
grant execute on function public.staff_diary_add(uuid, bigint, text, text, text, text) to service_role;
