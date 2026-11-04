/** Müəllim analitikası: xam cavablar DB-dən, hesablama packages/core ilə (klassik test nəzəriyyəsi). */
import { analyzeItem, type ItemFlag } from '../../../packages/core/src/itemAnalysis.ts'
import { unwrap } from './errors.ts'
import type { Db } from './handlers.ts'

interface RawItem {
  question_id: string; stem: string; topic: string; answer_index: number; option_count: number; trap_marked: boolean
  responses: { c: number | null; p: number }[]
}

/** Prioritet: əvvəl açar şübhəsi, sonra fərqləndirməyən, çox asan/çətin, tələ, az məlumat. */
const SEVERITY: Record<ItemFlag, number> = { suspect_key: 0, non_discriminating: 1, too_hard: 2, too_easy: 3, trap: 4, insufficient_data: 5 }

export async function itemAnalysis(db: Db, staff: string, subject: string) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('staff_item_responses', { p_staff: staff, p_subject: subject }))
  const items = ((r.items as RawItem[]) ?? []).map((it) => {
    const rep = analyzeItem(it.responses.map((x) => ({ chosen: x.c, sessionPercent: Number(x.p) })), it.answer_index, it.option_count)
    return {
      questionId: it.question_id, stem: it.stem, topic: it.topic, trapMarked: it.trap_marked, answerIndex: it.answer_index,
      n: rep.n, p: rep.p, discrimination: rep.discrimination, pointBiserial: rep.pointBiserial, distractors: rep.distractors, flags: rep.flags,
    }
  })
  const rank = (f: ItemFlag[]) => Math.min(9, ...f.map((x) => SEVERITY[x]))
  items.sort((a, b) => rank(a.flags) - rank(b.flags) || b.n - a.n)
  return { items }
}
