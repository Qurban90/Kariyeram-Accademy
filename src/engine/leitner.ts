export const DAY = 86_400_000
/** Yanlış cavab 1 gün, sonra düzgün cavablarla 3, 7, 14 gün. */
export const INTERVAL_DAYS = [1, 3, 7, 14] as const

export interface Rec {
  box: number
  due: number
  seen: number
  right: number
  wrong: number
  lastWrong: boolean
}

export const fresh = (): Rec => ({ box: 0, due: 0, seen: 0, right: 0, wrong: 0, lastWrong: false })

export function review(rec: Rec | undefined, correct: boolean, now: number): Rec {
  const r = rec ?? fresh()
  if (!correct) {
    return { ...r, box: 0, due: now + INTERVAL_DAYS[0] * DAY, seen: r.seen + 1, wrong: r.wrong + 1, lastWrong: true }
  }
  const box = Math.min(r.box + 1, INTERVAL_DAYS.length - 1)
  return { ...r, box, due: now + INTERVAL_DAYS[box] * DAY, seen: r.seen + 1, right: r.right + 1, lastWrong: false }
}

/** new: görülməyib. stone: yadda qalıb. crack: son cavab yanlışdır və ya təkrar vaxtı keçib. */
export type Slot = 'new' | 'stone' | 'crack'

export function slotState(rec: Rec | undefined, now: number): Slot {
  if (!rec || rec.seen === 0) return 'new'
  if (rec.lastWrong || rec.due <= now) return 'crack'
  return 'stone'
}
