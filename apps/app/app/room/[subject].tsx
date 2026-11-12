/** Fənn otağı (özünü öyrənmə): mövzular, test rejimləri, sual sayı. */
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '../../src/components/Text'
import { Badge, Button, Card, Chip, ErrorBox, Group, H, Icon, ListRow, Loading, P, Screen, Section, SelectRow, type IconName } from '../../src/components/ui'
import { t } from '../../src/i18n/az'
import { api, ApiFailure, type Mode } from '../../src/lib/api'
import { hasAccess, useEnrollments, useLibrary, useSubjects, useTopics } from '../../src/lib/queries'
import { colors, font, space } from '../../src/theme'
import { fmtDate } from '../../src/lib/dates'

const SIZES = [10, 20, 30, 50] as const
const MODES: { mode: Mode; title: string; sub: string; icon: IconName }[] = [
  { mode: 'topic', title: t.room.topicTest, sub: t.room.topicTestSub, icon: 'book' },
  { mode: 'mixed', title: t.room.mixed, sub: t.room.mixedSub, icon: 'shuffle' },
  { mode: 'mistakes', title: t.room.mistakes, sub: t.room.mistakesSub, icon: 'repeat' },
  { mode: 'exam', title: t.room.exam, sub: t.room.examSub, icon: 'timer' },
]

export default function Room() {
  const { subject } = useLocalSearchParams<{ subject: string }>()
  const subjects = useSubjects()
  const topics = useTopics(subject)
  const enr = useEnrollments()
  const shelf = useLibrary(subject)
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

  const openItem = (id: string, kind: 'text' | 'pdf', title: string) => {
    setErr(null)
    router.push({ pathname: '/library/[id]', params: kind === 'pdf' ? { id, kind, title } : { id } })
  }

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
    <Screen back title="">
      <View style={st.hero} accessible accessibilityLabel={`${name} sinfi`}>
        <Text style={st.heroTxt}>{name}</Text>
        {access ? <Badge tone="gold" icon="check" label={t.room.accessUntil(fmtDate(access.access_until))} /> : (
          <View style={st.note}>
            <Icon name="lock" size={16} color={colors.ivoryFaint} />
            <P dim small style={{ flex: 1 }}>{t.room.noAccess}</P>
          </View>
        )}
      </View>
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

      <Section title={t.library.shelf}>
        {(shelf.data ?? []).length === 0 ? <P dim small>{t.library.empty}</P> : (
          <Group>
            {(shelf.data ?? []).map((it, i) => {
              const can = !!access || it.free
              return (
                <View key={it.id} style={!can ? { opacity: 0.5 } : undefined}>
                  <ListRow testID={`shelf-${i}`} icon={it.kind === 'pdf' ? 'file' : 'bookOpen'} title={it.title}
                    sub={`${it.kind === 'pdf' ? t.library.pdf : t.library.text}${it.free && !access ? ` · ${t.library.free}` : ''}${!can ? ` · ${t.library.locked}` : ''}`}
                    onPress={can ? () => openItem(it.id, it.kind, it.title) : undefined}
                    right={!can ? <Icon name="lock" size={18} color={colors.ivoryFaint} /> : undefined} />
                </View>
              )
            })}
          </Group>
        )}
      </Section>
      {(shelf.data ?? []).some((x) => x.kind === 'pdf') && <P dim small>{t.library.pdfNote}</P>}
    </Screen>
  )
}

const st = StyleSheet.create({
  hero: { alignItems: 'flex-start', gap: space.md, paddingBottom: space.sm },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  heroTxt: { color: colors.ivory, fontSize: font.display, lineHeight: 40, fontFamily: font.serif, letterSpacing: -0.4 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  mode: { flexBasis: '47%', flexGrow: 1, minWidth: 150 },
})
