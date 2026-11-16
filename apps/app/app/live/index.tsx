/** Oxu zalı: 3D-də pilləli auditoriya (tələbə içəri girir, istədiyi yerə oturur, dərslərin siyahısı pəncərədə açılır); sadə görünüşdə siyahı səhifəsi. */
import { router, Stack, useFocusEffect } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useState } from 'react'
import { IconButton, Loading, Screen } from '../../src/components/ui'
import { t } from '../../src/i18n/az'
import { useAuth } from '../../src/lib/auth'
import { useView3d } from '../../src/lib/view3d'
import { LiveListPanel } from '../../src/live/LiveListPanel'
import { Room3D } from '../../src/school3d/Room3D'

export default function LiveList() {
  const { profile } = useAuth()
  const staff = profile?.role === 'teacher' || profile?.role === 'admin'
  const [view3d, setView3d] = useView3d()
  const [focused, setFocused] = useState(true)
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false) }, []))

  if (view3d === null) return <Screen><Loading /></Screen>
  if (view3d) {
    return (
      <>
        {/* Qapıdan keçid səhnənin öz animasiyasıdır: ekranın sürüşməsi onu pozmasın. */}
        <Stack.Screen options={{ animation: 'none' }} />
        <StatusBar style="light" />
        <Room3D kind="hall" roomNo="" name={t.live.title} active={focused}
          onExit={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          onSimple={() => setView3d(false)} onFail={() => setView3d(false, false)}>
          <LiveListPanel create={staff} />
        </Room3D>
      </>
    )
  }
  return (
    <Screen back title={t.live.title} right={staff ? <IconButton tone="gold" icon="plus" label={t.live.create} onPress={() => router.push('/live/new')} /> : null}>
      <LiveListPanel />
    </Screen>
  )
}
