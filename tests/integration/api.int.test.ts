/**
 * End-to-end: real GoTrue (telefon + e-poçt OTP), PostgREST/RLS, Edge Function `api`, LiveKit dev server.
 * İşə salma: tests/integration/run.sh
 */
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { signHS256 } from '../../supabase/functions/_shared/jwt.ts'
import { totp } from '../util/totp.mjs'

const URL_ = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const DB = process.env.SUPABASE_DB_URL!
const MAILPIT = process.env.MAILPIT!
const LK = process.env.LIVEKIT_HTTP!
const run = Date.now().toString(36)

function sql(q: string): string {
  return execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-At', '-c', q], { encoding: 'utf8' }).trim().split('\n')[0]!.trim()
}

async function http(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const r = await fetch(`${URL_}${path}`, {
    method: init.method ?? 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await r.text()
  return { status: r.status, json: text ? JSON.parse(text) : null }
}

const api = (token: string, route: string, body: unknown = {}) => http(`/functions/v1/api/${route}`, { token, body })

async function phoneLogin(phone: string, name: string) {
  const o = await http('/auth/v1/otp', { body: { phone, data: { display_name: name } } })
  expect(o.status).toBe(200)
  const v = await http('/auth/v1/verify', { body: { type: 'sms', phone, token: '123456' } })
  expect(v.status, JSON.stringify(v.json)).toBe(200)
  return { token: v.json.access_token as string, id: v.json.user.id as string }
}

async function emailLogin(email: string) {
  const o = await http('/auth/v1/otp', { body: { email, create_user: true } })
  expect(o.status, JSON.stringify(o.json)).toBe(200)
  let code = ''
  for (let i = 0; i < 40 && !code; i++) {
    const s = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json() as { messages: { ID: string }[] }
    if (s.messages?.length) {
      const m = await (await fetch(`${MAILPIT}/api/v1/message/${s.messages[0]!.ID}`)).json() as { Text: string }
      code = /\b(\d{6})\b/.exec(m.Text)?.[1] ?? ''
    }
    if (!code) await new Promise((r) => setTimeout(r, 250))
  }
  expect(code, 'Mailpit-də OTP kodu').toMatch(/^\d{6}$/)
  const v = await http('/auth/v1/verify', { body: { type: 'email', email, token: code } })
  expect(v.status, JSON.stringify(v.json)).toBe(200)
  return { token: v.json.access_token as string, id: v.json.user.id as string }
}

/** TOTP faktoru qoşur və təsdiqləyir (real GoTrue); aal2 tokeni qaytarır. Admin marşrutları bunu tələb edir. */
async function mfaUp(token: string): Promise<{ token: string; factor: string; secret: string }> {
  const f = await http('/auth/v1/factors', { token, body: { factor_type: 'totp', friendly_name: `itest-${randomUUID().slice(0, 8)}` } })
  expect(f.status, JSON.stringify(f.json)).toBe(200)
  const secret = f.json.totp.secret as string
  const c = await http(`/auth/v1/factors/${f.json.id}/challenge`, { token, body: {} })
  const v = await http(`/auth/v1/factors/${f.json.id}/verify`, { token, body: { challenge_id: c.json.id, code: totp(secret) } })
  expect(v.status, JSON.stringify(v.json)).toBe(200)
  return { token: v.json.access_token as string, factor: f.json.id as string, secret }
}

const DOCS = ['terms', 'privacy', 'age18']
const dev = () => `dev-${randomUUID().replace(/-/g, '')}`

beforeAll(() => {
  // İdempotentlik: əvvəlki işdən qalan test istifadəçiləri silinir (kaskad).
  sql(`delete from auth.users where phone like '9945000000%' or email like 'itest-%@karyeram.test'`)
  sql(`insert into public.subjects (id, name) values ('itest', 'İnformatika (test)') on conflict do nothing;
       insert into public.topics (id, subject_id, name, free) values
         ('aaaaaaaa-0000-4000-8000-000000000001', 'itest', 'Excel (pulsuz)', true),
         ('aaaaaaaa-0000-4000-8000-000000000002', 'itest', 'Şəbəkələr', false) on conflict do nothing;
       insert into public.questions (id, topic_id, stem, options, answer_index, option_explanations, explanation, status)
       select md5('itest' || i)::uuid,
              case when i <= 15 then 'aaaaaaaa-0000-4000-8000-000000000001'::uuid else 'aaaaaaaa-0000-4000-8000-000000000002'::uuid end,
              'İnteqrasiya sualı ' || i, '["A","B","C","D"]', i % 4, '["a","b","c","d"]', 'İzah ' || i, 'published'
       from generate_series(1, 30) i on conflict do nothing;`)
})

describe('telefon OTP və qorunan test axını', () => {
  let t = ''
  const device = dev()
  it('telefonla qeydiyyat, profil avtomatik, razılıqsız test bloklanır', async () => {
    const u = await phoneLogin('+994500000001', 'Aysel Test')
    t = u.token
    expect(sql(`select display_name from public.profiles where id = '${u.id}'`)).toBe('Aysel Test')
    expect((await api(t, 'device/claim', { device })).status).toBe(200)
    const s = await api(t, 'session/start', { device, subject: 'itest', mode: 'topic', size: 10 })
    expect(s.status).toBe(403)
    expect(s.json.error).toBe('consent_required')
    const c = await api(t, 'account/consent', { docs: DOCS })
    expect(c.json.onboarded).toBe(true)
  })

  it('10 suallıq test: cavab açarı gəlmir, server yoxlayır, nəticə, icmal, gündəlik', async () => {
    const s = await api(t, 'session/start', { device, subject: 'itest', mode: 'topic', size: 10 })
    expect(s.status, JSON.stringify(s.json)).toBe(200)
    const session = s.json.session_id
    let correct = 0
    for (let i = 0; i < 10; i++) {
      const q = await api(t, 'question/next', { device, session })
      expect(q.status).toBe(200)
      expect(q.json).not.toHaveProperty('answer_index')
      expect(q.json).not.toHaveProperty('correct_display')
      expect(q.json.options).toHaveLength(4)
      const chosen = i % 3 === 0 ? null : i % 4
      const a = await api(t, 'answer', { device, session, question: q.json.question_id, chosen, ms: 9000, chars: 50 })
      expect(a.status, JSON.stringify(a.json)).toBe(200)
      expect(a.json.option_explanations).toHaveLength(4)
      if (a.json.correct) correct++
    }
    const f = await api(t, 'session/finish', { session })
    expect(f.json.total).toBe(10)
    expect(f.json.correct).toBe(correct)
    expect(f.json.blank).toBeGreaterThanOrEqual(4)
    const r = await api(t, 'session/review', { session })
    expect(r.json.items).toHaveLength(10)
    const diary = await http('/rest/v1/diary_entries?select=title,kind', { method: 'GET', token: t })
    expect(diary.json.length).toBeGreaterThanOrEqual(1)
  })

  it('RLS: sual cədvəli boşdur, RPC birbaşa çağırılmır, abunəsiz ödənişli mövzu yoxdur', async () => {
    const q = await http('/rest/v1/questions?select=id,answer_index', { method: 'GET', token: t })
    expect(q.json).toEqual([])
    const rpc = await http('/rest/v1/rpc/next_question', { token: t, body: { p_student: randomUUID(), p_device: device, p_session: randomUUID() } })
    expect([401, 403, 404]).toContain(rpc.status)
    const s = await api(t, 'session/start', { device, subject: 'itest', mode: 'topic', topicIds: ['aaaaaaaa-0000-4000-8000-000000000002'], size: 10 })
    expect(s.status).toBe(404)
  })

  it('yanlış giriş və tokensiz sorğu', async () => {
    expect((await api(t, 'answer', { device, session: 'x' })).status).toBe(400)
    expect((await http('/functions/v1/api/device/claim', { body: { device } })).status).toBe(401)
  })
})

describe('e-poçt OTP, kodla abunə, canlı dərs, ixrac və silmə', () => {
  let student = { token: '', id: '' }
  let teacher = { token: '', id: '' }
  const email = `itest-${run}@karyeram.test`

  it('e-poçtla qeydiyyat (kod Mailpit-dən), müəllimin kodu ilə abunə', async () => {
    student = await emailLogin(email)
    await api(student.token, 'account/consent', { docs: DOCS, displayName: 'Elvin Test' })
    teacher = await phoneLogin('+994500000002', 'Müəllim Test')
    await api(teacher.token, 'account/consent', { docs: DOCS })
    sql(`update public.profiles set role = 'teacher' where id = '${teacher.id}'`)
    const code = sql(`select code from public.create_codes('${teacher.id}', 'itest', 1, 30)`)
    const r = await api(student.token, 'code/redeem', { code })
    expect(r.status, JSON.stringify(r.json)).toBe(200)
    expect(r.json.subject_id).toBe('itest')
    expect((await api(student.token, 'code/redeem', { code: 'ABCD-EFGH-JKLM' })).json.error).toBe('invalid_code')
  })

  it('canlı dərs: müəllim planlaşdırır, tələbə qoşulur, LiveKit tokeni real serverdə keçərlidir', async () => {
    const venue = sql(`insert into public.venues (kind, name, subject_id, owner_id, capacity) values ('classroom', 'Test sinfi', 'itest', '${teacher.id}', 30) returning id`)
    const start = new Date(Date.now() - 60_000).toISOString()
    const end = new Date(Date.now() + 3_600_000).toISOString()
    expect((await api(student.token, 'live/create', { venue, title: 'X', startsAt: start, endsAt: end, access: 'enrolled' })).json.error).toBe('forbidden')
    const c = await api(teacher.token, 'live/create', { venue, title: 'Excel canlı', startsAt: start, endsAt: end, access: 'enrolled' })
    expect(c.status, JSON.stringify(c.json)).toBe(200)
    const session = c.json.session_id
    const host = await api(teacher.token, 'live/join', { session })
    expect(host.json.role).toBe('host')
    const j = await api(student.token, 'live/join', { session })
    expect(j.status, JSON.stringify(j.json)).toBe(200)
    expect(j.json).toMatchObject({ role: 'audience', seat: 1, canPublish: false })
    const v = await fetch(`${LK}/rtc/validate?access_token=${encodeURIComponent(j.json.token)}`)
    expect(v.status, await v.clone().text()).toBe(200)
    const forged = await signHS256({ iss: 'devkey', sub: student.id, video: { room: 'x', roomJoin: true } }, 'yanlış-sirr')
    expect((await fetch(`${LK}/rtc/validate?access_token=${forged}`)).status).not.toBe(200)

    expect((await api(student.token, 'live/hand/raise', { session })).json.position).toBe(1)
    expect((await api(student.token, 'live/hands', { session })).status).toBe(403)
    expect((await api(teacher.token, 'live/hands', { session })).json.hands).toHaveLength(1)
    const g = await api(teacher.token, 'live/role', { session, target: student.id, role: 'speaker' })
    expect(g.status, JSON.stringify(g.json)).toBe(200)
    const st = await api(teacher.token, 'live/settings', { session, onlyHostAudio: true })
    expect(st.json.silenced).toBe(1)
    expect((await api(student.token, 'live/chat', { session, body: 'Müəllim, sualım var' })).status).toBe(200)
    const chat = await http(`/rest/v1/live_chat?session_id=eq.${session}&select=body`, { method: 'GET', token: student.token })
    expect(chat.json).toEqual([{ body: 'Müəllim, sualım var' }])
    expect((await api(teacher.token, 'live/state', { session, state: 'live' })).json.state).toBe('live')
    const ended = await api(teacher.token, 'live/state', { session, state: 'ended' })
    expect(ended.json.state, JSON.stringify(ended.json)).toBe('ended')
    expect((await api(student.token, 'live/join', { session })).json.error).toBe('session_closed')
  })

  it('LiveKit server API bizim admin tokenimizi qəbul edir', async () => {
    const now = Math.floor(Date.now() / 1000)
    const tok = await signHS256({ iss: 'devkey', nbf: now - 5, exp: now + 60, video: { roomList: true } }, 'secret')
    const r = await fetch(`${LK}/twirp/livekit.RoomService/ListRooms`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: '{}' })
    expect(r.status).toBe(200)
  })

  it('ixrac və hesab silmə: sonra token işləmir', async () => {
    const e = await api(student.token, 'account/export')
    expect(e.json.profile.display_name).toBe('Elvin Test')
    expect(JSON.stringify(e.json)).not.toContain('answer_index')
    expect((await api(student.token, 'account/delete', { confirm: 'sil' })).json.error).toBe('confirm_required')
    const d = await api(student.token, 'account/delete', { confirm: 'SİL' })
    expect(d.json.deleted).toBe(true)
    expect(sql(`select count(*) from public.profiles where id = '${student.id}'`)).toBe('0')
    expect((await api(student.token, 'device/claim', { device: dev() })).status).toBe(401)
  })
})

describe('admin: dayandırma real GoTrue qadağası ilə', () => {
  it('admin tələbəni tapır, dayandırır (API dərhal bağlanır, token yenilənmir), sonra bərpa edir', async () => {
    const admin0 = await emailLogin(`itest-admin-${run}@karyeram.test`)
    sql(`update public.profiles set role = 'admin' where id = '${admin0.id}'`)
    const admin = { ...admin0, token: (await mfaUp(admin0.token)).token }
    const o = await http('/auth/v1/otp', { body: { phone: '+994500000003', data: { display_name: 'Dayandırılan Test' } } })
    expect(o.status).toBe(200)
    const v = await http('/auth/v1/verify', { body: { type: 'sms', phone: '+994500000003', token: '123456' } })
    const student = { token: v.json.access_token as string, id: v.json.user.id as string, refresh: v.json.refresh_token as string }
    const no = sql(`select student_no from public.profiles where id = '${student.id}'`)

    // Tələbə: MFA qapısı (aal1) DB yoxlamasından əvvəl bloklayır; hər iki halda 403.
    expect((await api(student.token, 'admin/users/find', { query: no })).status).toBe(403)
    const f = await api(admin.token, 'admin/users/find', { query: no })
    expect(f.status, JSON.stringify(f.json)).toBe(200)
    expect(f.json.users.map((u: { id: string }) => u.id)).toContain(student.id)
    expect(JSON.stringify(f.json)).not.toContain('500000003')

    const s = await api(admin.token, 'admin/users/suspend', { user: student.id, hours: 2, reason: 'İnteqrasiya testi' })
    expect(s.json, JSON.stringify(s.json)).toMatchObject({ ok: true, authBan: true })
    expect(sql(`select banned_until > now() from auth.users where id = '${student.id}'`)).toBe('t')
    // GoTrue qadağan olunmuş istifadəçinin köhnə access tokenini də dərhal rədd edir: API bağlıdır (müddətin bitməsini gözləmir).
    expect((await api(student.token, 'device/claim', { device: dev() })).status).toBe(401)
    // Test nömrəsinin sabit kodu (auth.sms.test_otp); yeni OTP istəmirik, çünki 60 saniyəlik təkrar göndərmə limiti var.
    const signIn = await http('/auth/v1/verify', { body: { type: 'sms', phone: '+994500000003', token: '123456' } })
    expect(signIn.json.error_code, 'qadağan olunmuş hesab yenidən daxil ola bilmir').toBe('user_banned')
    const rf = await http('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: student.refresh } })
    expect(rf.status, 'qadağan olunmuş hesab tokeni yeniləyə bilmir').toBeGreaterThanOrEqual(400)

    const audit = await api(admin.token, 'admin/audit', { user: student.id })
    expect(audit.json.events[0]).toMatchObject({ kind: 'admin_suspended' })

    const u = await api(admin.token, 'admin/users/unsuspend', { user: student.id })
    expect(u.json).toMatchObject({ ok: true, authBan: true })
    expect(sql(`select coalesce(banned_until < now(), true) from auth.users where id = '${student.id}'`)).toBe('t')
    expect((await api(student.token, 'device/claim', { device: dev() })).status).toBe(200)
  })
})

describe('texniki iş rejimi və minimum versiya (server tərəfində)', () => {
  it('admin texniki işi açır → tələbə 503, admin və ixrac işləyir; minimum versiya → köhnə klient 426', async () => {
    const admin0 = await emailLogin(`itest-cfg-${run}@karyeram.test`)
    sql(`update public.profiles set role = 'admin' where id = '${admin0.id}'`)
    const admin = { ...admin0, token: (await mfaUp(admin0.token)).token }
    const student = await emailLogin(`itest-cfgs-${run}@karyeram.test`)
    const wait = () => new Promise((r) => setTimeout(r, 1300)) // APP_CONFIG_TTL_MS=1000 (lokal)
    try {
      expect((await api(student.token, 'admin/config', { maintenance: true })).status).toBe(403)
      const on = await api(admin.token, 'admin/config', { maintenance: true, message: 'Saat 03:00-a qədər' })
      expect(on.json, JSON.stringify(on.json)).toMatchObject({ maintenance: true })
      await wait()
      const blocked = await api(student.token, 'device/claim', { device: dev() })
      expect(blocked.status).toBe(503)
      expect(blocked.json).toMatchObject({ error: 'maintenance', message: 'Saat 03:00-a qədər' })
      expect((await api(student.token, 'account/export')).status).toBe(200)
      expect((await api(admin.token, 'admin/audit', { kind: 'admin_config' })).json.events.length).toBeGreaterThan(0)
      // Anon (girişdən əvvəl) da görür: klient "texniki iş" ekranını göstərir.
      const pub = await http('/rest/v1/app_config?select=maintenance', { method: 'GET' })
      expect(pub.json).toEqual([{ maintenance: true }])

      await api(admin.token, 'admin/config', { maintenance: false, minVersion: '9.0.0', message: '' })
      await wait()
      const old = await api(student.token, 'device/claim', { device: dev() })
      expect(old.status).toBe(426)
      expect(old.json.error).toBe('upgrade_required')
      const r = await fetch(`${URL_}/functions/v1/api/device/claim`, {
        method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json', authorization: `Bearer ${student.token}`, 'x-app-version': '9.0.0' },
        body: JSON.stringify({ device: dev() }),
      })
      expect(r.status).toBe(200)
    } finally {
      sql(`update public.app_config set maintenance = false, min_version = '0.0.0', message = null`)
      await wait()
    }
  })
})

describe('müəllim/admin iki mərhələli qoruma (real GoTrue TOTP)', () => {
  it('admin aal1 ilə bloklanır; TOTP-dan sonra aal2 işləyir; MFA qoşmuş müəllim sual bankını aal1 ilə görmür', async () => {
    const t0 = await emailLogin(`itest-mfa-${run}@karyeram.test`)
    sql(`update public.profiles set role = 'admin' where id = '${t0.id}'`)
    const consent = await api(t0.token, 'account/consent', { docs: DOCS, displayName: 'MFA Admin' })
    expect(consent.status, JSON.stringify(consent.json)).toBe(200)
    const denied = await api(t0.token, 'admin/audit', {})
    expect(denied.status).toBe(403)
    expect(denied.json.error).toBe('mfa_required')
    // Müəllim marşrutu: MFA qoşulmayıb və məcburi deyil → aal1 kifayətdir.
    expect((await api(t0.token, 'staff/codes/list', {})).status).toBe(200)
    const before = await http('/rest/v1/questions?select=id&limit=1', { method: 'GET', token: t0.token })
    expect(before.json.length).toBe(1)

    const up = await mfaUp(t0.token)
    expect((await api(up.token, 'admin/audit', {})).status).toBe(200)
    // Köhnə aal1 token: MFA artıq qoşulub → müəllim marşrutları və sual bankı bağlı.
    expect((await api(t0.token, 'staff/codes/list', {})).json.error).toBe('mfa_required')
    const after = await http('/rest/v1/questions?select=id&limit=1', { method: 'GET', token: t0.token })
    expect(after.json).toEqual([])
    const withAal2 = await http('/rest/v1/questions?select=id&limit=1', { method: 'GET', token: up.token })
    expect(withAal2.json.length).toBe(1)
    // Yanlış kod qəbul olunmur.
    const c = await http(`/auth/v1/factors/${up.factor}/challenge`, { token: up.token, body: {} })
    const bad = await http(`/auth/v1/factors/${up.factor}/verify`, { token: up.token, body: { challenge_id: c.json.id, code: totp(up.secret) === '000000' ? '111111' : '000000' } })
    expect(bad.status).toBeGreaterThanOrEqual(400)
  })
})
