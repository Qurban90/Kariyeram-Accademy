-- Pulsuz mərhələ (2026-11-21, sahibin qərarı): tətbiq ilk vaxtlar hamıya pulsuzdur, bütün mövzular
-- və mətn konspektləri hər tələbəyə açıqdır. Canlı dərs (access = 'enrolled') və kurs materialları
-- (PDF tətbiqdə paylanmır) abunəli qalır. Əvvəl bu yalnız klientdə idi və server pullu mövzunu yenə bağlayırdı.
-- Bayraq app_config-dədir: admin söndürəndə abunə qaydası geri qayıdır, kod dəyişmir.

alter table public.app_config add column if not exists free_access boolean not null default false;
update public.app_config set free_access = true;

create or replace function public._free_access() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select free_access from public.app_config limit 1), false)
$$;
revoke execute on function public._free_access() from public, anon, authenticated;
grant execute on function public._free_access() to service_role;

create or replace function public.candidates(p_student uuid, p_subject text, p_topic_ids uuid[] default null)
returns table (id uuid, topic_id uuid, level smallint, trap boolean, card jsonb, last_correct boolean, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, q.topic_id, q.level, q.trap, c.card, c.last_correct, c.last_seen
  from public.questions q
  join public.topics t on t.id = q.topic_id
  left join public.srs_cards c on c.student_id = p_student and c.question_id = q.id
  where q.status = 'published'
    and t.subject_id = p_subject
    and (p_topic_ids is null or q.topic_id = any (p_topic_ids))
    and (t.free or public._free_access() or exists (
      select 1 from public.enrollments e
      where e.student_id = p_student and e.subject_id = p_subject and e.access_until > now()))
$$;

-- Yalnız mətn konspekti pulsuz mərhələdə açılır; PDF (kurs materialı) abunə tələb edir.
create or replace function public._library_access(p_user uuid, p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.library_items i
    where i.id = p_item and (
      i.free
      or (i.kind = 'text' and public._free_access())
      or public.is_staff(p_user)
      or exists (select 1 from public.enrollments e where e.student_id = p_user and e.subject_id = i.subject_id and e.access_until > now())))
$$;
