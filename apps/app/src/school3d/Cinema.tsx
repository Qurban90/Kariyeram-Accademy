/**
 * Avtomatik (kinematik) giriş: binanın çöldən görünüşü → dəhliz → fənn otağı → partaya oturma → iki seçim.
 * Tələbə heç nə idarə etmir (GTA tərzi öz-özünə hərəkət); istəyəndə "Keç" ilə birbaşa partaya çatır.
 * Hər mərhələ öz səhnəsini və pərdəsini idarə edir; seçim klikləndi tam ekran açılır (sinif səhnəsi söküllür).
 */
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Lockup } from '../components/Brand'
import { Button, P } from '../components/ui'
import { t } from '../i18n/az'
import { colors, space } from '../theme'
import { Corridor3D, type DoorInfo } from './Corridor3D'
import { Exterior3D } from './Exterior3D'
import { Veil } from './Hud'
import { Room3D } from './Room3D'

type Stage = 'exterior' | 'corridor' | 'room'
const reduceMotion = Platform.OS === 'web' && typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Cinema({ doors, idx, hallLive, roomNo, name, seatNo, greeting, active, onExit, onSimple, onFail, onLesson, onTest }: {
  doors: DoorInfo[]; idx: number; hallLive: boolean
  roomNo: string; name: string; seatNo: number; greeting: string
  active: boolean
  onExit: () => void; onSimple: () => void; onFail: () => void
  onLesson: () => void; onTest: () => void
}) {
  const [stage, setStage] = useState<Stage>(reduceMotion ? 'room' : 'exterior')
  const [veil, setVeil] = useState(true)
  const ins = useSafeAreaInsets()
  useEffect(() => { if (stage !== 'exterior') setVeil(false) }, [stage])
  const caption = stage === 'exterior' ? t.cine.entering : stage === 'corridor' ? t.cine.corridor : t.cine.seating

  return (
    <View style={st.wrap}>
      {stage === 'exterior' ? (
        <Exterior3D active={active} low={Platform.OS !== 'web'} onReady={() => setVeil(false)} onDone={() => setStage('corridor')} />
      ) : stage === 'corridor' ? (
        <Corridor3D auto autoTarget={String(idx)} doors={doors} hallLive={hallLive} active={active} greeting={greeting}
          onEnter={() => setStage('room')} onGo={(w) => router.push(`/${w}`)} onSimple={onSimple} onFail={onFail} />
      ) : (
        <Room3D auto seatNo={seatNo} roomNo={roomNo} name={name} active={active} onExit={onExit} onSimple={onSimple} onFail={onFail}
          onLesson={onLesson} onTest={onTest}>{null}</Room3D>
      )}

      {/* Üst zolaq: brend + mərhələ + keç / çıx */}
      <View style={[st.top, { paddingTop: ins.top + space.sm }]} pointerEvents="box-none">
        <View style={st.topRow}>
          <Lockup variant="row" size={30} />
          <View style={{ flex: 1 }} />
          {stage !== 'room' ? <Button testID="cine-skip" small variant="ghost" label={t.cine.skip} onPress={() => setStage('room')} /> : null}
          <Button testID="cine-exit" small variant="quiet" icon="exit" label={t.common.back} onPress={onExit} />
        </View>
        {stage !== 'room' ? <P dim small style={st.caption}>{caption}</P> : null}
      </View>
      {stage === 'exterior' ? <Veil shown={veil} /> : null}
    </View>
  )
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.nightDeep },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: space.md, gap: space.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  caption: { textAlign: 'center' },
})