import { describe, expect, it } from 'vitest'
import { board } from './board.ts'

describe('şərəf lövhəsi', () => {
  it('az cavablı tələbə sıralanmır, amma öz vəziyyətini görür; ID qaytarılmır', async () => {
    const db = {
      async rpc(fn: string, args: Record<string, unknown>) {
        expect(fn).toBe('board_rows'); expect(args).toEqual({ p_user: 'u1', p_subject: null })
        return { since: '2026-11-02', rows: [
          { name: 'Aysel M.', correct: 45, total: 50, me: false },
          { name: 'Elvin', correct: 30, total: 30, me: false },   // 30/30: Wilson sərhədi 45/50-dən yüksəkdir
          { name: 'Mən', correct: 5, total: 10, me: true },
        ] } as never
      },
    }
    const r = await board(db, 'u1', null)
    expect(r.top.map((x) => x.name)).toEqual(['Elvin', 'Aysel M.'])
    expect(r.top[0]!.rank).toBe(1)
    expect(r.me).toMatchObject({ rank: null, total: 10, me: true })
    expect(JSON.stringify(r)).not.toMatch(/u1|studentId/)
  })
})
