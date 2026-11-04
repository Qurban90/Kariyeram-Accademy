import { t } from '../src/i18n/az'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack, router, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ErrorBox, Loading, P, Screen } from '../src/components/ui'
import { configError } from '../src/config'
import { AuthProvider, useAuth } from '../src/lib/auth'
import { ApiFailure } from '../src/lib/api'
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
  const { ready, session, profile, profileError, refreshProfile } = useAuth()
  const segments = useSegments()
  const first = segments[0] ?? ''

  useEffect(() => {
    if (!ready) return
    if (!session) { if (!PUBLIC.has(first)) router.replace('/sign-in'); return }
    if (!profile) return
    if (!profile.onboarded_at) { if (first !== 'onboarding') router.replace('/onboarding'); return }
    // Onboarding-ə yenilənmiş şərtlər üçün (consent_required) qayıtmaq mümkündür, ona görə oradan avtomatik çıxarmırıq.
    if (PUBLIC.has(first)) router.replace('/')
  }, [ready, session, profile, first])

  if (!ready) return <Loading />
  if (session && !profile) {
    return (
      <Screen>
        {profileError ? <ErrorBox message={t.system.profileFailed} onRetry={refreshProfile} /> : <Loading />}
      </Screen>
    )
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.board }, animation: 'slide_from_right' }} />
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
