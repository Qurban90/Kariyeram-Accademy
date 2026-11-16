/** Məktəb zalı: dəhlizdə fənn qapıları, oxu zalının ikiqat qapısı, gündəlik və kabinet. */
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Lockup } from '../src/components/Brand'
import { Door, DoorSpacer } from '../src/components/Door'
import { Corridor3D } from '../src/school3d/Corridor3D'
import { crumb, hallAttempt, hallReset, hallStable } from '../src/lib/diag'
import { take3dFallback, useView3d } from '../src/lib/view3d'
import { SafeHall } from '../src/components/SafeHall'
import { StatusBar } from 'expo-status-bar'
import { Badge, Bar, Button, Card, Chip, ErrorBox, Group, H, Icon, ListRow, Loading, P, Screen, Section } from '../src/components/ui'
import { t } from '../src/i18n/az'
import { useAuth } from '../src/lib/auth'
import { hasAccess, useActiveSession, useEnrollments, useLiveSessions, useSubjects, useTopics } from '../src/lib/queries'
import { colors, space } from '../src/theme'

const native = Platform.OS !== 'web'
/** Yoxlama rejimində ekranın açıldığı hissələr (son izə görə hansı hissədə dayandığı bilinir). */
const STAGES = ['bashliq', 'salam', 'bolme_ve_chip', 'ilk_qapi', 'qalan_qapilar', 'zal_qapisi', 'siyahi'] as const

