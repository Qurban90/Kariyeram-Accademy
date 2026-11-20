/** Birbaşa (RLS ilə qorunan) oxumalar. Suallar burada YOXDUR: onlar yalnız Edge API-dən gəlir. */
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export interface Subject { id: string; name: string; sort: number }
export interface Topic { id: string; subject_id: string; name: string; sort: number; free: boolean }
export interface Enrollment { subject_id: string; access_until: string; /** Pulsuz mərhələnin verdiyi giriş (abunə deyil). */ free?: boolean }
export interface LiveSession {
  id: string; title: string; description: string; starts_at: string; ends_at: string
  state: 'scheduled' | 'live' | 'ended' | 'cancelled'; access: 'enrolled' | 'invite' | 'public'
  subject_id: string | null; host_id: string | null; venue_id: string
  venues: { name: string; kind: 'classroom' | 'hall'; door_label: string | null; capacity: number } | null
}
export interface DiaryEntry { id: string; kind: 'test' | 'grade' | 'note'; title: string; payload: Record<string, unknown>; created_at: string }
export interface Venue { id: string; name: string; kind: 'classroom' | 'hall'; subject_id: string | null; capacity: number; door_label: string | null; owner_id: string | null }

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}

export const useSubjects = () => useQuery({
  queryKey: ['subjects'],
  queryFn: () => rows<Subject[]>(supabase.from('subjects').select('id, name, sort').order('sort')),
})

export const useTopics = (subject?: string) => useQuery({
  queryKey: ['topics', subject ?? 'all'],
  queryFn: () => {
    let q = supabase.from('topics').select('id, subject_id, name, sort, free').order('sort')
    if (subject) q = q.eq('subject_id', subject)
    return rows<Topic[]>(q)
  },
})

/** Pulsuz mərhələ (app_config.free_access): server bütün mövzuları açır. Bayraq abunələrlə birlikdə oxunur ki,
 * `hasAccess` çağırılanda artıq məlum olsun. Oxuna bilməsə (köhnə server) abunə qaydası qüvvədədir. */
let freeAll = false
export const isFreeAccess = () => freeAll

export const useEnrollments = () => useQuery({
  queryKey: ['enrollments'],
  queryFn: async () => {
    const [list, cfg] = await Promise.all([
      rows<Enrollment[]>(supabase.from('enrollments').select('subject_id, access_until')),
      supabase.from('app_config').select('free_access').limit(1).maybeSingle(),
    ])
    freeAll = !cfg.error && (cfg.data as { free_access?: boolean } | null)?.free_access === true
    return list
  },
})

export function hasAccess(enr: Enrollment[] | undefined, subject: string, now = Date.now()): Enrollment | undefined {
  const real = enr?.find((e) => e.subject_id === subject && Date.parse(e.access_until) > now)
  if (real) return real
  // Pulsuz mərhələ: hamı bütün mövzulara girir (server də eyni bayrağı yoxlayır; canlı dərs abunəli qalır).
  if (freeAll) return { subject_id: subject, access_until: new Date(now + 86400_000).toISOString(), free: true }
  return undefined
}

export const useLiveSessions = () => useQuery({
  queryKey: ['live-sessions'],
  refetchInterval: 30_000,
  queryFn: () => rows<LiveSession[]>(
    supabase.from('live_sessions')
      .select('id, title, description, starts_at, ends_at, state, access, subject_id, host_id, venue_id, venues(name, kind, door_label, capacity)')
      .in('state', ['scheduled', 'live'])
      .gte('ends_at', new Date(Date.now() - 3600_000).toISOString())
      .order('starts_at')
      .limit(50),
  ),
})

export const useDiary = () => useQuery({
  queryKey: ['diary'],
  queryFn: () => rows<DiaryEntry[]>(
    supabase.from('diary_entries').select('id, kind, title, payload, created_at').order('created_at', { ascending: false }).limit(100),
  ),
})

export const useVenues = () => useQuery({
  queryKey: ['venues'],
  queryFn: () => rows<Venue[]>(supabase.from('venues').select('id, name, kind, subject_id, capacity, door_label, owner_id').order('sort')),
})

export interface ActiveSession { id: string; subject_id: string; mode: string; cursor: number; total: number; started_at: string; time_limit_s: number | null }

/** Yarımçıq test (tətbiq bağlanıbsa belə kursor serverdədir). Server eyni anda yalnız bir aktiv sessiya saxlayır.
 * `total` server sütunudur: sual ID-ləri və toxum klientə verilmir (bank qorunması). */
export const useActiveSession = () => useQuery({
  queryKey: ['active-session'],
  queryFn: async () => {
    const { data, error } = await supabase.from('test_sessions')
      .select('id, subject_id, mode, cursor, total, started_at, time_limit_s')
      .eq('state', 'active').order('started_at', { ascending: false }).limit(1)
    if (error) throw new Error(error.message)
    return ((data ?? [])[0] as ActiveSession | undefined) ?? null
  },
})

export interface LibraryItem { id: string; subject_id: string; topic_id: string | null; title: string; kind: 'text' | 'pdf'; free: boolean; created_at: string }
/** Şkafın siyahısı (yalnız metadata; məzmun API-dən icazə ilə). */
export const useLibrary = (subject?: string) => useQuery({
  queryKey: ['library', subject ?? 'all'],
  queryFn: () => {
    let q = supabase.from('library_items').select('id, subject_id, topic_id, title, kind, free, created_at').order('created_at', { ascending: false }).limit(200)
    if (subject) q = q.eq('subject_id', subject)
    return rows<LibraryItem[]>(q)
  },
})
