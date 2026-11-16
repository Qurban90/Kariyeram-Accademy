import { t } from '../src/i18n/az'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium'
import { Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces/500Medium_Italic'
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold'
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular'
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium'
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold'
import { HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk/700Bold'
import { useFonts } from 'expo-font'
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
import { crumb, installCrashCapture, useCrash } from '../src/lib/diag'
import { colors } from '../src/theme'

// Tutulmayan JS xətası tətbiqi bağlamasın: qeydə alınır və xəta ekranı göstərilir (yalnız native).
installCrashCapture()
crumb('app_start')

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

  // Diaqnostika: sessiyanın bərpası və profilin yüklənməsi (şəxsi məlumat göndərilmir).
  useEffect(() => { if (ready) crumb('session_restore', session ? 'var' : 'yox') }, [ready, !!session])
  useEffect(() => { if (profile) crumb('profile_ok', `onboarded=${profile.onboarded_at ? 1 : 0} role=${profile.role}`) }, [profile?.id, !!profile?.onboarded_at])
  useEffect(() => { if (profileError) crumb('profile_fail') }, [profileError])

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
  // Brend şriftləri (başlıq: Fraunces, mətn: Hanken Grotesk). Yüklənməsə sistem şrifti ilə davam edirik.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium, Fraunces_500Medium_Italic, Fraunces_600SemiBold,
    HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold,
  })
  const [crash, clearCrash] = useCrash()
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.night }} />
  if (crash) {
    return (
      <SafeAreaProvider>
        <Screen>
          <H>{t.safe.crashTitle}</H>
          <P dim>{t.safe.crashSub}</P>
          <ErrorBox message={crash.message} />
          <P dim small>{crash.stack}</P>
          <Button testID="crash-continue" label={t.common.retry} onPress={clearCrash} />
        </Screen>
      </SafeAreaProvider>
    )
  }
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
