import type { Question } from '../content/schema'
import { slotState, type Rec } from './leitner'
import { liveQuestions } from './tower'

export type Mode = 'daily' | 'repair' | 'floor'

interface Opts {
  subject?: string
  size?: number
}

const byDue = (recs: Record<string, Rec>) => (a: Question, b: Question) => (recs[a.id]?.due ?? 0) - (recs[b.id]?.due ?? 0)

/** Sessiya üçün sual növbəsi. Çatlar həmişə birinci gəlir. */
export function buildQueue(mode: Mode, questions: Question[], recs: Record<string, Rec>, now: number, opts: Opts = {}): Question[] {
  const live = liveQuestions(questions)
  const cracks = live.filter((q) => slotState(recs[q.id], now) === 'crack').sort(byDue(recs))
  const fresh = live.filter((q) => slotState(recs[q.id], now) === 'new')
  const stones = live.filter((q) => slotState(recs[q.id], now) === 'stone').sort(byDue(recs))

  if (mode === 'repair') return cracks.slice(0, opts.size ?? 8)

  if (mode === 'floor') {
    const inSubject = (q: Question) => q.subject === opts.subject
    return [...cracks.filter(inSubject), ...fresh.filter(inSubject), ...stones.filter(inSubject)].slice(0, opts.size ?? 8)
  }

  const size = opts.size ?? 7
  const picked: Question[] = [...cracks.slice(0, 3)]
  // Yeni sualları fənlər üzrə növbə ilə götür ki, bir mərtəbə qalan hamısını örtməsin.
  const lanes = new Map<string, Question[]>()
  for (const q of fresh) lanes.set(q.subject, [...(lanes.get(q.subject) ?? []), q])
  let progressed = true
  while (picked.length < size && progressed) {
    progressed = false
    for (const lane of lanes.values()) {
      const q = lane.shift()
      if (q && picked.length < size) {
        picked.push(q)
        progressed = true
      }
    }
  }
  for (const q of [...cracks.slice(3), ...stones]) if (picked.length < size) picked.push(q)
  return picked
}

/** Cavab variantlarının yerini dəyişir, düzgün cavabın yeni indeksini qaytarır. */
export function shuffleOptions(q: Question, rand: () => number = Math.random): { options: string[]; answer: number } {
  const idx = q.options.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return { options: idx.map((i) => q.options[i]), answer: idx.indexOf(q.answer) }
}
