/**
 * Test (partadakı "Testi yazmaq istəyirəm"): mövzuya bir toxunuş, test dərhal başlayır.
 * Sual sayı yuxarıda seçilir (defolt 10); qarışıq, səhvlər və sınaq imtahanı aşağıdadır.
 */
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Promo } from '../../src/components/Promo'
import { ErrorBox, Group, Icon, ListRow, Loading, P, RoomTheme, Screen, Section, Segmented, usePalette } from '../../src/components/ui'
import { t } from '../../src/i18n/az'
import { api, ApiFailure, type Mode } from '../../src/lib/api'
import { hasAccess, useEnrollments, useSubjects, useTopics } from '../../src/lib/queries'
import { space } from '../../src/theme'

const SIZES = ['10', '20', '30'] as const

function PracticeInner() {
  const { subject } = useLocalSearchParams<{ subject: string }>()
  const colors = usePalette()
  const subjects = useSubjects()
  const topics = useTopics(subject)
  const enr = useEnrollments()
  const [size, setSize] = useState<(typeof SIZES)[number]>('10')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const name = subjects.data?.find((s) => s.id === subject)?.name ?? ''
  const access = hasAccess(enr.data, subject)

  if (topics.isLoading || enr.isLoading) return <Screen back title={name}><Loading /></Screen>

  const open = (topics.data ?? []).filter((x) => access || x.free)
  const start = async (key: string, mode: Mode, topicIds?: string[]) => {
    if (busy) return
    setErr(null); setBusy(key)
    try {
      const ids = topicIds ?? (access ? undefined : open.map((o) => o.id))
      const r = await api.start({ subject, mode, topicIds: ids, size: mode === 'exam' ? undefined : Number(size) })
      router.push({ pathname: '/test/[session]', params: { session: r.session_id, subject, from: 'room' } })
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  const spin = (key: string) => (busy === key ? <ActivityIndicator color={colors.gold} /> : undefined)

  return (
    <Screen back title={name}>
      <P dim>{t.practice.lead}</P>
      <View style={{ gap: space.sm }}>
        <P dim small>{t.practice.size}</P>
        <Segmented value={size} onChange={setSize} options={SIZES.map((n) => ({ value: n, label: n, testID: `psize-${n}` }))} />
      </View>
      <ErrorBox message={err} />
      <ErrorBox message={topics.error ? (topics.error as Error).message : null} onRetry={() => topics.refetch()} />

      <Section title={t.practice.topics}>
        <Group>
          {(topics.data ?? []).map((x) => {
            const can = access || x.free
            return (
              <ListRow key={x.id} testID={`ptopic-${x.sort}`} icon={can ? 'book' : 'lock'} title={x.name}
                sub={can ? undefined : t.room.locked}
                right={spin(`t-${x.id}`) ?? (can ? undefined : <Icon name="lock" size={16} color={colors.ivoryFaint} />)}
                onPress={can ? () => void start(`t-${x.id}`, 'topic', [x.id]) : undefined} />
            )
          })}
        </Group>
      </Section>

      <Section title={t.practice.more}>
        <Group>
          <ListRow testID="pmode-mixed" icon="shuffle" title={t.room.mixed} sub={t.room.mixedSub} right={spin('mixed')} onPress={() => void start('mixed', 'mixed')} />
          <ListRow testID="pmode-mistakes" icon="repeat" title={t.room.mistakes} sub={t.room.mistakesSub} right={spin('mistakes')} onPress={() => void start('mistakes', 'mistakes')} />
          <ListRow testID="pmode-exam" icon="timer" title={t.room.exam} sub={t.room.examSub} right={spin('exam')} onPress={() => void start('exam', 'exam')} />
        </Group>
      </Section>

      <Promo testID="practice-promo" />
    </Screen>
  )
}

export default function Practice() {
  return <RoomTheme><PracticeInner /></RoomTheme>
}
