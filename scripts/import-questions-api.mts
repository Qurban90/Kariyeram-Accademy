// Sual idxalı Supabase Management API ilə (HTTPS): birbaşa baza bağlantısı (psql) olmayan mühit üçün.
// import-questions.mts ilə eyni validasiya. Token SUPABASE_ACCESS_TOKEN-dən oxunur və çap olunmur.
//   node scripts/import-questions-api.mts <fayl.csv> <project-ref> [--status published|review] [--free]
// --free: yeni yaranan mövzular pulsuz (abunəsiz açıq) olur. Proksi arxasında: NODE_USE_ENV_PROXY=1.
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseCsv, validateRows } from '../packages/core/src/importQuestions.ts'

const [file, ref, ...rest] = process.argv.slice(2)
const status = rest.includes('--status') ? rest[rest.indexOf('--status') + 1] : 'review'
const free = rest.includes('--free')
const token = process.env.SUPABASE_ACCESS_TOKEN ?? 'sbp_placeholder'
const res = validateRows(parseCsv(readFileSync(file!, 'utf8')))
if (res.errors.length) { for (const e of res.errors) console.log(`XƏTA sətir ${e.row}: ${e.message}`); process.exit(1) }
const json = JSON.stringify(res.questions.map((q) => ({
  subject: q.subject, topic: q.topic, stem: q.stem, options: q.options, answer_index: q.answerIndex,
  explanation: q.explanation, option_explanations: q.optionExplanations, level: q.level, trap: q.trap, law_ref: q.lawRef,
})))
const tag = `$j${randomBytes(6).toString('hex')}$`
const query = `
with imp as (
  select * from jsonb_to_recordset(${tag}${json}${tag}::jsonb) as x(
    subject text, topic text, stem text, options jsonb, answer_index int, explanation text,
    option_explanations jsonb, level int, trap boolean, law_ref text)
), bad as (
  select string_agg(distinct subject, ', ') as s from imp i where not exists (select 1 from public.subjects s where s.id = i.subject)
), t_ins as (
  insert into public.topics (subject_id, name, sort${free ? ', free' : ''})
  select distinct subject, topic, 100${free ? ', true' : ''} from imp where (select s from bad) is null
  on conflict (subject_id, name) do nothing returning id, subject_id, name
), t_all as (
  select id, subject_id, name from t_ins union select id, subject_id, name from public.topics
), ins as (
  insert into public.questions (topic_id, stem, options, answer_index, option_explanations, explanation, level, trap, law_ref, status)
  select t.id, i.stem, i.options, i.answer_index, i.option_explanations, i.explanation, i.level, i.trap, i.law_ref, '${status}'::public.question_status
  from imp i join t_all t on t.subject_id = i.subject and t.name = i.topic
  where (select s from bad) is null
    and not exists (select 1 from public.questions q where q.topic_id = t.id and lower(q.stem) = lower(i.stem))
  returning 1)
select (select s from bad) as namelum_fenn, (select count(*) from imp) as fayldaki, (select count(*) from ins) as yazildi;`
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
})
console.log(`HTTP ${r.status}`, (await r.text()).slice(0, 500))
