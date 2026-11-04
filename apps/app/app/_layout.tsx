import { t } from '../src/i18n/az'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack, router, useSegments, type ErrorBoundaryProps } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Button, ErrorBox, H, Loading, P, Screen } from '../src/components/ui'
import { configError } from '../src/config'
import { AuthProvider, useAuth } from '../src/lib/auth'
import { ApiFailure } from '../src/lib/api'
import { checkAppConfig, useAppStatus } from '../src/lib/appStatus'
import { MfaChallenge, useMfaState } from '../src/components/Mfa'
import { colors } from '../src/theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // İcazə/razılıq xətalarını təkrar etmək mənasızdır.
      retry: (n, e) => !(e instanceof ApiFailure && e.status >= 400 && e.status < 500) && n < 2,
    },
  },
})

const PUBLIC = new Set(['sign-in'])

/** Marşrut qoruyucusu: sessiya → razılıq → məktəb. */
function Gate() {
  const { ready, session, profile, profileError, refreshProfile, signOut } = useAuth()
  // Sessiya dəyişəndə (giriş, token yenilənməsi) MFA səviyyəsi yenidən yoxlanır.
  const mfa = useMfaState(session ? `${session.user.id}:${session.access_token.slice(-16)}` : null)
  const segments = useSegments()
  const first = segments[0] ?? ''
  const app = useAppStatus()
  useEffect(() => {
    void checkAppConfig()
    // Uzun açıq qalan tətbiq texniki işin bitdiyini və ya yeni minimum versiyanı görsün.
    const id = setInterval(() => { void checkAppConfig() }, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!session) { if (!PUBLIC.has(first)) router.replace('/sign-in'); return }
    if (!profile) return
    if (!profile.onboarded_at) { if (first !== 'onboarding') router.replace('/onboarding'); return }
    // Onboarding-ə yenilənmiş şərtlər üçün (consent_required) qayıtmaq mümkündür, ona görə oradan avtomatik çıxarmırıq.
    if (PUBLIC.has(first)) router.replace('/')
  }, [ready, session, profile, first])

  // Admin texniki iş rejimində də daxil olur (rejimi Admin otağından söndürmək üçün); yeniləmə tələbi hamıya aiddir.
  if (app.kind === 'upgrade_required' || (app.kind === 'maintenance' && profile?.role !== 'admin')) {
    const up = app.kind === 'upgrade_required'
    return (
      <Screen>
        <H>{up ? t.system.upgradeTitle : t.system.maintenanceTitle}</H>
        <P>{app.message || (up ? t.system.upgradeSub : t.system.maintenanceSub)}</P>
        <Button testID="app-status-retry" label={t.system.checkAgain} onPress={() => { void checkAppConfig() }} />
      </Screen>
    )
  }
  if (!ready) return <Loading />
  if (session && mfa.ready && mfa.needsStepUp) {
    return <MfaChallenge onDone={() => { void mfa.recheck() }} onSignOut={() => { void signOut().then(() => router.replace('/sign-in')) }} />
  }
  if (session && !profile) {
    return (
      <Screen>
        {profileError ? <ErrorBox message={t.system.profileFailed} onRetry={refreshProfile} /> : <Loading />}
      </Screen>
    )
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.board }, animation: 'slide_from_right' }} />
}

/**
 * Gözlənilməz render xətası bütün tətbiqi ağ ekrana çevirməsin: expo-router bu komponenti göstərir.
 * Xətanın mətni istifadəçiyə göstərilmir (daxili detallar), yalnız "yenidən cəhd" və məktəbə qayıdış.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.board }}>
        <Screen>
          <H>{t.system.crashTitle}</H>
          <P dim>{t.system.crashSub}</P>
          <Button testID="crash-retry" label={t.common.retry} onPress={() => { void retry() }} />
          <Button variant="ghost" label={t.system.backToSchool} onPress={() => router.replace('/')} />
        </Screen>
      </View>
    </SafeAreaProvider>
  )
}

export default function RootLayout() {
  if (configError) {
    return (
      <SafeAreaProvider>
        <Screen><ErrorBox message={configError} /><P dim>{t.system.seeEnvExample}</P></Screen>
      </SafeAreaProvider>
    )
  }
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <View style={{ flex: 1, backgroundColor: colors.board }}>
            <StatusBar style="light" />
            <Gate />
          </View>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
