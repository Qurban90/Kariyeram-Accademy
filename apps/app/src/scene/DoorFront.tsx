/**
 * Qapının qarşısında: tələbə qapıya çatıb, qapı (perspektivlə) içəri açılır, arxada sinfin isti işığı
 * və lövhəsi görünür. Sonrakı ekran (sinif) eyni işıqla başlayır, ona görə keçid kəsilmir.
 */
import { Animated, StyleSheet, View } from 'react-native'
import { Text } from '../components/Text'
import { colors, radius, scene as c, space, type } from '../theme'

export function DoorFront({ number, title, open, wide }: { number: string; title: string; open: Animated.Value; wide?: boolean }) {
  const rot = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-86deg'] })
  const rotR = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '86deg'] })
  const zoom = open.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1.04, 1.9] })
  const light = open.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0, 0, 1] })
  const leaf = (r: Animated.AnimatedInterpolation<string>, hinge: 'left' | 'right', w: number) => ({
    transform: [{ perspective: 900 }, { translateX: hinge === 'left' ? -w / 2 : w / 2 }, { rotateY: r }, { translateX: hinge === 'left' ? w / 2 : -w / 2 }],
  })
  return (
    <View style={st.wall}>
      <Animated.View style={[st.center, { transform: [{ scale: zoom }] }]}>
        <View style={[st.frame, wide && st.frameWide]}>
          {/* İçəri: sinfin divarı və yazı lövhəsi */}
          <View style={st.inside}>
            <View style={st.boardHint} />
            <View style={st.floorHint} />
          </View>
          {wide ? (
            <View style={StyleSheet.absoluteFill}>
              <View style={st.pair}>
                <Animated.View style={[st.leaf, leaf(rot, 'left', 138)]}><View style={[st.knob, { right: 10 }]} /></Animated.View>
                <Animated.View style={[st.leaf, leaf(rotR, 'right', 138)]}><View style={[st.knob, { left: 10 }]} /></Animated.View>
              </View>
            </View>
          ) : (
            <Animated.View style={[st.leaf, StyleSheet.absoluteFill, leaf(rot, 'left', 216)]}>
              <View style={st.panelTop} />
              <View style={st.panelBottom} />
              <View style={st.plate}>
                {number ? <Text style={st.no}>{number}</Text> : null}
                <Text style={st.name} numberOfLines={2}>{title}</Text>
              </View>
              <View style={[st.knob, { right: 18 }]} />
            </Animated.View>
          )}
        </View>
        {wide ? <View style={st.wideSign}><Text style={st.name}>{title}</Text></View> : null}
      </Animated.View>
      <View style={st.wainscot} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.roomWall, opacity: light }]} />
    </View>
  )
}

const st = StyleSheet.create({
  wall: { flex: 1, backgroundColor: c.plasterLit, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  center: { alignItems: 'center', gap: space.md, zIndex: 1 },
  frame: {
    width: 240, height: 440, maxHeight: '86%', borderWidth: 12, borderColor: c.doorFrame, borderBottomWidth: 0,
    borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: 'visible', backgroundColor: c.roomWall,
    boxShadow: '0px 24px 60px rgba(0,0,0,0.45)',
  },
  frameWide: { width: 300, height: 400 },
  inside: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.roomWall, alignItems: 'center', overflow: 'hidden' },
  boardHint: { marginTop: '22%', width: '78%', height: '26%', backgroundColor: c.board, borderWidth: 4, borderColor: c.boardRim, borderRadius: 2 },
  floorHint: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '24%', backgroundColor: c.roomFloor },
  pair: { flex: 1, flexDirection: 'row' },
  leaf: { flex: 1, backgroundColor: c.doorLeaf, borderWidth: 1, borderColor: c.doorFrame, alignItems: 'center', backfaceVisibility: 'hidden' },
  panelTop: { position: 'absolute', top: 18, left: 18, right: 18, height: '44%', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.28)', borderRadius: 3 },
  panelBottom: { position: 'absolute', bottom: 18, left: 18, right: 18, height: '36%', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.28)', borderRadius: 3 },
  plate: {
    marginTop: 46, minWidth: 120, maxWidth: 190, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm,
    alignItems: 'center', gap: 2, backgroundColor: c.sign, borderWidth: 1, borderColor: colors.goldLine,
  },
  no: { color: colors.gold, fontFamily: type.displayBold, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'] },
  name: { color: c.signText, fontFamily: type.semibold, fontSize: 15, textAlign: 'center' },
  knob: { position: 'absolute', top: '52%', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold, boxShadow: '0px 0px 10px rgba(233,178,60,0.5)' },
  wideSign: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: c.sign, borderWidth: 1, borderColor: colors.goldLine },
  wainscot: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '22%', backgroundColor: c.wainscot, borderTopWidth: 4, borderTopColor: c.rail },
})
