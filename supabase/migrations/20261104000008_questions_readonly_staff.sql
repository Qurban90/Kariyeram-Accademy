-- Müəllim/admin sual cədvəlinə REST ilə birbaşa YAZA bilirdi (audit-dən yan keçmək, cavab açarını iz qoymadan dəyişmək).
-- İndi klientdən yalnız oxuma; status dəyişikliyi staff_set_question_status (audit), yükləmə idxal aləti ilə.
drop policy if exists questions_staff on public.questions;
create policy questions_staff_read on public.questions for select to authenticated using (public.is_staff(auth.uid()));
revoke insert, update, delete on public.questions from anon, authenticated;
