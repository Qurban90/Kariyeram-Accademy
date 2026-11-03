import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { dayKey } from '../engine/daily'
import { review, type Rec } from '../engine/leitner'

export interface Settings {
  sound: boolean
  haptic: boolean
  fontScale: number
  theme: 'auto' | 'light' | 'dark'
  /** "HH:MM". Xatırlatma server push tələb edir (növbəti mərhələ), indi yalnız saxlanılır. */
  reminder: string | null
}

export interface DailyResult {
  correct: boolean
  choice: number
}

interface State {
  recs: Record<string, Rec>
  /** Tarix -> həmin gün cavablanan sual sayı (pəncərələr). */
  days: Record<string, number>
  /** Tarix -> həmin gün hansı fənn(lər)də işlənib. */
  dayFloors: Record<string, string[]>
  daily: Record<string, DailyResult>
  favs: string[]
  settings: Settings
  tourDone: boolean
  answer: (qid: string, subject: string, correct: boolean) => void
  setDaily: (key: string, r: DailyResult) => void
  toggleFav: (qid: string) => void
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void
  finishTour: () => void
  replayTour: () => void
  reset: () => void
}

const initial = {
  recs: {} as Record<string, Rec>,
  days: {} as Record<string, number>,
  dayFloors: {} as Record<string, string[]>,
  daily: {} as Record<string, DailyResult>,
  favs: [] as string[],
  settings: { sound: true, haptic: true, fontScale: 1, theme: 'auto', reminder: null } as Settings,
  tourDone: false,
}

/**
 * Saxlama localStorage-dadır. `storage` dəyişdirilərsə (IndexedDB, Supabase),
 * qalan kod toxunulmaz qalır.
 */
export const useApp = create<State>()(
  persist(
    (set) => ({
      ...initial,
      answer: (qid, subject, correct) =>
        set((s) => {
          const now = Date.now()
          const k = dayKey()
          const floors = s.dayFloors[k] ?? []
          return {
            recs: { ...s.recs, [qid]: review(s.recs[qid], correct, now) },
            days: { ...s.days, [k]: (s.days[k] ?? 0) + 1 },
            dayFloors: { ...s.dayFloors, [k]: floors.includes(subject) ? floors : [...floors, subject] },
          }
        }),
      setDaily: (key, r) => set((s) => ({ daily: { ...s.daily, [key]: r } })),
      toggleFav: (qid) => set((s) => ({ favs: s.favs.includes(qid) ? s.favs.filter((x) => x !== qid) : [...s.favs, qid] })),
      setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),
      finishTour: () => set({ tourDone: true }),
      replayTour: () => set({ tourDone: false }),
      reset: () => set({ ...initial, settings: initial.settings }),
    }),
    { name: 'pille:v1', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
)
