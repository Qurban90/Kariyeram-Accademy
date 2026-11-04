-- Konspekt şkafı (FR-031). Metadata klientə açıqdır; məzmun (mətn və ya fayl) yalnız icazə yoxlamasından sonra Edge API ilə.
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  title text not null check (length(title) between 1 and 140),
  kind text not null check (kind in ('text', 'pdf')),
  free boolean not null default false,
  storage_path text check (storage_path is null or storage_path ~ '^[a-z0-9-]{1,40}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'),
  bytes int check (bytes is null or bytes between 1 and 26214400),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'pdf') = (storage_path is not null))
);
create index library_items_subject on public.library_items (subject_id, created_at desc);

-- Mətn konspektlərin gövdəsi ayrıca cədvəldə: klient siyasəti yoxdur, yalnız server oxuyur.
create table public.library_bodies (
  item_id uuid primary key references public.library_items (id) on delete cascade,
  body text not null check (length(body) between 1 and 200000)
);

alter table public.library_items enable row level security;
alter table public.library_bodies enable row level security;
create policy library_items_read on public.library_items for select to authenticated using (true);

-- Tələbənin bu materiala girişi varmı (pulsuz və ya aktiv abunə; müəllim/admin həmişə).
create or replace function public._library_access(p_user uuid, p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.library_items i
    where i.id = p_item and (
      i.free
      or public.is_staff(p_user)
      or exists (select 1 from public.enrollments e where e.student_id = p_user and e.subject_id = i.subject_id and e.access_until > now())))
$$;

create or replace function public.library_open(p_user uuid, p_item uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i public.library_items; pr public.profiles;
begin
  select * into pr from public.profiles where id = p_user;
  if not found then return jsonb_build_object('error', 'no_profile'); end if;
  if not public._consented(p_user) then return jsonb_build_object('error', 'consent_required'); end if;
  select * into i from public.library_items where id = p_item;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if not public._library_access(p_user, p_item) then return jsonb_build_object('error', 'forbidden'); end if;
  insert into public.audit_events (student_id, kind, detail) values (p_user, 'library_open', jsonb_build_object('item', p_item));
  return jsonb_build_object('kind', i.kind, 'title', i.title, 'watermark', pr.student_no, 'storage_path', i.storage_path,
    'body', case when i.kind = 'text' then (select body from public.library_bodies where item_id = p_item) end);
end $$;

create or replace function public.staff_library_add(p_staff uuid, p_subject text, p_topic uuid, p_title text, p_kind text,
                                                    p_free boolean, p_body text default null, p_storage_path text default null, p_bytes int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  if not exists (select 1 from public.subjects where id = p_subject) then return jsonb_build_object('error', 'not_found'); end if;
  if p_topic is not null and not exists (select 1 from public.topics where id = p_topic and subject_id = p_subject) then return jsonb_build_object('error', 'bad_topic'); end if;
  if length(trim(coalesce(p_title, ''))) not between 1 and 140 then return jsonb_build_object('error', 'bad_title'); end if;
  if p_kind = 'text' and length(coalesce(p_body, '')) not between 1 and 200000 then return jsonb_build_object('error', 'bad_body'); end if;
  -- Yol yalnız serverin yaratdığı formatda ola bilər: <fənn>/<uuid>.pdf (yol keçidi və başqa fənnin qovluğu olmur).
  if p_kind = 'pdf' and (p_storage_path is null or p_storage_path !~ ('^' || p_subject || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$')) then return jsonb_build_object('error', 'bad_path'); end if;
  if p_kind not in ('text', 'pdf') then return jsonb_build_object('error', 'bad_kind'); end if;
  insert into public.library_items (subject_id, topic_id, title, kind, free, storage_path, bytes, created_by)
  values (p_subject, p_topic, trim(p_title), p_kind, coalesce(p_free, false), case when p_kind = 'pdf' then p_storage_path end, p_bytes, p_staff)
  returning id into v_id;
  if p_kind = 'text' then insert into public.library_bodies (item_id, body) values (v_id, p_body); end if;
  insert into public.audit_events (student_id, kind, detail) values (p_staff, 'library_add', jsonb_build_object('item', v_id));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.staff_library_delete(p_staff uuid, p_item uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  if not public.is_staff(p_staff) then return jsonb_build_object('error', 'forbidden'); end if;
  delete from public.library_items where id = p_item returning storage_path into v_path;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  insert into public.audit_events (student_id, kind, detail) values (p_staff, 'library_delete', jsonb_build_object('item', p_item));
  return jsonb_build_object('ok', true, 'storage_path', v_path);
end $$;

revoke execute on function public._library_access(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.library_open(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.staff_library_add(uuid, text, uuid, text, text, boolean, text, text, int) from public, anon, authenticated;
revoke execute on function public.staff_library_delete(uuid, uuid) from public, anon, authenticated;
grant execute on function public._library_access(uuid, uuid) to service_role;
grant execute on function public.library_open(uuid, uuid) to service_role;
grant execute on function public.staff_library_add(uuid, text, uuid, text, text, boolean, text, text, int) to service_role;
grant execute on function public.staff_library_delete(uuid, uuid) to service_role;

-- Storage: şəxsi "library" bucket-i. Faylı yalnız server (service_role) yazır və oxuyur; klient siyasəti yoxdur.
-- DB testləri adi Postgres-də işlədiyi üçün storage sxemi yoxdursa bu hissə atlanır.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('library', 'library', false, 26214400, array['application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;
