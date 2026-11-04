-- finish_session idempotentdir, amma təkrar çağırışda Edge API imtahan kartlarını (FSRS) ikinci dəfə yeniləyirdi.
-- İndi təkrar çağırış 'already': true qaytarır və handler kartlara toxunmur.
create or replace function public.finish_session(p_student uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.test_sessions; v_total int; v_correct int; v_wrong int; v_by jsonb; v_res jsonb; v_subject text;
begin
  select * into s from public.test_sessions where id = p_session for update;
  if not found or s.student_id <> p_student then return jsonb_build_object('error', 'not_found'); end if;
  if s.state = 'finished' then return s.result || jsonb_build_object('already', true); end if;
  v_total := cardinality(s.question_ids);
  select count(*) filter (where a.correct), count(*) filter (where a.chosen is not null and not a.correct)
    into v_correct, v_wrong
  from public.answers a where a.session_id = p_session;
  select coalesce(jsonb_object_agg(x.topic_id, jsonb_build_object(
           'name', x.name, 'total', x.total, 'correct', x.correct, 'wrong', x.wrong, 'blank', x.total - x.correct - x.wrong)), '{}'::jsonb)
    into v_by
  from (
    select t.id::text as topic_id, t.name, count(*) as total,
           count(*) filter (where a.correct) as correct,
           count(*) filter (where a.chosen is not null and not a.correct) as wrong
    from unnest(s.question_ids) as u (qid)
    join public.questions q on q.id = u.qid
    join public.topics t on t.id = q.topic_id
    left join public.answers a on a.session_id = p_session and a.question_id = u.qid
    group by t.id, t.name
  ) x;
  v_res := jsonb_build_object(
    'total', v_total, 'correct', v_correct, 'wrong', v_wrong, 'blank', v_total - v_correct - v_wrong,
    'percent', round(100.0 * v_correct / v_total, 1), 'by_topic', v_by, 'mode', s.mode);
  update public.test_sessions set state = 'finished', finished_at = now(), result = v_res where id = p_session;
  select name into v_subject from public.subjects where id = s.subject_id;
  insert into public.diary_entries (student_id, kind, title, payload)
  values (p_student, 'test',
          v_subject || ' · ' || case s.mode when 'exam' then 'Sınaq' when 'mistakes' then 'Səhvlərim' when 'mixed' then 'Qarışıq test' else 'Mövzu testi' end,
          v_res || jsonb_build_object('session_id', p_session));
  return v_res;
end $$;
