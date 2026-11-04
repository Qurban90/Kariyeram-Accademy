-- Miqyas təməli: çatışmayan indekslər, məlumat saxlama siyasəti (avtomatik təmizləmə), tətbiq konfiqurasiyası
-- (minimum versiya və texniki iş rejimi). Bax: docs/adr/0007-scale-foundation.md

-- ============ 1. İndekslər ============
-- İstifadəçiyə istinad edən xarici açarlar: hesab silinəndə (kaskad / set null) və admin dayandırmasında
-- bu cədvəllər tam skan olunmasın. Böyüyən cədvəllərdə (chat, iştirakçılar) bu, saniyələr ilə milisaniyələr fərqidir.
create index if not exists live_chat_user on public.live_chat (user_id);
create index if not exists live_participants_user on public.live_participants (user_id) where left_at is null;
create index if not exists live_participants_user_all on public.live_participants (user_id);
create index if not exists live_hands_user on public.live_hands (user_id);
create index if not exists live_hands_session on public.live_hands (session_id, raised_at);
create index if not exists live_events_session on public.live_events (session_id);
create index if not exists live_events_received on public.live_events (received_at);
create index if not exists live_invites_user on public.live_invites (user_id);
create index if not exists live_sessions_host on public.live_sessions (host_id, starts_at desc);
create index if not exists diary_created_by on public.diary_entries (created_by);
create index if not exists access_codes_created_by on public.access_codes (created_by, created_at desc);
create index if not exists access_codes_redeemed_by on public.access_codes (redeemed_by);
create index if not exists questions_topic_all on public.questions (topic_id, status);
create index if not exists questions_author on public.questions (author_id);
create index if not exists question_views_question on public.question_views (question_id);
create index if not exists question_views_at on public.question_views (viewed_at);
create index if not exists srs_cards_question on public.srs_cards (question_id);
create index if not exists library_items_topic on public.library_items (topic_id);
create index if not exists library_items_created_by on public.library_items (created_by);
create index if not exists test_sessions_active on public.test_sessions (started_at) where state = 'active';

-- ============ 2. Saxlama siyasəti ============
-- Qayda (docs/SECURITY.md "Məlumatların saxlanması"):
--   * question_views: 35 gün (gündəlik limit və sürət yoxlaması üçün kifayətdir)
--   * 7 gündən köhnə yarımçıq test → abandoned (nəticəyə təsir etmir, kursor silinmir)
--   * live_events (webhook təkrar qoruması): 30 gün
--   * live_chat: dərs bitəndən 90 gün sonra
--   * audit_events: klient siqnalları 180 gün, qalanı 400 gün (bir illik təhlükəsizlik araşdırması üçün)
-- Silmə hissə-hissə (hər addımda ən çox p_batch sətir) aparılır ki, uzun kilid və böyük WAL yaranmasın.
create or replace function public.maintenance_cleanup(p_batch int default 20000) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_views int := 0; v_events int := 0; v_chat int := 0; v_audit int := 0; v_abandoned int := 0; n int;
begin
  update public.test_sessions set state = 'abandoned'
   where state = 'active' and started_at < now() - interval '7 days';
  get diagnostics v_abandoned = row_count;

  loop
    delete from public.question_views where ctid = any (array(
      select ctid from public.question_views where viewed_at < now() - interval '35 days' limit p_batch));
    get diagnostics n = row_count; v_views := v_views + n; exit when n < p_batch;
  end loop;

  loop
    delete from public.live_events where ctid = any (array(
      select ctid from public.live_events where received_at < now() - interval '30 days' limit p_batch));
    get diagnostics n = row_count; v_events := v_events + n; exit when n < p_batch;
  end loop;

  loop
    delete from public.live_chat where ctid = any (array(
      select c.ctid from public.live_chat c join public.live_sessions s on s.id = c.session_id
       where s.state in ('ended', 'cancelled') and s.ends_at < now() - interval '90 days' limit p_batch));
    get diagnostics n = row_count; v_chat := v_chat + n; exit when n < p_batch;
  end loop;

  loop
    delete from public.audit_events where ctid = any (array(
      select ctid from public.audit_events
       where (kind like 'client\_%' and at < now() - interval '180 days') or at < now() - interval '400 days'
       limit p_batch));
    get diagnostics n = row_count; v_audit := v_audit + n; exit when n < p_batch;
  end loop;

  return jsonb_build_object('abandoned', v_abandoned, 'question_views', v_views, 'live_events', v_events, 'live_chat', v_chat, 'audit_events', v_audit);
end $$;
revoke execute on function public.maintenance_cleanup(int) from public, anon, authenticated;
grant execute on function public.maintenance_cleanup(int) to service_role;

-- Gündəlik plan (Bakı vaxtı ilə 04:17 = UTC 00:17). pg_cron olmayan mühitdə (lokal test klasteri) addım ötürülür.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'karyeram-cleanup';
    perform cron.schedule('karyeram-cleanup', '17 0 * * *', 'select public.maintenance_cleanup()');
  end if;
end $$;

-- ============ 3. Tətbiq konfiqurasiyası ============
-- Tək sətirli cədvəl. Klient girişdən əvvəl də oxuyur (anon): köhnə versiya "yeniləyin" ekranı, texniki iş rejimi.
-- Server də hər API sorğusunda yoxlayır (Edge Function, qısa keşlə), ona görə klienti yan keçmək mümkün deyil.
create table if not exists public.app_config (
  id boolean primary key default true check (id),
  min_version text not null default '0.0.0' check (min_version ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$'),
  maintenance boolean not null default false,
  message text check (length(message) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.app_config (id) values (true) on conflict do nothing;
alter table public.app_config enable row level security;
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config for select to anon, authenticated using (true);
revoke insert, update, delete on public.app_config from anon, authenticated;

create or replace function public.admin_set_config(p_admin uuid, p_min_version text, p_maintenance boolean, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_old public.app_config;
begin
  if not public.is_admin(p_admin) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_min_version is not null and p_min_version !~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$' then return jsonb_build_object('error', 'bad_version'); end if;
  if length(coalesce(p_message, '')) > 500 then return jsonb_build_object('error', 'bad_message'); end if;
  select * into v_old from public.app_config where id for update;
  update public.app_config set
    min_version = coalesce(p_min_version, min_version),
    maintenance = coalesce(p_maintenance, maintenance),
    message = case when p_message is null then message else nullif(trim(p_message), '') end,
    updated_at = now(), updated_by = p_admin
  where id;
  insert into public.audit_events (student_id, kind, detail) values (p_admin, 'admin_config', jsonb_build_object(
    'by', p_admin, 'from', jsonb_build_object('min_version', v_old.min_version, 'maintenance', v_old.maintenance),
    'to', jsonb_build_object('min_version', coalesce(p_min_version, v_old.min_version), 'maintenance', coalesce(p_maintenance, v_old.maintenance))));
  return (select jsonb_build_object('min_version', min_version, 'maintenance', maintenance, 'message', message) from public.app_config where id);
end $$;
revoke execute on function public.admin_set_config(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_set_config(uuid, text, boolean, text) to service_role;
