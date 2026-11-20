import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'

/**
 * Aralıqlı təkrar: FSRS (Free Spaced Repetition Scheduler).
 * Leitner qutularından fərqli olaraq hər sual üçün "yaddaş sabitliyi" və "çətinlik" saxlayır
 * və sualın unudulma ehtimalını (retrievability) hesablayır.
 */
export type SrsCard = Card

export interface SrsCardJSON {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string | null
}

const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: false,
    request_retention: 0.9,
    maximum_interval: 180,
  }),
)

export const newCard = (now: Date): SrsCard => createEmptyCard(now)

/** Oxu və düşünmə üçün gözlənilən vaxt (ms): sualın uzunluğundan asılıdır. */
export function expectedMs(questionChars: number, optionsChars: number): number {
  const ms = 8000 + (questionChars + optionsChars) * 45
  return Math.max(10_000, Math.min(90_000, ms))
}

/**
 * Cavabı FSRS qiymətinə çevirir. Test sualında tələbə özünü qiymətləndirmir,
 * ona görə doğruluq və cavab sürətindən istifadə edirik.
 * İlk görüşdə (kart yoxdur / New / reps=0) sürətli cavab təxmin ola bilər — Easy yox, Good verilir.
 */
export function gradeFromAnswer(a: { correct: boolean; ms: number; expectedMs: number }, card?: SrsCard): Grade {
  if (!a.correct) return Rating.Again
  if (a.ms > a.expectedMs * 1.6) return Rating.Hard
  if (a.ms < a.expectedMs * 0.4) {
    const firstReview = !card || card.state === State.New || card.reps === 0
    return firstReview ? Rating.Good : Rating.Easy
  }
  return Rating.Good
}

export function review(card: SrsCard | undefined, grade: Grade, now: Date): SrsCard {
  return scheduler.next(card ?? newCard(now), now, grade).card
}

/** 0..1: sualı indi düzgün xatırlama ehtimalı. Görülməmiş sual üçün null. */
export function retrievability(card: SrsCard | undefined, now: Date): number | null {
  if (!card || card.state === State.New) return null
  return scheduler.get_retrievability(card, now, false)
}

export const isDue = (card: SrsCard | undefined, now: Date) => !!card && card.state !== State.New && card.due.getTime() <= now.getTime()

export function toJSON(c: SrsCard): SrsCardJSON {
  return { ...c, due: c.due.toISOString(), last_review: c.last_review ? c.last_review.toISOString() : null, state: c.state }
}

export function fromJSON(j: SrsCardJSON): SrsCard {
  return { ...j, due: new Date(j.due), last_review: j.last_review ? new Date(j.last_review) : undefined, state: j.state as State }
}

export { Rating, State }
