import { describe, expect, it } from 'vitest'
import { answer, ApiError, finish, randomSeed, startSession, type Db } from './handlers.ts'

function fakeDb(responses: Record<string, unknown>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const db: Db = {
    async rpc(fn, args) {
      calls.push({ fn, args })
      const r = responses[fn]
      return (typeof r === 'function' ? (r as (a: unknown) => unknown)(args) : r) as never
    },
  }
  return { db, calls }
}

const rows = Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, topic_id: i < 20 ? 't1' : 't2', level: 2, trap: false, card: null, last_correct: null, last_seen: null }))

describe('api handlers', () => {
  it('session/start: namizədlərdən test yığır və serverə yalnız ID-lər göndərir', async () => {
    const { db, calls } = fakeDb({ candidates: rows, create_session: { session_id: 's1', total: 20 } })
    const r = await startSession(db, 'u1', { device: 'dev-12345678', subject: 'inf', mode: 'mixed', size: 20 }, new Date('2026-11-03'), 7)
    expect(r.session_id).toBe('s1')
    const cs = calls.find((c) => c.fn === 'create_session')!
    const ids = cs.args.p_question_ids as string[]
    expect(ids).toHaveLength(20)
    expect(new Set(ids).size).toBe(20)
    expect(cs.args.p_time_limit_s).toBeNull()
  })
  it('session/start: icazəsiz ölçü rədd edilir, imtahana vaxt limiti qoyulur', async () => {
    const { db } = fakeDb({ candidates: rows, create_session: { session_id: 's2', total: 10 } })
    await expect(startSession(db, 'u1', { device: 'd', subject: 'inf', mode: 'topic', size: 13 })).rejects.toBeInstanceOf(ApiError)
    const { db: db2, calls } = fakeDb({ candidates: rows, create_session: { session_id: 's3', total: 10 } })
    await startSession(db2, 'u1', { device: 'd', subject: 'inf', mode: 'exam', size: 10 }, new Date(), 1)
    expect(calls.find((c) => c.fn === 'create_session')!.args.p_time_limit_s).toBe(720)
  })
  it('session/start: səhv yoxdursa no_mistakes', async () => {
    const { db } = fakeDb({ candidates: rows })
    await expect(startSession(db, 'u1', { device: 'd', subject: 'inf', mode: 'mistakes' })).rejects.toMatchObject({ code: 'no_mistakes', status: 404 })
  })
  it('answer: düz cavabdan sonra FSRS kartı atomik (srs_apply) yenilənir', async () => {
    const { db, calls } = fakeDb({ submit_answer: { accepted: true, correct: true, done: false }, card_of: [], srs_apply: true })
    await answer(db, 'u1', { device: 'd', session: 's', question: 'q1', chosen: 2, ms: 12000, chars: 200 })
    const up = calls.find((c) => c.fn === 'srs_apply')!
    expect(up.args.p_last_correct).toBe(true)
    expect(up.args.p_prev).toBeNull()
    expect((up.args.p_card as { reps: number }).reps).toBe(1)
    expect(calls.some((c) => c.fn === 'upsert_card')).toBe(false)
  })
  it('answer: kart toqquşanda yenidən oxuyub təkrarlayır (itki yoxdur)', async () => {
    let applies = 0
    const { db, calls } = fakeDb({
      submit_answer: { accepted: true, correct: true, done: false },
      card_of: () => [{ card: { due: new Date().toISOString(), stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review: null } }],
      srs_apply: () => ++applies >= 2,
    })
    await answer(db, 'u1', { device: 'd', session: 's', question: 'q1', chosen: 0, ms: 12000, chars: 200 })
    expect(calls.filter((c) => c.fn === 'srs_apply')).toHaveLength(2)
    expect(calls.filter((c) => c.fn === 'card_of')).toHaveLength(2)
    const second = calls.filter((c) => c.fn === 'srs_apply')[1]!
    expect(second.args.p_prev).toMatchObject({ reps: 1 })
  })
  it('answer: imtahanda kart dərhal yenilənmir; server xətası ApiError olur', async () => {
    const { db, calls } = fakeDb({ submit_answer: { accepted: true, done: false } })
    await answer(db, 'u1', { device: 'd', session: 's', question: 'q1', chosen: 0, ms: 5000, chars: 100 })
    expect(calls.some((c) => c.fn === 'srs_apply')).toBe(false)
    const { db: db2 } = fakeDb({ submit_answer: { error: 'daily_limit' } })
    await expect(answer(db2, 'u1', { device: 'd', session: 's', question: 'q', chosen: 0, ms: 1, chars: 1 })).rejects.toMatchObject({ code: 'daily_limit', status: 429 })
  })
  it('finish: imtahandan sonra bütün kartlar icmaldan yenilənir', async () => {
    const { db, calls } = fakeDb({
      finish_session: { mode: 'exam', total: 2 },
      session_review: { items: [{ question_id: 'a', correct: true, stem: 'x' }, { question_id: 'b', correct: false, stem: 'y' }] },
      card_of: [], srs_apply: true,
    })
    await finish(db, 'u1', { session: 's' })
    expect(calls.filter((c) => c.fn === 'srs_apply')).toHaveLength(2)
  })
  it('finish: təkrar çağırış (already) kartları ikinci dəfə yeniləmir', async () => {
    const { db, calls } = fakeDb({ finish_session: { mode: 'exam', total: 2, already: true }, session_review: { items: [{ question_id: 'a', correct: true, stem: 'x' }] }, card_of: [], srs_apply: true })
    await finish(db, 'u1', { session: 's' })
    expect(calls.map((c) => c.fn)).toEqual(['finish_session'])
  })
  it('toxum: kriptoqrafik 31-bit tam ədəddir (Math.random deyil)', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThan(2 ** 31)
    }
    const seeds = new Set(Array.from({ length: 30 }, () => randomSeed()))
    expect(seeds.size).toBeGreaterThan(20)
  })
  it('session/start: defolt toxum create_session-a ötürülür', async () => {
    const { db, calls } = fakeDb({ candidates: rows, create_session: { session_id: 's4', total: 20 } })
    await startSession(db, 'u1', { device: 'dev-12345678', subject: 'inf', mode: 'mixed', size: 20 })
    const seed = calls.find((c) => c.fn === 'create_session')!.args.p_seed as number
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 31)
  })
})
