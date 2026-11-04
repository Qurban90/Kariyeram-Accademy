/**
 * Şərəf lövhəsi: həcmi deyil, keyfiyyəti mükafatlandırır.
 * Wilson aşağı sərhədi az cavabla təsadüfən yüksək faiz alanı önə keçirmir.
 */
export function wilsonLower(k: number, n: number, z = 1.96): number {
  if (n === 0) return 0
  const p = k / n
  const d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return (c - m) / d
}

export interface WeekRow {
  studentId: string
  correct: number
  total: number
}

export interface RankedRow extends WeekRow {
  score: number
  rank: number
}

/** Minimum cavab sayından az olan tələbə lövhəyə düşmür (spam və təsadüf qarşısı). */
export function rankWeek(rows: WeekRow[], minTotal = 30): RankedRow[] {
  const scored = rows
    .filter((r) => r.total >= minTotal)
    .map((r) => ({ ...r, score: Math.round(wilsonLower(r.correct, r.total) * 1000) / 10 }))
    .sort((a, b) => b.score - a.score || b.total - a.total || a.studentId.localeCompare(b.studentId))
  let rank = 0
  let prev: number | null = null
  return scored.map((r, i) => {
    if (r.score !== prev) rank = i + 1
    prev = r.score
    return { ...r, rank }
  })
}
