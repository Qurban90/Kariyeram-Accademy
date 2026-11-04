/** Gündəlik qeydlərindən medallar və seriya (FR-071). Azərbaycan 2016-dan yay vaxtına keçmir: UTC+4 sabitdir. */
import { badges, streak, type Badge } from '@karyeram/core/src/badges.ts'

const BAKU_MS = 4 * 3600_000
export const bakuDate = (iso: string | number | Date) => new Date(new Date(iso).getTime() + BAKU_MS).toISOString().slice(0, 10)

interface Entry { kind: string; created_at: string; payload: Record<string, unknown> }
type ByTopic = Record<string, { name: string; total: number; correct: number }>

export function progressFrom(entries: Entry[], now = new Date()): { streak: number; badges: Badge[]; totalCorrect: number } {
  const tests = entries.filter((e) => e.kind === 'test')
  const days = [...new Set(tests.map((e) => bakuDate(e.created_at)))]
  const today = bakuDate(now)
  let totalCorrect = 0
  const topics = new Map<string, { topicId: string; name: string; correct: number; total: number }>()
  for (const e of tests) {
    totalCorrect += Number(e.payload.correct ?? 0)
    for (const [id, x] of Object.entries((e.payload.by_topic ?? {}) as ByTopic)) {
      const t = topics.get(id) ?? { topicId: id, name: x.name, correct: 0, total: 0 }
      t.correct += x.correct; t.total += x.total
      topics.set(id, t)
    }
  }
  return { streak: streak(days, today), totalCorrect, badges: badges({ activeDays: days, today, totalCorrect, topics: [...topics.values()] }) }
}
