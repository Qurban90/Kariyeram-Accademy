/**
 * Partanın üstü (oturandan sonra): ad kartı, iki əşya və bir stiker.
 * Dəftər: "Dərsin izahı". Test vərəqi: "Testi yazmaq istəyirəm". Hər biri bir toxunuşla tam ekran açılır.
 * Stiker: akademiyanın reklamı (materiallar və canlı dərs üçün kursa yazılmaq).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { Icon } from '../components/Icon'
import { PromoSheet } from '../components/Promo'
import { Text } from '../components/Text'
import { config } from '../config'
import { t } from '../i18n/az'
import { radius, scene as c, space, touch, type } from '../theme'
import { nativeDriver } from './Stage'

function Wood() {
  // Ceviz damarları: bir neçə yumşaq əyri, şəkil faylı yoxdur.
  const grain = Array.from({ length: 14 }, (_, i) => {
    const y = 30 + i * 58
    return `M-20 ${y} C 120 ${y - 18 + (i % 3) * 9}, 260 ${y + 22}, 420 ${y - 6} S 700 ${y + 14 - (i % 2) * 20}, 840 ${y + 4}`
  })
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="dk-wood" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.deskDark} />
          <Stop offset="0.25" stopColor={c.desk} />
          <Stop offset="1" stopColor={c.deskTop} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={800} height={800} fill="url(#dk-wood)" />
      {grain.map((d, i) => <Path key={i} d={d} stroke={c.deskDark} strokeOpacity={0.16 + (i % 3) * 0.05} strokeWidth={1.4 + (i % 4)} fill="none" />)}
    </Svg>
  )
}

/** Partadakı əşya: kağız, bir az çəp, altında yumşaq kölgə. Basanda qalxır. */
function Item({ testID, label, rotate, onPress, children, style, delay, enter }: {
  testID: string; label: string; rotate: number; onPress: () => void; children: ReactNode; style?: object; delay: number; enter: Animated.Value
}) {
  const lift = useRef(new Animated.Value(0)).current
  const y = enter.interpolate({ inputRange: [0, 1], outputRange: [24 + delay / 10, 0] })
  const press = (to: number) => Animated.timing(lift, { toValue: to, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start()
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] })
  return (
    <Animated.View style={[{ opacity: enter, transform: [{ translateY: y }, { rotate: `${rotate}deg` }, { scale }] }, style]}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={() => press(1)} onPressOut={() => press(0)}
        style={({ pressed }) => [st.item, pressed && st.itemPressed]}>
        {children}
      </Pressable>
    </Animated.View>
  )
}

