import { describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import * as library from './library.ts'
import { dispatch, type Ctx } from './router.ts'
import { stampPdf, stampText } from './stamp.ts'

const U1 = '11111111-1111-1111-1111-111111111111'
const I1 = '22222222-2222-2222-2222-222222222222'

const storage = (file: Uint8Array = new Uint8Array([1, 2, 3])) => ({
  download: vi.fn(async (_p: string) => file),
  signUpload: vi.fn(async (p: string) => ({ path: p, token: 'up' })),
  remove: vi.fn(async () => {}),
})

describe('konspekt şkafı', () => {
  it('open: PDF üçün yalnız metadata (fayl ünvanı yox); mətn: gövdə', async () => {
    const st = storage()
    const db = { async rpc() { return { kind: 'pdf', title: 'T', watermark: 17, storage_path: 'inf/a.pdf' } as never } }
    const r = await library.open(db, st, U1, I1)
    expect(r).toEqual({ kind: 'pdf', title: 'T', watermark: 17 })
    expect(JSON.stringify(r)).not.toContain('inf/a.pdf')
    const db2 = { async rpc() { return { kind: 'text', title: 'T', watermark: 17, body: 'mətn' } as never } }
    expect(await library.open(db2, st, U1, I1)).toMatchObject({ kind: 'text', body: 'mətn' })
  })
  it('pdf: icazədən sonra fayl serverdə oxunur və su nişanı ilə qaytarılır', async () => {
    const st = storage(new Uint8Array([9, 9]))
    const stamp = vi.fn(async (b: Uint8Array, t: string) => new Uint8Array([...b, t.length]))
    const db = { async rpc() { return { kind: 'pdf', title: 'T', watermark: 1152, storage_path: 'inf/a.pdf' } as never } }
    const out = await library.pdf(db, st, U1, I1, stamp, (no) => `No ${no}`)
    expect(st.download).toHaveBeenCalledWith('inf/a.pdf')
    expect(stamp).toHaveBeenCalledWith(new Uint8Array([9, 9]), 'No 1152')
    expect(out.__file.contentType).toBe('application/pdf')
  })
  it('pdf: icazə yoxdursa fayl oxunmur; böyük fayl rədd olunur; mətn konspekt PDF deyil', async () => {
    const st = storage()
    await expect(library.pdf({ async rpc() { return { error: 'forbidden' } as never } }, st, U1, I1, vi.fn(), String)).rejects.toMatchObject({ status: 403 })
    expect(st.download).not.toHaveBeenCalled()
    await expect(library.pdf({ async rpc() { return { kind: 'text', body: 'x' } as never } }, st, U1, I1, vi.fn(), String)).rejects.toMatchObject({ code: 'not_pdf' })
    const big = storage(new Uint8Array(library.MAX_STAMP_BYTES + 1))
    await expect(library.pdf({ async rpc() { return { kind: 'pdf', storage_path: 'a/b.pdf', watermark: 1 } as never } }, big, U1, I1, vi.fn(), String)).rejects.toMatchObject({ status: 413 })
  })
  it('stampPdf: real PDF-in hər səhifəsinə yazır, metadata-da da var; zibil fayl rədd', async () => {
    const src = await PDFDocument.create()
    src.addPage([595, 842]); src.addPage([842, 595])
    const raw = await src.save()
    const text = stampText(1152, new Date(Date.UTC(2026, 10, 4)))
    expect(text).toBe('Karyeram Academy - Telebe No 1152 - 04.11.2026')
    const out = await stampPdf(raw, text)
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getSubject()).toBe(text)
    expect(out.byteLength).toBeGreaterThan(raw.byteLength)
    await expect(stampPdf(new Uint8Array([1, 2, 3]), text)).rejects.toMatchObject({ code: 'pdf_unreadable', status: 422 })
    expect(stampText('12; DROP', new Date())).toContain('Telebe No 12 ')
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
    await expect(dispatch('library/pdf', ctx, { item: I1 })).rejects.toMatchObject({ status: 503 })
    await dispatch('staff/library/add', ctx, { subject: 'inf', title: 'K', kind: 'text', free: true, body: 'b', path: 'evil/../x.pdf' })
    expect(seen.at(-1)![1]).toMatchObject({ p_staff: U1, p_kind: 'text', p_storage_path: null, p_body: 'b' })
  })
})
