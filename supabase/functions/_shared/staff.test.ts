import { describe, expect, it } from 'vitest'
import { itemAnalysis } from './staff.ts'

describe('staff/analysis', () => {
  it('xam cavablardan hesabat qurur və açar şübhəsini önə çıxarır', async () => {
    // Sual A: güclülər B seçir, zəiflər A (açar "A" yazılıb) → açar şübhəli.
    const suspect = [
      ...Array.from({ length: 20 }, () => ({ c: 1, p: 90 })),
      ...Array.from({ length: 20 }, () => ({ c: 0, p: 30 })),
    ]
    // Sual B: güclülər düz, zəiflər səhv → sağlam.
    const good = [
      ...Array.from({ length: 20 }, () => ({ c: 2, p: 90 })),
      ...Array.from({ length: 20 }, () => ({ c: 0, p: 30 })),
    ]
    const calls: unknown[] = []
    const db = {
      async rpc(fn: string, args: Record<string, unknown>) {
        calls.push([fn, args])
        return { items: [
          { question_id: 'good', stem: 'G', topic: 'T', answer_index: 2, option_count: 4, trap_marked: false, responses: good },
          { question_id: 'bad', stem: 'B', topic: 'T', answer_index: 0, option_count: 4, trap_marked: false, responses: suspect },
        ] } as never
      },
    }
    const r = await itemAnalysis(db, 'staff-1', 'inf')
    expect(calls).toEqual([['staff_item_responses', { p_staff: 'staff-1', p_subject: 'inf' }]])
    expect(r.items[0]!.questionId).toBe('bad')
    expect(r.items[0]!.flags).toContain('suspect_key')
    expect(r.items[1]!.flags).not.toContain('suspect_key')
    expect(r.items[1]!.n).toBe(40)
  })
  it('icazə xətası ötürülür', async () => {
    const db = { async rpc() { return { error: 'forbidden' } as never } }
    await expect(itemAnalysis(db, 's', 'inf')).rejects.toMatchObject({ code: 'forbidden', status: 403 })
  })
})
