import { createHmac, createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { deleteAccount } from './account.ts'
import { ApiError } from './errors.ts'
import { b64url, b64urlDecode, signHS256, verifyHS256 } from './jwt.ts'
import * as live from './live.ts'
import { bestEffort, joinToken, LiveKitError, permissionFor, RoomService, verifyWebhook } from './livekit.ts'
import { dispatch, type Ctx } from './router.ts'

const cfg = { url: 'wss://lk.example.az', apiKey: 'APIkey123', apiSecret: 'secret-secret-secret-secret-1234' }
const decode = (t: string) => JSON.parse(new TextDecoder().decode(b64urlDecode(t.split('.')[1]!)))
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const S1 = '33333333-3333-4333-8333-333333333333'

describe('jwt', () => {
  it('imza Node HMAC-SHA256 ilə eynidir', async () => {
    const t = await signHS256({ a: 1 }, 'k')
    const [h, p, s] = t.split('.')
    const expected = createHmac('sha256', 'k').update(`${h}.${p}`).digest('base64url')
    expect(s).toBe(expected)
  })
  it('saxta, alg=none, vaxtı keçmiş tokenlər rədd edilir', async () => {
    const t = await signHS256({ sub: 'x', exp: 1000 }, 'k')
    await expect(verifyHS256(t, 'k', 900)).resolves.toMatchObject({ sub: 'x' })
    await expect(verifyHS256(t, 'k', 2000)).rejects.toThrow('expired')
    await expect(verifyHS256(t, 'yanlış', 900)).rejects.toThrow('bad_signature')
    const [, p] = t.split('.')
    const none = `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${p}.`
    await expect(verifyHS256(none, 'k', 900)).rejects.toThrow('bad_alg')
    const tampered = t.replace(t.split('.')[1]!, b64url(JSON.stringify({ sub: 'admin', exp: 1000 })))
    await expect(verifyHS256(tampered, 'k', 900)).rejects.toThrow('bad_signature')
    await expect(verifyHS256('a.b', 'k')).rejects.toThrow('malformed')
  })
})

describe('livekit', () => {
  it('dinləyici tokeni yayım icazəsi vermir, host hər şeyi', async () => {
    const aud = decode(await joinToken(cfg, { room: 'ks_1', identity: U1, name: 'A', role: 'audience', canPublish: false, seat: 3 }, 1000))
    expect(aud).toMatchObject({ iss: cfg.apiKey, sub: U1, video: { room: 'ks_1', roomJoin: true, canPublish: false, canSubscribe: true, canPublishSources: [] } })
    expect(JSON.parse(aud.metadata)).toEqual({ role: 'audience', seat: 3 })
    expect(aud.exp - aud.nbf).toBeLessThanOrEqual(2 * 3600 + 5)
    expect(aud.video.roomAdmin).toBeUndefined()
    const host = decode(await joinToken(cfg, { room: 'ks_1', identity: U2, name: 'H', role: 'host', canPublish: true, seat: null }))
    expect(host.video.canPublishSources).toEqual(['camera', 'microphone', 'screen_share', 'screen_share_audio'])
    expect(permissionFor('speaker', true).canPublishSources).toEqual(['microphone'])
  })
  it('server API: düzgün ünvan, admin tokeni, gövdə; 404 xəta sayılmır', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{}' }))
    const rs = new RoomService(cfg, fetcher)
    await rs.updatePermission('ks_1', U1, permissionFor('audience', false))
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }]
    expect(url).toBe('https://lk.example.az/twirp/livekit.RoomService/UpdateParticipant')
    const claims = decode(init.headers.authorization!.replace('Bearer ', ''))
    expect(claims.video).toEqual({ room: 'ks_1', roomAdmin: true })
    expect(JSON.parse(init.body)).toMatchObject({ room: 'ks_1', identity: U1, permission: { canPublish: false } })
    await rs.deleteRoom('ks_1')
    const del = decode(((fetcher.mock.calls[1] as unknown as [string, { headers: Record<string, string> }])[1]).headers.authorization!.replace('Bearer ', ''))
    expect(del.video).toEqual({ roomCreate: true })
    const nf = new RoomService(cfg, async () => ({ ok: false, status: 404, text: async () => 'participant not found' }))
    await expect(bestEffort(nf.removeParticipant('ks_1', U1))).resolves.toBeNull()
    const boom = new RoomService(cfg, async () => ({ ok: false, status: 500, text: async () => 'boom' }))
    await expect(bestEffort(boom.removeParticipant('ks_1', U1))).rejects.toBeInstanceOf(LiveKitError)
  })
  it('webhook: imza, gövdə hash-i, issuer, köhnəlmə', async () => {
    const body = JSON.stringify({ id: 'EV_1', event: 'participant_left', createdAt: 1000, room: { name: 'ks_1' }, participant: { identity: U1 } })
    const sha = createHash('sha256').update(body).digest('base64')
    const auth = await signHS256({ iss: cfg.apiKey, sha256: sha, exp: 2000 }, cfg.apiSecret)
    await expect(verifyWebhook(cfg, body, auth, 1010)).resolves.toMatchObject({ id: 'EV_1' })
    await expect(verifyWebhook(cfg, body + ' ', auth, 1010)).rejects.toThrow('bad_body_hash')
    await expect(verifyWebhook(cfg, body, auth, 1500)).rejects.toThrow('stale_event')
    const wrongIss = await signHS256({ iss: 'other', sha256: sha, exp: 2000 }, cfg.apiSecret)
    await expect(verifyWebhook(cfg, body, wrongIss, 1010)).rejects.toThrow('bad_issuer')
    await expect(verifyWebhook(cfg, body, null, 1010)).rejects.toThrow('no_auth')
  })
})