export function DeskView({ name, seatNo, roomNo, subject, onLesson, onTest, onLeave, menu }: {
  name: string; seatNo: number; roomNo: string; subject: string
  onLesson: () => void; onTest: () => void; onLeave: () => void
  menu?: ReactNode
}) {
  const ins = useSafeAreaInsets()
  const enter = useRef(new Animated.Value(0)).current
  const enter2 = useRef(new Animated.Value(0)).current
  const enter3 = useRef(new Animated.Value(0)).current
  const [promo, setPromo] = useState(false)
  useEffect(() => {
    const ease = Easing.out(Easing.cubic)
    Animated.stagger(90, [enter, enter2, enter3].map((v) => Animated.timing(v, { toValue: 1, duration: 520, easing: ease, useNativeDriver: nativeDriver }))).start()
  }, [])

  return (
    <View style={st.wrap} testID="desk-view">
      <Wood />
      <ScrollView contentContainerStyle={[st.content, { paddingTop: ins.top + space.sm, paddingBottom: ins.bottom + space.xl }]} showsVerticalScrollIndicator={false}>
        <View style={st.bar}>
          <Pressable testID="desk-leave" onPress={onLeave} accessibilityRole="button" accessibilityLabel={t.scene.leave} hitSlop={8} style={st.barBtn}>
            <Icon name="back" size={20} color={c.paper} />
            <Text style={st.barTxt}>{t.scene.leave}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {menu}
        </View>

        {/* Ad kartı */}
        <Animated.View style={[st.tent, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}
          accessible accessibilityRole="header" accessibilityLabel={`${name}, ${t.scene.seat(seatNo)}, ${roomNo} ${subject}`}>
          <Text style={st.tentName} numberOfLines={1}>{name}</Text>
          <Text style={st.tentSub} numberOfLines={1}>{t.scene.seatIn(seatNo, roomNo, subject)}</Text>
        </Animated.View>

        <View style={st.items}>
          <Item testID="desk-lesson" label={`${t.scene.lesson}. ${t.scene.lessonSub}`} rotate={-2} delay={0} enter={enter2} onPress={onLesson} style={st.half}>
            <View style={st.notebook}>
              <View style={st.spine} />
              {[0, 1, 2, 3, 4, 5].map((i) => <View key={i} style={[st.ruled, { top: 74 + i * 18 }]} />)}
              <Icon name="bookOpen" size={30} color={c.ink} />
              <Text style={st.itemTitle}>{t.scene.lesson}</Text>
              <Text style={st.itemSub}>{t.scene.lessonSub}</Text>
            </View>
          </Item>
          <Item testID="desk-test" label={`${t.scene.test}. ${t.scene.testSub}`} rotate={1.6} delay={80} enter={enter3} onPress={onTest} style={st.half}>
            <View style={st.sheet}>
              <View style={st.bubbles}>
                {[0, 1, 2].map((r) => (
                  <View key={r} style={st.bubbleRow}>
                    {['A', 'B', 'C', 'D'].map((l, i) => <View key={l} style={[st.bubble, r === 0 && i === 1 && st.bubbleOn, r === 1 && i === 3 && st.bubbleOn]} />)}
                  </View>
                ))}
              </View>
              <Icon name="timer" size={30} color={c.ink} />
              <Text style={st.itemTitle}>{t.scene.test}</Text>
              <Text style={st.itemSub}>{t.scene.testSub}</Text>
            </View>
          </Item>
        </View>

        {/* Stiker: akademiyanın reklamı */}
        <Animated.View style={{ opacity: enter3, alignSelf: 'center', transform: [{ rotate: '-1.5deg' }] }}>
          <Pressable testID="desk-promo" onPress={() => setPromo(true)} accessibilityRole="button" accessibilityLabel={`${t.promo.sticky}. ${t.promo.stickySub}`}
            style={({ pressed }) => [st.sticky, pressed && { opacity: 0.9 }]}>
            <View style={st.tape} />
            <Text style={st.stickyTitle}>{t.promo.sticky}</Text>
            <Text style={st.stickySub}>{t.promo.stickySub}</Text>
            <Text style={st.stickyPhone}>{config.contactPhoneDisplay}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
      <PromoSheet visible={promo} onClose={() => setPromo(false)} />
    </View>
  )
}

const paperShadow = '0px 2px 3px rgba(40,24,8,0.25), 0px 16px 30px rgba(40,24,8,0.35)'
const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.desk },
  content: { paddingHorizontal: space.lg, gap: space.xl, alignItems: 'stretch', width: '100%', maxWidth: 640, alignSelf: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: touch },
  barBtn: {
    minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, borderRadius: radius.pill,
    backgroundColor: 'rgba(30,18,8,0.45)',
  },
  barTxt: { color: c.paper, fontFamily: type.semibold, fontSize: 15 },
  tent: {
    alignSelf: 'center', minWidth: 210, maxWidth: '86%', paddingHorizontal: space.xl, paddingVertical: space.md, alignItems: 'center', gap: 2,
    backgroundColor: c.paper, borderRadius: 4, borderBottomWidth: 6, borderBottomColor: c.paperShade, boxShadow: paperShadow,
  },
  tentName: { color: c.ink, fontFamily: type.displayBold, fontSize: 26, lineHeight: 32 },
  tentSub: { color: c.inkDim, fontFamily: type.medium, fontSize: 14 },
  items: { flexDirection: 'row', gap: space.lg, flexWrap: 'wrap', justifyContent: 'center' },
  half: { flexBasis: 150, flexGrow: 1, maxWidth: 290 },
  item: { borderRadius: 6, boxShadow: paperShadow },
  itemPressed: { boxShadow: '0px 4px 6px rgba(40,24,8,0.25), 0px 26px 40px rgba(40,24,8,0.4)' },
  notebook: {
    minHeight: 236, padding: space.lg, paddingLeft: space.xl + 6, gap: space.sm, justifyContent: 'flex-end', overflow: 'hidden',
    backgroundColor: c.paper, borderRadius: 6,
  },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, backgroundColor: c.spine },
  ruled: { position: 'absolute', left: 30, right: 14, height: 1, backgroundColor: 'rgba(62,92,118,0.22)' },
  sheet: { minHeight: 236, padding: space.lg, gap: space.sm, justifyContent: 'flex-end', backgroundColor: c.paper, borderRadius: 6 },
  bubbles: { position: 'absolute', top: space.lg, left: space.lg, gap: 8 },
  bubbleRow: { flexDirection: 'row', gap: 8 },
  bubble: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(34,27,17,0.45)' },
  bubbleOn: { backgroundColor: c.ink, borderColor: c.ink },
  itemTitle: { color: c.ink, fontFamily: type.displayBold, fontSize: 20, lineHeight: 25 },
  itemSub: { color: c.inkDim, fontFamily: type.body, fontSize: 14, lineHeight: 19 },
  sticky: {
    width: 260, padding: space.lg, paddingTop: space.xl, gap: 4, backgroundColor: c.sticky, borderRadius: 2,
    borderBottomRightRadius: 18, boxShadow: '0px 2px 2px rgba(40,24,8,0.2), 0px 12px 22px rgba(40,24,8,0.3)',
  },
  tape: { position: 'absolute', top: -9, alignSelf: 'center', width: 70, height: 20, backgroundColor: 'rgba(255,253,246,0.55)', transform: [{ rotate: '2deg' }] },
  stickyTitle: { color: c.ink, fontFamily: type.displayBold, fontSize: 19 },
  stickySub: { color: c.stickyInk, fontFamily: type.body, fontSize: 14, lineHeight: 19 },
  stickyPhone: { color: c.ink, fontFamily: type.bold, fontSize: 20, marginTop: space.xs, fontVariant: ['tabular-nums'] },
})

