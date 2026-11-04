import { isDue, retrievability, type SrsCard } from './srs.ts'
import { rng, shuffle, type ID, type Level, type QuestionMeta } from './types.ts'

export interface Candidate extends QuestionMeta {
  card?: SrsCard
  /** Son cavab: true düz, false səhv, null boş, undefined heç görülməyib. */
  lastCorrect?: boolean | null
  lastSeen?: number
}

export type AssembleRequest =
  | { mode: 'topic'; topicIds: ID[]; size?: number }
  | { mode: 'mixed'; topicIds: ID[]; size: number }
  | { mode: 'mistakes'; topicIds?: ID[]; size?: number }
  | { mode: 'exam'; blueprint: { topicId: ID; share: number }[]; size: number; levelMix?: Partial<Record<Level, number>> }

const DAY = 86_400_000
const RECENT_MS = 10 * 60_000

/**
 * Largest-remainder (Hamilton) metodu: `total` sayını çəkilərə görə tam ədədlərə bölür,
 * hər hissə öz tutumundan (`cap`) çox ola bilməz, artıq qalan pay başqalarına keçir.
 */
export function allocate(total: number, weights: number[], caps: number[]): number[] {
  const n = weights.length
  const out = new Array<number>(n).fill(0)
  let remaining = Math.min(total, caps.reduce((a, b) => a + b, 0))
  let active = weights.map((w, i) => (w > 0 && (caps[i] ?? 0) > 0 ? i : -1)).filter((i) => i >= 0)
  while (remaining > 0 && active.length) {
    const wsum = active.reduce((a, i) => a + (weights[i] ?? 0), 0)
    const raw = active.map((i) => ({ i, v: (remaining * (weights[i] ?? 0)) / wsum }))
    let given = 0
    for (const r of raw) {
      const room = (caps[r.i] ?? 0) - (out[r.i] ?? 0)
      const take = Math.min(room, Math.floor(r.v))
      out[r.i] = (out[r.i] ?? 0) + take
      given += take
    }
    let left = remaining - given
    const order = [...raw].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)) || (weights[b.i] ?? 0) - (weights[a.i] ?? 0))
    for (const r of order) {
      if (left <= 0) break
      if ((out[r.i] ?? 0) < (caps[r.i] ?? 0)) {
        out[r.i] = (out[r.i] ?? 0) + 1
        left--
      }
    }
    remaining = left
    active = active.filter((i) => (out[i] ?? 0) < (caps[i] ?? 0))
  }
  return out
}

/** Məşq prioriteti: vaxtı keçmiş, zəif xatırlanan, yeni və tələli suallar öndə. */
export function practicePriority(c: Candidate, now: Date, jitter: number): number {
  const r = retrievability(c.card, now)
  let s = 0
  if (isDue(c.card, now)) {
    const overdueDays = Math.max(0, (now.getTime() - (c.card as SrsCard).due.getTime()) / DAY)
    s += 1 + Math.min(1, overdueDays / 7)
  }
  if (c.lastCorrect === false) s += 0.8
  s += r === null ? 0.6 : 1 - r
  if (c.trap) s += 0.15
  if (c.lastSeen && now.getTime() - c.lastSeen < RECENT_MS) s -= 2
  return s + jitter * 0.05
}

/** Mövzu üzrə mənimsəmə: görülmüş sualların orta xatırlama ehtimalı (görülməmiş = 0.5). */
export function topicMastery(pool: Candidate[], topicId: ID, now: Date): number {
  const qs = pool.filter((q) => q.topicId === topicId)
  if (!qs.length) return 0
  return qs.reduce((a, q) => a + (retrievability(q.card, now) ?? 0.5), 0) / qs.length
}

/** Mövzuları növbə ilə qarışdırır (interleaving): eyni mövzudan ardıcıl çox sual gəlmir. */
export function interleave(ids: ID[], topicOf: (id: ID) => ID): ID[] {
  const lanes = new Map<ID, ID[]>()
  for (const id of ids) {
    const t = topicOf(id)
    lanes.set(t, [...(lanes.get(t) ?? []), id])
  }
  const out: ID[] = []
  let progressed = true
  while (progressed) {
    progressed = false
    for (const lane of lanes.values()) {
      const id = lane.shift()
      if (id) {
        out.push(id)
        progressed = true
      }
    }
  }
  return out
}

export function assemble(pool: Candidate[], req: AssembleRequest, now: Date, seed: number): ID[] {
  const rand = rng(seed)
  const byId = new Map(pool.map((q) => [q.id, q]))
  const topicOf = (id: ID) => byId.get(id)?.topicId ?? ''
  const ranked = (qs: Candidate[]) =>
    qs.map((q) => ({ q, s: practicePriority(q, now, rand()) })).sort((a, b) => b.s - a.s).map((x) => x.q)

  if (req.mode === 'mistakes') {
    const qs = pool.filter((q) => q.lastCorrect === false && (!req.topicIds || req.topicIds.includes(q.topicId)))
    const sorted = qs.sort((a, b) => (retrievability(a.card, now) ?? 0) - (retrievability(b.card, now) ?? 0) || (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
    return sorted.slice(0, req.size ?? 50).map((q) => q.id)
  }

  if (req.mode === 'topic') {
    const qs = ranked(pool.filter((q) => req.topicIds.includes(q.topicId)))
    return qs.slice(0, req.size ?? qs.length).map((q) => q.id)
  }

  if (req.mode === 'mixed') {
    const topics = req.topicIds.filter((t) => pool.some((q) => q.topicId === t))
    // Zəif mövzular daha çox pay alır: w = 1 + (1 - mənimsəmə)
    const weights = topics.map((t) => 1 + (1 - topicMastery(pool, t, now)))
    const caps = topics.map((t) => pool.filter((q) => q.topicId === t).length)
    const quota = allocate(req.size, weights, caps)
    const picked: ID[] = []
    topics.forEach((t, i) => {
      picked.push(...ranked(pool.filter((q) => q.topicId === t)).slice(0, quota[i] ?? 0).map((q) => q.id))
    })
    return interleave(picked, topicOf)
  }

  // exam: blueprint üzrə kvota, aralıqlı təkrar nəzərə alınmır, sıra təsadüfidir.
  const bp = req.blueprint.filter((b) => b.share > 0)
  const caps = bp.map((b) => pool.filter((q) => q.topicId === b.topicId).length)
  const quota = allocate(req.size, bp.map((b) => b.share), caps)
  const picked: ID[] = []
  bp.forEach((b, i) => {
    const inTopic = shuffle(pool.filter((q) => q.topicId === b.topicId), rand)
    const want = quota[i] ?? 0
    if (!req.levelMix) {
      picked.push(...inTopic.slice(0, want).map((q) => q.id))
      return
    }
    const levels: Level[] = [1, 2, 3]
    const lcaps = levels.map((l) => inTopic.filter((q) => (q.level ?? 2) === l).length)
    const lq = allocate(want, levels.map((l) => req.levelMix?.[l] ?? 0), lcaps)
    const chosen = new Set<ID>()
    levels.forEach((l, k) => inTopic.filter((q) => (q.level ?? 2) === l).slice(0, lq[k] ?? 0).forEach((q) => chosen.add(q.id)))
    for (const q of inTopic) if (chosen.size < want) chosen.add(q.id)
    picked.push(...chosen)
  })
  return shuffle(picked, rand)
}
