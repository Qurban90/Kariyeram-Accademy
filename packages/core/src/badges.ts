/** Ardıcıl günlər (seriya). `days` YYYY-MM-DD formatında, tələbənin yerli vaxtı ilə. */
export function streak(days: string[], today: string): number {
  const set = new Set(days)
  const d = new Date(`${today}T00:00:00Z`)
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1) // bu gün hələ işləməyibsə seriya dünəndən sayılır
  let n = 0
  while (set.has(d.toISOString().slice(0, 10))) {
    n++
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return n
}

export interface BadgeInput {
  activeDays: string[]
  today: string
  totalCorrect: number
  topics: { topicId: string; name: string; correct: number; total: number }[]
}

export interface Badge {
  id: string
  title: string
}

export function badges(x: BadgeInput): Badge[] {
  const out: Badge[] = []
  const s = streak(x.activeDays, x.today)
  for (const n of [7, 30, 100]) if (s >= n) out.push({ id: `streak-${n}`, title: `${n} gün ardıcıl` })
  for (const n of [100, 1000, 5000]) if (x.totalCorrect >= n) out.push({ id: `correct-${n}`, title: `${n} düz cavab` })
  for (const t of x.topics) if (t.total >= 50 && t.correct / t.total >= 0.9) out.push({ id: `master-${t.topicId}`, title: `${t.name} ustası` })
  return out
}
