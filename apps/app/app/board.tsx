/** Şərəf lövhəsi: bu həftə, Wilson aşağı sərhədi ilə (həcm yox, etibarlı dəqiqlik). Yalnız razılıq verənlər görünür. */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from '../src/components/Text'
import { Card, Chip, ErrorBox, H, Loading, P, Screen } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { api, type BoardRow } from '../src/lib/api'
import { useAuth } from '../src/lib/auth'
import { useSubjects } from '../src/lib/queries'
import { colors, font, radius, space } from '../src/theme'

const PODIUM = [colors.gold, '#C9CDD2', '#C08A5A']

export default function Board() {
  const { profile } = useAuth()
  const subjects = useSubjects()
  const [subject, setSubject] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['board', subject], queryFn: () => api.board(subject ?? undefined) })

  return (
    <Screen back title="">
      <View style={{ gap: space.xs }} accessible accessibilityLabel={t.board.title}>
        <H>{t.board.title}</H>
        <P dim>{t.board.sub}</P>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label={t.board.all} selected={subject === null} onPress={() => setSubject(null)} />
        {(subjects.data ?? []).map((s) => <Chip key={s.id} label={s.name} selected={subject === s.id} onPress={() => setSubject(s.id)} />)}
      </View>
      {q.isLoading && <Loading />}
      <ErrorBox message={q.error ? (q.error as Error).message : null} onRetry={() => q.refetch()} />
      {q.data && (
        <>
          {q.data.top.length === 0 && <P dim>{t.board.empty}</P>}
          {q.data.top.map((r, i) => <Row key={i} r={r} />)}
          {q.data.me && q.data.me.rank === null && (
            <Card testID="board-me" tone="gold">
              <P>{t.board.you}</P>
              <P dim small>{t.board.notRanked(q.data.me.total, q.data.minTotal)}</P>
            </Card>
          )}
          {!profile?.show_on_board && <P dim small>{t.board.hidden}</P>}
          <P dim small>{t.board.note(q.data.minTotal)}</P>
          <P dim small>{t.board.privacy}</P>
        </>
      )}
    </Screen>
  )
}

function Row({ r }: { r: BoardRow }) {
  const top = !!r.rank && r.rank <= 3
  return (
    <View style={[st.row, r.me && { borderColor: colors.goldLine, backgroundColor: colors.surfaceHi }]} accessibilityLabel={`${r.rank}. ${r.name}, ${r.score} ${t.board.score}`}>
      <View style={[st.rankBox, top && { borderColor: PODIUM[r.rank! - 1], backgroundColor: 'transparent' }]}>
        <Text style={[st.rank, top && { color: PODIUM[r.rank! - 1] }]}>{r.rank}</Text>
      </View>
      <Text style={st.name} numberOfLines={1}>{r.name}{r.me ? ` (${t.board.you})` : ''}</Text>
      <Text style={st.score}>{r.score}</Text>
    </View>
  )
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  rankBox: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', backgroundColor: colors.surfaceHi },
  rank: { color: colors.ivoryDim, fontFamily: font.serif, fontSize: font.h3, fontVariant: ['tabular-nums'] },
  name: { flex: 1, color: colors.ivory, fontSize: font.body, fontWeight: '500' },
  score: { color: colors.goldBright, fontFamily: font.serif, fontSize: font.h2, fontVariant: ['tabular-nums'] },
})
