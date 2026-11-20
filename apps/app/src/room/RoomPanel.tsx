/**
 * Fənn otağının məzmunu: mövzular, test rejimləri, sual sayı, başlat düyməsi və konspekt şkafı.
 * Sadə görünüşdə səhifənin özüdür, 3D sinifdə partada açılan pəncərənin içidir.
 */
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Card, Chip, ErrorBox, Group, H, Icon, Loading, P, Section, SelectRow, usePalette, type IconName } from '../components/ui'
import { t } from '../i18n/az'
import { api, ApiFailure, type Mode } from '../lib/api'
import { Promo } from '../components/Promo'
import { hasAccess, useEnrollments, useTopics } from '../lib/queries'
import { space } from '../theme'

const SIZES = [10, 20, 30, 50] as const
const MODES: { mode: Mode; title: string; sub: string; icon: IconName }[] = [
  { mode: 'topic', title: t.room.topicTest, sub: t.room.topicTestSub, icon: 'book' },
  { mode: 'mixed', title: t.room.mixed, sub: t.room.mixedSub, icon: 'shuffle' },
  { mode: 'mistakes', title: t.room.mistakes, sub: t.room.mistakesSub, icon: 'repeat' },
  { mode: 'exam', title: t.room.exam, sub: t.room.examSub, icon: 'timer' },
]

export function RoomPanel({ subject }: { subject: string }) {
  const colors = usePalette()
  const topics = useTopics(subject)
  const enr = useEnrollments()
  const [mode, setMode] = useState<Mode>('topic')
  const [size, setSize] = useState<number>(10)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const access = hasAccess(enr.data, subject)
  const open = useMemo(() => (topics.data ?? []).filter((x) => access || x.free), [topics.data, access])

  if (topics.isLoading) return <Loading />

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const start = async () => {
    setErr(null)
    let topicIds: string[] | undefined
    if (mode === 'topic') {
      topicIds = [...picked].filter((id) => open.some((o) => o.id === id))
      if (!topicIds.length) { setErr(t.room.pickTopics); return }
    } else if (!access) {
      // Abunəsiz: yalnız pulsuz mövzular (server də yoxlayır).
      topicIds = open.map((o) => o.id)
    }
    setBusy(true)
    try {
      const r = await api.start({ subject, mode, topicIds, size: mode === 'exam' ? undefined : size })
      // from=room: nəticədən sonra bu otağa (oturduğu partaya) qayıdır.
      router.push({ pathname: '/test/[session]', params: { session: r.session_id, subject, from: 'room' } })
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      {!access ? (
        <View style={st.note}>
          <Icon name="lock" size={16} color={colors.ivoryFaint} />
          <P dim small style={{ flex: 1 }}>{t.room.noAccess}</P>
        </View>
      ) : null}
      <ErrorBox message={topics.error ? (topics.error as Error).message : null} onRetry={() => topics.refetch()} />

      <Section title={t.room.topics}>
        <Group>
          {(topics.data ?? []).map((x) => {
            const can = access || x.free
            return (
              <SelectRow key={x.id} testID={`topic-${x.sort}`} disabled={!can || mode !== 'topic'} locked={!can} selected={mode === 'topic' && picked.has(x.id)}
                title={x.name} sub={!can ? t.room.locked : !access && x.free ? t.room.free : undefined} onPress={() => toggle(x.id)} />
            )
          })}
        </Group>
      </Section>

      <View style={st.modes}>
        {MODES.map((m) => (
          <Card key={m.mode} testID={`mode-${m.mode}`} label={m.title} onPress={() => setMode(m.mode)} tone={mode === m.mode ? 'gold' : 'plain'} style={st.mode}>
            <Icon name={m.icon} size={22} color={mode === m.mode ? colors.gold : colors.ivoryDim} />
            <H level={3}>{m.title}</H>
            <P dim small>{m.sub}</P>
          </Card>
        ))}
      </View>

      {mode !== 'exam' && (
        <View style={{ gap: space.sm }}>
          <P dim small>{t.room.size}</P>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {SIZES.map((n) => <Chip key={n} testID={`size-${n}`} label={String(n)} selected={size === n} onPress={() => setSize(n)} />)}
          </View>
        </View>
      )}
      <ErrorBox message={err} />
      <Button testID="start-test" label={t.room.start} onPress={start} loading={busy} />

      {/* Materiallar tətbiqdə paylanmır: izah canlı dərsdə, PDF yalnız kurs tələbələrinə verilir. */}
      <Promo testID="room-promo" />
    </View>
  )
}

const st = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  mode: { flexBasis: '47%', flexGrow: 1, minWidth: 150 },
})
