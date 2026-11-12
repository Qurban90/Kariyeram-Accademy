/**
 * Dəhlizdəki sinif qapısı. Basanda qapı tayı açılır (rotateY) və içəridəki isti işıq görünür, sonra otağa keçid edilir.
 * Açıq (girişi olan) otağın qapısının altından işıq sızır: loqodakı fənər motivi.
 * "Azaldılmış hərəkət" seçilibsə animasiya atlanır.
 */
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native'
import { colors, font, radius, space, type } from '../theme'
import { Text } from './Text'

export function Door({ number, title, status, statusTone = 'dim', onOpen, testID, wide, basis }: {
  number: string; title: string; status?: string; statusTone?: 'ok' | 'dim' | 'live'; onOpen: () => void; testID?: string; wide?: boolean
  /** Sütun eni (faizlə). Verilməsə 2 sütun. */
  basis?: `${number}%`
}) {
  const a = useRef(new Animated.Value(0)).current
  const [reduce, setReduce] = useState(false)
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}) }, [])

  const open = () => {
    if (reduce) { onOpen(); return }
    Animated.timing(a, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      onOpen()
      setTimeout(() => a.setValue(0), 400)
    })
  }
  const rotate = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-70deg'] })
  // İçərinin işığı yalnız qapı açılmağa başlayanda görünür (bağlı qapının kənarından sızmasın).
  const glow = a.interpolate({ inputRange: [0, 0.06, 1], outputRange: [0, 1, 1] })
  const lit = statusTone !== 'dim'
  const dot = statusTone === 'live' ? colors.live : colors.gold

  return (
    <Pressable testID={testID} onPress={open} accessibilityRole="button" accessibilityLabel={`${number}. ${title}${status ? `, ${status}` : ''}`}
      style={({ pressed }) => [st.wrap, basis ? { width: basis, maxWidth: basis } : null, wide && { width: '100%', maxWidth: '100%' }, pressed && { opacity: 0.92 }]}>
      <View style={[st.frame, wide && { aspectRatio: 2.6, maxHeight: 220 }, lit && { borderColor: colors.goldLine }]}>
        <Animated.View style={[st.inside, { opacity: glow }]}><Text style={st.insideTxt} numberOfLines={3}>{title}</Text></Animated.View>
        <Animated.View style={[st.leaf, wide && st.leafWide, { transform: [{ perspective: 700 }, { translateX: -40 }, { rotateY: rotate }, { translateX: 40 }] }]}>
          {wide ? <View style={st.inset} /> : (<><View style={st.panelTop} /><View style={st.panelBottom} /></>)}
          {wide ? <View style={st.seam} /> : null}
          <Text style={[st.number, wide && { fontSize: 26, letterSpacing: 6, marginRight: -6 }]}>{number}</Text>
          <View style={st.rule} />
          {wide ? (
            <>
              <View style={[st.knob, st.knobWide, { marginLeft: -20 }]} />
              <View style={[st.knob, st.knobWide, { marginLeft: 10 }]} />
            </>
          ) : <View style={st.knob} />}
          {lit ? <View style={[st.sill, statusTone === 'live' && { backgroundImage: `linear-gradient(90deg, rgba(239,99,81,0) 0%, ${colors.live} 50%, rgba(239,99,81,0) 100%)`, boxShadow: '0px -8px 22px rgba(239,99,81,0.35)' }]} /> : null}
        </Animated.View>
      </View>
      <View style={{ gap: 3 }}>
        <Text style={st.title} numberOfLines={2}>{title}</Text>
        {status ? (
          <View style={st.statusRow}>
            {lit ? <View style={[st.dot, { backgroundColor: dot }]} /> : null}
            <Text style={[st.status, lit && { color: statusTone === 'live' ? colors.live : colors.goldBright }]}>{status}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

/**
 * Qapıların sayı tək olanda sonuncu sıraya qoyulan görünməz doldurucu: boş yeri o tutur,
 * sonuncu qapı bütün eni tutub böyümür.
 */
export function DoorSpacer({ basis }: { basis?: `${number}%` }) {
  return <View style={[st.spacer, basis ? { width: basis, maxWidth: basis } : null]} />
}

const st = StyleSheet.create({
  spacer: { width: '47%', minWidth: 140, flexGrow: 1 },
  wrap: { width: '47%', minWidth: 140, flexGrow: 1, gap: space.sm + 2 },
  frame: { aspectRatio: 0.92, backgroundColor: colors.nightDeep, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, overflow: 'hidden' },
  inside: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space.md,
    backgroundColor: colors.gold, backgroundImage: 'radial-gradient(circle at 50% 58%, #FBDD95 0%, #E9B23C 46%, #8C5E10 100%)',
  },
  insideTxt: { color: colors.onGold, fontFamily: type.displayBold, fontSize: font.h3, textAlign: 'center' },
  leaf: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', paddingTop: '17%', gap: space.sm,
    backgroundColor: colors.surfaceHi, backgroundImage: 'linear-gradient(155deg, #2B261F 0%, #1A1714 55%, #131110 100%)',
  },
  leafWide: { paddingTop: 22 },
  knobWide: { right: undefined, left: '50%', top: '66%' },
  inset: { position: 'absolute', top: 9, left: 9, right: 9, bottom: 9, borderRadius: radius.sm - 2, borderWidth: 1, borderColor: 'rgba(246,237,224,0.07)' },
  panelTop: { position: 'absolute', top: 9, left: 9, right: 9, height: '50%', borderRadius: radius.sm - 2, borderWidth: 1, borderColor: 'rgba(246,237,224,0.08)', backgroundColor: 'rgba(246,237,224,0.015)' },
  panelBottom: { position: 'absolute', bottom: 9, left: 9, right: 9, top: '58%', borderRadius: radius.sm - 2, borderWidth: 1, borderColor: 'rgba(246,237,224,0.06)' },
  seam: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  number: { color: colors.gold, fontFamily: type.display, fontSize: 30, lineHeight: 36, fontVariant: ['tabular-nums'] },
  rule: { width: 22, height: 1, backgroundColor: colors.goldLine },
  knob: { position: 'absolute', right: '9%', top: '53.5%', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold, boxShadow: '0px 0px 10px rgba(233,178,60,0.55)' },
  sill: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
    backgroundImage: `linear-gradient(90deg, rgba(233,178,60,0) 0%, ${colors.goldBright} 50%, rgba(233,178,60,0) 100%)`,
    boxShadow: '0px -8px 22px rgba(233,178,60,0.38)',
  },
  title: { color: colors.ivory, fontWeight: '600', fontSize: font.body, lineHeight: 21 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  status: { color: colors.ivoryDim, fontSize: font.tiny + 1, fontWeight: '500' },
})
