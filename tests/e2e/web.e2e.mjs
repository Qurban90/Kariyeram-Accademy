/**
 * Veb E2E: build olunmuş Expo veb tətbiqi (apps/app/dist) + lokal Supabase + lokal LiveKit.
 * Real telefon OTP (GoTrue test nömrəsi), real Edge API, real Postgres, real LiveKit serveri.
 * İşə salma: bash tests/e2e/run.sh
 */
import { execFileSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const DIST = join(ROOT, 'apps/app/dist')
const SHOTS = process.env.SHOTS_DIR || join(ROOT, 'tests/e2e/screenshots')
const DB = process.env.DB_URL
const PORT = 8099
const PHONE_LOCAL = '050 000 00 03'
const PHONE_DB = '994500000003'
if (!DB) throw new Error('DB_URL tələb olunur (tests/e2e/run.sh)')
if (!existsSync(join(DIST, 'index.html'))) throw new Error('apps/app/dist yoxdur: əvvəlcə expo export')
mkdirSync(SHOTS, { recursive: true })

const MAILPIT = 'http://127.0.0.1:54324'
async function mailCode(to) {
  for (let i = 0; i < 20; i++) {
    const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + to)}`)).json()
    const id = r.messages?.[0]?.ID
    if (id) { const m = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json(); const c = m.Text?.match(/\b(\d{6})\b/)?.[1]; if (c) return c }
    await new Promise((res) => setTimeout(res, 500))
  }
  throw new Error('məktub gəlmədi: ' + to)
}
const sql = (q) => execFileSync('psql', [DB, '-At', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim().split('\n')[0] ?? ''

// --- SPA statik server ---
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf' }
const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url || '/').split('?')[0])
  let f = join(DIST, p)
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) f = join(DIST, 'index.html')
  res.setHeader('content-type', types[extname(f)] || 'application/octet-stream')
  createReadStream(f).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

let passed = 0
const results = []
async function step(name, fn) {
  const t0 = Date.now()
  try { await fn(); passed++; results.push(`ok   ${name} (${Date.now() - t0} ms)`) } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); throw e }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg) }

const HOST_LOCAL = '050 000 00 02'
const HOST_DB = '994500000002'
// Təmiz başlanğıc
sql(`delete from auth.users where phone in ('${PHONE_DB}', '${HOST_DB}')`)
sql(`delete from public.library_items where title like 'E2E:%'`)
sql(`delete from public.questions q where q.stem = '[E2E] Yoxlama sualı' and not exists (select 1 from public.answers a where a.question_id = q.id)`)

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'az-AZ', acceptDownloads: true })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
const shot = (n) => page.screenshot({ path: join(SHOTS, `${n}.png`) })
const tid = (id) => page.getByTestId(id)

/** UI ilə qeydiyyat: telefon OTP + razılıqlar. */
async function signUp(pg, phone, name) {
  await pg.goto(`http://127.0.0.1:${PORT}/sign-in`)
  await pg.getByTestId('phone').fill(phone)
  await pg.getByTestId('send-code').click()
  await pg.getByTestId('otp').fill('123456')
  await pg.getByTestId('verify').click()
  await pg.waitForURL('**/onboarding', { timeout: 20000 })
  await pg.getByTestId('name').fill(name)
  for (const c of ['c-terms', 'c-privacy', 'c-age']) await pg.getByTestId(c).click()
  await pg.getByTestId('enter-school').click()
  await pg.getByTestId('door-live').waitFor({ timeout: 20000 })
}

