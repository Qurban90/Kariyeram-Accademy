/**
 * Dəhlizdəki sinif qapısı. Basanda qapı tayı açılır (rotateY), sonra otağa keçid edilir.
 * "Azaldılmış hərəkət" seçilibsə animasiya atlanır.
 */
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, font, radius, space } from '../theme'

export function Door({ number, title, status, statusTone = 'dim', onOpen, testID, wide }: {
  number: string; title: string; status?: string; statusTone?: 'ok' | 'dim' | 'live'; onOpen: () => void; testID?: string; wide?: boolean
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
  const tone = statusTone === 'live' ? colors.bad : statusTone === 'ok' ? colors.ok : colors.chalkDim

  return (
    <Pressable testID={testID} onPress={open} accessibilityRole="button" accessibilityLabel={`${number}. ${title}${status ? `, ${status}` : ''}`}
      style={[st.wrap, wide && { width: '100%' }]}>
      <View style={[st.frame, wide && { aspectRatio: 2.2 }]}>
        <View style={st.inside}><Text style={st.insideTxt}>{title}</Text></View>
        <Animated.View style={[st.leaf, { transform: [{ perspective: 600 }, { translateX: -40 }, { rotateY: rotate }, { translateX: 40 }] }]}>
          <View style={st.window} />
          <View style={st.plate}><Text style={st.plateTxt}>{number}</Text></View>
          <View style={st.knob} />
        </Animated.View>
      </View>
      <Text style={st.title} numberOfLines={2}>{title}</Text>
      {status ? <Text style={[st.status, { color: tone }]}>{statusTone === 'live' ? '● ' : ''}{status}</Text> : null}
    </Pressable>
  )
}

const st = StyleSheet.create({
  wrap: { width: '47%', minWidth: 140, flexGrow: 1, gap: space.xs },
  frame: { aspectRatio: 0.95, backgroundColor: '#2b1d12', borderRadius: radius.sm, borderWidth: 5, borderColor: colors.woodLight, overflow: 'hidden' },
  inside: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#e9dfc4', alignItems: 'center', justifyContent: 'center', padding: space.sm },
  insideTxt: { color: '#3a2a18', fontWeight: '700', textAlign: 'center' },
  leaf: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.wood, alignItems: 'center', paddingTop: '10%', gap: 8, borderRightWidth: 2, borderRightColor: '#4d3420' },
  window: { width: '52%', height: '24%', backgroundColor: 'rgba(200,225,215,0.35)', borderWidth: 3, borderColor: '#4d3420', borderRadius: 3 },
  plate: { backgroundColor: colors.brass, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 3, borderWidth: 1, borderColor: colors.brassDeep },
  plateTxt: { color: colors.ink, fontWeight: '800', fontSize: font.small, letterSpacing: 1 },
  knob: { position: 'absolute', right: '12%', top: '55%', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brass },
  title: { color: colors.chalk, fontWeight: '700', fontSize: font.body },
  status: { fontSize: font.tiny, fontWeight: '600' },
})
