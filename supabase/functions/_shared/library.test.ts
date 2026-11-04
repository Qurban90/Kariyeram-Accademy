import { describe, expect, it, vi } from 'vitest'
import * as library from './library.ts'
import { dispatch, type Ctx } from './router.ts'

const U1 = '11111111-1111-1111-1111-111111111111'
const I1 = '22222222-2222-2222-2222-222222222222'

const storage = () => ({
  signDownload: vi.fn(async (p: string, ttl: number) => `/object/sign/library/${p}?token=t&ttl=${ttl}`),
  signUpload: vi.fn(async (p: string) => ({ path: p, token: 'up' })),
  remove: vi.fn(async () => {}),
})

describe('konspekt şkafı', () => {
  it('PDF: icazədən sonra 5 dəqiqəlik imzalı URL; mətn: gövdə', async () => {
    const st = storage()
    const db = { async rpc() { return { kind: 'pdf', title: 'T', watermark: 17, storage_path: 'inf/a.pdf' } as never } }
    const r = await library.open(db, st, U1, I1)
    expect(r).toMatchObject({ kind: 'pdf', url: '/object/sign/library/inf/a.pdf?token=t&ttl=300', watermark: 17 })
    const db2 = { async rpc() { return { kind: 'text', title: 'T', watermark: 17, body: 'mətn' } as never } }
    expect(await library.open(db2, st, U1, I1)).toMatchObject({ kind: 'text', body: 'mətn' })
  })
  it('icazə yoxdursa URL imzalanmır', async () => {
    const st = storage()
    const db = { async rpc() { return { error: 'forbidden' } as never } }
    await expect(library.open(db, st, U1, I1)).rejects.toMatchObject({ status: 403 })
    expect(st.signDownload).not.toHaveBeenCalled()
  })
  it('yükləmə ünvanı yalnız müəllimə, yol serverdə yaradılır', async () => {
    const st = storage()
    await expect(library.uploadUrl({ async rpc() { return false as never } }, st, U1, 'inf')).rejects.toMatchObject({ status: 403 })
    const r = await library.uploadUrl({ async rpc() { return true as never } }, st, U1, 'inf')
    expect(r.path).toMatch(/^inf\/[0-9a-f-]{36}\.pdf$/)
    await expect(library.uploadUrl({ async rpc() { return true as never } }, st, U1, '../x')).rejects.toMatchObject({ code: 'bad_subject' })
  })
  it('silmə: metadata, sonra fayl; storage xətası nəticəni pozmur', async () => {
    const st = storage(); st.remove.mockRejectedValueOnce(new Error('down'))
    const db = { async rpc() { return { ok: true, storage_path: 'inf/a.pdf' } as never } }
    expect(await library.remove(db, st, U1, I1)).toEqual({ ok: true })
    expect(st.remove).toHaveBeenCalledWith('inf/a.pdf')
  })
  it('router: storage yoxdursa 503, mətn tipində path qəbul olunmur', async () => {
    const seen: [string, Record<string, unknown>][] = []
    const db = { async rpc(fn: string, args: Record<string, unknown>) { seen.push([fn, args]); return { kind: 'pdf', storage_path: 'x/y.pdf', id: 'n' } as never } }
    const ctx: Ctx = { db, userId: U1, live: { cfg: null, rooms: null }, admin: { deleteAuthUser: async () => {}, setBan: async () => {} } }
    await expect(dispatch('library/open', ctx, { item: I1 })).rejects.toMatchObject({ status: 503 })
    await dispatch('staff/library/add', ctx, { subject: 'inf', title: 'K', kind: 'text', free: true, body: 'b', path: 'evil/../x.pdf' })
    expect(seen.at(-1)![1]).toMatchObject({ p_staff: U1, p_kind: 'text', p_storage_path: null, p_body: 'b' })
  })
})
