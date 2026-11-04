/**
 * Sual idxalı: CSV → questions. Yalnız müəllim/admin kompüterində, birbaşa DB bağlantısı ilə işlədilir
 * (DB URL sirdir, repoya yazılmır). Node 22.18+ (TypeScript birbaşa işləyir).
 *
 *   node scripts/import-questions.mts sual.csv --db "$DATABASE_URL" [--dry-run] [--status review|published]
 *
 * Qaydalar: fənn əvvəlcədən mövcud olmalıdır; mövzu yoxdursa yaradılır; eyni mövzuda eyni mətnli sual təkrar yazılmır.
 * Defolt status "review": tələbələr görmür, müəllim yoxlayıb dərc etməlidir (FR-062).
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseCsv, validateRows } from '../packages/core/src/importQuestions.ts'

const args = process.argv.slice(2)
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const file = args.find((a, i) => !a.startsWith('--') && !['--db', '--status'].includes(args[i - 1] ?? ''))
const db = flag('--db') ?? process.env.DATABASE_URL
const status = flag('--status') ?? 'review'
const dry = args.includes('--dry-run')

if (!file) { console.error('İstifadə: node scripts/import-questions.mts <fayl.csv> --db <url> [--dry-run] [--status review|published]'); process.exit(2) }
if (!['draft', 'review', 'published'].includes(status)) { console.error('status: draft | review | published'); process.exit(2) }

const res = validateRows(parseCsv(readFileSync(file, 'utf8')))
for (const e of res.errors) console.log(`XƏTA     sətir ${e.row}: ${e.message}`)
for (const w of res.warnings) console.log(`DİQQƏT   sətir ${w.row}: ${w.message}`)
console.log(`\nDüzgün sual: ${res.questions.length}, xətalı sətir: ${new Set(res.errors.map((e) => e.row)).size}, xəbərdarlıq: ${res.warnings.length}`)
if (res.errors.length) { console.log('Xətalar düzəldilməyincə heç nə yazılmır.'); process.exit(1) }
if (dry) { console.log('--dry-run: bazaya yazılmadı.'); process.exit(0) }
if (!db) { console.error('--db və ya DATABASE_URL lazımdır'); process.exit(2) }

const json = JSON.stringify(res.questions.map((q) => ({
  subject: q.subject, topic: q.topic, stem: q.stem, options: q.options, answer_index: q.answerIndex,
  explanation: q.explanation, option_explanations: q.optionExplanations, level: q.level, trap: q.trap, law_ref: q.lawRef,
})))
// Dollar-quote teqi təsadüfidir: məzmun SQL-i qıra bilməz.
const tag = `$j${randomBytes(6).toString('hex')}$`
const sql = `
begin;
create temp table _imp on commit drop as
  select * from jsonb_to_recordset(${tag}${json}${tag}::jsonb) as x(
    subject text, topic text, stem text, options jsonb, answer_index int, explanation text,
    option_explanations jsonb, level int, trap boolean, law_ref text);
do $chk$ begin
  if exists (select 1 from _imp i where not exists (select 1 from public.subjects s where s.id = i.subject)) then
    raise exception 'Naməlum fənn kodu: %', (select string_agg(distinct subject, ', ') from _imp i where not exists (select 1 from public.subjects s where s.id = i.subject));
  end if;
end $chk$;
insert into public.topics (subject_id, name, sort)
  select distinct subject, topic, 100 from _imp on conflict (subject_id, name) do nothing;
with ins as (
  insert into public.questions (topic_id, stem, options, answer_index, option_explanations, explanation, level, trap, law_ref, status)
  select t.id, i.stem, i.options, i.answer_index, i.option_explanations, i.explanation, i.level, i.trap, i.law_ref, '${status}'::public.question_status
  from _imp i join public.topics t on t.subject_id = i.subject and t.name = i.topic
  where not exists (select 1 from public.questions q where q.topic_id = t.id and lower(q.stem) = lower(i.stem))
  returning 1)
select 'yazıldı=' || (select count(*) from ins) || ' təkrar(atlandı)=' || ((select count(*) from _imp) - (select count(*) from ins));
commit;
`
const out = execFileSync('psql', [db, '-At', '-v', 'ON_ERROR_STOP=1', '-q'], { input: sql, encoding: 'utf8' })
console.log(out.trim())
