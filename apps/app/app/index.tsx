/** Məktəb zalı: dəhlizdə fənn qapıları, oxu zalının ikiqat qapısı, gündəlik və kabinet. */
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Lockup } from '../src/components/Brand'
import { Door, DoorSpacer } from '../src/components/Door'
import { Corridor3D } from '../src/school3d/Corridor3D'
import { secureStorage } from '../src/lib/storage'
import { Badge, Bar, Button, Card, Chip, ErrorBox, Group, H, Icon, ListRow, Loading, P, Screen, Section } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { useAuth } from '../src/lib/auth'
import { hasAccess, useActiveSession, useEnrollments, useLiveSessions, useSubjects, useTopics } from '../src/lib/queries'
import { colors, space } from '../src/theme'

export default function Hall() {
  const { profile } = useAuth()
  const subjects = useSubjects()
  const topics = useTopics()
  const enr = useEnrollments()
  const live = useLiveSessions()
  const active = useActiveSession()
  const [view3d, setView3d] = useState(false)
  const [glErr, setGlErr] = useState<string | null>(null)
  const { width } = useWindowDimensions()
  const cols = width >= 700 ? 4 : 2
  useEffect(() => { secureStorage.getItem('karyeram.view3d').then((v) => setView3d(v === '1')).catch(() => {}) }, [])
  const setView = (v: boolean) => { setView3d(v); setGlErr(null); secureStorage.setItem('karyeram.view3d', v ? '1' : '0').catch(() => {}) }
  useFocusEffect(useCallback(() => { void active.refetch() }, [active.refetch]))

  if (subjects.isLoading) return <Screen><Loading /></Screen>
  const liveNow = (live.data ?? []).filter((s) => s.state === 'live').length
  const first = profile?.display_name?.split(' ')[0] || ''

  const resumeTotal = active.data?.question_ids.length ?? 0
  // Telefonda 2, enli ekranda 4 qapı bir sırada; sıranı görünməz doldurucular tamamlayır.
  const basis = cols === 4 ? '22%' : '47%'
  const n = subjects.data?.length ?? 0
  const spacers = (cols - (n % cols)) % cols

  return (
    <Screen glow>
      <View style={st.top}>
        <Lockup />
        {profile ? <Badge label={t.hall.studentNo(String(profile.student_no))} /> : null}
      </View>
      <View style={{ gap: space.xs }}>
        <H>{t.hall.greeting(first)}</H>
        <P dim>{t.hall.lead}</P>
      </View>
      <ErrorBox message={subjects.error ? (subjects.error as Error).message : null} onRetry={() => subjects.refetch()} />

      {active.data && (
        <Card testID="resume-card" tone="gold">
          <View style={st.resumeHead}>
            <View style={st.resumeIcon}><Icon name="stairs" size={20} color={colors.gold} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <H level={3}>{t.hall.resume}</H>
              <P dim small>{t.hall.resumeSub(subjects.data?.find((s) => s.id === active.data!.subject_id)?.name ?? active.data.subject_id, active.data.cursor, resumeTotal)}</P>
            </View>
          </View>
          <Bar value={resumeTotal ? (100 * active.data.cursor) / resumeTotal : 0} />
          <Button testID="resume-test" label={t.hall.resumeBtn}
            onPress={() => router.push({ pathname: '/test/[session]', params: { session: active.data!.id, subject: active.data!.subject_id } })} />
        </Card>
      )}

      <Section title={t.hall.rooms} gap={space.lg}
        right={<Chip testID="toggle-3d" icon={view3d ? 'door' : 'compass'} label={view3d ? t.hall.view2d : t.hall.view3d} selected={view3d} onPress={() => setView(!view3d)} />}>
        {glErr ? <P dim small>{glErr}</P> : null}
        {view3d ? (
          <Corridor3D
            doors={(subjects.data ?? []).map((s, i) => ({ key: s.id, number: String(101 + i), title: s.name }))}
            hallLive={liveNow > 0}
            onEnter={(k) => (k === 'hall' ? router.push('/live') : router.push({ pathname: '/room/[subject]', params: { subject: k } }))}
            onFail={() => { setView3d(false); setGlErr(t.hall.gl3dFailed) }}
          />
        ) : (<>
          <View style={st.corridor}>
            {(subjects.data ?? []).map((s, i) => {
              const acc = hasAccess(enr.data, s.id)
              const freeCount = (topics.data ?? []).filter((x) => x.subject_id === s.id && x.free).length
              return (
                <Door key={s.id} basis={basis} testID={`door-${s.id}`} number={String(101 + i)} title={s.name}
                  status={acc ? t.hall.open : freeCount ? t.hall.locked : undefined} statusTone={acc ? 'ok' : 'dim'}
                  onOpen={() => router.push({ pathname: '/room/[subject]', params: { subject: s.id } })} />
              )
            })}
            {Array.from({ length: spacers }, (_, i) => <DoorSpacer key={`sp-${i}`} basis={basis} />)}
          </View>

          <Door wide testID="door-live" number="ZAL" title={t.hall.live}
            status={liveNow ? `${liveNow} ${t.live.liveNow}` : t.hall.liveSub} statusTone={liveNow ? 'live' : 'dim'}
            onOpen={() => router.push('/live')} />
        </>)}
      </Section>

      <Group>
        <ListRow icon="notebook" title={t.hall.diary} sub={t.hall.diarySub} onPress={() => router.push('/diary')} testID="go-diary" />
        <ListRow icon="trophy" title={t.hall.board} sub={t.hall.boardSub} onPress={() => router.push('/board')} testID="go-board" />
        <ListRow icon="user" title={t.hall.profile} sub={t.hall.profileSub} onPress={() => router.push('/profile')} testID="go-profile" />
      </Group>
    </Screen>
  )
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap', paddingBottom: space.sm },
  resumeHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  resumeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldWash },
  corridor: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xl },
})
