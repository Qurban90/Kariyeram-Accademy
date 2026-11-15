/** Fənn otağı (özünü öyrənmə). 3D-də tələbə sinifdə gəzir, partaya oturur və pəncərə açılır; sadə görünüşdə eyni məzmun səhifədir. */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Loading, RoomTheme, Screen } from '../../src/components/ui'
import { RoomScene } from '../../src/components/RoomScene'
import { t } from '../../src/i18n/az'
import { fmtDate } from '../../src/lib/dates'
import { hasAccess, useEnrollments, useSubjects, useTopics } from '../../src/lib/queries'
import { useView3d } from '../../src/lib/view3d'
import { RoomPanel } from '../../src/room/RoomPanel'
import { Room3D } from '../../src/school3d/Room3D'

const leave = () => (router.canGoBack() ? router.back() : router.replace('/'))

export default function Room() {
  const { subject } = useLocalSearchParams<{ subject: string }>()
  const subjects = useSubjects()
  const topics = useTopics(subject)
  const enr = useEnrollments()
  const [view3d, setView3d] = useView3d()
  const [focused, setFocused] = useState(true)
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))

  const name = subjects.data?.find((s) => s.id === subject)?.name ?? ''
  const idx = (subjects.data ?? []).findIndex((s) => s.id === subject)
  const roomNo = idx >= 0 ? String(101 + idx) : ''

  if (view3d === null || subjects.isLoading) return <Screen><Loading /></Screen>

  if (view3d) {
    return (
      <>
        <StatusBar style="light" />
        <Room3D roomNo={roomNo} name={name} active={focused} onExit={leave}
          onSimple={() => setView3d(false)} onFail={() => setView3d(false, false)}>
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
          note={access ? t.room.accessUntil(fmtDate(access.access_until)) : anyOpen ? t.hall.locked : undefined} />
        <RoomPanel subject={subject} />
      </Screen>
    </RoomTheme>
  )
}
