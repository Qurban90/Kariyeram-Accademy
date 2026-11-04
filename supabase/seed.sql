-- LOKAL İNKİŞAF ÜÇÜN DEMO MƏZMUN. Real sual bankı deyil və istehsala yüklənmir.
-- Real suallar repoya düşmür (/content/ və seed.private.sql .gitignore-dadır).
-- Bütün demo sualların mətni "[DEMO]" ilə başlayır ki, səhvən real kimi qəbul olunmasın.

insert into public.subjects (id, name, sort) values
  ('az-dili', 'Azərbaycan dili', 1),
  ('qanun', 'Qanunvericilik', 2),
  ('informatika', 'İnformatika', 3)
on conflict (id) do nothing;

insert into public.topics (subject_id, name, sort, free) values
  ('az-dili', 'Fonetika (DEMO)', 1, true), ('az-dili', 'Morfologiya (DEMO)', 2, false),
  ('qanun', 'Konstitusiya: əsaslar (DEMO)', 1, true), ('qanun', 'Dövlət qulluğu (DEMO)', 2, false),
  ('informatika', 'Say sistemləri (DEMO)', 1, true), ('informatika', 'Kompüter qurğuları (DEMO)', 2, false)
on conflict (subject_id, name) do nothing;

create function pg_temp.q(p_subject text, p_topic text, p_stem text, p_opts text[], p_ans int, p_expl text,
                          p_optexpl text[], p_level int default 2, p_trap boolean default false, p_law text default null)
returns void language sql as $$
  insert into public.questions (topic_id, stem, options, answer_index, option_explanations, explanation, level, trap, law_ref, status)
  select t.id, '[DEMO] ' || p_stem, to_jsonb(p_opts), p_ans, to_jsonb(p_optexpl), p_expl, p_level, p_trap, p_law, 'published'
  from public.topics t where t.subject_id = p_subject and t.name = p_topic
    and not exists (select 1 from public.questions x where x.topic_id = t.id and x.stem = '[DEMO] ' || p_stem);
$$;

-- Azərbaycan dili
select pg_temp.q('az-dili', 'Fonetika (DEMO)', 'Azərbaycan dilində neçə sait səs var?', array['7', '9', '12', '32'], 1,
  'Azərbaycan dilində 9 sait var: a, ı, o, u, e, ə, i, ö, ü.',
  array['7 rus dilindəki sait hərflərinin sayı ilə qarışdırılır.', 'Düzdür: a, ı, o, u, e, ə, i, ö, ü.', '12 rəqəmi heç bir bölgüyə uyğun deyil.', '32 əlifbadakı hərflərin sayıdır, saitlərin yox.'], 1);
select pg_temp.q('az-dili', 'Fonetika (DEMO)', 'Hansı sait qalın saitdir?', array['ə', 'i', 'ı', 'ü'], 2,
  'Qalın saitlər: a, ı, o, u.', array['ə incə saitdir.', 'i incə saitdir.', 'Düzdür: ı qalın saitdir.', 'ü incə saitdir.'], 1);
select pg_temp.q('az-dili', 'Fonetika (DEMO)', 'Hansı sözdə ahəng qanunu pozulub?', array['kitab', 'dəftər', 'qələm', 'ana'], 0,
  'Alınma sözlərdə ahəng qanunu çox vaxt pozulur: "kitab" ərəb mənşəlidir (incə i, qalın a).',
  array['Düzdür: i incə, a qalın saitdir.', 'Bütün saitlər incədir.', 'Bütün saitlər incədir.', 'Bütün saitlər qalındır.'], 2, true);
select pg_temp.q('az-dili', 'Fonetika (DEMO)', 'Kar samiti göstərin.', array['b', 'd', 'p', 'z'], 2,
  'p kar samitdir, cingiltili qarşılığı b-dir.', array['b cingiltilidir.', 'd cingiltilidir.', 'Düzdür.', 'z cingiltilidir.'], 1);
