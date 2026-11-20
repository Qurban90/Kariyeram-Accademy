import { describe, expect, it } from 'vitest'
import {
  allocate, analyzeItem, assemble, badges, expectedMs, fromJSON, gradeFromAnswer, interleave, isDue, newCard, paceSuspicion,
  rankWeek, Rating, retrievability, review, score, streak, toJSON, TokenBucket, weakTopics, wilsonLower, type Candidate, type ItemResponse,
} from './index.ts'

const NOW = new Date('2026-11-03T12:00:00Z')
const DAY = 86_400_000

describe('srs (FSRS)', () => {
  it('düz cavab intervalı uzadır, səhv cavab qısaldır', () => {
    let c = review(undefined, Rating.Good, NOW)
    c = review(c, Rating.Good, new Date(c.due.getTime()))
    const good = c.due.getTime() - NOW.getTime()
    const failed = review(c, Rating.Again, new Date(c.due.getTime()))
    expect(good).toBeGreaterThan(DAY)
    expect(failed.lapses).toBe(1)
    expect(failed.due.getTime() - c.due.getTime()).toBeLessThan(good)
  })
  it('retrievability vaxtla azalır, yeni kart üçün null', () => {
    expect(retrievability(newCard(NOW), NOW)).toBeNull()
    let c = review(undefined, Rating.Good, NOW)
    c = review(c, Rating.Good, new Date(c.due.getTime()))
    const r1 = retrievability(c, new Date(c.due.getTime() - DAY)) ?? 0
    const r2 = retrievability(c, new Date(c.due.getTime() + 30 * DAY)) ?? 0
    expect(r1).toBeGreaterThan(r2)
  })
  it('cavabdan qiymət: səhv=Again, yavaş=Hard, çox tez=Easy (təkrarda)', () => {
    const e = expectedMs(200, 200)
    const seen = review(review(undefined, Rating.Good, NOW), Rating.Good, new Date(NOW.getTime() + DAY))
    expect(gradeFromAnswer({ correct: false, ms: 1000, expectedMs: e })).toBe(Rating.Again)
    expect(gradeFromAnswer({ correct: true, ms: e * 2, expectedMs: e })).toBe(Rating.Hard)
    expect(gradeFromAnswer({ correct: true, ms: e * 0.3, expectedMs: e }, seen)).toBe(Rating.Easy)
    expect(gradeFromAnswer({ correct: true, ms: e, expectedMs: e })).toBe(Rating.Good)
  })
  it('ilk görüşdə sürətli cavab Easy vermir (təxmin ola bilər)', () => {
    const e = expectedMs(200, 200)
    const fast = { correct: true, ms: e * 0.2, expectedMs: e }
    expect(gradeFromAnswer(fast)).toBe(Rating.Good)
    expect(gradeFromAnswer(fast, newCard(NOW))).toBe(Rating.Good)
    const once = review(undefined, Rating.Good, NOW)
    expect(gradeFromAnswer(fast, once)).toBe(Rating.Easy)
  })
  it('JSON-a və geri çevirmə itkisizdir', () => {
    const c = review(undefined, Rating.Good, NOW)
    const back = fromJSON(toJSON(c))
    expect(back.due.getTime()).toBe(c.due.getTime())
    expect(back.stability).toBe(c.stability)
  })
})

describe('allocate (Hamilton)', () => {
  it('cəmi saxlayır və tutumu aşmır', () => {
    const q = allocate(10, [1, 1, 1], [100, 100, 100])
    expect(q.reduce((a, b) => a + b, 0)).toBe(10)
    expect(Math.max(...q) - Math.min(...q)).toBeLessThanOrEqual(1)
    const capped = allocate(10, [5, 1, 1], [2, 100, 100])
    expect(capped[0]).toBe(2)
    expect(capped.reduce((a, b) => a + b, 0)).toBe(10)
    expect(allocate(50, [1, 1], [3, 4]).reduce((a, b) => a + b, 0)).toBe(7)
  })
})

function pool(): Candidate[] {
  const out: Candidate[] = []
  for (const t of ['excel', 'fonetika', 'konst']) for (let i = 0; i < 20; i++) out.push({ id: `${t}-${i}`, subjectId: 's', topicId: t, level: ((i % 3) + 1) as 1 | 2 | 3 })
  return out
}

