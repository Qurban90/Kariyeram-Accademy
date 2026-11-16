/** Planlaşdırılmış və canlı dərslərin siyahısı (RLS yalnız qoşula biləcəyiniz dərsləri qaytarır). Sadə görünüşdə səhifədir, 3D zalda pəncərənin içidir. */
import { router } from 'expo-router'
import { View } from 'react-native'
import { Badge, Button, Card, ErrorBox, H, Loading, P } from '../components/ui'
import { t } from '../i18n/az'
import { useAuth } from '../lib/auth'
import { fmtWhen } from '../lib/dates'
import { useLiveSessions } from '../lib/queries'
import { space } from '../theme'
import { canEnter } from './model'

export function LiveListPanel({ create }: { /** Müəllim/admin üçün "yeni dərs" düyməsi siyahının üstündə göstərilsin. */ create?: boolean }) {
  const { session } = useAuth()
  const q = useLiveSessions()
  return (
    <View style={{ gap: space.lg }}>
      {create ? <Button testID="live-create" variant="ghost" icon="plus" label={t.live.create} onPress={() => router.push('/live/new')} /> : null}
      <H level={2}>{t.live.upcoming}</H>
      {q.isLoading && <Loading />}
      <ErrorBox message={q.error ? (q.error as Error).message : null} onRetry={() => q.refetch()} />
      {!q.isLoading && (q.data ?? []).length === 0 && <P dim>{t.live.none}</P>}
      {(q.data ?? []).map((s) => {
        const mine = s.host_id === session?.user.id
        const open = mine || canEnter(s.starts_at, s.state)
        const when = fmtWhen(s.starts_at)
        return (
          <Card key={s.id} testID={`live-${s.id}`} tone={s.state === 'live' ? 'gold' : 'plain'}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
              {s.state === 'live' ? <Badge tone="live" dot label={t.live.liveNow} /> : <Badge label={t.live.scheduled} />}
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
    </View>
  )
}
