import type { Question, Subject } from '../content/schema'
import { slotState, type Rec, type Slot } from './leitner'

export const BLOCKS_PER_FLOOR = 12
/** Komissiya otağının qapısı hər mərtəbə bu həddə çatanda açılır. */
export const DOOR_THRESHOLD = 0.5

export interface FloorStats {
  subject: Subject
  total: number
  stones: number
  cracks: number
  fresh: number
  /** 0..1: yadda qalan sualların payı. */
  fraction: number
  blocks: Slot[]
}

export const liveQuestions = (qs: Question[]) => qs.filter((q) => q.status !== 'stale')

export function floorStats(subject: Subject, questions: Question[], recs: Record<string, Rec>, now: number): FloorStats {
  const qs = liveQuestions(questions).filter((q) => q.subject === subject.id)
  let stones = 0
  let cracks = 0
  for (const q of qs) {
    const s = slotState(recs[q.id], now)
    if (s === 'stone') stones++
    else if (s === 'crack') cracks++
  }
  const total = qs.length
  const fresh = total - stones - cracks
  return { subject, total, stones, cracks, fresh, fraction: total ? stones / total : 0, blocks: toBlocks(stones, cracks, total) }
}

/** Sualları 12 vizual bloka çevirir: əvvəl daş, sonra çat, qalanı boş. */
export function toBlocks(stones: number, cracks: number, total: number, n = BLOCKS_PER_FLOOR): Slot[] {
  if (total === 0) return Array<Slot>(n).fill('new')
  let c = cracks > 0 ? Math.max(1, Math.round((cracks / total) * n)) : 0
  let s = stones > 0 ? Math.max(1, Math.round((stones / total) * n)) : 0
  while (s + c > n) {
    if (s >= c && s > 0) s--
    else c--
  }
  return [...Array<Slot>(s).fill('stone'), ...Array<Slot>(c).fill('crack'), ...Array<Slot>(n - s - c).fill('new')]
}

export const totalCracks = (floors: FloorStats[]) => floors.reduce((a, f) => a + f.cracks, 0)

export const isDoorOpen = (floors: FloorStats[], threshold = DOOR_THRESHOLD) =>
  floors.length > 0 && floors.every((f) => f.total > 0 && f.fraction >= threshold)
