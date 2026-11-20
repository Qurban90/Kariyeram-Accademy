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
import { fileURLToPath } from 'node:url'

import { totp } from '../util/totp.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

// fileURLToPath: Windows-da URL.pathname "/C:/..." qaytarır və resolve səhv işləyir.
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
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
  try { await fn(); passed++; results.push(`ok   ${name} (${Date.now() - t0} ms)`) } catch (e) {
    results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`)
    // Düşən addımın ekranı və brauzer xətaları: səbəbi tapmaq üçün (xüsusən proqram renderində WebGL itkisi).
    try { await page.screenshot({ path: join(SHOTS, 'FAIL.png') }); console.log('Düşən addımın ekranı: FAIL.png; brauzer xətaları:', JSON.stringify(consoleErrors.slice(-8))) } catch { /* səhifə bağlıdır */ }
    throw e
  }
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
// Tətbiq defolt olaraq 3D məktəblə açılır. Köhnə addımlar sadə (2D) görünüşdə gedir; 3D ayrıca addımda yoxlanır.
const simpleView = () => { try { if (localStorage.getItem('karyeram.view3d') === null) localStorage.setItem('karyeram.view3d', '0') } catch { /* yaddaş yoxdur */ } }
await ctx.addInitScript(simpleView)
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

  const canvasReady = (id) => page.waitForFunction((x) => { const c = document.querySelector(`[data-testid="${x}"] canvas`); return !!c && c.width > 0 }, id, { timeout: 30000 })
  const walkerState = () => page.evaluate(() => { const w = globalThis.__karyeramWalker; return w ? { x: w.x, z: w.z, yaw: w.yaw, eye: w.eye, mode: w.mode } : null })
  /** Giriş qatına barmaq hadisələri göndərir (joystik: sol tərəf, baxış: sağ tərəf). */
  const drag = (pad, id, x0, y0, x1, y1, holdMs) => page.evaluate(async ([padId, pid, a, b, c, d, ms]) => {
    const el = document.querySelector(`[data-testid="${padId}"]`)
    const r = el.getBoundingClientRect()
    const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: pid, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, bubbles: true }))
    ev('pointerdown', a, b)
    for (let i = 1; i <= 5; i++) { ev('pointermove', a + ((c - a) * i) / 5, b + ((d - b) * i) / 5); await new Promise((res) => setTimeout(res, 16)) }
    await new Promise((res) => setTimeout(res, ms))
    ev('pointerup', c, d)
  }, [pad, id, x0, y0, x1, y1, holdMs])

  await step('3D məktəb: joystiklə dəhlizdə gəzinti və baxış', async () => {
    await tid('toggle-3d').click()
    await canvasReady('corridor-3d')
    await page.waitForFunction(() => !!globalThis.__karyeramWalker, null, { timeout: 30000 })
    await page.waitForTimeout(1500)
    const start = await walkerState()
    await shot('04b-3d-dehliz')
    await drag('walk-pad', 11, 80, 640, 80, 580, 2000) // joystik irəli (proqram renderində kadr sürəti aşağıdır, ona görə 2 san)
    const moved = await walkerState()
    expect(moved.z < start.z - 0.5, `joystik irəli aparmadı: ${start.z} → ${moved.z}`)
    // Qapıya yaxınlaşanda "Daxil ol" düyməsi çıxır.
    for (let i = 0; i < 20 && (await walkerState()).z > -2.4; i++) await drag('walk-pad', 20 + i, 80, 640, 80, 580, 300)
    await tid('hud-main').waitFor({ timeout: 5000 })
    expect(/Daxil ol/.test(await tid('hud-main').innerText()), 'qapının yanında "Daxil ol" çıxmadı')
    await shot('04b2-3d-qapi')
    const atDoor = await walkerState()
    await drag('walk-pad', 12, 300, 400, 240, 400, 50) // sağ tərəfdə sürüşdürmə: baxış dönür
    const turned = await walkerState()
    expect(Math.abs(turned.yaw - atDoor.yaw) > 0.1, 'baxış dönmədi')
    expect(Math.abs(turned.z - atDoor.z) < 0.05, 'baxış sürüşdürməsi yeri dəyişdi')
  })

  await step('3D məktəb: qapıdan sinfə giriş, partaya oturma, pəncərə, ayağa qalxma, dəhlizə çıxış', async () => {
    await tid('hud-menu').click()
    await tid('door3d-informatika').click() // tələbə qapıya özü yeriyir, qapı açılır, arxasında sinif görünür
    // Qapıdan keçərkən: divarın xəttini keçib (|x| > 2), yəni portal yox, yeriyərək keçid.
    await page.waitForFunction(() => Math.abs(globalThis.__karyeramWalker?.x ?? 0) > 1.15, null, { timeout: 30000 })
    await shot('04b3-3d-qapidan-kecid')
    await page.waitForURL('**/room/informatika', { timeout: 40000 }).catch(async (e) => { throw new Error(`otağa keçmədi: ${JSON.stringify(await walkerState())} ${e.message.split('\n')[0]}`) })
    await canvasReady('room-3d')
    await page.waitForFunction(() => globalThis.__karyeramWalker?.z > 4, null, { timeout: 30000 }) // sinfin qapısında
    await page.waitForTimeout(1200)
    await shot('04c-3d-sinif')
    await tid('sit-desk').click()
    await tid('desk-window').waitFor({ timeout: 20000 }) // partaya gedir, oturur, pəncərə açılır
    const seated = await walkerState()
    expect(seated.mode === 'seated' && seated.eye < 1.3, `oturmadı: ${JSON.stringify(seated)}`)
    await tid('topic-1').waitFor()
    await tid('start-test').waitFor()
    await page.waitForTimeout(500)
    await shot('04d-3d-pencere')
    await tid('window-close').click()
    await tid('open-window').waitFor()
    await page.waitForTimeout(300)
    await shot('04e-3d-partada')
    await drag('room-pad', 13, 80, 640, 80, 580, 500) // oturanda joystik yerindən tərpətmir
    await drag('room-pad', 14, 300, 400, 260, 400, 50) // amma ətrafa baxmaq olur
    const still = await walkerState()
    expect(Math.abs(still.z - seated.z) < 0.01, 'oturan tələbə yerindən tərpəndi')
    expect(Math.abs(still.yaw - seated.yaw) > 0.05, 'oturanda baxış dönmədi')
    await tid('open-window').click()
    await tid('topic-1').waitFor()
    await tid('window-close').click()
    await tid('stand-up').click()
    await tid('sit-desk').waitFor({ timeout: 10000 })
    expect((await walkerState()).mode === 'walk', 'ayağa qalxmadı')
    // Partanın üstünə toxunmaq: tələbə həmin partaya gedib oturur (səhnədə əşya seçimi).
    const tapped = await page.evaluate(async () => {
      const el = document.querySelector('[data-testid="room-pad"]'), r = el.getBoundingClientRect()
      const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 40, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, bubbles: true }))
      for (const [fx, fy] of [[0.3, 0.62], [0.2, 0.66], [0.4, 0.6], [0.3, 0.7], [0.12, 0.6], [0.5, 0.64], [0.25, 0.56]]) {
        ev('pointerdown', r.width * fx, r.height * fy); ev('pointerup', r.width * fx, r.height * fy)
        await new Promise((res) => setTimeout(res, 250))
        if (globalThis.__karyeramWalker.mode !== 'walk') return true
      }
      return false
    })
    expect(tapped, 'partaya toxunuş seçilmədi')
    await tid('desk-window').waitFor({ timeout: 20000 })
    expect((await walkerState()).mode === 'seated', 'toxunulan partaya oturmadı')
    await shot('04f-3d-secilen-parta')
    await tid('window-close').click()
    await tid('room-menu-open').click()
    await tid('menu-exit').click() // qapıya gedir, qapı açılır, arxasında dəhliz görünür, qapıdan çıxır
    await page.waitForFunction(() => (globalThis.__karyeramWalker?.z ?? 0) > 5.6, null, { timeout: 30000 })
    await shot('04g-3d-sinifden-cixis')
    await page.waitForURL((u) => u.pathname === '/', { timeout: 30000 })
    await canvasReady('corridor-3d')
    // Dəhlizə həmin qapıdan çıxır və qapının qarşısında dayanır (dəhlizin içində).
    await page.waitForFunction(() => { const w = globalThis.__karyeramWalker; return !!w && w.mode === 'walk' && Math.abs(w.x) < 1.6 }, null, { timeout: 20000 })
  })

  await step('3D oxu zalı: pilləli auditoriya, yuxarıdan giriş, yerə oturma, dərslərin pəncərəsi, çıxış', async () => {
    await tid('hud-menu').click()
    await tid('door3d-hall').click()
    await page.waitForURL('**/live', { timeout: 40000 })
    await canvasReady('hall-3d')
    await tid('sit-desk').waitFor({ timeout: 30000 }) // qapıdan içəri addımladı
    const top = await walkerState()
    await page.waitForTimeout(800)
    await shot('04h-3d-zal')
    await tid('sit-desk').click()
    await tid('desk-window').waitFor({ timeout: 30000 })
    await page.getByText('Planlaşdırılmış dərslər').waitFor()
    await page.waitForTimeout(400)
    await shot('04i-3d-zal-pencere')
    await tid('window-close').click()
    await tid('open-window').waitFor()
    const seated = await walkerState()
    expect(seated.mode === 'seated', `zalda oturmadı: ${JSON.stringify(seated)}`)
    await page.waitForTimeout(300)
    await shot('04j-3d-zal-yerde')
    // Aşağı sıradakı yerə toxunuş: tələbə keçidlə enir (döşəmə alçalır) və oturur.
    await tid('stand-up').click()
    await tid('sit-desk').waitFor({ timeout: 10000 })
    const floorTop = await page.evaluate(() => globalThis.__karyeramWalker.floor)
    const tapped = await page.evaluate(async () => {
      const el = document.querySelector('[data-testid="room-pad"]'), r = el.getBoundingClientRect()
      const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 41, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, bubbles: true }))
      for (const [fx, fy] of [[0.5, 0.62], [0.4, 0.66], [0.6, 0.6], [0.3, 0.7], [0.5, 0.72], [0.2, 0.6], [0.7, 0.66]]) {
        ev('pointerdown', r.width * fx, r.height * fy); ev('pointerup', r.width * fx, r.height * fy)
        await new Promise((res) => setTimeout(res, 250))
        if (globalThis.__karyeramWalker.mode !== 'walk') return true
      }
      return false
    })
    expect(tapped, 'zalda yerə toxunuş seçilmədi')
    await tid('desk-window').waitFor({ timeout: 40000 })
    const floorLow = await page.evaluate(() => globalThis.__karyeramWalker.floor)
    expect(top.z > 7 && floorTop > 2 && floorLow <= floorTop, `pillə hündürlüyü: yuxarı ${floorTop}, seçilən yer ${floorLow}`)
    await tid('window-close').click()
    await tid('room-menu-open').click()
    await tid('menu-exit').click()
    await page.waitForURL((u) => u.pathname === '/', { timeout: 40000 })
    await canvasReady('corridor-3d')
    await page.waitForFunction(() => { const w = globalThis.__karyeramWalker; return !!w && w.mode === 'walk' }, null, { timeout: 20000 })
    await tid('hud-menu').click()
    await tid('toggle-3d').click() // növbəti addımlar üçün sadə görünüşə qayıt (seçim yadda saxlanılır)
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
  await hctx.addInitScript(simpleView)
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

  await step('iki mərhələli qoruma: admin MFA olmadan admin otağına girə bilmir, TOTP qoşur, yeni girişdə kod soruşulur', async () => {
    const mp = await hctx.newPage()
    await mp.goto(`http://127.0.0.1:${PORT}/admin`)
    await mp.getByTestId('admin-q').fill('Test')
    await mp.getByTestId('admin-search').click()
    await mp.getByText(/iki mərhələli qoruma lazımdır/).waitFor({ timeout: 15000 })
    await mp.goto(`http://127.0.0.1:${PORT}/profile`)
    // Yalnız telefonlu hesabda TOTP qoşulmur (GoTrue e-poçt adı tələb edir): əvvəl e-poçt bağlanır.
    await mp.getByText(/Əvvəlcə yuxarıdakı bölmədən hesabınıza e-poçt bağlayın/).waitFor({ timeout: 15000 })
    const hostMail = `e2e-host-${Date.now()}@karyeram.test`
    await mp.getByTestId('link-email').click()
    await mp.getByTestId('link-value').fill(hostMail)
    await mp.getByTestId('link-send').click()
    await mp.getByTestId('link-code').fill(await mailCode(hostMail))
    await mp.getByTestId('link-verify').click()
    await mp.getByTestId('mfa-enroll').click()
    const secret = (await mp.getByTestId('mfa-secret').innerText({ timeout: 15000 })).trim()
    expect(/^[A-Z2-7]{16,}$/.test(secret), 'gizli açar formatı: ' + secret)
    await mp.getByTestId('mfa-enroll-code').fill(totp(secret))
    await mp.getByTestId('mfa-confirm').click()
    await mp.getByText('İki mərhələli qoruma qoşuldu.').waitFor({ timeout: 15000 })
    await mp.screenshot({ path: join(SHOTS, '16-mfa-qosuldu.png') })
    await mp.close()
    expect(sql(`select count(*) from auth.mfa_factors f join auth.users u on u.id = f.user_id where u.phone = '${HOST_DB}' and f.status = 'verified'`) === '1', 'faktor təsdiqlənmədi')
    // Yeni cihazda giriş: telefon OTP-dən sonra autentifikator kodu soruşulur.
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'az-AZ' })
    await c2.addInitScript(simpleView)
    const p2 = await c2.newPage()
    await p2.goto(`http://127.0.0.1:${PORT}/sign-in`)
    await p2.getByTestId('phone').fill(HOST_LOCAL)
    await p2.getByTestId('send-code').click()
    await p2.getByTestId('otp').fill('123456')
    await p2.getByTestId('verify').click()
    await p2.getByTestId('mfa-code').waitFor({ timeout: 20000 })
    await p2.getByTestId('mfa-code').fill(totp(secret) === '000000' ? '111111' : '000000')
    await p2.getByTestId('mfa-verify').click()
    await p2.getByText(/Kod yanlışdır/).waitFor({ timeout: 15000 })
    await p2.getByTestId('mfa-code').fill(totp(secret))
    await p2.getByTestId('mfa-verify').click()
    await p2.getByTestId('door-live').waitFor({ timeout: 20000 })
    await c2.close()
  })

  await step('admin otağı: tələbəni № ilə tapır, səbəblə dayandırır (GoTrue qadağası), audit-də görür, bərpa edir', async () => {
    const no = sql(`select student_no from public.profiles p join auth.users u on u.id = p.id where u.phone = '${PHONE_DB}'`)
    const ap = await hctx.newPage()
    await ap.goto(`http://127.0.0.1:${PORT}/profile`)
    await ap.getByTestId('open-admin').click()
    await ap.waitForURL('**/admin')
    await ap.getByTestId('admin-q').fill(no)
    await ap.getByTestId('admin-search').click()
    const card = ap.getByTestId(`admin-user-${no}`)
    await card.waitFor({ timeout: 15000 })
    expect(!(await card.innerText()).includes('500000003'), 'telefon maskalanmayıb')
    await card.getByTestId('admin-reason').fill('E2E: qayda pozuntusu yoxlaması')
    await card.getByTestId('admin-suspend').click()
    await card.getByText(/Dayandırılıb: .* tarixinədək/).waitFor({ timeout: 15000 })
    expect(sql(`select banned_until > now() from auth.users where phone = '${PHONE_DB}'`) === 't', 'GoTrue qadağası yoxdur')
    await ap.screenshot({ path: join(SHOTS, '14-admin-dayandirma.png') })
    await ap.getByTestId('tab-audit').click()
    await ap.getByText('Admin dayandırdı').first().waitFor({ timeout: 15000 })
    await ap.getByTestId('tab-users').click()
    // Tab dəyişəndə axtarış nəticəsi qalmalıdır (yenidən axtarmadan).
    await card.getByTestId('admin-unsuspend').click()
    await card.getByText('Aktiv').waitFor({ timeout: 15000 })
    expect(sql(`select coalesce(banned_until < now(), true) from auth.users where phone = '${PHONE_DB}'`) === 't', 'qadağa götürülmədi')
    await ap.close()
  })

  await step('şkaf: müəllim mətn konspekti və PDF yükləyir → tələbə oxuyur (icazə, su nişanı; PDF serverdə möhürlənir)', async () => {
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
    await sp.getByText('E2E: Say sistemləri konspekti').click()
    await sp.getByTestId('library-body').getByText('Onaltılıqda A=10, F=15.').waitFor({ timeout: 15000 })
    expect(await sp.getByText(/№ \d+/).count() > 0, 'konspektdə su nişanı yoxdur')
    await sp.goBack()
    // PDF: tətbiqin içində açılır; server faylı tələbə nömrəsi ilə möhürləyib göndərir, birbaşa fayl ünvanı verilmir.
    const signed = []
    sp.on('request', (r) => { if (r.url().includes('/storage/v1/object/')) signed.push(r.url()) })
    const [resp] = await Promise.all([
      sp.waitForResponse((r) => r.url().endsWith('/functions/v1/api/library/pdf'), { timeout: 20000 }),
      sp.getByText('E2E: PDF konspekt').click(),
    ])
    expect(resp.status() === 200 && resp.headers()['content-type'] === 'application/pdf', 'PDF cavabı deyil: ' + resp.status())
    const { PDFDocument } = require('pdf-lib')
    const stamped = await PDFDocument.load(await resp.body())
    const no = sql(`select student_no from public.profiles p join auth.users u on u.id = p.id where u.phone = '${PHONE_DB}'`)
    expect(stamped.getSubject()?.includes(`Telebe No ${no}`), 'PDF-də tələbə nömrəsi yoxdur: ' + stamped.getSubject())
    await sp.getByTestId('pdf-frame').waitFor({ timeout: 15000 })
    expect(signed.length === 0, 'klient birbaşa storage ünvanına müraciət etdi: ' + signed.join(', '))
    await sp.screenshot({ path: join(SHOTS, '15-pdf-su-nisani.png') })
    // Faylın özü nə imzasız, nə də anon açarla açılmır.
    const path = sql(`select storage_path from public.library_items where title = 'E2E: PDF konspekt'`)
    const api = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
    expect((await fetch(`${api}/storage/v1/object/public/library/${path}`)).status >= 400, 'PDF imzasız açılır!')
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
    // Tələbə 3D sinifdə: müəllimin kamerası 3D lövhəyə tekstura kimi çəkilir
    await tid('toggle-3d-class').click()
    await page.waitForFunction(() => { const c = document.querySelector('[data-testid="classroom-3d"] canvas'); return !!c && c.width > 0 }, null, { timeout: 30000 })
    // Lövhə teksturasının mənbəyi: müəllimin uzaq video treki həqiqətən kadr verir (adaptiveStream onu dayandırmır)
    await page.waitForFunction(() => [...document.querySelectorAll('video[aria-hidden="true"]')].some((v) => v.videoWidth > 0 && !v.paused && v.currentTime > 0), null, { timeout: 20000 })
    await page.waitForTimeout(1500)
    await shot('12a-3d-sinif-telebe')
    await tid('toggle-3d-class').click()
  })

  await step('tələbə əl qaldırır → müəllim növbədə görür → söz verir → tələbə mikrofonu açır', async () => {
    await tid('ctl-hand').click()
    await htid('hand-0').waitFor({ timeout: 15000 })
    await host.screenshot({ path: join(SHOTS, '11-muellim-paneli.png') })
    // Müəllim 3D sinifdə: tələbənin avatarı partada, əli qaldırılıb
    await htid('toggle-3d-class').click()
    await host.waitForFunction(() => { const c = document.querySelector('[data-testid="classroom-3d"] canvas'); return !!c && c.width > 0 }, null, { timeout: 30000 })
    await host.waitForTimeout(2000)
    await host.screenshot({ path: join(SHOTS, '11b-3d-sinif-muellim.png') })
    await htid('toggle-3d-class').click()
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
