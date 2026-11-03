import { describe, expect, it } from 'vitest'
import { samplePack } from '../content/sample'
import { dailyQuestion, dayKey, litDaysThisWeek, weekKeys } from './daily'
import { DAY, INTERVAL_DAYS, review, slotState, type Rec } from './leitner'
import { buildQueue, shuffleOptions } from './queue'
import { floorStats, isDoorOpen, toBlocks, totalCracks } from './tower'

const NOW = Date.UTC(2026, 10, 3, 12)

describe('leitner', () => {
  it('düzgün cavablar 3, 7, 14, 14 gün verir', () => {
    let r = review(undefined, true, NOW)
    expect((r.due - NOW) / DAY).toBe(INTERVAL_DAYS[1])
    r = review(r, true, NOW)
    expect((r.due - NOW) / DAY).toBe(INTERVAL_DAYS[2])
    r = review(r, true, NOW)
    expect((r.due - NOW) / DAY).toBe(INTERVAL_DAYS[3])
    r = review(r, true, NOW)
    expect((r.due - NOW) / DAY).toBe(14)
  })

  it('yanlış cavab 1 günə qaytarır və çat yaradır', () => {
    const good = review(review(undefined, true, NOW), true, NOW)
    const bad = review(good, false, NOW)
    expect(bad.box).toBe(0)
    expect((bad.due - NOW) / DAY).toBe(1)
    expect(bad.lastWrong).toBe(true)
    expect(slotState(bad, NOW)).toBe('crack')
  })

  it('slotState: yeni, daş, vaxtı keçmiş çat', () => {
    expect(slotState(undefined, NOW)).toBe('new')
    const r = review(undefined, true, NOW)
    expect(slotState(r, NOW)).toBe('stone')
    expect(slotState(r, NOW + 4 * DAY)).toBe('crack')
  })
})

describe('tower', () => {
  it('toBlocks 12-dən çox olmur və sıranı saxlayır', () => {
    const b = toBlocks(3, 1, 4)
    expect(b).toHaveLength(12)
    expect(b.indexOf('crack')).toBeGreaterThan(b.lastIndexOf('stone'))
    expect(toBlocks(0, 0, 4).every((x) => x === 'new')).toBe(true)
    expect(toBlocks(4, 4, 4).filter((x) => x !== 'new').length).toBeLessThanOrEqual(12)
  })

  it('stale suallar mərtəbə hesabına daxil deyil', () => {
    const subj = samplePack.subjects.find((s) => s.id === 'qanun')!
    const f = floorStats(subj, samplePack.questions, {}, NOW)
    expect(f.total).toBe(2)
  })

  it('qapı yalnız bütün mərtəbələr həddə çatanda açılır', () => {
    const recs: Record<string, Rec> = {}
    const answerAll = (subject: string, n: number) => {
      samplePack.questions.filter((q) => q.subject === subject && q.status !== 'stale').slice(0, n).forEach((q) => (recs[q.id] = review(undefined, true, NOW)))
    }
    const stats = () => samplePack.subjects.map((s) => floorStats(s, samplePack.questions, recs, NOW))
    expect(isDoorOpen(stats())).toBe(false)
    answerAll('dil', 2); answerAll('inf', 2); answerAll('mantiq', 2)
    expect(isDoorOpen(stats())).toBe(false)
    answerAll('qanun', 1)
    expect(isDoorOpen(stats())).toBe(true)
    recs['q1'] = review(recs['q1'], false, NOW)
    expect(totalCracks(stats())).toBe(1)
  })
})

describe('queue', () => {
  it('repair yalnız çatları verir', () => {
    const recs: Record<string, Rec> = { m1: review(undefined, false, NOW), d1: review(undefined, true, NOW) }
    const q = buildQueue('repair', samplePack.questions, recs, NOW)
    expect(q.map((x) => x.id)).toEqual(['m1'])
  })

  it('daily: 7 sual, stale yoxdur, çat birinci gəlir, fənlər növbələnir', () => {
    const recs: Record<string, Rec> = { i1: review(undefined, false, NOW) }
    const q = buildQueue('daily', samplePack.questions, recs, NOW)
    expect(q).toHaveLength(7)
    expect(q[0].id).toBe('i1')
    expect(q.some((x) => x.status === 'stale')).toBe(false)
    expect(new Set(q.map((x) => x.id)).size).toBe(7)
    expect(new Set(q.slice(1, 5).map((x) => x.subject)).size).toBeGreaterThan(2)
  })

  it('floor yalnız seçilən fənni verir', () => {
    const q = buildQueue('floor', samplePack.questions, {}, NOW, { subject: 'mantiq' })
    expect(q.length).toBeGreaterThan(0)
    expect(q.every((x) => x.subject === 'mantiq')).toBe(true)
  })

  it('shuffleOptions düzgün cavabı itirmir', () => {
    for (const q of samplePack.questions) {
      const s = shuffleOptions(q, Math.random)
      expect(s.options[s.answer]).toBe(q.options[q.answer])
    }
  })
})

describe('daily', () => {
  it('günün sualı eyni tarixə eyni sualdır', () => {
    const a = dailyQuestion(samplePack.questions, '2026-11-03')
    const b = dailyQuestion([...samplePack.questions].reverse(), '2026-11-03')
    expect(a?.id).toBe(b?.id)
    expect(a?.status).not.toBe('stale')
  })

  it('həftə bazar ertəsindən başlayır', () => {
    const wk = weekKeys(new Date(2026, 10, 4))
    expect(wk[0]).toBe('2026-11-02')
    expect(wk[6]).toBe('2026-11-08')
    expect(dayKey(new Date(2026, 10, 3))).toBe('2026-11-03')
    expect(litDaysThisWeek({ '2026-11-02': 3, '2026-11-04': 1, '2026-10-30': 5 }, new Date(2026, 10, 4))).toBe(2)
  })
})
