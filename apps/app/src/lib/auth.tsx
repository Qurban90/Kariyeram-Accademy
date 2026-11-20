/**
 * Sessiya və profil vəziyyəti. Marşrutlaşdırma bu vəziyyətə əsaslanır:
 * sessiya yoxdur → giriş; profil razılıqsızdır → onboarding; əks halda məktəb.
 */
import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState, Platform } from 'react-native'
import { supabase } from './supabase'
import { queryClient } from './queryClient'
import { crumb } from './diag'

export interface Profile {
  id: string
  display_name: string
  student_no: number
  role: 'student' | 'teacher' | 'admin'
  onboarded_at: string | null
  suspended_until: string | null
  show_on_board: boolean
}

interface AuthState {
  ready: boolean
  session: Session | null
  profile: Profile | null
  /** Profil yüklənərkən xəta (şəbəkə və s.). */
  profileError: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return }
    const { data, error } = await supabase.from('profiles')
      .select('id, display_name, student_no, role, onboarded_at, suspended_until, show_on_board').eq('id', s.user.id).maybeSingle()
    if (error) { setProfileError(error.message); return }
    setProfileError(null)
    if (!data) {
      // Token hələ etibarlıdır, amma profil yoxdur (hesab başqa cihazda silinib): sonsuz gözləmə əvəzinə çıxış.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      setSession(null)
    }
    setProfile(data as Profile | null)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session)
      if (alive) setReady(true)
    }).catch(() => {
      // SecureStore/Keystore oxunuşu uğursuz ola bilər: sonsuz yükləmə ekranı əvəzinə girişə keç.
      if (!alive) return
      crumb('session_restore_fail')
      setSession(null)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // TOKEN_REFRESHED zamanı profili yenidən oxumağa ehtiyac yoxdur.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void loadProfile(s).catch(() => {})
      // Çıxışda keşi təmizlə: növbəti istifadəçi əvvəlkinin gündəlik/nəticələrini görməsin.
      if (event === 'SIGNED_OUT') { queryClient.clear(); setProfile(null); setProfileError(null) }
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  // Native: tətbiq ön plandadırsa tokeni avtomatik yenilə (Supabase tövsiyəsi).
  useEffect(() => {
    if (Platform.OS === 'web') return
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    })
    return () => sub.remove()
  }, [])

  const value = useMemo<AuthState>(() => ({
    ready, session, profile, profileError,
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      // Yalnız bu cihazdan çıxış; server tərəfdə refresh token ləğv olunur.
      await supabase.auth.signOut({ scope: 'local' })
      queryClient.clear()
      setProfile(null)
    },
  }), [ready, session, profile, profileError, loadProfile])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth AuthProvider daxilində çağırılmalıdır')
  return v
}
