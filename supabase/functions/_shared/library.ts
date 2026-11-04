/** Konspekt şkafı: icazə DB-də (library_open), fayl ünvanı qısa müddətli imzalı URL (5 dəq). */
import { ApiError, unwrap } from './errors.ts'
import type { Db } from './handlers.ts'
import type { StorageDeps } from './supabase.ts'

export const DOWNLOAD_TTL_S = 300

function need(s: StorageDeps | undefined): StorageDeps {
  if (!s) throw new ApiError('storage_not_configured', 503)
  return s
}

export async function open(db: Db, storage: StorageDeps | undefined, user: string, item: string) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('library_open', { p_user: user, p_item: item }))
  if (r.kind === 'pdf') {
    const url = await need(storage).signDownload(String(r.storage_path), DOWNLOAD_TTL_S)
    return { kind: 'pdf', title: r.title, watermark: r.watermark, url, expiresIn: DOWNLOAD_TTL_S }
  }
  return { kind: 'text', title: r.title, watermark: r.watermark, body: r.body }
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
