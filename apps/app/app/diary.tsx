/** Gündəlik (FR-027/028): test nəticələri, müəllim qiymətləri və qeydləri; "səhvlər harada çoxdur". */
import { weakTopics, type Tally } from '@karyeram/core/src/scoring.ts'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { View } from 'react-native'
import { Text } from '../src/components/Text'
import { Badge, Bar, Card, Divider, ErrorBox, H, Icon, Loading, P, Screen } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { progressFrom } from '../src/lib/progress'
import { useDiary } from '../src/lib/queries'
import { colors, font, space } from '../src/theme'
import { fmtDateTime } from '../src/lib/dates'

type TopicPayload = Record<string, { name: string; total: number; correct: number; wrong: number; blank: number }>

export default function Diary() {
  const diary = useDiary()

  const weak = useMemo(() => {
    const agg: Record<string, Tally & { name: string }> = {}
    for (const e of diary.data ?? []) {
      if (e.kind !== 'test') continue
      const by = (e.payload.by_topic ?? {}) as TopicPayload
      for (const [id, x] of Object.entries(by)) {
        const a = (agg[id] ??= { name: x.name, total: 0, correct: 0, wrong: 0, blank: 0, percent: 0 })
        a.total += x.total; a.correct += x.correct; a.wrong += x.wrong; a.blank += x.blank
      }
    }
    return weakTopics(agg, 5).slice(0, 5).map((w) => ({ ...w, name: agg[w.topicId]!.name }))
  }, [diary.data])

  const prog = useMemo(() => progressFrom(diary.data ?? []), [diary.data])

  if (diary.isLoading) return <Screen back title={t.diary.title}><Loading /></Screen>

  return (
    <Screen back title={t.diary.title}>
      <ErrorBox message={diary.error ? (diary.error as Error).message : null} onRetry={() => diary.refetch()} />
      <Card testID="progress" tone={prog.streak ? 'gold' : 'plain'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldWash }}>
            <Icon name="flame" size={24} color={prog.streak ? colors.gold : colors.ivoryFaint} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <H level={3}>{prog.streak ? t.diary.streak(prog.streak) : t.diary.streakNone}</H>
            <P dim small>{t.diary.correctTotal(prog.totalCorrect)}</P>
          </View>
        </View>
        <Divider />
        <P small dim>{t.diary.medals}</P>
        {prog.badges.length === 0 ? <P dim small>{t.diary.noMedals}</P> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {prog.badges.map((b) => <Badge key={b.id} tone="gold" icon="medal" label={b.title} />)}
          </View>
        )}
      </Card>

      <H level={2}>{t.diary.weak}</H>
      {weak.length === 0 ? <P dim>{t.diary.weakEmpty}</P> : weak.map((w) => (
        <View key={w.topicId} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <P small>{w.name}</P><P small dim>{t.diary.missStat(w.missRate, w.total)}</P>
          </View>
          <Bar value={w.missRate} color={w.missRate > 40 ? colors.bad : colors.warn} />
        </View>
      ))}

      <H level={2}>{t.diary.entries}</H>
      {(diary.data ?? []).length === 0 && <P dim>{t.diary.empty}</P>}
      {(diary.data ?? []).map((e) => {
        const p = e.payload as { percent?: number; correct?: number; total?: number; session_id?: string; grade?: string | number; text?: string }
        const date = fmtDateTime(e.created_at)
        return (
          <Card key={e.id} testID={`diary-${e.id}`}
            onPress={e.kind === 'test' && p.session_id ? () => router.push({ pathname: '/result/[session]', params: { session: p.session_id! } }) : undefined}
            label={e.title}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ivory, fontWeight: '600', fontSize: font.body }}>{e.title}</Text>
                <P dim small>{date} · {e.kind === 'test' ? t.diary.test : e.kind === 'grade' ? t.diary.grade : t.diary.note}</P>
              </View>
              {e.kind === 'test' && typeof p.percent === 'number' && (
                <Text style={{ color: p.percent >= 80 ? colors.ok : p.percent >= 50 ? colors.warn : colors.bad, fontFamily: font.serif, fontSize: font.h2 + 2, fontVariant: ['tabular-nums'] }}>{p.percent}%</Text>
              )}
              {e.kind === 'grade' && p.grade !== undefined && <Text style={{ color: colors.gold, fontFamily: font.serif, fontSize: font.h2 + 2 }}>{String(p.grade)}</Text>}
            </View>
            {e.kind === 'test' && typeof p.correct === 'number' && <P dim small>{t.diary.correctOf(p.correct, p.total ?? 0)}</P>}
            {p.text ? <P small>{p.text}</P> : null}
          </Card>
        )
      })}
    </Screen>
  )
}
