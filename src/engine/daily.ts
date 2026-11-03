import type { Question } from '../content/schema'
import { liveQuestions } from './tower'

/** Yerli tarix açarı: YYYY-MM-DD */
export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Tarixdən asılı sabit say (hamıya eyni gün eyni nəticə). */
export function hashKey(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Günün sualı: hamı üçün eyni, tarixə görə seçilir. */
export function dailyQuestion(questions: Question[], key: string): Question | undefined {
  const live = [...liveQuestions(questions)].sort((a, b) => a.id.localeCompare(b.id))
  if (!live.length) return undefined
  return live[hashKey(key) % live.length]
}

/** Bazar ertəsindən başlayan cari həftənin 7 günü. */
export function weekKeys(now: Date = new Date()): string[] {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    return dayKey(x)
  })
}

export const WEEK_GOAL = 4
export const litDaysThisWeek = (days: Record<string, number>, now: Date = new Date()) =>
  weekKeys(now).filter((k) => (days[k] ?? 0) > 0).length

/** Gün nömrəsi (nəticə kartı üçün): 2026-11-01-dən sayılır. */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  const start = Date.UTC(2026, 10, 1)
  return Math.floor((Date.UTC(y, m - 1, d) - start) / 86_400_000) + 1
}
