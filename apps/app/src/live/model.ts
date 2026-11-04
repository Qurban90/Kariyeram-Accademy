/** Canlı zalın saf modeli (UI-dan və LiveKit-dən asılı deyil, vitest ilə yoxlanılır). */
export type LiveRole = 'host' | 'cohost' | 'speaker' | 'audience'

export interface PeerMeta { role: LiveRole; seat: number | null }

const ROLES: readonly LiveRole[] = ['host', 'cohost', 'speaker', 'audience']

/**
 * LiveKit iştirakçı metadata-sı serverdə imzalanmış tokendən və ya server API-dən gəlir
 * (canUpdateOwnMetadata=false), amma yenə də etibarsız JSON-a dözümlü oluruq.
 * Server rol dəyişəndə yalnız {role} göndərir, ona görə əvvəlki oturacaq saxlanılır.
 */
export function parseMeta(raw: string | undefined | null, prev?: PeerMeta): PeerMeta {
  let o: unknown = null
  try { o = raw ? JSON.parse(raw) : null } catch { o = null }
  const r = (o && typeof o === 'object' ? o : {}) as { role?: unknown; seat?: unknown }
  const role = ROLES.includes(r.role as LiveRole) ? (r.role as LiveRole) : prev?.role ?? 'audience'
  const seat = typeof r.seat === 'number' && Number.isInteger(r.seat) && r.seat > 0 ? r.seat : prev?.seat ?? null
  return { role, seat }
}

export const isHostRole = (r: LiveRole) => r === 'host' || r === 'cohost'

/** Göstəriləcək parta sayı: tutumdan çox deyil, ən azı 12, tutulmuş ən böyük yerdən sonra bir sıra boş yer. */
export function deskCount(capacity: number, occupiedSeats: number[], perRow = 4): number {
  const maxSeat = occupiedSeats.length ? Math.max(...occupiedSeats) : 0
  const want = Math.max(12, Math.ceil((maxSeat + perRow) / perRow) * perRow)
  return Math.max(maxSeat, Math.min(capacity, want))
}

export interface SeatView<P> { seat: number; peer: P | null }
export function seatMap<P extends { seat: number | null }>(peers: P[], total: number): SeatView<P>[] {
  const by = new Map<number, P>()
  for (const p of peers) if (p.seat !== null && !by.has(p.seat)) by.set(p.seat, p)
  return Array.from({ length: total }, (_, i) => ({ seat: i + 1, peer: by.get(i + 1) ?? null }))
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0]!.charAt(0) + (parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '')).toLocaleUpperCase('az')
}

/** Dərsə qoşulmaq nə vaxt mümkündür (server də yoxlayır: başlamağa 15 dəq qalmış). */
export function canEnter(startsAt: string, state: string, now = Date.now()): boolean {
  if (state === 'live') return true
  if (state !== 'scheduled') return false
  return Date.parse(startsAt) - now <= 15 * 60_000
}

/** "YYYY-AA-GG SS:DD" cihazın yerli vaxtı kimi oxunur. */
export function parseLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(s.trim())
  if (!m || Number(m[4]) > 23 || Number(m[5]) > 59) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d
}
