import type { ID } from './types'

export interface AnswerRecord {
  questionId: ID
  topicId: ID
  /** Seçilmiş variant indeksi, boş buraxılıbsa null. */
  chosen: number | null
  correct: boolean
}

export interface Tally {
  total: number
  correct: number
  wrong: number
  blank: number
  /** 0..100, bir onluq dəqiqliklə */
  percent: number
}

export interface Score extends Tally {
  /** Səhv cavab cəzası tətbiq olunmuş xalis düz sayı. */
  net: number
  byTopic: Record<ID, Tally>
}

const round1 = (x: number) => Math.round(x * 10) / 10

function tally(list: AnswerRecord[]): Tally {
  const total = list.length
  const blank = list.filter((a) => a.chosen === null).length
  const correct = list.filter((a) => a.chosen !== null && a.correct).length
  const wrong = total - blank - correct
  return { total, correct, wrong, blank, percent: total ? round1((correct / total) * 100) : 0 }
}

/**
 * Test nəticəsi. `penaltyPerWrong` imtahan formatına görə konfiqurasiya olunur
 * (məsələn 0.25 = 4 səhv 1 düzü silir). Dövlət qulluğu formatı üçün dəqiq qayda rəsmi mənbədən təsdiqlənməlidir.
 */
export function score(answers: AnswerRecord[], opts: { penaltyPerWrong?: number } = {}): Score {
  const t = tally(answers)
  const byTopic: Record<ID, Tally> = {}
  for (const topic of new Set(answers.map((a) => a.topicId))) byTopic[topic] = tally(answers.filter((a) => a.topicId === topic))
  return { ...t, net: round1(t.correct - t.wrong * (opts.penaltyPerWrong ?? 0)), byTopic }
}

/** "Səhvlərim harada çoxdur": mövzuları səhv+boş payına görə sıralayır (minimum cavab sayı ilə). */
export function weakTopics(byTopic: Record<ID, Tally>, minTotal = 5): { topicId: ID; missRate: number; total: number }[] {
  return Object.entries(byTopic)
    .filter(([, t]) => t.total >= minTotal)
    .map(([topicId, t]) => ({ topicId, total: t.total, missRate: round1(((t.wrong + t.blank) / t.total) * 100) }))
    .sort((a, b) => b.missRate - a.missRate || b.total - a.total)
}
