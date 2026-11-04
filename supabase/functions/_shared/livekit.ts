/**
 * LiveKit inteqrasiyası: access token, server API (Twirp/HTTP) və webhook yoxlaması.
 * Rəsmi SDK əvəzinə kiçik, test olunan qat: Deno Edge Runtime-da asılılıqsız işləyir.
 */
import { sha256b64, signHS256, verifyHS256 } from './jwt.ts'

export interface LiveKitConfig {
  url: string // wss://...
  apiKey: string
  apiSecret: string
}

export type Source = 'camera' | 'microphone' | 'screen_share' | 'screen_share_audio'

export interface Permission {
  canSubscribe: boolean
  canPublish: boolean
  canPublishData: boolean
  canPublishSources: Source[]
}

/** Rola görə icazə: dinləyici yalnız qəbul edir; danışan yalnız mikrofon; host/köməkçi hər şey. */
export function permissionFor(role: 'host' | 'cohost' | 'speaker' | 'audience', canPublish: boolean): Permission {
  if (!canPublish) return { canSubscribe: true, canPublish: false, canPublishData: true, canPublishSources: [] }
  if (role === 'speaker') return { canSubscribe: true, canPublish: true, canPublishData: true, canPublishSources: ['microphone'] }
  return { canSubscribe: true, canPublish: true, canPublishData: true, canPublishSources: ['camera', 'microphone', 'screen_share', 'screen_share_audio'] }
}

export interface JoinTokenInput {
  room: string
  identity: string
  name: string
  role: 'host' | 'cohost' | 'speaker' | 'audience'
  canPublish: boolean
  seat: number | null
  ttlSec?: number
}

export async function joinToken(cfg: LiveKitConfig, t: JoinTokenInput, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const p = permissionFor(t.role, t.canPublish)
  return signHS256({
    iss: cfg.apiKey,
    sub: t.identity,
    name: t.name,
    nbf: nowSec - 5,
    exp: nowSec + (t.ttlSec ?? 2 * 3600),
    jti: crypto.randomUUID(),
    metadata: JSON.stringify({ role: t.role, seat: t.seat }),
    video: {
      room: t.room,
      roomJoin: true,
      canSubscribe: p.canSubscribe,
      canPublish: p.canPublish,
      canPublishData: p.canPublishData,
      canPublishSources: p.canPublishSources,
      canUpdateOwnMetadata: false,
    },
  }, cfg.apiSecret)
}

export class LiveKitError extends Error {
  constructor(public status: number, public body: string) {
    super(`livekit ${status}`)
  }
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export class RoomService {
  constructor(private cfg: LiveKitConfig, private fetcher: Fetch = fetch as unknown as Fetch, private timeoutMs = 5000) {}

  private httpBase() {
    return this.cfg.url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '')
  }

  /** Hər metod üçün minimal icazə: iştirakçı əməliyyatları roomAdmin, otaq silmə roomCreate tələb edir. */
  private async call(method: string, room: string, body: Record<string, unknown>) {
    const now = Math.floor(Date.now() / 1000)
    const video = method === 'DeleteRoom' ? { roomCreate: true } : { room, roomAdmin: true }
    const token = await signHS256({ iss: this.cfg.apiKey, nbf: now - 5, exp: now + 60, video }, this.cfg.apiSecret)
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), this.timeoutMs)
    try {
      const r = await this.fetcher(`${this.httpBase()}/twirp/livekit.RoomService/${method}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal,
      })
      const text = await r.text()
      if (!r.ok) throw new LiveKitError(r.status, text)
      return text ? JSON.parse(text) : {}
    } finally {
      clearTimeout(t)
    }
  }

  updatePermission(room: string, identity: string, permission: Permission, metadata?: string) {
    return this.call('UpdateParticipant', room, { room, identity, permission, ...(metadata ? { metadata } : {}) })
  }
  removeParticipant(room: string, identity: string) {
    return this.call('RemoveParticipant', room, { room, identity })
  }
  deleteRoom(room: string) {
    return this.call('DeleteRoom', room, { room })
  }
}

/** İştirakçı hələ otaqda deyilsə (404) bu xəta deyil: yeni icazə növbəti qoşulmada tokenlə gələcək. */
export async function bestEffort<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch (e) {
    if (e instanceof LiveKitError && (e.status === 404 || /not.?found/i.test(e.body))) return null
    throw e
  }
}

export interface WebhookEvent {
  id: string
  event: string
  createdAt?: number | string
  room?: { name?: string }
  participant?: { identity?: string }
}

/** LiveKit webhook: Authorization = JWT(iss=apiKey, sha256=base64(sha256(body))). Köhnə hadisələr (>5 dəq) rədd edilir. */
export async function verifyWebhook(cfg: LiveKitConfig, rawBody: string, authHeader: string | null, nowSec = Math.floor(Date.now() / 1000)): Promise<WebhookEvent> {
  if (!authHeader) throw new Error('no_auth')
  const claims = await verifyHS256(authHeader.replace(/^Bearer /, ''), cfg.apiSecret, nowSec)
  if (claims.iss !== cfg.apiKey) throw new Error('bad_issuer')
  if (claims.sha256 !== (await sha256b64(rawBody))) throw new Error('bad_body_hash')
  const ev = JSON.parse(rawBody) as WebhookEvent
  if (!ev.id || !ev.event) throw new Error('bad_event')
  const created = Number(ev.createdAt ?? 0)
  if (created && Math.abs(nowSec - created) > 300) throw new Error('stale_event')
  return ev
}
