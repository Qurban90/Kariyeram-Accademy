/** Oxu zalının qapısı: planlaşdırılmış və canlı dərslər (RLS yalnız qoşula biləcəyiniz dərsləri qaytarır). */
import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { Button, Card, ErrorBox, H, Loading, P, Screen } from '../../src/components/ui'
import { t } from '../../src/i18n/az'
import { canEnter } from '../../src/live/model'
import { useAuth } from '../../src/lib/auth'
import { useLiveSessions } from '../../src/lib/queries'
import { colors, font, space } from '../../src/theme'
import { fmtWhen } from '../../src/lib/dates'

export default function LiveList() {
  const { profile, session } = useAuth()
  const q = useLiveSessions()
  const staff = profile?.role === 'teacher' || profile?.role === 'admin'

  return (
    <Screen back title={t.live.title} right={staff ? <Button small variant="ghost" label="+" onPress={() => router.push('/live/new')} /> : null}>
      <H level={2}>{t.live.upcoming}</H>
      {q.isLoading && <Loading />}
      <ErrorBox message={q.error ? (q.error as Error).message : null} onRetry={() => q.refetch()} />
      {!q.isLoading && (q.data ?? []).length === 0 && <P dim>{t.live.none}</P>}
      {(q.data ?? []).map((s) => {
        const mine = s.host_id === session?.user.id
        const open = mine || canEnter(s.starts_at, s.state)
        const when = fmtWhen(s.starts_at)
        return (
          <Card key={s.id} testID={`live-${s.id}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ color: s.state === 'live' ? colors.bad : colors.chalkDim, fontWeight: '800', fontSize: font.tiny }}>
                {s.state === 'live' ? `● ${t.live.liveNow}` : t.live.scheduled}
              </Text>
              <P dim small>{s.venues?.name ?? ''}</P>
            </View>
            <H level={3}>{s.title}</H>
            {s.description ? <P dim small>{s.description}</P> : null}
            <P small>{when}{mine ? ` · ${t.live.host}` : ''}</P>
            <Button testID={`join-${s.id}`} label={open ? t.live.join : t.live.enterSoon} disabled={!open}
              onPress={() => router.push({ pathname: '/live/[id]', params: { id: s.id } })} />
          </Card>
        )
      })}
    </Screen>
  )
}
