/** Nəticə və icmal: düz/səhv/boş, mövzu üzrə, hər sualın seçilən və düzgün variantı, hər variantın izahı. */
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '../../src/components/Text'
import { useScreenGuard } from '../../src/components/ScreenGuard'
import { Badge, Bar, Button, Card, ErrorBox, H, Icon, Loading, P, Screen } from '../../src/components/ui'
import { Watermark } from '../../src/components/Watermark'
import { t } from '../../src/i18n/az'
import { api, ApiFailure, type ReviewItem } from '../../src/lib/api'
import { colors, font, radius, space } from '../../src/theme'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export default function Result() {
  const { session, subject } = useLocalSearchParams<{ session: string; subject?: string }>()
  useScreenGuard('review')
  const res = useQuery({ queryKey: ['result', session], queryFn: () => api.finish(session) })
  const rev = useQuery({ queryKey: ['review', session], queryFn: () => api.review(session) })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (res.isLoading) return <Screen back title={t.result.title}><Loading /></Screen>
  if (res.error || !res.data) return <Screen back title={t.result.title}><ErrorBox message={(res.error as Error)?.message} onRetry={() => res.refetch()} /></Screen>
  const r = res.data
  const tone = r.percent >= 80 ? colors.ok : r.percent >= 50 ? colors.warn : colors.bad

  const retryMistakes = async () => {
    if (!subject) return
    setBusy(true); setErr(null)
    try {
      const s = await api.start({ subject, mode: 'mistakes', size: 20 })
      router.replace({ pathname: '/test/[session]', params: { session: s.session_id, subject } })
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.board }}>
      <Screen back={() => router.replace(subject ? { pathname: '/room/[subject]', params: { subject } } : '/')} title={t.result.title}>
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }} tone="gold">
          <Text style={[st.pct, { color: tone }]} testID="percent">{r.percent}%</Text>
          <View style={st.row}>
            <Stat label={t.result.correct} value={r.correct} color={colors.ok} />
            <Stat label={t.result.wrong} value={r.wrong} color={colors.bad} />
            <Stat label={t.result.blank} value={r.blank} color={colors.chalkDim} />
          </View>
        </Card>

        <H level={2}>{t.result.byTopic}</H>
        {Object.entries(r.by_topic).map(([id, x]) => (
          <View key={id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <P small>{x.name}</P><P small dim>{x.correct}/{x.total}</P>
            </View>
            <Bar value={x.total ? (100 * x.correct) / x.total : 0} color={x.correct / Math.max(1, x.total) >= 0.7 ? colors.ok : colors.warn} />
          </View>
        ))}

        <ErrorBox message={err} />
        {r.wrong + r.blank > 0 && subject ? <Button testID="retry-mistakes" label={t.result.retryMistakes} onPress={retryMistakes} loading={busy} /> : null}
        <Button variant="ghost" label={t.result.backToRoom} onPress={() => router.replace(subject ? { pathname: '/room/[subject]', params: { subject } } : '/')} />

        <H level={2}>{t.result.review}</H>
        {rev.isLoading && <Loading />}
        <ErrorBox message={rev.error ? (rev.error as Error).message : null} onRetry={() => rev.refetch()} />
        {(rev.data?.items ?? []).map((it) => <ReviewCard key={it.question_id} it={it} />)}
      </Screen>
      <Watermark value={rev.data?.watermark} />
    </View>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 72 }}>
      <Text style={{ color, fontSize: font.title, fontFamily: font.serif, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <P dim small>{label}</P>
    </View>
  )
}

function ReviewCard({ it }: { it: ReviewItem }) {
  return (
    <Card tone={it.trap ? 'trap' : 'plain'} testID={`review-${it.position}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <P small dim>{it.position}. {it.topic}</P>
        <Icon name={it.correct ? 'check' : it.chosen_display === null ? 'minus' : 'x'} size={18} strokeWidth={2.4}
          color={it.correct ? colors.ok : it.chosen_display === null ? colors.warn : colors.bad} />
      </View>
      {it.trap && <Badge tone="trap" icon="alert" label={t.test.trap} />}
      <Text style={st.stem} selectable={false}>{it.stem}</Text>
      {it.options.map((o, i) => {
        const right = i === it.correct_display, mine = i === it.chosen_display
        return (
          <View key={i} style={[st.opt, right && { borderColor: colors.ok }, mine && !right && { borderColor: colors.bad }]}>
            <Text style={[st.optTxt, right && { color: colors.ok }, mine && !right && { color: colors.bad }]} selectable={false}>
              {LETTERS[i]}. {o}{mine ? `  (${t.result.yourAnswer})` : ''}
            </Text>
            {it.option_explanations[i] ? <Text style={st.exp}>{it.option_explanations[i]}</Text> : null}
          </View>
        )
      })}
      {it.chosen_display === null && <P small dim>{t.result.noAnswer}</P>}
      {it.explanation ? <P small><Text style={{ fontWeight: '700' }}>{t.test.explanation}: </Text>{it.explanation}</P> : null}
      {it.law_ref ? <P small dim>{t.test.lawRef}: {it.law_ref}</P> : null}
    </Card>
  )
}

const st = StyleSheet.create({
  pct: { fontSize: 64, lineHeight: 72, fontFamily: font.serif, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  row: { flexDirection: 'row', gap: space.xl, justifyContent: 'center' },
  stem: { color: colors.ivory, fontSize: font.body, fontWeight: '500', lineHeight: 24 },
  opt: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, gap: 3 },
  optTxt: { color: colors.ivory, fontSize: font.small, lineHeight: 20 },
  exp: { color: colors.ivoryDim, fontSize: font.tiny + 1, lineHeight: 18 },
})
