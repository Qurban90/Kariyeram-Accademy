/** Məktəb zalı: dəhlizdə fənn qapıları, oxu zalının ikiqat qapısı, gündəlik və kabinet. */
import { router, useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Door } from '../src/components/Door'
import { Button, Card, ErrorBox, H, Loading, P, Screen } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { useAuth } from '../src/lib/auth'
import { hasAccess, useActiveSession, useEnrollments, useLiveSessions, useSubjects, useTopics } from '../src/lib/queries'
import { colors, font, space } from '../src/theme'

export default function Hall() {
  const { profile } = useAuth()
  const subjects = useSubjects()
  const topics = useTopics()
  const enr = useEnrollments()
  const live = useLiveSessions()
  const active = useActiveSession()
  useFocusEffect(useCallback(() => { void active.refetch() }, [active.refetch]))

  if (subjects.isLoading) return <Screen><Loading /></Screen>
  const liveNow = (live.data ?? []).filter((s) => s.state === 'live').length
  const first = profile?.display_name?.split(' ')[0] || ''

  return (
    <Screen>
      <View style={st.sign}>
        <Text style={st.signTxt}>KARYERAM ACADEMY</Text>
      </View>
      <View>
        <H>{t.hall.greeting(first)}</H>
        <P dim>{t.hall.lead}</P>
        {profile && <P dim small>{t.hall.studentNo(String(profile.student_no))}</P>}
      </View>
      <ErrorBox message={subjects.error ? (subjects.error as Error).message : null} onRetry={() => subjects.refetch()} />

      {active.data && (
        <Card testID="resume-card" style={{ borderColor: colors.brass }}>
          <H level={3}>{t.hall.resume}</H>
          <P dim small>{t.hall.resumeSub(subjects.data?.find((s) => s.id === active.data!.subject_id)?.name ?? active.data.subject_id, active.data.cursor, active.data.question_ids.length)}</P>
          <Button testID="resume-test" label={t.hall.resumeBtn}
            onPress={() => router.push({ pathname: '/test/[session]', params: { session: active.data!.id, subject: active.data!.subject_id } })} />
        </Card>
      )}

      <H level={2}>{t.hall.rooms}</H>
      <View style={st.corridor}>
        {(subjects.data ?? []).map((s, i) => {
          const acc = hasAccess(enr.data, s.id)
          const freeCount = (topics.data ?? []).filter((x) => x.subject_id === s.id && x.free).length
          return (
            <Door key={s.id} testID={`door-${s.id}`} number={String(101 + i)} title={s.name}
              status={acc ? t.hall.open : freeCount ? t.hall.locked : undefined} statusTone={acc ? 'ok' : 'dim'}
              onOpen={() => router.push({ pathname: '/room/[subject]', params: { subject: s.id } })} />
          )
        })}
      </View>

      <Door wide testID="door-live" number="ZAL" title={t.hall.live}
        status={liveNow ? `${liveNow} ${t.live.liveNow}` : t.hall.liveSub} statusTone={liveNow ? 'live' : 'dim'}
        onOpen={() => router.push('/live')} />

      <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
        <Card style={{ flex: 1, minWidth: 150 }} onPress={() => router.push('/diary')} label={t.hall.diary} testID="go-diary">
          <Text style={st.icon}>📓</Text>
          <H level={3}>{t.hall.diary}</H>
          <P dim small>{t.hall.diarySub}</P>
        </Card>
        <Card style={{ flex: 1, minWidth: 150 }} onPress={() => router.push('/profile')} label={t.hall.profile} testID="go-profile">
          <Text style={st.icon}>🗝️</Text>
          <H level={3}>{t.hall.profile}</H>
          <P dim small>{t.hall.profileSub}</P>
        </Card>
      </View>
    </Screen>
  )
}

const st = StyleSheet.create({
  sign: { alignSelf: 'center', backgroundColor: colors.wood, borderColor: colors.brass, borderWidth: 2, paddingHorizontal: space.xl, paddingVertical: space.sm, borderRadius: 4 },
  signTxt: { color: colors.brass, fontFamily: font.serif, fontWeight: '800', letterSpacing: 3, fontSize: font.h3 },
  corridor: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingVertical: space.md, paddingHorizontal: space.sm, backgroundColor: '#1a2e26', borderRadius: 12, borderBottomWidth: 10, borderBottomColor: '#3b2a1c' },
  icon: { fontSize: 28 },
})
