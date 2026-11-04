/**
 * Lokal yük testi (PERF-001/002 üçün ilkin ölçmə). İstehsal göstəricisi DEYİL: hamısı bir maşında, Docker-də.
 *   VUS=20 QUESTIONS=20 node tests/load/load.mjs
 * Hər virtual tələbə: admin API ilə yaradılır → parol ilə token (yalnız test üçün) → razılıq → cihaz →
 * test (QUESTIONS sual: next + answer) → finish. Hər marşrut üçün gecikmə faizilləri çıxarılır.
 */
import { execFileSync } from 'node:child_process'

const env = Object.fromEntries(execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
  .split('\n').map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]))
const API = env.API_URL, ANON = env.ANON_KEY, SERVICE = env.SERVICE_ROLE_KEY, DB = env.DB_URL
const VUS = Number(process.env.VUS ?? 20), QUESTIONS = Number(process.env.QUESTIONS ?? 20), SUBJECT = 'load-test'
const PREFIX = 'load-'

const lat = {}
const errors = {}
async function timed(name, fn) {
  const t = performance.now()
  try { return await fn() } finally { (lat[name] ??= []).push(performance.now() - t) }
}
// Tətbiqin təkrar siyasətinin eynisi (apps/app/src/lib/api.ts): istifadəçinin gördüyü xətanı ölçmək üçün.
const RETRY_ONCE = new Set(['answer', 'session/start'])
const IDEMPOTENT = new Set(['question/next', 'session/finish', 'session/review', 'account/consent', 'device/claim'])
let retries = 0
const is5xx = (e) => /:(5\d\d|internal)$/.test(String(e.message))
async function api(token, route, body) {
  const attempts = IDEMPOTENT.has(route) ? 3 : RETRY_ONCE.has(route) ? 2 : 1
  for (let i = 0; ; i++) {
    try { return await api1(token, route, body) } catch (e) {
      if (route === 'answer' && i > 0 && String(e.message).includes('out_of_order')) return { accepted: true }
      if (i >= attempts - 1 || !is5xx(e)) throw e
      retries++
      await new Promise((r) => setTimeout(r, 400 * 2 ** i))
    }
  }
}
async function api1(token, route, body) {
  return timed(route, async () => {
    const r = await fetch(`${API}/functions/v1/api/${route}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { const k = `${route}:${j.error ?? r.status}`; errors[k] = (errors[k] ?? 0) + 1; throw new Error(k) }
    return j
  })
}
const q = (s) => execFileSync('psql', [DB, '-At', '-c', s], { encoding: 'utf8' }).trim()

// Müvəqqəti fənn: 1 pulsuz mövzu, 100 sintetik sual (sonda silinir)
function setup() {
  q(`insert into public.subjects (id, name) values ('${SUBJECT}', 'Yük testi') on conflict do nothing`)
  q(`insert into public.topics (subject_id, name, free) values ('${SUBJECT}', 'Yük mövzusu', true) on conflict do nothing`)
  q(`insert into public.questions (topic_id, stem, options, answer_index, option_explanations, explanation, status)
     select t.id, 'Yük sualı ' || g, '["a","b","c","d"]', g % 4, '["x","y","z","w"]', 'izah', 'published'
     from public.topics t, generate_series(1, 100) g where t.subject_id = '${SUBJECT}' and not exists (select 1 from public.questions x where x.topic_id = t.id)`)
}
function teardown() {
  q(`delete from auth.users where email like '${PREFIX}%@karyeram.test'`)
  q(`delete from public.questions where topic_id in (select id from public.topics where subject_id = '${SUBJECT}')`)
  q(`delete from public.subjects where id = '${SUBJECT}'`)
}

async function user(i) {
  const email = `${PREFIX}${i}-${Date.now()}@karyeram.test`, password = `Load-${i}-${Math.random().toString(36).slice(2)}`
  const c = await fetch(`${API}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: `Yük ${i}` } }) })
  if (!c.ok) throw new Error(`admin create ${c.status}`)
  const t = await (await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
  return t.access_token
}

async function vu(i) {
  const token = await user(i)
  const device = `load-device-${i}-abcdef`
  await api(token, 'account/consent', { docs: ['terms', 'privacy', 'age18'] })
  await api(token, 'device/claim', { device })
  const topics = q(`select string_agg(id::text, ',') from public.topics where subject_id = '${SUBJECT}' and free`).split(',').filter(Boolean)
  const s = await api(token, 'session/start', { device, subject: SUBJECT, mode: 'topic', topicIds: topics, size: QUESTIONS >= 50 ? 50 : QUESTIONS >= 30 ? 30 : QUESTIONS >= 20 ? 20 : 10 })
  let answered = 0
  while (answered < QUESTIONS) {
    const nq = await api(token, 'question/next', { device, session: s.session_id })
    if (nq.done) break
    await api(token, 'answer', { device, session: s.session_id, question: nq.question_id, chosen: answered % nq.options.length, ms: 4000 + (answered % 7) * 300, chars: 120 })
    answered++
  }
  await api(token, 'session/finish', { session: s.session_id })
  return answered
}

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] }
setup()
const t0 = performance.now()
const results = await Promise.allSettled(Array.from({ length: VUS }, (_, i) => vu(i)))
const wall = (performance.now() - t0) / 1000
const ok = results.filter((r) => r.status === 'fulfilled')
const total = Object.values(lat).reduce((a, x) => a + x.length, 0)
console.log(`VUS=${VUS}, uğurlu axın: ${ok.length}/${VUS}, sorğu: ${total}, müddət: ${wall.toFixed(1)} san, ötürmə: ${(total / wall).toFixed(1)} sorğu/san`)
console.log('marşrut'.padEnd(18), 'n'.padStart(5), 'p50'.padStart(7), 'p95'.padStart(7), 'p99'.padStart(7), 'max'.padStart(7), '(ms)')
for (const [k, v] of Object.entries(lat)) console.log(k.padEnd(18), String(v.length).padStart(5), ...[50, 95, 99].map((p) => pct(v, p).toFixed(0).padStart(7)), Math.max(...v).toFixed(0).padStart(7))
if (Object.keys(errors).length) console.log('Server xətaları (klient təkrarından əvvəl):', errors, 'təkrar:', retries)
for (const r of results) if (r.status === 'rejected') { console.log('İlk uğursuz axın:', String(r.reason).slice(0, 200)); break }
teardown()
