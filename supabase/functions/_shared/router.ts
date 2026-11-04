/** Bütün API marşrutları: giriş validasiyası + handler. index.ts yalnız HTTP, auth və log ilə məşğuldur. */
import * as account from './account.ts'
import type { AdminDeps } from './account.ts'
import { ApiError, unwrap } from './errors.ts'
import { answer, claimDevice, finish, nextQuestion, redeemCode, reviewSession, startSession, type Db } from './handlers.ts'
import * as live from './live.ts'
import { itemAnalysis } from './staff.ts'
import type { LiveDeps } from './live.ts'
import { bool, device, int, obj, oneOf, str, uuid, uuids } from './validate.ts'

export interface Ctx {
  db: Db
  userId: string
  live: LiveDeps
  admin: AdminDeps
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

  // Müəllim paneli (icazə DB-də yoxlanır: is_staff)
  'staff/codes': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('staff_create_codes', {
    p_staff: c.userId, p_subject: str(b, 'subject', 1, 40)!, p_count: int(b, 'count', 1, 200)!, p_days: int(b, 'days', 1, 730)!,
  })),
  'staff/analysis': (c, b) => itemAnalysis(c.db, c.userId, str(b, 'subject', 1, 40)!),
  'staff/question/status': async (c, b) => unwrap(await c.db.rpc<Record<string, unknown>>('staff_set_question_status', {
    p_staff: c.userId, p_question: uuid(b, 'question'), p_status: oneOf(b, 'status', ['draft', 'review', 'published', 'retired'])!,
  })),

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