select pg_temp.q('az-dili', 'Morfologiya (DEMO)', '"Kitabçı" sözündə hansı şəkilçi var?', array['Sözdüzəldici', 'Sözdəyişdirici', 'Formadüzəldici', 'Şəkilçi yoxdur'], 0,
  '-çı yeni məna (peşə) yaradır, ona görə sözdüzəldicidir.',
  array['Düzdür: yeni söz yaranıb.', 'Sözdəyişdirici sözün mənasını dəyişmir, əlaqə yaradır.', 'Formadüzəldici fel formaları yaradır.', '-çı şəkilçidir.'], 2);
select pg_temp.q('az-dili', 'Morfologiya (DEMO)', 'Hansı söz isimdir?', array['gözəl', 'yazmaq', 'sevinc', 'tez'], 2,
  '"Sevinc" əşya/hadisə adı bildirir, kim? nə? sualına cavab verir.',
  array['Sifətdir.', 'Feldir (məsdər).', 'Düzdür: nə? sualına cavab verir.', 'Zərfdir.'], 1);
select pg_temp.q('az-dili', 'Morfologiya (DEMO)', 'Hansı söz qrammatik cəhətdən təsirlik halındadır?', array['evdə', 'evi', 'evə', 'evdən'], 1,
  'Müəyyən təsirlik hal şəkilçisi -ı, -i, -u, -ü.',
  array['Yerlik hal.', 'Düzdür: təsirlik hal.', 'Yönlük hal.', 'Çıxışlıq hal.'], 2, true);

-- Qanunvericilik
select pg_temp.q('qanun', 'Konstitusiya: əsaslar (DEMO)', 'Azərbaycan Respublikasının Konstitusiyası hansı ildə ümumxalq səsverməsi ilə qəbul edilib?',
  array['1991', '1993', '1995', '1998'], 2, 'Konstitusiya 12 noyabr 1995-ci ildə referendumla qəbul edilib.',
  array['1991 müstəqilliyin bərpası ilidir.', '1993 düzgün deyil.', 'Düzdür: 12 noyabr 1995.', '1998 düzgün deyil.'], 1, false, 'Konstitusiya');
select pg_temp.q('qanun', 'Konstitusiya: əsaslar (DEMO)', 'Azərbaycan Respublikasında dövlət hakimiyyətinin yeganə mənbəyi kimdir?',
  array['Prezident', 'Milli Məclis', 'Xalq', 'Konstitusiya Məhkəməsi'], 2,
  'Konstitusiyaya görə dövlət hakimiyyətinin yeganə mənbəyi xalqdır.',
  array['Prezident icra hakimiyyətini həyata keçirir, mənbə deyil.', 'Qanunvericilik orqanıdır.', 'Düzdür.', 'Məhkəmə hakimiyyəti orqanıdır.'], 1, true, 'Konstitusiya, maddə 1');
select pg_temp.q('qanun', 'Konstitusiya: əsaslar (DEMO)', 'Dövlət hakimiyyəti hansı prinsip əsasında təşkil olunur?',
  array['Hakimiyyətlərin bölünməsi', 'Mərkəzləşmə', 'Partiya rəhbərliyi', 'İrsi idarəetmə'], 0,
  'Dövlət hakimiyyəti qanunvericilik, icra və məhkəmə hakimiyyətlərinin bölünməsi prinsipi əsasında təşkil edilir.',
  array['Düzdür.', 'Konstitusiyada belə prinsip yoxdur.', 'Konstitusiya ideoloji rəhbərliyə yol vermir.', 'Respublika idarəetmə formasıdır.'], 2, false, 'Konstitusiya, maddə 7');
select pg_temp.q('qanun', 'Konstitusiya: əsaslar (DEMO)', 'Azərbaycan Respublikasının dövlət dili hansıdır?',
  array['Azərbaycan dili', 'Türk dili', 'Rus dili', 'İngilis dili'], 0, 'Dövlət dili Azərbaycan dilidir.',
  array['Düzdür.', 'Qohum dildir, dövlət dili deyil.', 'Dövlət dili deyil.', 'Dövlət dili deyil.'], 1, false, 'Konstitusiya, maddə 21');
