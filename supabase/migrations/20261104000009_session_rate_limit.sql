-- create_session: saatlıq limit (DB-ni boş sessiyalarla doldurmağın qarşısı).
create or replace function public.create_session(
  p_student uuid, p_device text, p_mode public.session_mode, p_subject text,
  p_question_ids uuid[], p_seed bigint, p_time_limit_s int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_err text; v_ok int; v_id uuid; n int := coalesce(cardinality(p_question_ids), 0);
begin
  v_err := public._guard(p_student, p_device);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if n = 0 or n > 200 then return jsonb_build_object('error', 'bad_size'); end if;
  -- Spam qarşısı: saatda ən çox 60 test sessiyası (normal istifadə bunun çox altındadır).
  if (select count(*) from public.test_sessions where student_id = p_student and started_at > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  if (select count(distinct x) from unnest(p_question_ids) as u (x)) <> n then return jsonb_build_object('error', 'duplicate_questions'); end if;
  select count(*) into v_ok from public.candidates(p_student, p_subject, null) c where c.id = any (p_question_ids);
  if v_ok <> n then return jsonb_build_object('error', 'invalid_questions'); end if;
  -- Eyni anda bir aktiv sessiya: paralel köçürməni çətinləşdirir.
  update public.test_sessions set state = 'abandoned' where student_id = p_student and state = 'active';
  insert into public.test_sessions (student_id, mode, subject_id, question_ids, seed, time_limit_s)
  values (p_student, p_mode, p_subject, p_question_ids, p_seed, p_time_limit_s)
  returning id into v_id;
  return jsonb_build_object('session_id', v_id, 'total', n);
end $$;
