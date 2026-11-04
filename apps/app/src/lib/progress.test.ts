import { describe, expect, it } from 'vitest'
import { bakuDate, progressFrom } from './progress'

describe('medallar və seriya', () => {
  it('Bakı tarixi: UTC 21:30 → növbəti gün', () => {
    expect(bakuDate('2026-11-03T21:30:00Z')).toBe('2026-11-04')
    expect(bakuDate('2026-11-03T19:59:00Z')).toBe('2026-11-03')
  })
  it('7 gün ardıcıl test və mövzu ustası', () => {
    const now = new Date('2026-11-10T08:00:00Z')
    const entries = Array.from({ length: 7 }, (_, i) => ({
      kind: 'test', created_at: new Date(now.getTime() - i * 86400_000).toISOString(),
      payload: { correct: 9, by_topic: { t1: { name: 'Say sistemləri', total: 10, correct: 9 } } },
    }))
    entries.push({ kind: 'note', created_at: now.toISOString(), payload: {} } as never)
    const p = progressFrom(entries, now)
    expect(p.streak).toBe(7)
    expect(p.totalCorrect).toBe(63)
    expect(p.badges.map((b) => b.id)).toEqual(['streak-7', 'master-t1'])
  })
})
