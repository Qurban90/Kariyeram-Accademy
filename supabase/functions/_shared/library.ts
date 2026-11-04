/**
 * Konspekt şkafı: icazə DB-də (library_open, audit ilə).
 * PDF: fayl heç vaxt birbaşa ünvanla verilmir; server onu oxuyur, hər səhifəyə tələbə nömrəsini vurur və baytları qaytarır (R-13).
 */
import { ApiError, unwrap } from './errors.ts'
import type { Db } from './handlers.ts'
import type { StorageDeps } from './supabase.ts'

/** Su nişanı vurulan ən böyük fayl. Edge funksiyasının CPU/yaddaş limiti üçün (ölçmə: docs/PERFORMANCE.md). */
export const MAX_STAMP_BYTES = 15 * 1024 * 1024
export type Stamp = (src: Uint8Array, text: string) => Promise<Uint8Array>
export interface FileOut { __file: { bytes: Uint8Array; contentType: string; filename: string } }

function need(s: StorageDeps | undefined): StorageDeps {
  if (!s) throw new ApiError('storage_not_configured', 503)
  return s
}

export async function open(db: Db, storage: StorageDeps | undefined, user: string, item: string) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('library_open', { p_user: user, p_item: item }))
  // PDF üçün yalnız metadata: faylın özü library/pdf marşrutundan su nişanı ilə gəlir.
  if (r.kind === 'pdf') return { kind: 'pdf', title: r.title, watermark: r.watermark }
  return { kind: 'text', title: r.title, watermark: r.watermark, body: r.body }
}

export async function pdf(db: Db, storage: StorageDeps | undefined, user: string, item: string, stamp: Stamp, textFor: (no: unknown) => string): Promise<FileOut> {
  const r = unwrap(await db.rpc<Record<string, unknown>>('library_open', { p_user: user, p_item: item }))
  if (r.kind !== 'pdf' || !r.storage_path) throw new ApiError('not_pdf')
  const raw = await need(storage).download(String(r.storage_path))
  if (raw.byteLength > MAX_STAMP_BYTES) throw new ApiError('too_large', 413)
  const bytes = await stamp(raw, textFor(r.watermark))
  return { __file: { bytes, contentType: 'application/pdf', filename: 'konspekt.pdf' } }
}

export async function uploadUrl(db: Db, storage: StorageDeps | undefined, user: string, subject: string) {
  if (!(await db.rpc<boolean>('is_staff', { p: user }))) throw new ApiError('forbidden', 403)
  if (!/^[a-z0-9-]{1,40}$/.test(subject)) throw new ApiError('bad_subject')
  return need(storage).signUpload(`${subject}/${crypto.randomUUID()}.pdf`)
}

export interface AddBody { subject: string; topic?: string; title: string; kind: 'text' | 'pdf'; free: boolean; body?: string; path?: string; bytes?: number }
export async function add(db: Db, user: string, b: AddBody) {
  return unwrap(await db.rpc<Record<string, unknown>>('staff_library_add', {
    p_staff: user, p_subject: b.subject, p_topic: b.topic ?? null, p_title: b.title, p_kind: b.kind, p_free: b.free,
    p_body: b.body ?? null, p_storage_path: b.path ?? null, p_bytes: b.bytes ?? null,
  }))
}

export async function remove(db: Db, storage: StorageDeps | undefined, user: string, item: string) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('staff_library_delete', { p_staff: user, p_item: item }))
  if (r.storage_path && storage) {
    // Metadata silinib: fayl silinməsi uğursuz olsa belə artıq heç kim imzalı URL ala bilmir.
    await storage.remove(String(r.storage_path)).catch((e) => console.log(JSON.stringify({ level: 'warn', msg: 'storage_remove_failed', err: String(e).slice(0, 200) })))
  }
  return { ok: true }
}
