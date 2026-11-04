/** Bütün API marşrutları: giriş validasiyası + handler. index.ts yalnız HTTP, auth və log ilə məşğuldur. */
import * as account from './account.ts'
import * as adminOps from './admin.ts'
import type { AdminDeps } from './account.ts'
import { ApiError, unwrap } from './errors.ts'
import { answer, claimDevice, finish, nextQuestion, redeemCode, reviewSession, startSession, type Db } from './handlers.ts'
import * as live from './live.ts'
import { itemAnalysis } from './staff.ts'
import { board } from './board.ts'
import * as library from './library.ts'
import { stampPdf, stampText } from './stamp.ts'
import type { StorageDeps } from './supabase.ts'
import type { LiveDeps } from './live.ts'
import { bool, device, int, obj, oneOf, str, uuid, uuids } from './validate.ts'

export interface Ctx {
  db: Db
  userId: string
  live: LiveDeps
  admin: AdminDeps
  storage?: StorageDeps
  log?: (msg: string, data: Record<string, unknown>) => void
}

type Handler = (ctx: Ctx, body: Record<string, unknown>) => Promise<unknown>

const MODES = ['topic', 'mixed', 'mistakes', 'exam'] as const

export const routes: Record<string, Handler> = {
  // Hesab
  'account/consent': (c, b) => {
    const docs = b.docs
    if (!Array.isArray(docs) || docs.length === 0 || docs.length > 5 || !docs.every((d) => typeof d === 'string')) throw new ApiError('bad_docs')
    return account.consent(c.db, c.userId, docs as string[], str(b, 'displayName', 2, 80, true))
  },
  'account/revoke': (c, b) => account.revoke(c.db, c.userId, oneOf(b, 'doc', ['marketing', 'recording'])!),
  'account/export': (c) => account.exportData(c.db, c.userId),
  'account/delete': (c, b) => account.deleteAccount(c.db, c.admin, c.userId, str(b, 'confirm', 1, 10)!),

  // Klient təhlükəsizlik siqnalı (iOS ekran şəkli və s.) — yalnız audit, sübut deyil
  'client/event': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('report_client_event', {
    p_user: c.userId, p_kind: oneOf(b, 'kind', ['screenshot', 'screen_recording'])!, p_context: str(b, 'context', 0, 64, true) ?? null,
  })),

  // Konspekt şkafı
  'library/open': (c, b) => library.open(c.db, c.storage, c.userId, uuid(b, 'item')),
  'library/pdf': (c, b) => library.pdf(c.db, c.storage, c.userId, uuid(b, 'item'), stampPdf, (no) => stampText(String(no), new Date())),
  'staff/library/upload-url': (c, b) => library.uploadUrl(c.db, c.storage, c.userId, str(b, 'subject', 1, 40)!),
  'staff/library/add': (c, b) => {
    const kind = oneOf(b, 'kind', ['text', 'pdf'])!
    return library.add(c.db, c.userId, {
      subject: str(b, 'subject', 1, 40)!, topic: b.topic ? uuid(b, 'topic') : undefined, title: str(b, 'title', 1, 140)!, kind,
      free: bool(b, 'free')!, body: kind === 'text' ? str(b, 'body', 1, 200_000)! : undefined,
      path: kind === 'pdf' ? str(b, 'path', 5, 200)! : undefined, bytes: int(b, 'bytes', 1, 15 * 1024 * 1024, true),
    })
  },
  'staff/library/delete': (c, b) => library.remove(c.db, c.storage, c.userId, uuid(b, 'item')),

  // Şərəf lövhəsi (məxfilik: yalnız razılıq verənlər görünür)
  'board': (c, b) => board(c.db, c.userId, str(b, 'subject', 1, 40, true) ?? null),
  'account/board': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('set_board_visibility', { p_user: c.userId, p_show: bool(b, 'show')! })),

  // Müəllim paneli (icazə DB-də yoxlanır: is_staff)
  'staff/codes': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('staff_create_codes', {
    p_staff: c.userId, p_subject: str(b, 'subject', 1, 40)!, p_count: int(b, 'count', 1, 200)!, p_days: int(b, 'days', 1, 730)!,
  })),
  'staff/codes/list': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('staff_list_codes', { p_staff: c.userId, p_subject: str(b, 'subject', 1, 40, true) ?? null })),
  'staff/codes/revoke': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('staff_revoke_code', { p_staff: c.userId, p_code: uuid(b, 'code') })),
  'staff/diary': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('staff_diary_add', {
    p_staff: c.userId, p_student_no: int(b, 'studentNo', 1, 9_999_999_999)!, p_kind: oneOf(b, 'kind', ['grade', 'note'])!,
    p_title: str(b, 'title', 1, 140)!, p_grade: str(b, 'grade', 1, 10, true) ?? null, p_text: str(b, 'text', 0, 2000, true) ?? null,
  })),
  'staff/analysis': (c, b) => itemAnalysis(c.db, c.userId, str(b, 'subject', 1, 40)!),
  'staff/question/status': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('staff_set_question_status', {
    p_staff: c.userId, p_question: uuid(b, 'question'), p_status: oneOf(b, 'status', ['draft', 'review', 'published', 'retired'])!,
  })),

  // Admin (icazə DB-də: is_admin; admin başqa adminə toxuna bilməz)
  'admin/users/find': (c, b) => adminOps.find(c.db, c.userId, str(b, 'query', 1, 120)!),
  'admin/users/suspend': (c, b) => adminOps.suspend(c.db, c.admin, c.userId, uuid(b, 'user'), int(b, 'hours', 1, 87600)!, str(b, 'reason', 3, 300)!, c.log, c.live),
  'admin/users/unsuspend': (c, b) => adminOps.unsuspend(c.db, c.admin, c.userId, uuid(b, 'user'), c.log),
  'admin/users/role': (c, b) => adminOps.setRole(c.db, c.userId, uuid(b, 'user'), oneOf(b, 'role', ['student', 'teacher'])!),
  'admin/config': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('admin_set_config', {
    p_admin: c.userId, p_min_version: str(b, 'minVersion', 5, 11, true) ?? null,
    p_maintenance: bool(b, 'maintenance', true) ?? null, p_message: typeof b.message === 'string' ? str(b, 'message', 0, 500)! : null,
    p_staff_mfa: bool(b, 'staffMfaRequired', true) ?? null,
  })),
  'admin/audit': (c, b) => adminOps.audit(c.db, c.userId, {
    kind: str(b, 'kind', 1, 40, true), target: b.user ? uuid(b, 'user') : undefined, before: int(b, 'before', 1, Number.MAX_SAFE_INTEGER, true),
  }),

  // Cihaz və abunə
  'device/claim': (c, b) => claimDevice(c.db, c.userId, { device: device(b) }),
  'code/redeem': (c, b) => redeemCode(c.db, c.userId, { code: str(b, 'code', 12, 20)! }),

  // Test
  'session/start': (c, b) => startSession(c.db, c.userId, {
    device: device(b),
    subject: str(b, 'subject', 1, 40)!,
    mode: oneOf(b, 'mode', MODES)!,
    topicIds: uuids(b, 'topicIds', 50, true),
    size: int(b, 'size', 1, 200, true),
    timeLimitS: int(b, 'timeLimitS', 60, 14400, true),
  }),
  'question/next': (c, b) => nextQuestion(c.db, c.userId, { device: device(b), session: uuid(b, 'session') }),
  'answer': (c, b) => answer(c.db, c.userId, {
    device: device(b),
    session: uuid(b, 'session'),
    question: uuid(b, 'question'),
    chosen: b.chosen === null ? null : int(b, 'chosen', 0, 5)!,
    ms: int(b, 'ms', 0, 3_600_000)!,
    chars: int(b, 'chars', 0, 20_000)!,
  }),
  'session/finish': (c, b) => finish(c.db, c.userId, { session: uuid(b, 'session') }),
  'session/review': (c, b) => reviewSession(c.db, c.userId, { session: uuid(b, 'session') }),

  // Canlı oxu zalı
  'live/create': (c, b) => live.create(c.db, c.userId, {
    venue: uuid(b, 'venue'),
    title: str(b, 'title', 1, 140)!,
    startsAt: str(b, 'startsAt', 10, 40)!,
    endsAt: str(b, 'endsAt', 10, 40)!,
    access: oneOf(b, 'access', ['enrolled', 'invite', 'public'])!,
    subject: str(b, 'subject', 1, 40, true),
    description: str(b, 'description', 0, 2000, true),
  }),
  'live/join': (c, b) => live.join(c.db, c.live, c.userId, uuid(b, 'session')),
  'live/leave': (c, b) => live.leave(c.db, c.userId, uuid(b, 'session')),
  'live/hand/raise': (c, b) => live.raiseHand(c.db, c.userId, uuid(b, 'session')),
  'live/hand/lower': (c, b) => live.lowerHand(c.db, c.userId, uuid(b, 'session')),
  'live/hands': (c, b) => live.hands(c.db, c.userId, uuid(b, 'session')),
  'live/role': (c, b) => live.setRole(c.db, c.live, c.userId, uuid(b, 'session'), uuid(b, 'target'), oneOf(b, 'role', ['speaker', 'audience', 'cohost'])!),
  'live/settings': (c, b) => live.settings(c.db, c.live, c.userId, uuid(b, 'session'), bool(b, 'onlyHostAudio', true), bool(b, 'chatEnabled', true)),
  'live/ban': (c, b) => live.ban(c.db, c.live, c.userId, uuid(b, 'session'), uuid(b, 'target')),
  'live/state': (c, b) => live.setState(c.db, c.live, c.userId, uuid(b, 'session'), oneOf(b, 'state', ['live', 'ended', 'cancelled'])!),
  'live/chat': (c, b) => live.chat(c.db, c.userId, uuid(b, 'session'), str(b, 'body', 1, 500)!),
  'live/attendance': (c, b) => live.attendance(c.db, c.userId, uuid(b, 'session')),
}

export async function dispatch(route: string, ctx: Ctx, rawBody: unknown) {
  const h = Object.prototype.hasOwnProperty.call(routes, route) ? routes[route] : undefined
  if (!h) throw new ApiError('not_found', 404)
  return h(ctx, obj(rawBody))
}