describe('assemble', () => {
  it('mixed: istənən say, təkrarsız, mövzular növbələnir, zəif mövzu çox pay alır', () => {
    const p = pool()
    // fonetika zəifdir: çox səhv, aşağı xatırlama
    for (const q of p.filter((x) => x.topicId === 'fonetika')) {
      q.card = review(undefined, Rating.Again, new Date(NOW.getTime() - 20 * DAY))
      q.lastCorrect = false
    }
    for (const q of p.filter((x) => x.topicId === 'excel')) {
      let c = review(undefined, Rating.Easy, new Date(NOW.getTime() - 2 * DAY))
      c = review(c, Rating.Easy, new Date(NOW.getTime() - DAY))
      q.card = c
      q.lastCorrect = true
    }
    const ids = assemble(p, { mode: 'mixed', topicIds: ['excel', 'fonetika', 'konst'], size: 30 }, NOW, 1)
    expect(ids).toHaveLength(30)
    expect(new Set(ids).size).toBe(30)
    const count = (t: string) => ids.filter((id) => id.startsWith(t)).length
    expect(count('fonetika')).toBeGreaterThan(count('excel'))
    expect(ids[0]?.split('-')[0]).not.toBe(ids[1]?.split('-')[0])
  })
  it('mistakes yalnız səhv cavablananları verir', () => {
    const p = pool()
    p[3]!.lastCorrect = false
    p[3]!.card = review(undefined, Rating.Again, NOW)
    p[4]!.lastCorrect = true
    expect(assemble(p, { mode: 'mistakes' }, NOW, 1)).toEqual([p[3]!.id])
  })
  it('exam: blueprint payı və çətinlik qarışığı, eyni toxum eyni test', () => {
    const p = pool()
    const req = { mode: 'exam' as const, size: 30, blueprint: [{ topicId: 'konst', share: 2 }, { topicId: 'excel', share: 1 }], levelMix: { 1: 1, 2: 1, 3: 1 } }
    const a = assemble(p, req, NOW, 42)
    expect(a).toHaveLength(30)
    expect(a.filter((id) => id.startsWith('konst')).length).toBe(20)
    expect(assemble(p, req, NOW, 42)).toEqual(a)
    expect(assemble(p, req, NOW, 43)).not.toEqual(a)
  })
  it('exam: təkrarlanan topicId eyni sualı iki dəfə seçmir', () => {
    const p = pool()
    const dup = { mode: 'exam' as const, size: 30, blueprint: [{ topicId: 'konst', share: 1 }, { topicId: 'konst', share: 1 }, { topicId: 'excel', share: 1 }], levelMix: { 1: 1, 2: 1, 3: 1 } }
    const a = assemble(p, dup, NOW, 42)
    expect(new Set(a).size).toBe(a.length)
    expect(a).toHaveLength(30)
    const noMix = assemble(p, { mode: 'exam', size: 25, blueprint: [{ topicId: 'konst', share: 1 }, { topicId: 'konst', share: 1 }] }, NOW, 7)
    expect(new Set(noMix).size).toBe(noMix.length)
    expect(noMix.length).toBeLessThanOrEqual(20) // mövzuda cəmi 20 sual var
  })
  it('mixed: təkrarlanan topicId kvotanı şişirtmir', () => {
    const ids = assemble(pool(), { mode: 'mixed', topicIds: ['excel', 'excel', 'fonetika'], size: 30 }, NOW, 1)
    expect(new Set(ids).size).toBe(30)
  })
  it('topic: vaxtı keçmiş sual birinci gəlir', () => {
    const p = pool().filter((q) => q.topicId === 'konst')
    p[7]!.card = review(undefined, Rating.Good, new Date(NOW.getTime() - 30 * DAY))
    p[7]!.lastCorrect = true
    expect(isDue(p[7]!.card, NOW)).toBe(true)
    expect(assemble(p, { mode: 'topic', topicIds: ['konst'] }, NOW, 5)[0]).toBe(p[7]!.id)
  })
  it('interleave mövzuları növbələyir', () => {
    expect(interleave(['a1', 'a2', 'b1', 'b2'], (id) => id[0]!)).toEqual(['a1', 'b1', 'a2', 'b2'])
  })
})

