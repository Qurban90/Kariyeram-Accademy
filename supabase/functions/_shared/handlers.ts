/**
 * Test və sessiya məntiqi (Deno-dan asılı deyil, vitest ilə test olunur).
 * Edge Function JWT-ni yoxlayır, sonra bu funksiyalar service_role ilə SQL RPC-ləri çağırır.
 */
import {
  assemble, expectedMs, fromJSON, gradeFromAnswer, review, toJSON,
  type AssembleRequest, type Candidate, type SrsCardJSON,
} from '../../../packages/core/src/index.ts'
import { ApiError, unwrap } from './errors.ts'

export { ApiError }

export interface Db {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T>
}

export interface StartBody {
  device: string
  subject: string
  mode: 'topic' | 'mixed' | 'mistakes' | 'exam'
  topicIds?: string[]
  size?: number
  timeLimitS?: number
}

interface CandidateRow {
  id: string
  topic_id: string
  level: 1 | 2 | 3
  trap: boolean
  card: SrsCardJSON | null
  last_correct: boolean | null
  last_seen: string | null
}

const SIZES = new Set([10, 20, 30, 50, 100])

/** Kriptoqrafik təsadüfi 31-bit toxum (Math.random proqnozlaşdırıla bilər). Testlər üçün inyeksiya olunur. */
export function randomSeed(): number {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0]! & 0x7fffffff
}

export async function startSession(db: Db, student: string, b: StartBody, now = new Date(), seed = randomSeed()) {
  if (b.size !== undefined && !SIZES.has(b.size)) throw new ApiError('bad_size')
  const rows = await db.rpc<CandidateRow[]>('candidates', { p_student: student, p_subject: b.subject, p_topic_ids: b.topicIds?.length ? b.topicIds : null })
  const pool: Candidate[] = rows.map((r) => ({
    id: r.id, subjectId: b.subject, topicId: r.topic_id, level: r.level, trap: r.trap,
    card: r.card ? fromJSON(r.card) : undefined,
    lastCorrect: r.last_correct === null ? undefined : r.last_correct,
    lastSeen: r.last_seen ? Date.parse(r.last_seen) : undefined,
  }))
  const topics = b.topicIds?.length ? b.topicIds : [...new Set(pool.map((q) => q.topicId))]
  let req: AssembleRequest
  if (b.mode === 'topic') req = { mode: 'topic', topicIds: topics, size: b.size }
  else if (b.mode === 'mistakes') req = { mode: 'mistakes', topicIds: b.topicIds, size: b.size ?? 50 }
  else if (b.mode === 'mixed') req = { mode: 'mixed', topicIds: topics, size: b.size ?? 20 }
  else req = { mode: 'exam', size: b.size ?? 50, blueprint: topics.map((t) => ({ topicId: t, share: 1 })), levelMix: { 1: 1, 2: 2, 3: 1 } }
  const ids = assemble(pool, req, now, seed).slice(0, 200)
  if (!ids.length) throw new ApiError(b.mode === 'mistakes' ? 'no_mistakes' : 'no_questions', 404)
  return unwrap(await db.rpc<Record<string, unknown>>('create_session', {
    p_student: student, p_device: b.device, p_mode: b.mode, p_subject: b.subject,
    p_question_ids: ids, p_seed: seed, p_time_limit_s: b.mode === 'exam' ? (b.timeLimitS ?? ids.length * 72) : null,
  }))
}

export async function nextQuestion(db: Db, student: string, b: { device: string; session: string }) {
  return unwrap(await db.rpc<Record<string, unknown>>('next_question', { p_student: student, p_device: b.device, p_session: b.session }))
}

export interface AnswerBody {
  device: string
  session: string
  question: string
  chosen: number | null
  ms: number
  /** Sual və variantların ümumi uzunluğu (gözlənilən vaxt üçün; klient sualı onsuz da görür). */
  chars: number
}

export async function answer(db: Db, student: string, b: AnswerBody, now = new Date()) {
  const r = unwrap(await db.rpc<Record<string, unknown>>('submit_answer', {
    p_student: student, p_device: b.device, p_session: b.session, p_question: b.question, p_chosen: b.chosen, p_ms: Math.round(b.ms),
  }))
  // İmtahan rejimində server "correct" qaytarmır; FSRS-i bitirəndə icmaldan yeniləyirik.
  if (typeof r.correct === 'boolean') await updateCard(db, student, b.question, r.correct, b.ms, b.chars, now)
  return r
}

async function updateCard(db: Db, student: string, question: string, correct: boolean, ms: number, chars: number, now: Date) {
  // Atomik yeniləmə: kart oxunur, TS-də hesablanır və köhnə dəyərlə (CAS) yazılır.
  // Bu arada başqa yazı olubsa srs_apply false qaytarır → yenidən oxuyub təkrarlayırıq (itkinin qarşısı).
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await db.rpc<CandidateRow[]>('card_of', { p_student: student, p_question: question })
    const prevJson = rows[0]?.card ?? null
    const prev = prevJson ? fromJSON(prevJson) : undefined
    const grade = gradeFromAnswer({ correct, ms, expectedMs: expectedMs(chars, 0) }, prev)
    const applied = await db.rpc<boolean>('srs_apply', {
      p_student: student, p_question: question, p_card: toJSON(review(prev, grade, now)), p_last_correct: correct, p_prev: prevJson,
    })
    if (applied) return
  }
  // Nadir hal: 3 dəfə ardıcıl toqquşma. Kart növbəti cavabda yenilənəcək; cavabın özü artıq qəbul olunub.
}

export async function finish(db: Db, student: string, b: { session: string }, now = new Date()) {
  const res = unwrap(await db.rpc<Record<string, unknown>>('finish_session', { p_student: student, p_session: b.session }))
  // Təkrar çağırış (already) kartları yenidən yeniləməməlidir: FSRS bir cavabı iki dəfə saymasın.
  if (res.mode === 'exam' && !res.already) {
    const rev = await db.rpc<{ items: { question_id: string; correct: boolean; stem: string }[] }>('session_review', { p_student: student, p_session: b.session })
    for (const it of rev.items ?? []) await updateCard(db, student, it.question_id, it.correct, 30_000, it.stem.length, now)
  }
  return res
}

export const reviewSession = async (db: Db, student: string, b: { session: string }) =>
  unwrap(await db.rpc<Record<string, unknown>>('session_review', { p_student: student, p_session: b.session }))
export const claimDevice = async (db: Db, student: string, b: { device: string }) =>
  db.rpc<Record<string, unknown>>('claim_device', { p_student: student, p_device: b.device })
export const redeemCode = async (db: Db, student: string, b: { code: string }) =>
  unwrap(await db.rpc<Record<string, unknown>>('redeem_code', { p_student: student, p_code: b.code }))

