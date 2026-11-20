import { t } from '../src/i18n/az'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../src/lib/queryClient'
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
import { checkAppConfig, useAppStatus } from '../src/lib/appStatus'
import { MfaChallenge, useMfaState } from '../src/components/Mfa'
import { crumb, installCrashCapture, useCrash } from '../src/lib/diag'
import { setNavSegment } from '../src/lib/nav'
import { colors } from '../src/theme'

// Tutulmayan JS xətası tətbiqi bağlamasın: qeydə alınır və xəta ekranı göstərilir (yalnız native).
installCrashCapture()
crumb('app_start')

const PUBLIC = new Set(['sign-in'])

/** Marşrut qoruyucusu: sessiya → razılıq → məktəb. */
function Gate() {
  const { ready, session, profile, profileError, refreshProfile, signOut } = useAuth()
  // Sessiya dəyişəndə (giriş, token yenilənməsi) MFA səviyyəsi yenidən yoxlanır.
  const mfa = useMfaState(session ? `${session.user.id}:${session.access_token.slice(-16)}` : null)
  const segments = useSegments()
  const first = segments[0] ?? ''
  setNavSegment(first)
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
    let want: string | null = null
    if (!session) { if (!PUBLIC.has(first)) want = '/sign-in' }
    else if (profile && !profile.onboarded_at) { if (first !== 'onboarding') want = '/onboarding' }
    else if (profile && PUBLIC.has(first)) want = '/'
    if (!want) return
    // Android-də react-native-screens fragment yarışının qarşısını almaq üçün replace render commit-indən sonra gedir.
    const id = setTimeout(() => {
      crumb('nav', want!)
      try { router.replace(want!) } catch { /* naviqasiya xətası tətbiqi bağlamasın */ }
    }, 30)
    return () => clearTimeout(id)
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
  // Marşrut hədəflə uyğun deyilsə Stack qurulmur: səhv ekranın bir anlıq açılıb bağlanması (və Android-də
  // screens fragment çöküşü) baş vermir. Yönləndirmə yuxarıdaki effect-dədir.
  const routeOk = !session
    ? PUBLIC.has(first)
    : !!profile && (!profile.onboarded_at ? first === 'onboarding' : !PUBLIC.has(first))
  if (!routeOk) return <Loading />
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