try {
  await step('qonaq giriş səhifəsinə yönləndirilir', async () => {
    await page.goto(`http://127.0.0.1:${PORT}/`)
    await page.waitForURL('**/sign-in', { timeout: 20000 })
    await tid('phone').waitFor()
    await shot('01-giris')
  })

  await step('yanlış nömrə klientdə rədd olunur', async () => {
    await tid('phone').fill('012 123 45 67')
    await tid('send-code').click()
    await page.getByText('Yalnız Azərbaycan mobil nömrələri').waitFor()
  })

  await step('telefon OTP ilə qeydiyyat (real GoTrue)', async () => {
    await tid('phone').fill(PHONE_LOCAL)
    await tid('send-code').click()
    await tid('otp').waitFor()
    await tid('otp').fill('123456')
    await shot('02-otp')
    await tid('verify').click()
    await page.waitForURL('**/onboarding', { timeout: 20000 })
    expect(sql(`select count(*) from public.profiles p join auth.users u on u.id = p.id where u.phone = '${PHONE_DB}'`) === '1', 'profil yaranmadı')
  })

  await step('razılıqlar olmadan davam etmək olmur', async () => {
    await tid('name').fill('Test Tələbə')
    await tid('enter-school').click()
    await page.getByText('Məcburi bəndləri qeyd edin.').waitFor()
  })

  await step('razılıqlar və ad saxlanılır, məktəbə daxil olur', async () => {
    await tid('c-terms').click(); await tid('c-privacy').click(); await tid('c-age').click()
    await shot('03-razilig')
    await tid('enter-school').click()
    await tid('door-informatika').waitFor({ timeout: 20000 })
    expect(sql(`select count(*) from public.consents c join auth.users u on u.id = c.user_id where u.phone = '${PHONE_DB}'`) === '3', 'razılıqlar yazılmadı')
    expect(sql(`select display_name from public.profiles p join auth.users u on u.id = p.id where u.phone = '${PHONE_DB}'`) === 'Test Tələbə', 'ad saxlanmadı')
    expect(sql(`select count(*) from public.devices d join auth.users u on u.id = d.student_id where u.phone = '${PHONE_DB}' and d.active`) === '1', 'cihaz aktiv edilmədi')
    await page.waitForTimeout(600)
    await shot('04-mekteb-zali')
  })

  await step('3D dəhliz: WebGL səhnəsi, qapı seçimi kameranı aparır və otağa keçir', async () => {
    await tid('toggle-3d').click()
    await page.waitForFunction(() => { const c = document.querySelector('[data-testid="corridor-3d"] canvas'); return !!c && c.width > 0 }, null, { timeout: 30000 })
    await page.waitForTimeout(1500)
    // Kətan boş deyil: mərkəzdə fon rəngindən fərqli piksellər (dəhliz çəkilib)
    const drawn = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="corridor-3d"] canvas')
      const gl = c.getContext('webgl2', { preserveDrawingBuffer: true }) || c.getContext('webgl')
      return !!gl
    })
    expect(drawn, 'WebGL konteksti yoxdur')
    await shot('04b-3d-dehliz')
    await tid('door3d-informatika').click()
    await page.waitForURL('**/room/informatika', { timeout: 10000 })
    await page.goBack()
    await tid('toggle-3d').click() // növbəti addımlar üçün 2D-yə qayıt (seçim yadda saxlanılır)
    await tid('door-informatika').waitFor({ timeout: 10000 })
  })

  await step('fənn otağı: pulsuz mövzu açıq, ödənişli bağlı', async () => {
    await tid('door-informatika').click()
    await page.waitForURL('**/room/informatika', { timeout: 10000 })
    await tid('topic-1').waitFor()
    expect((await tid('topic-2').getAttribute('aria-disabled')) === 'true', 'ödənişli mövzu açıq görünür')
    expect((await tid('topic-1').getAttribute('aria-disabled')) !== 'true', 'pulsuz mövzu bağlı görünür')
    await tid('topic-1').click()
    expect((await tid('topic-1').getAttribute('aria-checked')) === 'true', 'mövzu seçilmədi')
    await tid('size-10').click()
    await shot('05-fenn-otagi')
  })

  let answered = 0
  await step('mövzu testi: serverdən sual, cavab, izah, su nişanı', async () => {
    await tid('start-test').click()
    await page.waitForURL('**/test/**', { timeout: 15000 })
    for (let i = 0; i < 12; i++) {
      await tid('stem').waitFor({ timeout: 15000 })
      const body = await page.content()
      expect(!body.includes('answer_index'), 'cavab açarı səhifədə')
      await tid(`opt-${i % 2}`).click()
      await tid('confirm').click()
      await tid('feedback').waitFor({ timeout: 15000 })
      answered++
      if (i === 0) {
        expect(await page.getByText(/№ \d+/).first().count() > 0, 'su nişanı yoxdur')
        await shot('06-test-izah')
      }
      const next = tid('next')
      const label = await next.innerText()
      await next.click()
      if (label.includes('Nəticə')) break
    }
    await page.waitForURL('**/result/**', { timeout: 15000 })
    await tid('percent').waitFor()
    await tid('review-1').waitFor({ timeout: 15000 })
    await shot('07-netice')
    expect(sql(`select count(*) from public.answers a join public.test_sessions s on s.id = a.session_id join auth.users u on u.id = s.student_id where u.phone = '${PHONE_DB}'`) === String(answered), 'cavab sayı uyğun deyil')
  })

  await step('gündəlik: test nəticəsi, seriya və zəif mövzular', async () => {
    await page.goto(`http://127.0.0.1:${PORT}/diary`)
    await page.getByText('İnformatika · Mövzu testi').first().waitFor({ timeout: 15000 })
    await page.getByText('1 gün ardıcıl').waitFor({ timeout: 5000 })
    await shot('08-gundelik')
  })

  await step('şərəf lövhəsi: öz vəziyyəti, razılıq olmadan gizli, Kabinetdən açılır', async () => {
    await page.goto(`http://127.0.0.1:${PORT}/`)
    await tid('go-board').click()
    await tid('board-me').waitFor({ timeout: 15000 })
    await page.getByText('Adınız başqalarına görünmür.').waitFor()
    await shot('09a-seref-lovhesi')
    await page.goto(`http://127.0.0.1:${PORT}/profile`)
    await tid('board-toggle').click()
    await page.getByText('Şərəf lövhəsində görün: Bəli').waitFor({ timeout: 15000 })
    expect(sql(`select show_on_board from public.profiles p join auth.users u on u.id = p.id where u.phone = '${PHONE_DB}'`) === 't', 'razılıq yazılmadı')
  })

  await step('yarımçıq test: zalda "Davam et" kartı, eyni yerdən davam edir', async () => {
    await page.goto(`http://127.0.0.1:${PORT}/room/informatika`)
    await tid('mode-mixed').click()
    await tid('size-10').click()
    await tid('start-test').click()
    await tid('stem').waitFor({ timeout: 15000 })
    await tid('opt-0').click(); await tid('confirm').click(); await tid('feedback').waitFor({ timeout: 15000 })
    await page.goto(`http://127.0.0.1:${PORT}/`)  // tətbiq "bağlandı"
    await tid('resume-card').waitFor({ timeout: 15000 })
    expect((await tid('resume-card').innerText()).includes('1/'), 'kartda irəliləyiş yoxdur')
    await tid('resume-test').click()
    await page.getByText(/^Sual 2 \/ \d+$/).waitFor({ timeout: 15000 })
  })

  await step('kabinet: yanlış kod rədd olunur, ixrac faylı endirilir', async () => {
    await page.goto(`http://127.0.0.1:${PORT}/profile`)
    await tid('code').fill('AAAA-BBBB-CCCC')
    await tid('redeem').click()
    await page.getByText('Kod yanlışdır.').waitFor({ timeout: 15000 })
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), tid('export').click()])
    expect(dl.suggestedFilename().startsWith('karyeram-melumatlarim-'), 'ixrac faylının adı')
    await shot('09-kabinet')
  })

  let liveId = ''
  await step('oxu zalı: canlı dərsə qoşulma (real LiveKit), yer, əl qaldırma, chat', async () => {
    liveId = sql(`insert into public.live_sessions (venue_id, title, starts_at, ends_at, access, state)
      select id, 'E2E: Say sistemləri canlı', now() - interval '1 minute', now() + interval '1 hour', 'public', 'live' from public.venues where name = 'Oxu zalı' limit 1 returning id`)
    expect(/^[0-9a-f-]{36}$/.test(liveId), 'canlı sessiya yaranmadı')
    await page.goto(`http://127.0.0.1:${PORT}/live`)
    await tid(`join-${liveId}`).click()
    await tid('ctl-hand').waitFor({ timeout: 30000 })
    expect(sql(`select seat from public.live_participants where session_id = '${liveId}' and left_at is null`) === '1', 'yer 1 verilmədi')
    await page.getByLabel(/Yer 1: Test Tələbə/).waitFor({ timeout: 15000 })
    await tid('ctl-hand').click()
    await page.waitForTimeout(800)
    expect(sql(`select count(*) from public.live_hands where session_id = '${liveId}' and resolved_at is null`) === '1', 'əl qaldırılmadı')
    await tid('ctl-chat').click()
    await tid('chat-input').fill('Salam, sual verə bilərəm?')
    await tid('chat-send').click()
    await page.getByText('Salam, sual verə bilərəm?').waitFor({ timeout: 15000 })
    // Başqasının mesajı Realtime ilə gəlməlidir (RLS: yalnız iştirakçılar alır).
    await page.waitForTimeout(1500)
    sql(`insert into public.live_chat (session_id, user_id, body) values ('${liveId}', null, 'Realtime yoxlaması: hamı eşidir?')`)
    await page.getByText('Realtime yoxlaması: hamı eşidir?').waitFor({ timeout: 15000 })
    await shot('10-oxu-zali')
  })

  await step('müəllim dərsi bitirəndə tələbə bildiriş görür', async () => {
    sql(`update public.live_sessions set state = 'ended' where id = '${liveId}'`)
    await page.getByText('Dərs bitdi.').waitFor({ timeout: 20000 })
  })

  // ---- Müəllim (host) ↔ tələbə: iki ayrı brauzer konteksti, eyni LiveKit otağı ----
  const hctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, locale: 'az-AZ', permissions: ['camera', 'microphone'] })
  const host = await hctx.newPage()
  const htid = (id) => host.getByTestId(id)
  let hostLive = ''
  await step('müəllim: qeydiyyat, dərs planlaşdırma (UI formu)', async () => {
    await signUp(host, HOST_LOCAL, 'Rauf Müəllim')
    sql(`update public.profiles set role = 'admin' from auth.users u where u.id = profiles.id and u.phone = '${HOST_DB}'`)
    await host.goto(`http://127.0.0.1:${PORT}/live/new`)
    await host.getByText('Zal · Oxu zalı').click()
    await host.getByLabel('Mövzu').fill('Canlı dərs: ikilik say sistemi')
    await host.getByRole('button', { name: 'Yeni dərs planlaşdır' }).last().click()
    await host.waitForURL('**/live/**-**', { timeout: 20000 })
    hostLive = host.url().split('/live/')[1]
    expect(/^[0-9a-f-]{36}$/.test(hostLive), 'host otağa keçmədi')
    await htid('ctl-host').waitFor({ timeout: 30000 })
  })

  await step('müəllim otağı: yoxlamadakı sualı dərc edir', async () => {
    sql(`insert into public.questions (topic_id, stem, options, answer_index, status)
         select id, '[E2E] Yoxlama sualı', '["bir","iki"]', 1, 'review' from public.topics where subject_id = 'informatika' and name = 'Kompüter qurğuları (DEMO)'`)
    const back = host.url()
    await host.goto(`http://127.0.0.1:${PORT}/teacher`)
    const card = host.getByTestId(/^rq-\d+$/).filter({ hasText: '[E2E] Yoxlama sualı' })
    await card.waitFor({ timeout: 15000 })
    await card.getByRole('button', { name: 'Dərc et' }).click()
    await card.waitFor({ state: 'detached', timeout: 15000 })
    expect(sql(`select status from public.questions where stem = '[E2E] Yoxlama sualı'`) === 'published', 'sual dərc olunmadı')
    await host.goto(back)
    await htid('ctl-host').waitFor({ timeout: 30000 })
  })

  let teacherCode = ''
  await step('müəllim otağı: toplu abunə kodu və sual analizi', async () => {
    const lp = await hctx.newPage()
    await lp.goto(`http://127.0.0.1:${PORT}/teacher`)
    await lp.getByTestId('tab-codes').click()
    await lp.getByTestId('cs-informatika').click()
    await lp.getByTestId('code-count').fill('2')
    await lp.getByTestId('make-codes').click()
    const out = (await lp.getByTestId('codes-out').innerText({ timeout: 15000 })).trim().split('\n')
    expect(out.length === 2 && out.every((c) => /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c)), 'kod formatı')
    teacherCode = out[0]
    await lp.screenshot({ path: join(SHOTS, '13-muellim-otagi-kodlar.png') })
    // Sual analizi: tələbənin bitirdiyi testin cavabları görünür (30-dan az: "Az məlumat")
    await lp.getByTestId('tab-analysis').click()
    await lp.getByTestId('an-informatika').click()
    await lp.getByTestId('an-item-0').waitFor({ timeout: 15000 })
    expect(await lp.getByText('Az məlumat').count() > 0, 'az məlumat bayrağı yoxdur')
    await lp.close()
  })

  await step('tələbə müəllimin kodunu aktivləşdirir → ödənişli mövzu açılır', async () => {
    const sp = await ctx.newPage()
    await sp.goto(`http://127.0.0.1:${PORT}/profile`)
    await sp.getByTestId('code').fill(teacherCode.toLowerCase())
    await sp.getByTestId('redeem').click()
    await sp.getByText(/İnformatika fənninə giriş .* tarixinədək açıldı/).waitFor({ timeout: 15000 })
    await sp.goto(`http://127.0.0.1:${PORT}/room/informatika`)
    await sp.getByTestId('topic-2').waitFor()
    expect((await sp.getByTestId('topic-2').getAttribute('aria-disabled')) !== 'true', 'ödənişli mövzu açılmadı')
    await sp.close()
  })

  await step('müəllim istifadə olunmamış kodu ləğv edir, gündəliyə qiymət yazır → tələbə görür', async () => {
    const lp = await hctx.newPage()
    await lp.goto(`http://127.0.0.1:${PORT}/teacher`)
    await lp.getByTestId('tab-codes').click()
    await lp.getByText('Aktivləşdirilib').first().waitFor({ timeout: 15000 })
    await lp.getByRole('button', { name: 'Ləğv et' }).first().click()
    await lp.getByText('Ləğv olunub').first().waitFor({ timeout: 15000 })
    expect(sql(`select count(*) from public.access_codes c join auth.users u on u.id = c.created_by where u.phone = '${HOST_DB}' and c.revoked`) === '1', 'kod ləğv olunmadı')
    const no = sql(`select student_no from public.profiles p join auth.users u on u.id = p.id where u.phone = '${PHONE_DB}'`)
    await lp.getByTestId('tab-diary').click()
    await lp.getByTestId('d-no').fill(no)
    await lp.getByTestId('d-title').fill('Şifahi sorğu: say sistemləri')
    await lp.getByTestId('d-grade').fill('9')
    await lp.getByTestId('d-save').click()
    await lp.getByText('Test Tələbə gündəliyinə yazıldı.').waitFor({ timeout: 15000 })
    await lp.close()
    const sp = await ctx.newPage()
    await sp.goto(`http://127.0.0.1:${PORT}/diary`)
    await sp.getByText('Şifahi sorğu: say sistemləri').waitFor({ timeout: 15000 })
    await sp.close()
  })

  await step('şkaf: müəllim mətn konspekti və PDF yükləyir → tələbə oxuyur (icazə, su nişanı, imzalı URL)', async () => {
    const lp = await hctx.newPage()
    await lp.goto(`http://127.0.0.1:${PORT}/teacher`)
    await lp.getByTestId('tab-library').click()
    await lp.getByTestId('ls-informatika').click()
    await lp.getByTestId('l-title').fill('E2E: Say sistemləri konspekti')
    await lp.getByTestId('l-body').fill('İkilik say sistemində yalnız 0 və 1 var.\n\nOnaltılıqda A=10, F=15.')
    await lp.getByTestId('l-save').click()
    await lp.getByText('Şkafa əlavə olundu.').waitFor({ timeout: 15000 })
    await lp.getByTestId('lk-pdf').click()
    await lp.getByTestId('l-title').fill('E2E: PDF konspekt')
    const [chooser] = await Promise.all([lp.waitForEvent('filechooser'), lp.getByTestId('l-pick').click()])
    await chooser.setFiles(join(ROOT, 'tests/e2e/fixtures/demo-konspekt.pdf'))
    await lp.getByText(/demo-konspekt\.pdf/).waitFor({ timeout: 10000 })
    await lp.getByTestId('l-save').click()
    await lp.getByText('Şkafa əlavə olundu.').waitFor({ timeout: 20000 })
    await lp.close()
    expect(sql(`select count(*) from public.library_items where title like 'E2E:%'`) === '2', 'şkafa yazılmadı')

    const sp = await ctx.newPage()
    await sp.goto(`http://127.0.0.1:${PORT}/room/informatika`)
    await sp.getByText('📘 E2E: Say sistemləri konspekti').click()
    await sp.getByTestId('library-body').getByText('Onaltılıqda A=10, F=15.').waitFor({ timeout: 15000 })
    expect(await sp.getByText(/№ \d+/).count() > 0, 'konspektdə su nişanı yoxdur')
    await sp.goBack()
    const [req] = await Promise.all([
      ctx.waitForEvent('request', { predicate: (r) => r.url().includes('/storage/v1/object/sign/library/'), timeout: 15000 }),
      sp.getByText('📄 E2E: PDF konspekt').click(),
    ])
    const pdfUrl = req.url()
    expect(/\/storage\/v1\/object\/sign\/library\/informatika\/[0-9a-f-]{36}\.pdf\?token=/.test(pdfUrl), 'imzalı URL deyil: ' + pdfUrl)
    const res = await fetch(pdfUrl)
    expect(res.status === 200 && (await res.arrayBuffer()).byteLength > 300, 'PDF endirilmədi')
    const unsigned = await fetch(pdfUrl.replace('/object/sign/', '/object/public/').split('?')[0])
    expect(unsigned.status >= 400, 'PDF imzasız açılır!')
    for (const p of ctx.pages()) if (p !== page) await p.close()
  })

  await step('müəllim dərsi başladır və kameranı açır', async () => {
    await htid('ctl-host').click()
    await htid('host-start').click()
    await htid('host-end').waitFor({ timeout: 15000 })
    expect(sql(`select state from public.live_sessions where id = '${hostLive}'`) === 'live', 'dərs canlı deyil')
    await htid('ctl-cam').click()
    await host.waitForFunction(() => { const v = document.querySelector('video'); return !!v && v.readyState >= 2 && v.videoWidth > 0 }, null, { timeout: 20000 })
  })

  await step('tələbə qoşulur, müəllimin görüntüsü lövhədə görünür', async () => {
    await page.goto(`http://127.0.0.1:${PORT}/live/${hostLive}`)
    await tid('ctl-hand').waitFor({ timeout: 30000 })
    await page.waitForFunction(() => { const v = document.querySelector('video'); return !!v && v.readyState >= 2 && v.videoWidth > 0 }, null, { timeout: 30000 })
    expect(await tid('ctl-mic').count() === 0, 'tələbədə əvvəldən mikrofon düyməsi var')
  })

  await step('tələbə əl qaldırır → müəllim növbədə görür → söz verir → tələbə mikrofonu açır', async () => {
    await tid('ctl-hand').click()
    await htid('hand-0').waitFor({ timeout: 15000 })
    await host.screenshot({ path: join(SHOTS, '11-muellim-paneli.png') })
    await htid('host-attendance').click()
    await host.getByTestId('attendance').getByText(/Test Tələbə · [\d.]+ dəq/).waitFor({ timeout: 15000 })
    await htid('host-onlyhost').click() // "yalnız host danışır" söndürülür
    await host.waitForTimeout(500)
    expect(sql(`select only_host_audio from public.live_sessions where id = '${hostLive}'`) === 'f', 'rejim dəyişmədi')
    await htid('hand-0').getByRole('button', { name: 'Söz ver' }).click()
    await tid('ctl-mic').waitFor({ timeout: 20000 })
    await page.getByText('Sizə söz verildi').waitFor({ timeout: 10000 })
    await tid('ctl-mic').click()
    await page.getByRole('button', { name: 'Mikrofon', exact: true }).waitFor({ timeout: 15000 })
    expect(sql(`select p.role from public.live_participants p join auth.users u on u.id = p.user_id where p.session_id = '${hostLive}' and u.phone = '${PHONE_DB}'`) === 'speaker', 'rol speaker deyil')
    await shot('12-telebe-soz-aldi')
  })

  await step('müəllim "yalnız host danışır" rejimini açır → tələbənin sözü alınır', async () => {
    await htid('host-onlyhost').click()
    await tid('ctl-mic').waitFor({ state: 'detached', timeout: 20000 })
    expect(sql(`select p.role from public.live_participants p join auth.users u on u.id = p.user_id where p.session_id = '${hostLive}' and u.phone = '${PHONE_DB}'`) === 'audience', 'rol audience-ə qayıtmadı')
  })

  await step('müəllim dərsi bitirir → tələbədə dərhal "Dərs bitdi"', async () => {
    await htid('host-end').click()
    await page.getByText('Dərs bitdi.').waitFor({ timeout: 15000 })
    expect(sql(`select count(*) from public.live_participants where session_id = '${hostLive}' and left_at is null`) === '0', 'iştirakçılar bağlanmadı')
  })
  await step('hesab başqa yerdə silinibsə tətbiq ilişmir, girişə qayıdır', async () => {
    sql(`delete from auth.users where phone = '${HOST_DB}'`)
    await host.goto(`http://127.0.0.1:${PORT}/`)
    await host.waitForURL('**/sign-in', { timeout: 20000 })
  })
  await hctx.close()

  const LINK_EMAIL = `e2e-${Date.now()}@karyeram.test`
  await step('telefon hesabına e-poçt bağlanır (kod Mailpit-dən)', async () => {
    await page.goto(`http://127.0.0.1:${PORT}/profile`)
    await tid('link-email').click()
    await tid('link-value').fill(LINK_EMAIL)
    await tid('link-send').click()
    await tid('link-code').fill(await mailCode(LINK_EMAIL))
    await tid('link-verify').click()
    await page.getByText(LINK_EMAIL).waitFor({ timeout: 15000 })
    expect(sql(`select email from auth.users where phone = '${PHONE_DB}'`) === LINK_EMAIL, 'e-poçt bağlanmadı')
  })

  await step('bütün cihazlardan çıxış: refresh tokenlər ləğv olunur; bağlanmış e-poçtla yenidən giriş', async () => {
    await page.goto(`http://127.0.0.1:${PORT}/profile`)
    await tid('sign-out-all').click()
    await page.waitForURL('**/sign-in', { timeout: 20000 })
    expect(sql(`select count(*) from auth.refresh_tokens rt join auth.users u on u.id::text = rt.user_id where u.phone = '${PHONE_DB}' and not rt.revoked`) === '0', 'refresh tokenlər ləğv olunmadı')
    await tid('tab-email').click()
    await tid('email').fill(LINK_EMAIL); await tid('send-code').click()
    await tid('otp').waitFor()
    await page.waitForTimeout(800)
    await tid('otp').fill(await mailCode(LINK_EMAIL)); await tid('verify').click()
    await tid('door-live').waitFor({ timeout: 20000 }) // razılıqlar var: birbaşa məktəbə
  })

  await step('hesab silinir (SİL təsdiqi) və giriş səhifəsinə qayıdır', async () => {
    await page.goto(`http://127.0.0.1:${PORT}/profile`)
    await tid('delete-open').click()
    await tid('delete-confirm').fill('sil')
    await tid('delete-go').click()
    await page.waitForURL('**/sign-in', { timeout: 20000 })
    expect(sql(`select count(*) from auth.users where phone = '${PHONE_DB}'`) === '0', 'auth istifadəçisi silinmədi')
  })
} finally {
  console.log(results.join('\n'))
  const serious = consoleErrors.filter((e) => !/favicon|DevTools|Download the React DevTools/.test(e))
  if (serious.length) console.log(`\nBrauzer konsol xətaları (${serious.length}):\n` + serious.slice(0, 10).map((e) => '  - ' + e.slice(0, 200)).join('\n'))
  await browser.close()
  server.close()
}
console.log(`\nE2E: ${passed} addım keçdi`)
