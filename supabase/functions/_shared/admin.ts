/**
 * Admin əməliyyatları (FR-064). Səlahiyyət DB-də yoxlanır (is_admin); burada yalnız GoTrue qadağası ilə sinxronlaşma.
 * Sıra: əvvəl DB (həqiqət mənbəyi, bütün RPC-lər onu yoxlayır), sonra GoTrue qadağası (yeni giriş və token yeniləmə bağlanır).
 * GoTrue uğursuz olsa, DB dayandırması yenə qüvvədədir; cavabda authBan=false qaytarılır ki, admin bilsin.
 */
import type { AdminDeps } from './account.ts'
import { unwrap } from './errors.ts'
import type { Db } from './handlers.ts'
import type { LiveDeps } from './live.ts'

type Log = (msg: string, data: Record<string, unknown>) => void
const noop: Log = () => {}

export const find = async (db: Db, admin: string, query: string) =>
  unwrap(await db.rpc<Record<string, unknown>>('admin_find_users', { p_admin: admin, p_query: query }))

export async function suspend(db: Db, deps: AdminDeps, admin: string, target: string, hours: number, reason: string, log: Log = noop, live?: LiveDeps) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('admin_suspend', { p_admin: admin, p_target: target, p_hours: hours, p_reason: reason }))
  // Canlı dərsdədirsə LiveKit-dən də çıxarılır (qoşulmuş iştirakçı token müddəti bitəndə də qalır).
  const rooms = Array.isArray(r.rooms) ? (r.rooms as unknown[]).filter((x): x is string => typeof x === 'string') : []
  if (live?.rooms && rooms.length) {
    const res = await Promise.allSettled(rooms.map((room) => live.rooms!.removeParticipant(room, target)))
    const failed = res.filter((x) => x.status === 'rejected').length
    if (failed) log('admin_kick_failed', { target, failed })
  }
  try {
    await deps.setBan(target, hours)
    return { ...r, authBan: true }
  } catch (e) {
    log('admin_ban_failed', { target, err: String(e).slice(0, 200) })
    return { ...r, authBan: false }
  }
}

export async function unsuspend(db: Db, deps: AdminDeps, admin: string, target: string, log: Log = noop) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('admin_unsuspend', { p_admin: admin, p_target: target }))
  try {
    await deps.setBan(target, null)
    return { ...r, authBan: true }
  } catch (e) {
    log('admin_unban_failed', { target, err: String(e).slice(0, 200) })
    return { ...r, authBan: false }
  }
}

export const setRole = async (db: Db, admin: string, target: string, role: 'student' | 'teacher') =>
  unwrap(await db.rpc<Record<string, unknown>>('admin_set_role', { p_admin: admin, p_target: target, p_role: role }))

export const audit = async (db: Db, admin: string, f: { kind?: string; target?: string; before?: number }) =>
  unwrap(await db.rpc<Record<string, unknown>>('admin_audit', {
    p_admin: admin, p_kind: f.kind ?? null, p_target: f.target ?? null, p_before: f.before ?? null, p_limit: 50,
  }))

/**
 * Dayandırılmış (GoTrue-da qadağan olunmuş) istifadəçi yalnız öz məlumat hüquqlarından istifadə edə bilər:
 * ixrac və silinmə (məxfilik qanunvericiliyi). Qalan bütün marşrutlar 403 suspended.
 */
export const ALLOWED_WHILE_SUSPENDED = new Set(['account/export', 'account/delete'])
export function suspendedGate(route: string, bannedUntil: string | null, now = Date.now()): boolean {
  if (!bannedUntil) return false
  const t = Date.parse(bannedUntil)
  return Number.isFinite(t) && t > now && !ALLOWED_WHILE_SUSPENDED.has(route)
}