select pg_temp.q('qanun', 'Dövlət qulluğu (DEMO)', 'Bu demo sual dövlət qulluğu bölməsinin formatını göstərir: düzgün variant hansıdır?',
  array['Birinci variant', 'İkinci variant', 'Düzgün variant', 'Dördüncü variant'], 2, 'Demo izah: real məzmun müəllimdən gələcək.',
  array['Demo.', 'Demo.', 'Demo: düzgün.', 'Demo.'], 2);

-- İnformatika
select pg_temp.q('informatika', 'Say sistemləri (DEMO)', '1 bayt neçə bitdir?', array['4', '8', '16', '1024'], 1, '1 bayt = 8 bit.',
  array['4 bit yarım baytdır (nibble).', 'Düzdür.', '16 bit 2 baytdır.', '1024 bayt 1 KB-dır.'], 1);
select pg_temp.q('informatika', 'Say sistemləri (DEMO)', 'İkilik say sistemində 1010 onluqda neçədir?', array['8', '10', '12', '1010'], 1,
  '1·8 + 0·4 + 1·2 + 0·1 = 10.', array['1000₂ = 8.', 'Düzdür.', '1100₂ = 12.', 'Bu, ikilik yazılışdır, onluq deyil.'], 2, true);
select pg_temp.q('informatika', 'Say sistemləri (DEMO)', 'Onaltılıq say sistemində F rəqəmi onluqda neçədir?', array['14', '15', '16', '6'], 1,
  'A=10, B=11, C=12, D=13, E=14, F=15.', array['E = 14.', 'Düzdür.', '16 onaltılıqda 10-dur.', 'Əlaqəsizdir.'], 1);
select pg_temp.q('informatika', 'Say sistemləri (DEMO)', '1 KB neçə baytdır (ikilik ölçü)?', array['1000', '1024', '512', '8'], 1,
  'İkilik ölçüdə 1 KB = 2¹⁰ = 1024 bayt.', array['Onluq (SI) kilobayt 1000-dir, sual ikilik ölçünü soruşur.', 'Düzdür.', '2⁹.', 'Bit sayı ilə qarışdırılır.'], 2, true);
select pg_temp.q('informatika', 'Kompüter qurğuları (DEMO)', 'Hansı qurğu daxiletmə qurğusudur?', array['Monitor', 'Printer', 'Klaviatura', 'Dinamik'], 2,
  'Klaviatura məlumatı kompüterə daxil edir.', array['Xaricetmə.', 'Xaricetmə.', 'Düzdür.', 'Xaricetmə.'], 1);
select pg_temp.q('informatika', 'Kompüter qurğuları (DEMO)', 'Enerji kəsiləndə hansı yaddaşdakı məlumat itir?', array['ROM', 'RAM', 'SSD', 'Flash'], 1,
  'RAM enerjidən asılıdır (operativ yaddaş).', array['Daimi yaddaşdır.', 'Düzdür.', 'Daimi saxlayır.', 'Daimi saxlayır.'], 2);

-- Məkanlar: hər fənnin sinfi və ümumi oxu zalı
insert into public.venues (kind, name, subject_id, capacity, door_label, sort)
select v.kind::public.venue_kind, v.name, v.subject_id, v.capacity, v.door, v.sort
from (values
  ('classroom', 'Azərbaycan dili sinfi', 'az-dili', 30, '101', 1),
  ('classroom', 'Qanunvericilik sinfi', 'qanun', 30, '102', 2),
  ('classroom', 'İnformatika sinfi', 'informatika', 30, '103', 3),
  ('hall', 'Oxu zalı', null, 120, 'Zal', 10)
) as v (kind, name, subject_id, capacity, door, sort)
where not exists (select 1 from public.venues x where x.name = v.name);
