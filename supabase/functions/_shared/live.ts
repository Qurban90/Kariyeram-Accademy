/** Canlı oxu zalı: DB qaydaları (RPC) + LiveKit icazələri. İcazə həmişə əvvəl DB-də dəyişir, sonra LiveKit-də. */
import { unwrap, ApiError } from './errors.ts'
import type { Db } from './handlers.ts'
import { bestEffort, joinToken, permissionFor, type LiveKitConfig, type RoomService } from './livekit.ts'

export interface LiveDeps {
  cfg: LiveKitConfig | null
  rooms: RoomService | null
}

type Role = 'host' | 'cohost' | 'speaker' | 'audience'

function need(live: LiveDeps): { cfg: LiveKitConfig } {
  if (!live.cfg) throw new ApiError('live_not_configured', 503)
  return { cfg: live.cfg }
}

export async function join(db: Db, live: LiveDeps, user: string, session: string) {
  const { cfg } = need(live)
  const r = unwrap(await db.rpc<Record<string, unknown>>('live_join', { p_user: user, p_session: session }))
  const role = r.role as Role
  const token = await joinToken(cfg, {
    room: String(r.room), identity: user, name: String(r.name), role, canPublish: Boolean(r.can_publish), seat: (r.seat as number | null) ?? null,
  })
  return {
    url: cfg.url, token, role, seat: r.seat, title: r.title, state: r.state,
    canPublish: r.can_publish, canPublishScreen: r.can_publish_screen, chatEnabled: r.chat_enabled, onlyHostAudio: r.only_host_audio,
  }
}

export const leave = async (db: Db, user: string, session: string) => unwrap(await db.rpc<Record<string, unknown>>('live_leave', { p_user: user, p_session: session }))
export const raiseHand = async (db: Db, user: string, session: string) => unwrap(await db.rpc<Record<string, unknown>>('live_raise_hand', { p_user: user, p_session: session }))
export const lowerHand = async (db: Db, user: string, session: string) => unwrap(await db.rpc<Record<string, unknown>>('live_lower_hand', { p_user: user, p_session: session }))
export const hands = async (db: Db, user: string, session: string) => unwrap(await db.rpc<Record<string, unknown>>('live_hands_queue', { p_user: user, p_session: session }))
export const attendance = async (db: Db, user: string, session: string) => unwrap(await db.rpc<Record<string, unknown>>('live_attendance', { p_user: user, p_session: session }))
export const chat = async (db: Db, user: string, session: string, body: string) => unwrap(await db.rpc<Record<string, unknown>>('live_chat_post', { p_user: user, p_session: session, p_body: body }))

export async function setRole(db: Db, live: LiveDeps, user: string, session: string, target: string, role: 'speaker' | 'audience' | 'cohost') {
  const r = unwrap(await db.rpc<Record<string, unknown>>('live_set_role', { p_user: user, p_session: session, p_target: target, p_role: role }))
  if (live.rooms) {
    await bestEffort(live.rooms.updatePermission(String(r.room), target, permissionFor(role, Boolean(r.can_publish)), JSON.stringify({ role })))
  }
  return { role, canPublish: r.can_publish }
}

export async function settings(db: Db, live: LiveDeps, user: string, session: string, onlyHostAudio?: boolean, chatEnabled?: boolean) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('live_settings', {
    p_user: user, p_session: session, p_only_host_audio: onlyHostAudio ?? null, p_chat_enabled: chatEnabled ?? null,
  }))
  const silenced = (r.silenced as string[]) ?? []
  if (live.rooms) {
    // Paralel, hər biri ayrıca: biri uğursuz olsa digərləri yenə susdurulur.
    const results = await Promise.allSettled(silenced.map((id) => bestEffort(live.rooms!.updatePermission(String(r.room), id, permissionFor('audience', false), JSON.stringify({ role: 'audience' })))))
    const failed = results.filter((x) => x.status === 'rejected').length
    if (failed) throw new ApiError('live_partial_failure', 502)
  }
  return { onlyHostAudio: r.only_host_audio, chatEnabled: r.chat_enabled, silenced: silenced.length }
}

export async function ban(db: Db, live: LiveDeps, user: string, session: string, target: string) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('live_ban', { p_user: user, p_session: session, p_target: target }))
  if (live.rooms) await bestEffort(live.rooms.removeParticipant(String(r.room), target))
  return { ok: true }
}

export async function setState(db: Db, live: LiveDeps, user: string, session: string, state: 'live' | 'ended' | 'cancelled') {
  const r = unwrap(await db.rpc<Record<string, unknown>>('live_set_state', { p_user: user, p_session: session, p_state: state }))
  let room: 'closed' | 'pending' | 'skipped' = 'skipped'
  if (live.rooms && (state === 'ended' || state === 'cancelled')) {
    // DB artıq bağlanıb: yeni qoşulma mümkün deyil. Otaq silinməsi uğursuz olsa, LiveKit boş otağı özü bağlayır.
    try {
      await bestEffort(live.rooms.deleteRoom(String(r.room)))
      room = 'closed'
    } catch (e) {
      console.log(JSON.stringify({ level: 'warn', msg: 'livekit_delete_room_failed', err: String(e).slice(0, 200) }))
      room = 'pending'
    }
  }
  return { state: r.state, room }
}

export interface CreateInput {
  venue: string
  title: string
  startsAt: string
  endsAt: string
  access: 'enrolled' | 'invite' | 'public'
  subject?: string
  description?: string
}

/** Müəllim öz otağında canlı dərs planlaşdırır (icazə DB-də yoxlanır). */
export async function create(db: Db, user: string, x: CreateInput) {
  const s = Date.parse(x.startsAt)
  const e = Date.parse(x.endsAt)
  if (!Number.isFinite(s) || !Number.isFinite(e)) throw new ApiError('bad_time')
  return unwrap(await db.rpc<Record<string, unknown>>('live_create_session', {
    p_host: user, p_venue: x.venue, p_title: x.title, p_starts: new Date(s).toISOString(), p_ends: new Date(e).toISOString(),
    p_access: x.access, p_subject: x.subject ?? null, p_description: x.description ?? '',
  }))
}
