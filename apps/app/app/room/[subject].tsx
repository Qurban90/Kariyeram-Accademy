/** Fənn otağı (özünü öyrənmə). 2.5D səhnədə (defolt) tələbə özü partasına oturur, partada iki seçim;
 * 3D gəzintidə əl ilə gəzinti; sadə görünüşdə eyni məzmun səhifədir. */
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Loading, RoomTheme, Screen } from '../../src/components/ui'
import { RoomScene } from '../../src/components/RoomScene'
import { t } from '../../src/i18n/az'
import { useAuth } from '../../src/lib/auth'
import { fmtDate } from '../../src/lib/dates'
import { hasAccess, useEnrollments, useSubjects, useTopics } from '../../src/lib/queries'
import { useViewMode } from '../../src/lib/view3d'
import { RoomPanel } from '../../src/room/RoomPanel'
import { ClassScene } from '../../src/scene/ClassScene'
import { Room3D } from '../../src/school3d/Room3D'

const leave = () => (router.canGoBack() ? router.back() : router.replace('/'))

export default function Room() {
  const { subject } = useLocalSearchParams<{ subject: string }>()
  const { profile } = useAuth()
  const subjects = useSubjects()
  const topics = useTopics(subject)
  const enr = useEnrollments()
  const [mode, setMode] = useViewMode()
  const [focused, setFocused] = useState(true)
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))

  const list = subjects.data ?? []
  const name = list.find((s) => s.id === subject)?.name ?? ''
  const idx = list.findIndex((s) => s.id === subject)
  const roomNo = idx >= 0 ? String(101 + idx) : ''

  if (mode === null || subjects.isLoading) return <Screen><Loading /></Screen>

  if (mode === 'scene') {
    return (
      <>
        {/* Qapıdan keçid səhnənin öz animasiyasıdır: ekranın sürüşməsi onu pozmasın. */}
        <Stack.Screen options={{ animation: 'fade' }} />
        <StatusBar style="dark" />
        <ClassScene subject={name} roomNo={roomNo} name={profile?.display_name ?? ''} firstName={profile?.display_name?.split(' ')[0] ?? ''}
          studentNo={profile?.student_no}
          onLesson={() => router.push({ pathname: '/lesson/[subject]', params: { subject } })}
          onTest={() => router.push({ pathname: '/practice/[subject]', params: { subject } })}
          onLeave={leave} />
      </>
    )
  }

  if (mode === '3d') {
    return (
      <>
        <Stack.Screen options={{ animation: 'none' }} />
        <StatusBar style="light" />
        <Room3D roomNo={roomNo} name={name} active={focused} onExit={leave}
          onSimple={() => setMode('simple')} onFail={() => setMode('simple', false)}>
          <RoomPanel subject={subject} />
        </Room3D>
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
          note={access?.free ? t.room.freeNow : access ? t.room.accessUntil(fmtDate(access.access_until)) : anyOpen ? t.hall.locked : undefined} />
        <RoomPanel subject={subject} />
      </Screen>
    </RoomTheme>
  )
}
