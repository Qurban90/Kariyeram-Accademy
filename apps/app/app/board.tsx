/** Şərəf lövhəsi: bu həftə, Wilson aşağı sərhədi ilə (həcm yox, etibarlı dəqiqlik). Yalnız razılıq verənlər görünür. */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Card, Chip, ErrorBox, Loading, P, Screen } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { api, type BoardRow } from '../src/lib/api'
import { useAuth } from '../src/lib/auth'
import { useSubjects } from '../src/lib/queries'
import { colors, font, radius, space } from '../src/theme'

const MEDAL = ['🥇', '🥈', '🥉']

export default function Board() {
  const { profile } = useAuth()
  const subjects = useSubjects()
  const [subject, setSubject] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['board', subject], queryFn: () => api.board(subject ?? undefined) })

  return (
    <Screen back title={t.board.title}>
      <View style={st.plaque} accessible accessibilityLabel={t.board.title}>
        <Text style={st.plaqueTxt}>{t.board.title.toUpperCase()}</Text>
        <Text style={st.plaqueSub}>{t.board.sub}</Text>
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
            <Card testID="board-me" style={{ borderColor: colors.brass }}>
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
  return (
    <View style={[st.row, r.me && { borderColor: colors.brass, backgroundColor: '#2c4a3a' }]} accessibilityLabel={`${r.rank}. ${r.name}, ${r.score} ${t.board.score}`}>
      <Text style={st.rank}>{r.rank && r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</Text>
      <Text style={st.name} numberOfLines={1}>{r.name}{r.me ? ` (${t.board.you})` : ''}</Text>
      <Text style={st.score}>{r.score}</Text>
    </View>
  )
}

const st = StyleSheet.create({
  plaque: { alignSelf: 'center', alignItems: 'center', backgroundColor: colors.wood, borderColor: colors.brass, borderWidth: 3, borderRadius: radius.sm, paddingHorizontal: space.xl, paddingVertical: space.md },
  plaqueTxt: { color: colors.brass, fontFamily: font.serif, fontWeight: '900', letterSpacing: 2, fontSize: font.h2 },
  plaqueSub: { color: colors.chalk, fontSize: font.small },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.boardLine, backgroundColor: colors.panel },
  rank: { width: 32, textAlign: 'center', color: colors.chalk, fontWeight: '800', fontSize: font.h3 },
  name: { flex: 1, color: colors.chalk, fontSize: font.body, fontWeight: '600' },
  score: { color: colors.brass, fontWeight: '900', fontSize: font.h3, fontVariant: ['tabular-nums'] },
})
