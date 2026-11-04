export type ID = string

/** 1 asan, 2 orta, 3 çətin (müəllimin qiymətləndirməsi və ya statistikadan). */
export type Level = 1 | 2 | 3

/** Alqoritmlərin gördüyü sual məlumatı. Sual mətni və cavab açarı burada yoxdur. */
export interface QuestionMeta {
  id: ID
  subjectId: ID
  topicId: ID
  level?: Level
  trap?: boolean
}

/** Deterministik təsadüfi ədəd generatoru (mulberry32). Eyni toxum eyni nəticə verir. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const t = a[i] as T
    a[i] = a[j] as T
    a[j] = t
  }
  return a
}
