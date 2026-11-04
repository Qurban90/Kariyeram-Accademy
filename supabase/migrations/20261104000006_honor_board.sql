-- Şərəf lövhəsi. Məxfilik: tələbə lövhədə yalnız özü razılıq verdikdə görünür (defolt: gizli).
-- Ad qısaldılır ("Aysel M."), ID-lər qaytarılmır. Sıralama Edge API-də (Wilson aşağı sərhədi, packages/core).
alter table public.profiles add column if not exists show_on_board boolean not null default false;

create or replace function public.set_board_visibility(p_user uuid, p_show boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set show_on_board = coalesce(p_show, false) where id = p_user;
  if not found then return jsonb_build_object('error', 'no_profile'); end if;
  return jsonb_build_object('show', coalesce(p_show, false));
end $$;

create or replace function public._short_name(p_name text, p_no bigint) returns text
language sql immutable as $$
  select case
    when coalesce(trim(p_name), '') = '' then 'Tələbə ' || p_no
    when array_length(regexp_split_to_array(trim(p_name), '\s+'), 1) = 1 then trim(p_name)
    else split_part(trim(p_name), ' ', 1) || ' ' ||
         upper(left((regexp_split_to_array(trim(p_name), '\s+'))[array_length(regexp_split_to_array(trim(p_name), '\s+'), 1)], 1)) || '.'
  end
$$;

-- Bu həftənin (Bakı vaxtı, bazar ertəsindən) cavab sayları: razılıq verənlər + soruşan özü.
create or replace function public.board_rows(p_user uuid, p_subject text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_since timestamptz := date_trunc('week', now() at time zone 'Asia/Baku') at time zone 'Asia/Baku';
begin
  return jsonb_build_object('since', v_since, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('name', public._short_name(p.display_name, p.student_no), 'correct', x.correct, 'total', x.total, 'me', p.id = p_user))
    from (
      select s.student_id, count(*) filter (where a.correct) as correct, count(*) as total
      from public.answers a join public.test_sessions s on s.id = a.session_id
      where a.answered_at >= v_since and (p_subject is null or s.subject_id = p_subject)
      group by s.student_id
    ) x join public.profiles p on p.id = x.student_id
    where p.show_on_board or p.id = p_user), '[]'::jsonb));
end $$;

revoke execute on function public.set_board_visibility(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.board_rows(uuid, text) from public, anon, authenticated;
revoke execute on function public._short_name(text, bigint) from public, anon, authenticated;
grant execute on function public.set_board_visibility(uuid, boolean) to service_role;
grant execute on function public.board_rows(uuid, text) to service_role;
grant execute on function public._short_name(text, bigint) to service_role;
