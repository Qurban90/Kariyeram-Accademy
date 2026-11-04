/** Şərəf lövhəsi: DB anonim həftəlik sayları verir, sıralama packages/core rankWeek (Wilson) ilə. */
import { rankWeek } from '../../../packages/core/src/leaderboard.ts'
import { unwrap } from './errors.ts'
import type { Db } from './handlers.ts'

export const BOARD_MIN = 30
export const BOARD_TOP = 20

export async function board(db: Db, user: string, subject: string | null) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('board_rows', { p_user: user, p_subject: subject }))
  const rows = (r.rows as { name: string; correct: number; total: number; me: boolean }[]) ?? []
  // ID-lər klientə getmir; rankWeek bərabərlikdə sabit sıra üçün açar istəyir.
  const keyed = rows.map((x, i) => ({ studentId: `${String(i).padStart(6, '0')}`, correct: x.correct, total: x.total, name: x.name, me: x.me }))
  const ranked = rankWeek(keyed, BOARD_MIN)
  const byKey = new Map(keyed.map((k) => [k.studentId, k]))
  const out = ranked.map((x) => ({ rank: x.rank, name: byKey.get(x.studentId)!.name, score: x.score, total: x.total, me: byKey.get(x.studentId)!.me }))
  const mine = keyed.find((k) => k.me)
  return {
    since: r.since, minTotal: BOARD_MIN,
    top: out.slice(0, BOARD_TOP),
    me: out.find((x) => x.me) ?? (mine ? { rank: null, name: mine.name, score: null, total: mine.total, me: true } : null),
  }
}
