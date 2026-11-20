/** Fənn otağı (özünü öyrənmə). Telefonda avtomatik kinematik giriş (bina → dəhliz → parta → iki seçim);
 * vebdə və "özüm gəzim" seçəndə əl ilə gəzinti. Sadə görünüşdə eyni məzmun səhifədir. */
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { Platform } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { Loading, RoomTheme, Screen } from '../../src/components/ui'
import { RoomScene } from '../../src/components/RoomScene'
import { t } from '../../src/i18n/az'
import { useAuth } from '../../src/lib/auth'
import { fmtDate } from '../../src/lib/dates'
import { hasAccess, useEnrollments, useLiveSessions, useSubjects, useTopics } from '../../src/lib/queries'
import { useView3d } from '../../src/lib/view3d'
import { RoomPanel } from '../../src/room/RoomPanel'
import { Cinema } from '../../src/school3d/Cinema'
import { Room3D } from '../../src/school3d/Room3D'

const leave = () => (router.canGoBack() ? router.back() : router.replace('/'))
const native = Platform.OS !== 'web'

export default function Room() {
  const { subject, cine } = useLocalSearchParams<{ subject: string; cine?: string }>()
  const { profile } = useAuth()
  const subjects = useSubjects()
  const topics = useTopics(subject)
  const allTopics = useTopics()
  const enr = useEnrollments()
  const live = useLiveSessions()
  const [view3d, setView3d] = useView3d()
  const [focused, setFocused] = useState(true)
  // Avtomatik rejimdə "Test" seçimi: sinif səhnəsi söküllür, tam ekran test paneli açılır (3D statusu dəyişmir).
  const [fullTest, setFullTest] = useState(false)
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))

  const list = subjects.data ?? []
  const name = list.find((s) => s.id === subject)?.name ?? ''
  const idx = list.findIndex((s) => s.id === subject)
  const roomNo = idx >= 0 ? String(101 + idx) : ''

  if (view3d === null || subjects.isLoading) return <Screen><Loading /></Screen>

  if (fullTest) {
    return (
      <RoomTheme>
        <Screen back title={name}>
          <RoomPanel subject={subject} />
        </Screen>
      </RoomTheme>
    )
  }

  if (view3d) {
    const doors = list.map((s, i) => {
      const acc = hasAccess(enr.data, s.id)
      const freeCount = (allTopics.data ?? []).filter((x) => x.subject_id === s.id && x.free).length
      return { key: s.id, number: String(101 + i), title: s.name, status: acc ? t.hall.open : freeCount ? t.hall.locked : undefined }
    })
    const liveNow = (live.data ?? []).filter((s) => s.state === 'live').length
    const first = profile?.display_name?.split(' ')[0] || ''
    return (
      <>
        {/* Qapıdan keçid səhnənin öz animasiyasıdır: ekranın sürüşməsi onu pozmasın. */}
        <Stack.Screen options={{ animation: 'none' }} />
        <StatusBar style="light" />
        {native || cine === '1' ? (
          <Cinema doors={doors} idx={Math.max(0, idx)} hallLive={liveNow > 0} roomNo={roomNo} name={name}
            seatNo={profile?.student_no ?? 1} greeting={t.hall.greeting(first)} active={focused}
            onExit={leave} onSimple={() => setView3d(false)} onFail={() => setView3d(false, false)}
            onLesson={() => router.push({ pathname: '/lesson/[subject]', params: { subject } })}
            onTest={() => setFullTest(true)} />
        ) : (
          <Room3D roomNo={roomNo} name={name} active={focused} onExit={leave}
            onSimple={() => setView3d(false)} onFail={() => setView3d(false, false)}>
            <RoomPanel subject={subject} />
          </Room3D>
        )}
      </>
    )
  }

  // Sadə görünüş: qapının arxası işıqlı sinifdir, ekran sinif palitrası ilə açılır.
  const access = hasAccess(enr.data, subject)
  const anyOpen = (topics.data ?? []).some((x) => access || x.free)
  return (
    <RoomTheme>
      <Screen back title="">
        <RoomScene number={roomNo || undefined} name={name}
          note={access ? t.room.accessUntil(fmtDate(access.access_until)) : anyOpen ? t.hall.locked : undefined} />
        <RoomPanel subject={subject} />
      </Screen>
    </RoomTheme>
  )
}