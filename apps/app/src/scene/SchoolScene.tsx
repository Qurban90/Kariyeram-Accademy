/**
 * Zal ekranının 2.5D görünüşü: tətbiq açılanda bir dəfə avtomatik giriş (bina → qapı → dəhliz),
 * sonra dəhliz və qapıların siyahısı. Fənnə toxunanda kamera qapıya yeriyir və sinfə keçilir.
 */
import { useFocusEffect } from 'expo-router'
import { useCallback, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Lockup } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Text } from '../components/Text'
import { t } from '../i18n/az'
import { colors, radius, space, touch, type } from '../theme'
import { Corridor, type CorridorDoor } from './Corridor'
import { Exterior } from './Exterior'
import { SceneMenu } from './SceneMenu'
import { useQuietMotion } from './Stage'

/** Giriş hər işə salınmada bir dəfə göstərilir (zala qayıdanda təkrarlanmır). */
let introPlayed = false

export function SchoolScene({ doors, hallLive, hallTitle, resume, onEnter, active }: {
  doors: CorridorDoor[]; hallLive: number; hallTitle: string
  /** Ekran görünür (fokusdadır və qeydiyyat bitib): giriş yalnız onda başlayır, arxa planda oynamasın. */
  active: boolean
  resume: { label: string; onPress: () => void } | null
  onEnter: (key: string) => void
}) {
  const quiet = useQuietMotion()
  const ins = useSafeAreaInsets()
  const [phase, setPhase] = useState<'intro' | 'corridor'>(introPlayed ? 'corridor' : 'intro')
  const [arrive, setArrive] = useState(false)
  // Zala qayıdanda dəhliz yenidən qurulur (əvvəlki qapı açıq qalmasın).
  const [visit, setVisit] = useState(0)
  useFocusEffect(useCallback(() => () => setVisit((v) => v + 1), []))

  const toCorridor = () => { introPlayed = true; setArrive(true); setPhase('corridor') }
  if (quiet === null || (phase === 'intro' && !active)) return <View style={st.black} />
  if (phase === 'intro' && !quiet) {
    return (
      <View style={st.black}>
        <Exterior onDone={toCorridor} />
        <View style={[st.skip, { top: ins.top + space.sm }]}>
          <Pressable testID="scene-skip" onPress={toCorridor} accessibilityRole="button" accessibilityLabel={t.scene.skip} style={({ pressed }) => [st.skipBtn, pressed && { opacity: 0.8 }]}>
            <Text style={st.skipTxt}>{t.scene.skip}</Text>
            <Icon name="chevron" size={16} color={colors.ivory} />
          </Pressable>
        </View>
      </View>
    )
  }

  const top: ReactNode = (
    <View style={st.topRow}>
      <Lockup variant="row" size={30} />
      <View style={{ flex: 1 }} />
      <SceneMenu onReplay={() => { introPlayed = false; setPhase('intro') }} />
    </View>
  )
  return (
    <Corridor key={visit} doors={doors} hallLive={hallLive} hallTitle={hallTitle} arrive={arrive && visit === 0 && !quiet} top={top}
      resume={resume ? (
        <Pressable testID="resume-test" onPress={resume.onPress} accessibilityRole="button" accessibilityLabel={resume.label}
          style={({ pressed }) => [st.resume, pressed && { opacity: 0.85 }]}>
          <Icon name="stairs" size={18} color={colors.onGold} />
          <Text style={st.resumeTxt} numberOfLines={1}>{resume.label}</Text>
          <Icon name="chevron" size={16} color={colors.onGold} />
        </Pressable>
      ) : null}
      onEnter={onEnter} />
  )
}

const st = StyleSheet.create({
  black: { flex: 1, backgroundColor: colors.nightDeep },
  skip: { position: 'absolute', right: space.lg },
  skipBtn: {
    minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.lg, borderRadius: radius.pill,
    backgroundColor: 'rgba(11,10,9,0.55)', borderWidth: 1, borderColor: colors.line,
  },
  skipTxt: { color: colors.ivory, fontFamily: type.semibold, fontSize: 15 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resume: {
    minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.md,
    backgroundColor: colors.gold,
  },
  resumeTxt: { flex: 1, color: colors.onGold, fontFamily: type.semibold, fontSize: 15 },
})
