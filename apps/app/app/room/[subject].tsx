/** Fənn otağı (özünü öyrənmə): mövzular, test rejimləri, sual sayı. */
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Button, Card, Chip, ErrorBox, H, Loading, P, Screen } from '../../src/components/ui'
import { t } from '../../src/i18n/az'
import { api, ApiFailure, type Mode } from '../../src/lib/api'
import { hasAccess, useEnrollments, useSubjects, useTopics } from '../../src/lib/queries'
import { colors, font, radius, space } from '../../src/theme'

const SIZES = [10, 20, 30, 50] as const
const MODES: { mode: Mode; title: string; sub: string; icon: string }[] = [
  { mode: 'topic', title: t.room.topicTest, sub: t.room.topicTestSub, icon: '📘' },
  { mode: 'mixed', title: t.room.mixed, sub: t.room.mixedSub, icon: '🔀' },
  { mode: 'mistakes', title: t.room.mistakes, sub: t.room.mistakesSub, icon: '🔁' },
  { mode: 'exam', title: t.room.exam, sub: t.room.examSub, icon: '⏱️' },
]

export default function Room() {
  const { subject } = useLocalSearchParams<{ subject: string }>()
  const subjects = useSubjects()
  const topics = useTopics(subject)
  const enr = useEnrollments()
  const [mode, setMode] = useState<Mode>('topic')
  const [size, setSize] = useState<number>(10)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const name = subjects.data?.find((s) => s.id === subject)?.name ?? ''
  const access = hasAccess(enr.data, subject)
  const open = useMemo(() => (topics.data ?? []).filter((x) => access || x.free), [topics.data, access])

  if (topics.isLoading || subjects.isLoading) return <Screen back title={name}><Loading /></Screen>

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
      router.push({ pathname: '/test/[session]', params: { session: r.session_id, subject } })
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen back title={name}>
      <View style={st.board} accessible accessibilityLabel={`${name} sinfi`}>
        <Text style={st.boardTxt}>{name}</Text>
        <Text style={st.boardSub}>{access ? t.room.accessUntil(new Date(access.access_until).toLocaleDateString('az-AZ')) : t.room.noAccess}</Text>
      </View>
      <ErrorBox message={topics.error ? (topics.error as Error).message : null} onRetry={() => topics.refetch()} />

      <H level={2}>{t.room.topics}</H>
      <View style={{ gap: space.sm }}>
        {(topics.data ?? []).map((x) => {
          const can = access || x.free
          return (
            <Chip key={x.id} testID={`topic-${x.sort}`} disabled={!can || mode !== 'topic'} selected={mode === 'topic' && picked.has(x.id)}
              label={`${x.name}${!access && x.free ? ` · ${t.room.free}` : ''}${!can ? ` · 🔒 ${t.room.locked}` : ''}`} onPress={() => toggle(x.id)} />
          )
        })}
      </View>

      <View style={st.modes}>
        {MODES.map((m) => (
          <Card key={m.mode} testID={`mode-${m.mode}`} label={m.title} onPress={() => setMode(m.mode)}
            style={[st.mode, mode === m.mode && { borderColor: colors.brass, backgroundColor: '#22402f' }]}>
            <Text style={{ fontSize: 24 }}>{m.icon}</Text>
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
    </Screen>
  )
}

const st = StyleSheet.create({
  board: { backgroundColor: '#1d3b2f', borderWidth: 8, borderColor: colors.woodLight, borderRadius: radius.sm, padding: space.xl, alignItems: 'center', gap: space.sm },
  boardTxt: { color: colors.chalk, fontSize: font.title, fontFamily: font.serif, fontWeight: '700', textAlign: 'center' },
  boardSub: { color: colors.chalkDim, fontSize: font.small, textAlign: 'center' },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  mode: { flexBasis: '47%', flexGrow: 1, minWidth: 150 },
})
