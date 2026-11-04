/**
 * Edge API klienti. Bütün tələbə əməliyyatları buradan keçir: server JWT-ni yoxlayır və istifadəçini
 * tokendən götürür (gövdədəki ID-yə inanmır).
 */
import { router } from 'expo-router'
import { config } from '../config'
import { errorText } from '../i18n/az'
import { getDeviceId } from './device'
import { supabase } from './supabase'

export class ApiFailure extends Error {
  constructor(public code: string, public status: number, public requestId?: string) {
    super(errorText(code))
    this.name = 'ApiFailure'
  }
}

/** Şəbəkə xətası zamanı təkrar cəhd yalnız oxuma tipli (idempotent) marşrutlar üçündür. */
const IDEMPOTENT = new Set(['question/next', 'session/finish', 'session/review', 'live/hands', 'live/attendance', 'account/export'])

async function once<T>(route: string, body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiFailure('unauthorized', 401)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), config.requestTimeoutMs)
  let res: Response
  try {
    res = await fetch(`${config.apiBase}/${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, apikey: config.supabaseAnonKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch (e) {
    throw new ApiFailure((e as Error).name === 'AbortError' ? 'timeout' : 'network', 0)
  } finally {
    clearTimeout(timer)
  }
  let json: Record<string, unknown> = {}
  try { json = (await res.json()) as Record<string, unknown> } catch { /* boş cavab */ }
  if (!res.ok) {
    const code = typeof json.error === 'string' ? json.error : res.status === 401 ? 'unauthorized' : 'internal'
    // Yeni şərt versiyası dərc olunubsa, istənilən ekrandan razılıq səhifəsinə yönləndiririk.
    if (code === 'consent_required') setTimeout(() => router.replace('/onboarding'), 0)
    throw new ApiFailure(code, res.status, typeof json.requestId === 'string' ? json.requestId : undefined)
  }
  return json as T
}

export async function call<T = Record<string, unknown>>(route: string, body: Record<string, unknown> = {}, opts: { device?: boolean } = {}): Promise<T> {
  const payload = opts.device ? { ...body, device: await getDeviceId() } : body
  const attempts = IDEMPOTENT.has(route) ? 3 : 1
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await once<T>(route, payload)
    } catch (e) {
      last = e
      const retriable = e instanceof ApiFailure && (e.code === 'network' || e.code === 'timeout' || e.status >= 502)
      if (!retriable || i === attempts - 1) break
      await new Promise((r) => setTimeout(r, 400 * 2 ** i))
    }
  }
  throw last
}

// ---- Tiplər (server cavabları) ----
export type Mode = 'topic' | 'mixed' | 'mistakes' | 'exam'

export interface Question {
  done: false
  position: number
  total: number
  question_id: string
  stem: string
  options: string[]
  level: 1 | 2 | 3
  trap: boolean
  mode: Mode
  watermark: number | string
  time_left_s: number | null
}
export type NextResult = Question | { done: true; time_up?: boolean }

export interface AnswerResult {
  accepted: true
  done: boolean
  correct?: boolean
  correct_display?: number
  explanation?: string
  option_explanations?: string[]
  law_ref?: string | null
  trap?: boolean
}

export interface TopicTally { name: string; total: number; correct: number; wrong: number; blank: number }
export interface SessionResult {
  total: number; correct: number; wrong: number; blank: number; percent: number
  by_topic: Record<string, TopicTally>; mode: Mode
}
export interface ReviewItem {
  position: number; question_id: string; topic: string; stem: string; options: string[]
  chosen_display: number | null; correct_display: number; correct: boolean
  explanation: string; option_explanations: string[]; trap: boolean; law_ref: string | null
}

export interface LiveJoin {
  url: string; token: string; role: 'host' | 'cohost' | 'speaker' | 'audience'; seat: number | null
  title: string; state: string; canPublish: boolean; canPublishScreen: boolean; chatEnabled: boolean; onlyHostAudio: boolean
}
export interface Hand { user_id: string; name: string; seat: number | null; raised_at: string }

export interface ItemStat {
  questionId: string; stem: string; topic: string; trapMarked: boolean; answerIndex: number
  n: number; p: number; discrimination: number; pointBiserial: number
  distractors: { index: number; share: number; upperShare: number }[]; flags: string[]
}

export interface BoardRow { rank: number | null; name: string; score: number | null; total: number; me: boolean }
export interface BoardResult { since: string; minTotal: number; top: BoardRow[]; me: BoardRow | null }

export const api = {
  claimDevice: () => call<{ replaced: boolean }>('device/claim', {}, { device: true }),
  redeem: (code: string) => call<{ subject_id: string; access_until?: string; already?: boolean }>('code/redeem', { code }),
  consent: (docs: string[], displayName?: string) => call('account/consent', displayName ? { docs, displayName } : { docs }),
  revoke: (doc: 'marketing' | 'recording') => call('account/revoke', { doc }),
  exportData: () => call<Record<string, unknown>>('account/export'),
  deleteAccount: (confirm: string) => call('account/delete', { confirm }),
  staffCodes: (subject: string, count: number, days: number) => call<{ codes: string[]; subject: string; days: number }>('staff/codes', { subject, count, days }),
  setQuestionStatus: (question: string, status: 'draft' | 'review' | 'published' | 'retired') => call<{ status: string; changed: boolean }>('staff/question/status', { question, status }),
  analysis: (subject: string) => call<{ items: ItemStat[] }>('staff/analysis', { subject }),
  board: (subject?: string) => call<BoardResult>('board', subject ? { subject } : {}),
  setBoardVisibility: (show: boolean) => call<{ show: boolean }>('account/board', { show }),
  clientEvent: (kind: 'screenshot' | 'screen_recording', context?: string) => call('client/event', context ? { kind, context } : { kind }),

  start: (b: { subject: string; mode: Mode; topicIds?: string[]; size?: number }) =>
    call<{ session_id: string; total: number }>('session/start', b, { device: true }),
  next: (session: string) => call<NextResult>('question/next', { session }, { device: true }),
  answer: (b: { session: string; question: string; chosen: number | null; ms: number; chars: number }) =>
    call<AnswerResult>('answer', b, { device: true }),
  finish: (session: string) => call<SessionResult>('session/finish', { session }),
  review: (session: string) => call<{ watermark: number | string; items: ReviewItem[] }>('session/review', { session }),

  liveJoin: (session: string) => call<LiveJoin>('live/join', { session }),
  liveLeave: (session: string) => call('live/leave', { session }),
  raiseHand: (session: string) => call<{ position: number }>('live/hand/raise', { session }),
  lowerHand: (session: string) => call('live/hand/lower', { session }),
  hands: (session: string) => call<{ hands: Hand[] }>('live/hands', { session }),
  setRole: (session: string, target: string, role: 'speaker' | 'audience' | 'cohost') => call('live/role', { session, target, role }),
  settings: (session: string, s: { onlyHostAudio?: boolean; chatEnabled?: boolean }) =>
    call<{ onlyHostAudio: boolean; chatEnabled: boolean; silenced: number }>('live/settings', { session, ...s }),
  ban: (session: string, target: string) => call('live/ban', { session, target }),
  setState: (session: string, state: 'live' | 'ended' | 'cancelled') => call<{ state: string }>('live/state', { session, state }),
  chat: (session: string, body: string) => call<{ id: number }>('live/chat', { session, body }),
  create: (b: { venue: string; title: string; startsAt: string; endsAt: string; access: 'enrolled' | 'invite' | 'public'; subject?: string; description?: string }) =>
    call<{ session_id: string }>('live/create', b),
}
