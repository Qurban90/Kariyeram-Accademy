export type QStatus = 'draft' | 'reviewed' | 'stale'

export interface Question {
  id: string
  subject: string
  topic: string
  text: string
  options: string[]
  answer: number
  explain: string
  /** Qanun maddəsinə istinad. Qanun dəyişəndə status 'stale' olur. */
  lawRef?: string
  status: QStatus
  version: number
}

export interface Subject {
  id: string
  name: string
  /** Konspekt mətni (sonradan idxal skripti ilə gələcək). */
  note: string
}

export interface Pack {
  stage: string
  /** Aşağıdan yuxarıya: birinci fənn qalanın birinci mərtəbəsidir. */
  subjects: Subject[]
  questions: Question[]
}