export default function Hall() {
  const { profile } = useAuth()
  const subjects = useSubjects()
  const topics = useTopics()
  const enr = useEnrollments()
  const live = useLiveSessions()
  const active = useActiveSession()
  const [view3d, setView] = useView3d()
  const [glErr, setGlErr] = useState<string | null>(null)
  const [focused, setFocused] = useState(true)
  // Əvvəlki açılışda 3D yarımçıq qalıbsa (donma) tətbiq sadə görünüşə qayıdıb: bir dəfə bildiririk.
  useEffect(() => { if (view3d === false && take3dFallback()) setGlErr(t.hall.gl3dFailed) }, [view3d])
  const { width } = useWindowDimensions()
  const cols = width >= 700 ? 4 : 2

  // Telefonda: bu ekran əvvəlki açılışlarda sabit vəziyyətə çatmadan tətbiq bağlanıbsa (çökmə, donma),
  // birinci dəfə hissə-hissə açılır (harada dayandığı serverdəki izdən bilinir), ikinci dəfədən ən sadə ekran göstərilir.
  const onboarded = !!profile?.onboarded_at
  const [fails, setFails] = useState<number | null>(native ? null : 0)
  useEffect(() => { if (native && onboarded && fails === null) void hallAttempt().then(setFails) }, [onboarded, fails])
  const [stage, setStage] = useState(0)
  const ready = !subjects.isLoading && view3d !== null && fails !== null
  const staged = fails === 1 && !view3d
  const opened = !staged || stage >= STAGES.length
  const count = subjects.data?.length ?? 0
  useEffect(() => { if (ready) crumb('hall_data', `fenn=${count} view3d=${view3d ? 1 : 0} fails=${fails}`) }, [ready])
  useEffect(() => {
    if (!ready || !staged || stage >= STAGES.length) return
    crumb(`stage_next_${stage + 1}`, STAGES[stage])
    const id = setTimeout(() => setStage(stage + 1), 700)
    return () => clearTimeout(id)
  }, [ready, staged, stage])
  useEffect(() => {
    if (!ready || !opened) return
    crumb('hall_rendered', (fails ?? 0) >= 2 ? 'sade' : view3d ? '3d' : staged ? 'merheleli' : 'tam')
    const a = setTimeout(() => crumb('hall_alive_1s'), 1000)
    const b = setTimeout(hallStable, 5000)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [ready, opened])
  /** Yoxlama rejimində `k`-cı hissə artıq açılıbmı. */
  const show = (k: number) => !staged || stage >= k
  useFocusEffect(useCallback(() => { setFocused(true); void active.refetch(); return () => setFocused(false) }, [active.refetch]))

  if (subjects.isLoading || view3d === null || fails === null) return <Screen><Loading /></Screen>
  const liveNow = (live.data ?? []).filter((s) => s.state === 'live').length
  const first = profile?.display_name?.split(' ')[0] || ''

  const resumeTotal = active.data?.question_ids.length ?? 0
  // Telefonda 2, enli ekranda 4 qapı bir sırada; sıranı görünməz doldurucular tamamlayır.
  const basis = cols === 4 ? '22%' : '47%'
  const n = subjects.data?.length ?? 0
  const spacers = (cols - (n % cols)) % cols

  const resume = active.data
    ? () => router.push({ pathname: '/test/[session]', params: { session: active.data!.id, subject: active.data!.subject_id } })
    : null
  const resumeSub = active.data
    ? t.hall.resumeSub(subjects.data?.find((s) => s.id === active.data!.subject_id)?.name ?? active.data.subject_id, active.data.cursor, resumeTotal)
    : ''

  // İki ardıcıl uğursuz açılışdan sonra: ən sadə ekran (tətbiq istifadəsiz qalmasın).
  if (fails >= 2) {
    return (
      <SafeHall greeting={t.hall.greeting(first)}
        rooms={[
          ...(subjects.data ?? []).map((s, i) => ({ key: s.id, title: `${101 + i} · ${s.name}`, onPress: () => router.push({ pathname: '/room/[subject]', params: { subject: s.id } }) })),
          { key: 'live', title: t.hall.live, sub: t.hall.liveSub, onPress: () => router.push('/live') },
        ]}
        links={[
          { key: 'diary', title: t.hall.diary, sub: t.hall.diarySub, onPress: () => router.push('/diary') },
          { key: 'board', title: t.hall.board, sub: t.hall.boardSub, onPress: () => router.push('/board') },
          { key: 'profile', title: t.hall.profile, sub: t.hall.profileSub, onPress: () => router.push('/profile') },
        ]}
        onRetryFull={() => { void hallReset().then(() => setFails(null)) }} />
    )
  }

  // 3D məktəb: tam ekran dəhliz, tələbə özü gəzir.
  if (view3d) {
    return (
      <>
        <StatusBar style="light" />
        <Corridor3D
          active={focused}
          greeting={t.hall.greeting(first)}
          doors={(subjects.data ?? []).map((s, i) => {
            const acc = hasAccess(enr.data, s.id)
            const freeCount = (topics.data ?? []).filter((x) => x.subject_id === s.id && x.free).length
            return { key: s.id, number: String(101 + i), title: s.name, status: acc ? t.hall.open : freeCount ? t.hall.locked : undefined }
          })}
          hallLive={liveNow > 0}
          resume={resume ? { sub: resumeSub, onPress: resume } : null}
          onEnter={(k) => (k === 'hall' ? router.push('/live') : router.push({ pathname: '/room/[subject]', params: { subject: k } }))}
          onGo={(w) => router.push(`/${w}`)}
          onSimple={() => { setGlErr(null); setView(false) }}
          onFail={() => { setView(false, false); setGlErr(t.hall.gl3dFailed) }}
        />
      </>
    )
  }

  return (
    <Screen glow>
      {staged && !opened ? <P dim small>{t.safe.staged(stage, STAGES.length)}</P> : null}
      {show(1) ? (
        <View style={st.top}>
          <Lockup />
          {profile ? <Badge label={t.hall.studentNo(String(profile.student_no))} /> : null}
        </View>
      ) : null}
      {show(2) ? (
        <View style={{ gap: space.xs }}>
          <H>{t.hall.greeting(first)}</H>
          <P dim>{t.hall.lead}</P>
        </View>
      ) : null}
      <ErrorBox message={subjects.error ? (subjects.error as Error).message : null} onRetry={() => subjects.refetch()} />

      {active.data && show(3) && (
        <Card testID="resume-card" tone="gold">
          <View style={st.resumeHead}>
            <View style={st.resumeIcon}><Icon name="stairs" size={20} color={colors.gold} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <H level={3}>{t.hall.resume}</H>
              <P dim small>{resumeSub}</P>
            </View>
          </View>
          <Bar value={resumeTotal ? (100 * active.data.cursor) / resumeTotal : 0} />
          <Button testID="resume-test" label={t.hall.resumeBtn} onPress={resume!} />
        </Card>
      )}

      {show(3) ? (
      <Section title={t.hall.rooms} gap={space.lg}
        right={<Chip testID="toggle-3d" icon="compass" label={Platform.OS === 'web' ? t.hall.view3d : t.hall.view3dBeta} onPress={() => { setGlErr(null); setView(true) }} />}>
        {glErr ? <P dim small>{glErr}</P> : null}
          <View style={st.corridor}>
            {(subjects.data ?? []).slice(0, show(5) ? undefined : show(4) ? 1 : 0).map((s, i) => {
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

          {show(6) ? (
            <Door wide testID="door-live" number="ZAL" title={t.hall.live}
              status={liveNow ? `${liveNow} ${t.live.liveNow}` : t.hall.liveSub} statusTone={liveNow ? 'live' : 'dim'}
              onOpen={() => router.push('/live')} />
          ) : null}
      </Section>
      ) : null}

      {show(7) ? (
      <Group>
        <ListRow icon="notebook" title={t.hall.diary} sub={t.hall.diarySub} onPress={() => router.push('/diary')} testID="go-diary" />
        <ListRow icon="trophy" title={t.hall.board} sub={t.hall.boardSub} onPress={() => router.push('/board')} testID="go-board" />
        <ListRow icon="user" title={t.hall.profile} sub={t.hall.profileSub} onPress={() => router.push('/profile')} testID="go-profile" />
      </Group>
      ) : null}
    </Screen>
  )
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap', paddingBottom: space.sm },
  resumeHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  resumeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldWash },
  corridor: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xl },
})