function fakeDb(responses: Record<string, unknown>) {
  const calls: string[] = []
  return {
    calls,
    db: { async rpc(fn: string) { calls.push(fn); return responses[fn] as never } },
  }
}
const rooms = () => ({ updatePermission: vi.fn(async () => ({})), removeParticipant: vi.fn(async () => ({})), deleteRoom: vi.fn(async () => ({})) })

describe('live handlers', () => {
  it('join: DB qərar verir, token rola uyğundur; LiveKit konfiqurasiyası yoxdursa 503', async () => {
    const { db } = fakeDb({ live_join: { room: 'ks_9', role: 'audience', seat: 4, can_publish: false, name: 'Aysel', title: 'Dərs', state: 'live' } })
    const r = await live.join(db, { cfg, rooms: null }, U1, S1)
    expect(decode(r.token).video).toMatchObject({ room: 'ks_9', canPublish: false })
    expect(r.url).toBe(cfg.url)
    await expect(live.join(db, { cfg: null, rooms: null }, U1, S1)).rejects.toMatchObject({ code: 'live_not_configured', status: 503 })
    const { db: denied } = fakeDb({ live_join: { error: 'forbidden' } })
    await expect(live.join(denied, { cfg, rooms: null }, U1, S1)).rejects.toMatchObject({ code: 'forbidden', status: 403 })
  })
  it('setRole: əvvəl DB, sonra LiveKit; DB rədd edərsə LiveKit-ə toxunulmur', async () => {
    const r1 = rooms()
    const { db } = fakeDb({ live_set_role: { room: 'ks_9', can_publish: true } })
    await live.setRole(db, { cfg, rooms: r1 as never }, U1, S1, U2, 'speaker')
    expect(r1.updatePermission).toHaveBeenCalledWith('ks_9', U2, permissionFor('speaker', true), JSON.stringify({ role: 'speaker' }))
    const r2 = rooms()
    const { db: deny } = fakeDb({ live_set_role: { error: 'forbidden' } })
    await expect(live.setRole(deny, { cfg, rooms: r2 as never }, U1, S1, U2, 'speaker')).rejects.toBeInstanceOf(ApiError)
    expect(r2.updatePermission).not.toHaveBeenCalled()
  })
  it('settings: susdurulan hər kəsin icazəsi bağlanır; ban otaqdan çıxarır; bitirmə otağı silir', async () => {
    const r = rooms()
    const { db } = fakeDb({
      live_settings: { room: 'ks_9', only_host_audio: true, chat_enabled: true, silenced: [U1, U2] },
      live_ban: { room: 'ks_9', identity: U2 },
      live_set_state: { state: 'ended', room: 'ks_9' },
    })
    expect((await live.settings(db, { cfg, rooms: r as never }, U1, S1, true)).silenced).toBe(2)
    expect(r.updatePermission).toHaveBeenCalledTimes(2)
    await live.ban(db, { cfg, rooms: r as never }, U1, S1, U2)
    expect(r.removeParticipant).toHaveBeenCalledWith('ks_9', U2)
    expect(await live.setState(db, { cfg, rooms: r as never }, U1, S1, 'ended')).toEqual({ state: 'ended', room: 'closed' })
    expect(r.deleteRoom).toHaveBeenCalledWith('ks_9')
    const failing = { ...rooms(), deleteRoom: vi.fn(async () => { throw new LiveKitError(500, 'x') }) }
    expect(await live.setState(db, { cfg, rooms: failing as never }, U1, S1, 'ended')).toEqual({ state: 'ended', room: 'pending' })
  })
})

