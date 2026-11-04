# ADR 0003: Suallar yalnız serverdən, bir-bir

Status: Qəbul edildi · 2026-11-03

## Kontekst
Sual bankı əsas aktivdir. Klientə bütün bankı və ya cavab açarlarını göndərmək köçürməni asanlaşdırır.

## Qərar
- Tələbə `questions` cədvəlini oxuya bilmir.
- Test serverdə yığılır, suallar `next_question` ilə bir-bir verilir; cavab `submit_answer` ilə serverdə yoxlanır.
- Variant sırası sessiyaya görə qarışdırılır; gündəlik limit, sürət aşkarlama, tək cihaz, bir aktiv sessiya; su nişanı.

## Nəticələr
- Oflayn test mümkün deyil (qəsdən).
- Hər sual üçün şəbəkə sorğusu: gecikmə hiss oluna bilər (PERF-001 ölçülməlidir).
- Tam qoruma yoxdur (ekrandan çəkmək olar); məqsəd çətinləşdirmək və izləməkdir.