describe('score', () => {
  it('düz, səhv, boş, faiz və mövzu üzrə', () => {
    const s = score([
      { questionId: '1', topicId: 'a', chosen: 0, correct: true },
      { questionId: '2', topicId: 'a', chosen: 1, correct: false },
      { questionId: '3', topicId: 'b', chosen: null, correct: false },
      { questionId: '4', topicId: 'b', chosen: 2, correct: true },
    ], { penaltyPerWrong: 0.25 })
    expect(s).toMatchObject({ total: 4, correct: 2, wrong: 1, blank: 1, percent: 50, net: 1.8 })
    expect(s.byTopic.b).toMatchObject({ blank: 1, correct: 1 })
    expect(weakTopics(s.byTopic, 1)[0]?.missRate).toBe(50)
  })
})

describe('itemAnalysis', () => {
  const mk = (n: number, f: (i: number) => ItemResponse) => Array.from({ length: n }, (_, i) => f(i))
  it('az məlumatla bayraq qoymur', () => {
    expect(analyzeItem(mk(10, () => ({ chosen: 0, sessionPercent: 50 })), 0, 4).flags).toEqual(['insufficient_data'])
  })
  it('güclülər düz, zəiflər eyni yanlışı seçir: tələli sual', () => {
    // 100 cavab: güclülər (yüksək faiz) düz, zəiflərin çoxu variant 2-yə düşür
    const r = mk(100, (i) => ({ sessionPercent: i, chosen: i >= 60 ? 0 : i % 5 === 0 ? 1 : 2 }))
    const rep = analyzeItem(r, 0, 4)
    expect(rep.p).toBeCloseTo(0.4, 2)
    expect(rep.discrimination).toBeGreaterThan(0.5)
    expect(rep.flags).toContain('trap')
    expect(rep.distractors[0]?.index).toBe(2)
  })
  it('güclülər "yanlış" variantı seçirsə: cavab açarı şübhəlidir', () => {
    const r = mk(100, (i) => ({ sessionPercent: i, chosen: i >= 50 ? 3 : 0 }))
    expect(analyzeItem(r, 0, 4).flags).toContain('suspect_key')
  })
  it('hamı düz: çox asan', () => {
    expect(analyzeItem(mk(40, (i) => ({ sessionPercent: i, chosen: 1 })), 1, 4).flags).toContain('too_easy')
  })
})

describe('leaderboard', () => {
  it('Wilson: 9/10 < 90/100', () => {
    expect(wilsonLower(9, 10)).toBeLessThan(wilsonLower(90, 100))
  })
  it('az cavabı lövhəyə buraxmır, bərabər xala bərabər yer', () => {
    const r = rankWeek([
      { studentId: 'a', correct: 95, total: 100 },
      { studentId: 'b', correct: 10, total: 10 },
      { studentId: 'c', correct: 95, total: 100 },
      { studentId: 'd', correct: 60, total: 100 },
    ])
    expect(r.map((x) => x.studentId)).toEqual(['a', 'c', 'd'])
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3])
  })
})

describe('badges', () => {
  it('seriya və medallar', () => {
    const days = ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']
    expect(streak(days, '2026-11-03')).toBe(7)
    expect(streak(days.slice(0, 6), '2026-11-03')).toBe(6)
    const b = badges({ activeDays: days, today: '2026-11-03', totalCorrect: 120, topics: [{ topicId: 'fon', name: 'Fonetika', correct: 48, total: 50 }] })
    expect(b.map((x) => x.id)).toEqual(['streak-7', 'correct-100', 'master-fon'])
  })
})

describe('antiAbuse', () => {
  it('token bucket limiti saxlayır və yenilənir', () => {
    const b = new TokenBucket(3, 1, 0)
    expect([b.take(0), b.take(0), b.take(0), b.take(0)]).toEqual([true, true, true, false])
    expect(b.take(1500)).toBe(true)
  })
  it('token bucket: saat geriyə gedəndə mənfi token yaranmır', () => {
    const b = new TokenBucket(3, 1, 0)
    expect(b.take(1000)).toBe(true)
    expect(b.take(1000)).toBe(true)
    expect(b.take(1000)).toBe(true)
    expect(b.take(500)).toBe(false) // geriyə sıçrayış: token əlavə olunmur, limit qalır
    expect(b.take(1000)).toBe(false)
    expect(b.take(2000)).toBe(true) // 1 san irəli: 1 token bərpa
  })
  it('çox sürətli cavablar şübhəlidir', () => {
    expect(paceSuspicion(Array(20).fill(800))).toBe(true)
    expect(paceSuspicion(Array(20).fill(9000))).toBe(false)
    expect(paceSuspicion(Array(5).fill(100))).toBe(false)
  })
})
