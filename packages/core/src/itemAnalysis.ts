/**
 * Klassik test nəzəriyyəsi ilə sual analizi.
 * Müəllim paneli üçün: hansı sual çox asandır, hansı tələlidir, hansının cavab açarı şübhəlidir.
 */
export interface ItemResponse {
  /** Tələbənin seçdiyi variant, boşdursa null. */
  chosen: number | null
  /** Həmin test sessiyasında tələbənin ümumi faizi (0..100). Güclü/zəif qrup bunun əsasında ayrılır. */
  sessionPercent: number
}

export type ItemFlag = 'insufficient_data' | 'too_easy' | 'too_hard' | 'non_discriminating' | 'suspect_key' | 'trap'

export interface ItemReport {
  n: number
  /** Düz cavab payı (çətinlik indeksi). */
  p: number
  /** Laplace hamarlanmış p: az cavabda kəskin rəqəmlərin qarşısını alır. */
  pSmoothed: number
  /** Yuxarı 27% ilə aşağı 27% arasında düz cavab fərqi. */
  discrimination: number
  /** Nöqtə-biserial korrelyasiya (düz cavab ↔ ümumi nəticə). */
  pointBiserial: number
  distractors: { index: number; share: number; upperShare: number }[]
  flags: ItemFlag[]
}

export const MIN_N = 30

export function analyzeItem(responses: ItemResponse[], correctIndex: number, optionCount: number): ItemReport {
  const n = responses.length
  const isRight = (r: ItemResponse) => r.chosen === correctIndex
  const k = responses.filter(isRight).length
  const p = n ? k / n : 0
  const pSmoothed = (k + 1) / (n + 2)

  const sorted = [...responses].sort((a, b) => b.sessionPercent - a.sessionPercent)
  const g = Math.max(1, Math.round(n * 0.27))
  const upper = sorted.slice(0, g)
  const lower = sorted.slice(-g)
  const rate = (arr: ItemResponse[], f: (r: ItemResponse) => boolean) => (arr.length ? arr.filter(f).length / arr.length : 0)
  const discrimination = n ? rate(upper, isRight) - rate(lower, isRight) : 0

  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
  const all = responses.map((r) => r.sessionPercent)
  const m = mean(all)
  const sd = Math.sqrt(mean(all.map((x) => (x - m) ** 2)))
  const m1 = mean(responses.filter(isRight).map((r) => r.sessionPercent))
  const m0 = mean(responses.filter((r) => !isRight(r)).map((r) => r.sessionPercent))
  const pointBiserial = sd > 0 && k > 0 && k < n ? ((m1 - m0) / sd) * Math.sqrt(p * (1 - p)) : 0

  const distractors = Array.from({ length: optionCount }, (_, i) => i)
    .filter((i) => i !== correctIndex)
    .map((i) => ({ index: i, share: rate(responses, (r) => r.chosen === i), upperShare: rate(upper, (r) => r.chosen === i) }))
    .sort((a, b) => b.share - a.share)

  const flags: ItemFlag[] = []
  if (n < MIN_N) flags.push('insufficient_data')
  else {
    if (p > 0.95) flags.push('too_easy')
    if (p < 0.15) flags.push('too_hard')
    const upperP = rate(upper, isRight)
    const top = distractors[0]
    if (discrimination < -0.05 || (top && top.upperShare > upperP)) flags.push('suspect_key')
    else if (discrimination < 0.1) flags.push('non_discriminating')
    if (!flags.includes('suspect_key') && p >= 0.15 && p <= 0.6 && top && top.share >= 0.3 && discrimination >= 0.1) flags.push('trap')
  }
  return { n, p, pSmoothed, discrimination, pointBiserial, distractors, flags }
}
