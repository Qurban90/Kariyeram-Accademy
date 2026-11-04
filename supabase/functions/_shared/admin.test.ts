import { describe, expect, it, vi } from 'vitest'
import { suspend, suspendedGate, unsuspend } from './admin.ts'
import { dispatch, type Ctx } from './router.ts'

const A = '11111111-1111-1111-1111-111111111111'
const T = '22222222-2222-2222-2222-222222222222'

function ctx(rpc: (fn: string, args: Record<string, unknown>) => unknown, setBan = vi.fn(async () => {})) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const c: Ctx = {
    db: { async rpc(fn, args) { calls.push({ fn, args }); return rpc(fn, args) as never } },
    userId: A, live: { cfg: null, rooms: null }, admin: { deleteAuthUser: vi.fn(), setBan },
  }
  return { c, calls, setBan }
}

describe('admin', () => {
  it('dayandırma: əvvəl DB, sonra GoTrue qadağası; admin ID tokendən gəlir', async () => {
    const { c, calls, setBan } = ctx(() => ({ ok: true, until: 'x' }))
    const r = await dispatch('admin/users/suspend', c, { user: T, hours: 24, reason: 'Sual paylaşır', p_admin: 'saxta' })
    expect(r).toMatchObject({ ok: true, authBan: true })
    expect(calls[0]).toEqual({ fn: 'admin_suspend', args: { p_admin: A, p_target: T, p_hours: 24, p_reason: 'Sual paylaşır' } })
    expect(setBan).toHaveBeenCalledWith(T, 24)
  })
  it('DB rədd edirsə GoTrue-ya toxunulmur', async () => {
    const { c, setBan } = ctx(() => ({ error: 'forbidden' }))
    await expect(dispatch('admin/users/suspend', c, { user: T, hours: 24, reason: 'xxx' })).rejects.toMatchObject({ code: 'forbidden', status: 403 })
    expect(setBan).not.toHaveBeenCalled()
  })
  it('GoTrue xətası dayandırmanı ləğv etmir, admin xəbərdar olur', async () => {
    const setBan = vi.fn(async () => { throw new Error('down') })
    const log = vi.fn()
    const db = { async rpc() { return { ok: true } as never } }
    expect(await suspend(db, { deleteAuthUser: vi.fn(), setBan }, A, T, 1, 'səbəb', log)).toMatchObject({ ok: true, authBan: false })
    expect(log).toHaveBeenCalledWith('admin_ban_failed', expect.objectContaining({ target: T }))
    expect(await unsuspend(db, { deleteAuthUser: vi.fn(), setBan }, A, T, log)).toMatchObject({ ok: true, authBan: false })
  })
  it('canlı dərsdəki istifadəçi LiveKit otağından da çıxarılır', async () => {
    const removeParticipant = vi.fn(async () => {})
    const { c } = ctx(() => ({ ok: true, until: 'x', rooms: ['ks_a', 'ks_b'] }))
    c.live = { cfg: null, rooms: { removeParticipant } as never }
    await dispatch('admin/users/suspend', c, { user: T, hours: 24, reason: 'Dərsdə pozuntu' })
    expect(removeParticipant.mock.calls).toEqual([['ks_a', T], ['ks_b', T]])
  })
  it('bərpa qadağanı götürür', async () => {
    const { c, setBan } = ctx(() => ({ ok: true }))
    await dispatch('admin/users/unsuspend', c, { user: T })
    expect(setBan).toHaveBeenCalledWith(T, null)
  })
  it('validasiya: saat, səbəb, rol', async () => {
    const { c } = ctx(() => ({ ok: true }))
    await expect(dispatch('admin/users/suspend', c, { user: T, hours: 0, reason: 'xxx' })).rejects.toMatchObject({ code: 'bad_hours' })
    await expect(dispatch('admin/users/suspend', c, { user: T, hours: 5, reason: 'x' })).rejects.toMatchObject({ code: 'bad_reason' })
    await expect(dispatch('admin/users/role', c, { user: T, role: 'admin' })).rejects.toMatchObject({ code: 'bad_role' })
    await expect(dispatch('admin/users/suspend', c, { user: 'not-a-uuid', hours: 5, reason: 'xxx' })).rejects.toMatchObject({ code: 'bad_user' })
  })
  it('audit: filtrlər ötürülür, limit serverdədir', async () => {
    const { c, calls } = ctx(() => ({ events: [] }))
    await dispatch('admin/audit', c, { kind: 'admin_role', before: 500 })
    expect(calls[0]!.args).toEqual({ p_admin: A, p_kind: 'admin_role', p_target: null, p_before: 500, p_limit: 50 })
  })
  it('dayandırılmış hesab: yalnız ixrac və silinmə', () => {
    const now = Date.parse('2026-11-04T10:00:00Z')
    const later = '2026-11-05T10:00:00Z', past = '2026-11-03T10:00:00Z'
    expect(suspendedGate('session/start', later, now)).toBe(true)
    expect(suspendedGate('live/join', later, now)).toBe(true)
    expect(suspendedGate('account/export', later, now)).toBe(false)
    expect(suspendedGate('account/delete', later, now)).toBe(false)
    expect(suspendedGate('session/start', past, now)).toBe(false)
    expect(suspendedGate('session/start', null, now)).toBe(false)
    expect(suspendedGate('session/start', 'zibil', now)).toBe(false)
  })
})
