-- İSTEHSAL ÜÇÜN ƏSAS MƏLUMAT (idempotent): fənlər və məkanlar. Sual və konspekt burada YOXDUR:
-- real məzmun repoya yazılmır, bazaya ayrıca idxal olunur (bax docs/DEPLOYMENT.md).
insert into public.subjects (id, name, sort) values
  ('az-dili', 'Azərbaycan dili', 1),
  ('qanun', 'Qanunvericilik', 2),
  ('informatika', 'İnformatika', 3),
  ('mentiq', 'Məntiq', 4),
  ('dunyagorusu', 'Dünyagörüşü', 5)
on conflict (id) do nothing;

insert into public.venues (kind, name, subject_id, capacity, door_label, sort)
select v.kind::public.venue_kind, v.name, v.subject_id, v.capacity, v.door, v.sort
from (values
  ('classroom', 'Azərbaycan dili sinfi', 'az-dili', 30, '101', 1),
  ('classroom', 'Qanunvericilik sinfi', 'qanun', 30, '102', 2),
  ('classroom', 'İnformatika sinfi', 'informatika', 30, '103', 3),
  ('classroom', 'Məntiq sinfi', 'mentiq', 30, '104', 4),
  ('classroom', 'Dünyagörüşü sinfi', 'dunyagorusu', 30, '105', 5),
  ('hall', 'Oxu zalı', null, 120, 'Zal', 10)
) as v (kind, name, subject_id, capacity, door, sort)
where not exists (select 1 from public.venues x where x.name = v.name);
