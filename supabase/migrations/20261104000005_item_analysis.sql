-- Sual analizi (FR-061) üçün xam məlumat: hər dərc olunmuş sual üzrə son 500 cavabın seçimi və həmin
-- testdəki ümumi faiz. Tələbə kimliyi qaytarılmır; hesablama Edge API-də packages/core ilə aparılır.
create or replace function public.staff_item_responses(p_staff uuid, p_subject text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'stem', left(q.stem, 300), 'topic', t.name, 'answer_index', q.answer_index,
      'option_count', jsonb_array_length(q.options), 'trap_marked', q.trap, 'responses', r.resp) order by t.sort, q.created_at)
    from public.questions q
    join public.topics t on t.id = q.topic_id
    cross join lateral (
      select jsonb_agg(jsonb_build_object('c', a.chosen, 'p', (s.result->>'percent')::numeric)) as resp
      from (select x.chosen, x.session_id from public.answers x where x.question_id = q.id order by x.answered_at desc limit 500) a
      join public.test_sessions s on s.id = a.session_id and s.state = 'finished' and s.result ? 'percent'
    ) r
    where t.subject_id = p_subject and q.status = 'published' and r.resp is not null), '[]'::jsonb));
end $$;

revoke execute on function public.staff_item_responses(uuid, text) from public, anon, authenticated;
grant execute on function public.staff_item_responses(uuid, text) to service_role;