describe('account', () => {
  it('silmə təsdiq sözü tələb edir, əvvəl audit, sonra auth silinməsi', async () => {
    const del = vi.fn(async () => {})
    const { db, calls } = fakeDb({ prepare_account_deletion: { ok: true } })
    await expect(deleteAccount(db, { deleteAuthUser: del }, U1, 'sil')).rejects.toMatchObject({ code: 'confirm_required' })
    expect(del).not.toHaveBeenCalled()
    await deleteAccount(db, { deleteAuthUser: del }, U1, 'SİL')
    expect(calls).toEqual(['prepare_account_deletion'])
    expect(del).toHaveBeenCalledWith(U1)
  })
})

describe('router validasiyası', () => {
  const ctx = (db: Ctx['db']): Ctx => ({ db, userId: U1, live: { cfg, rooms: null }, admin: { deleteAuthUser: async () => {} } })
  it('naməlum və prototip marşrutları 404', async () => {
    const { db } = fakeDb({})
    await expect(dispatch('nope', ctx(db), {})).rejects.toMatchObject({ status: 404 })
    await expect(dispatch('__proto__', ctx(db), {})).rejects.toMatchObject({ status: 404 })
    await expect(dispatch('constructor', ctx(db), {})).rejects.toMatchObject({ status: 404 })
  })
  it('yanlış giriş DB-yə çatmır', async () => {
    const { db, calls } = fakeDb({})
    await expect(dispatch('live/join', ctx(db), { session: 'x' })).rejects.toMatchObject({ code: 'bad_session' })
    await expect(dispatch('question/next', ctx(db), { device: 'a b', session: S1 })).rejects.toMatchObject({ code: 'bad_device' })
    await expect(dispatch('answer', ctx(db), { device: 'dev-12345678', session: S1, question: S1, chosen: 9, ms: 1, chars: 1 })).rejects.toMatchObject({ code: 'bad_chosen' })
    await expect(dispatch('live/chat', ctx(db), { session: S1, body: 'x'.repeat(501) })).rejects.toMatchObject({ code: 'bad_body' })
    await expect(dispatch('live/role', ctx(db), { session: S1, target: U2, role: 'host' })).rejects.toMatchObject({ code: 'bad_role' })
    await expect(dispatch('account/consent', ctx(db), { docs: 'terms' })).rejects.toMatchObject({ code: 'bad_docs' })
    await expect(dispatch('live/join', ctx(db), [1, 2])).rejects.toMatchObject({ code: 'bad_request' })
    expect(calls).toEqual([])
  })
  it('istifadəçi ID-si gövdədən yox, kontekstdən gəlir (IDOR qorunması)', async () => {
    const seen: Record<string, unknown>[] = []
    const db = { async rpc(_fn: string, args: Record<string, unknown>) { seen.push(args); return { id: 1 } as never } }
    await dispatch('live/chat', ctx(db), { session: S1, body: 'salam', p_user: U2, userId: U2 })
    expect(seen[0]).toMatchObject({ p_user: U1 })
  })
  it('staff marşrutları: validasiya və istifadəçi kontekstdən', async () => {
    const seen: [string, Record<string, unknown>][] = []
    const db = { async rpc(fn: string, args: Record<string, unknown>) { seen.push([fn, args]); return { codes: [] } as never } }
    await expect(dispatch('staff/codes', ctx(db), { subject: 'inf', count: 500, days: 30 })).rejects.toMatchObject({ code: 'bad_count' })
    await expect(dispatch('staff/question/status', ctx(db), { question: S1, status: 'deleted' })).rejects.toMatchObject({ code: 'bad_status' })
    await dispatch('staff/codes', ctx(db), { subject: 'inf', count: 5, days: 30, p_staff: U2 })
    await dispatch('staff/question/status', ctx(db), { question: S1, status: 'published' })
    expect(seen).toEqual([
      ['staff_create_codes', { p_staff: U1, p_subject: 'inf', p_count: 5, p_days: 30 }],
      ['staff_set_question_status', { p_staff: U1, p_question: S1, p_status: 'published' }],
    ])
  })
  it('client/event: yalnız icazəli növlər, istifadəçi kontekstdən', async () => {
    const seen: [string, Record<string, unknown>][] = []
    const db = { async rpc(fn: string, args: Record<string, unknown>) { seen.push([fn, args]); return { ok: true, recorded: true } as never } }
    await expect(dispatch('client/event', ctx(db), { kind: 'drop' })).rejects.toMatchObject({ code: 'bad_kind' })
    await expect(dispatch('client/event', ctx(db), { kind: 'screenshot', context: 'x'.repeat(65) })).rejects.toMatchObject({ code: 'bad_context' })
    await dispatch('client/event', ctx(db), { kind: 'screenshot', context: 'test', p_user: U2 })
    expect(seen).toEqual([['report_client_event', { p_user: U1, p_kind: 'screenshot', p_context: 'test' }]])
  })
})
