/**
 * Kursun binası (çöldən), avtomatik giriş: kamera yuxarıdan enərək binaya yaxınlaşır, adın yazıldığı
 * fasad, işıqlı pəncərələr, fənərlər; giriş qapısı açılır və içəridən isti işıq çıxır. Sonra dəhliz.
 * Tələbə heç nə etmir; "Keç" ilə dərhal dəhlizə keçə bilər.
 */
import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg'
import { Wordmark } from '../components/Brand'
import { Text } from '../components/Text'
import { t } from '../i18n/az'
import { colors, scene as c, space, type } from '../theme'
import { ease, easeOut, project, quad, type Cam } from './plan'
import { Layer, nativeDriver, SceneText, Stage, useToScreen } from './Stage'

const FACADE_Z = 12
const DOOR = { x0: -0.85, x1: 0.85, y1: 2.6 }
/** Dolly müddəti və qapının açılması (ms). */
const DOLLY = 6200
const OPEN = 1100

const path = (p: number): Cam => {
  const a = ease(p)
  return { dz: 8.2 * a, cx: -0.9 * (1 - a), drop: -2.4 * (1 - easeOut(p)) }
}

const STARS = Array.from({ length: 34 }, (_, i) => {
  const x = (i * 197) % 800
  const y = 40 + ((i * 89) % 230)
  return { x, y, r: i % 5 === 0 ? 1.6 : 0.9, o: 0.35 + ((i * 37) % 50) / 100 }
})

/** Fasad pəncərələri: [X, Y alt, en, hündürlük, işıqlı?]. */
function windows(): [number, number, number, number, number][] {
  const out: [number, number, number, number, number][] = []
  const cols = [-5, -3.4, -1.8, 1.8, 3.4, 5]
  for (const [r, y] of [3.6, 6.1].entries()) {
    cols.forEach((x, i) => out.push([x, y, 0.95, 1.55, (i + r * 2) % 5 === 3 ? 0 : (i + r) % 4 === 1 ? 0.5 : 1]))
  }
  // Birinci mərtəbə: qapının iki yanı
  for (const x of [-5, -3.4, -1.9, 1.9, 3.4, 5]) out.push([x, 0.9, 0.95, 1.6, x === -1.9 || x === 1.9 ? 1 : 0.5])
  return out
}

function Building() {
  const P = (X: number, Y: number) => project(X, Y, FACADE_Z)
  const wins = useMemo(windows, [])
  const base = P(0, 0).y
  return (
    <G>
      <Defs>
        <LinearGradient id="ex-facade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.stone} />
          <Stop offset="0.75" stopColor={c.stoneLit} />
          <Stop offset="1" stopColor={c.stoneLit} />
        </LinearGradient>
        <RadialGradient id="ex-doorglow" cx="50%" cy="90%" r="60%">
          <Stop offset="0" stopColor={c.warm} stopOpacity="0.55" />
          <Stop offset="1" stopColor={c.warm} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="ex-ground" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.path} />
          <Stop offset="1" stopColor={c.ground} />
        </LinearGradient>
        <RadialGradient id="ex-win" cx="50%" cy="80%" r="80%">
          <Stop offset="0" stopColor={c.warmCore} />
          <Stop offset="1" stopColor={c.glass} />
        </RadialGradient>
      </Defs>
      {/* Yer: meydança, binanın təməlindən ekranın altına */}
      <Rect x={-400} y={base} width={1600} height={1200} fill="url(#ex-ground)" />
      {/* Yan qanadlar (aşağı, tünd) */}
      <Polygon points={quad([[-14, 0, FACADE_Z + 1], [-14, 6.8, FACADE_Z + 1], [-6.2, 6.8, FACADE_Z + 1], [-6.2, 0, FACADE_Z + 1]])} fill={c.stoneDark} />
      <Polygon points={quad([[6.2, 0, FACADE_Z + 1], [6.2, 6.8, FACADE_Z + 1], [14, 6.8, FACADE_Z + 1], [14, 0, FACADE_Z + 1]])} fill={c.stoneDark} />
      {[-12, -10, -8, 8, 10, 12].map((x, i) => {
        const a = project(x - 0.45, 4.2, FACADE_Z + 1), b = project(x + 0.45, 5.6, FACADE_Z + 1)
        return <Rect key={`w${x}`} x={a.x} y={b.y} width={b.x - a.x} height={a.y - b.y} fill={i % 3 === 1 ? c.glassDim : c.glassOff} />
      })}
      {/* Əsas fasad */}
      <Polygon points={quad([[-6.4, 0, FACADE_Z], [-6.4, 8.4, FACADE_Z], [6.4, 8.4, FACADE_Z], [6.4, 0, FACADE_Z]])} fill="url(#ex-facade)" />
      {/* Karniz və üçbucaq frontoq */}
      <Polygon points={quad([[-6.8, 8.4, FACADE_Z], [-6.8, 8.9, FACADE_Z], [6.8, 8.9, FACADE_Z], [6.8, 8.4, FACADE_Z]])} fill={c.cornice} />
      <Polygon points={quad([[-3.2, 8.9, FACADE_Z], [0, 10.6, FACADE_Z], [3.2, 8.9, FACADE_Z]])} fill={c.cornice} />
      {/* Ad lövhəsi (yazı üst qatdadır) */}
      <Polygon points={quad([[-3.4, 7.25, FACADE_Z], [-3.4, 8.1, FACADE_Z], [3.4, 8.1, FACADE_Z], [3.4, 7.25, FACADE_Z]])} fill={c.sign} />
      {/* Pəncərələr */}
      {wins.map(([X, Y, w, h, lit], i) => {
        const a = P(X - w / 2, Y), b = P(X + w / 2, Y + h)
        return (
          <G key={i}>
            <Rect x={a.x - 1.5} y={b.y - 1.5} width={b.x - a.x + 3} height={a.y - b.y + 3} fill={c.cornice} />
            <Rect x={a.x} y={b.y} width={b.x - a.x} height={a.y - b.y} fill={lit === 1 ? 'url(#ex-win)' : lit ? c.glassDim : c.glassOff} />
            <Rect x={(a.x + b.x) / 2 - 0.6} y={b.y} width={1.2} height={a.y - b.y} fill={c.cornice} opacity={0.9} />
          </G>
        )
      })}
      {/* Giriş: sütunlar, portal, içəridən gələn işıq (qapı tayları üst qatdadır) */}
      {[-1.6, 1.6].map((x) => <Polygon key={x} points={quad([[x - 0.22, 0, FACADE_Z - 0.3], [x - 0.22, 3.4, FACADE_Z - 0.3], [x + 0.22, 3.4, FACADE_Z - 0.3], [x + 0.22, 0, FACADE_Z - 0.3]])} fill={c.column} />)}
      <Polygon points={quad([[-1.9, 3.4, FACADE_Z - 0.3], [-1.9, 3.75, FACADE_Z - 0.3], [1.9, 3.75, FACADE_Z - 0.3], [1.9, 3.4, FACADE_Z - 0.3]])} fill={c.cornice} />
      <Polygon points={quad([[DOOR.x0 - 0.12, 0, FACADE_Z], [DOOR.x0 - 0.12, DOOR.y1 + 0.12, FACADE_Z], [DOOR.x1 + 0.12, DOOR.y1 + 0.12, FACADE_Z], [DOOR.x1 + 0.12, 0, FACADE_Z]])} fill={c.doorFrame} />
      <Polygon points={quad([[DOOR.x0, 0, FACADE_Z], [DOOR.x0, DOOR.y1, FACADE_Z], [DOOR.x1, DOOR.y1, FACADE_Z], [DOOR.x1, 0, FACADE_Z]])} fill={c.warmCore} />
      {/* Fasaddakı fənərlər */}
      {[-1.25, 1.25].map((x) => {
        const p = P(x, 2.9)
        return (
          <G key={`l${x}`}>
            <Circle cx={p.x} cy={p.y} r={26} fill="url(#ex-doorglow)" />
            <Circle cx={p.x} cy={p.y} r={2.2} fill={c.warmCore} />
          </G>
        )
      })}
      {/* Pilləkən */}
      {[0, 1, 2].map((i) => (
        <Polygon key={`s${i}`} points={quad([[-2.4 + i * 0.25, 0, FACADE_Z - 0.6 - i * 0.45], [-2.4 + i * 0.25, -0.01, FACADE_Z - 1.05 - i * 0.45], [2.4 - i * 0.25, -0.01, FACADE_Z - 1.05 - i * 0.45], [2.4 - i * 0.25, 0, FACADE_Z - 0.6 - i * 0.45]])}
          fill={i % 2 ? c.stoneLit : c.cornice} />
      ))}
      {/* Qapıdan meydançaya düşən işıq və yol */}
      <Polygon points={quad([[-1.2, 0, FACADE_Z - 2.4], [1.2, 0, FACADE_Z - 2.4], [2.6, 0, 1], [-2.6, 0, 1]])} fill={c.path} />
      <Ellipse cx={P(0, 0).x} cy={P(0, 0).y + 14} rx={70} ry={16} fill="url(#ex-doorglow)" />
    </G>
  )
}

function Sky() {
  return (
    <>
      <Defs>
        <LinearGradient id="ex-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.skyTop} />
          <Stop offset="0.45" stopColor={c.skyMid} />
          <Stop offset="0.62" stopColor={c.skyLow} />
          <Stop offset="1" stopColor={c.skyLow} />
        </LinearGradient>
        <RadialGradient id="ex-moon" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.moon} stopOpacity="0.22" />
          <Stop offset="1" stopColor={c.moon} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={-400} y={-400} width={1600} height={1600} fill="url(#ex-sky)" />
      {STARS.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={c.star} opacity={s.o} />)}
      {/* Aypara: loqodakı kimi */}
      <Circle cx={548} cy={150} r={70} fill="url(#ex-moon)" />
      <Path d="M548 120a30 30 0 100 60a26 26 0 110-60z" fill={c.moon} opacity={0.92} />
    </>
  )
}

/** Ön plan: fənər dirəkləri və ağac kölgələri (kamera yanından keçir). */
function Foreground() {
  const posts = [-2.3, 2.3].map((x) => ({ x, top: project(x, 3.0, 4.4), bottom: project(x, 0, 4.4) }))
  return (
    <G>
      <Defs>
        <RadialGradient id="ex-lamp" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.warm} stopOpacity="0.5" />
          <Stop offset="1" stopColor={c.warm} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {posts.map((p) => (
        <G key={p.x}>
          <Ellipse cx={p.bottom.x} cy={p.bottom.y + 6} rx={90} ry={18} fill="url(#ex-lamp)" opacity={0.6} />
          <Rect x={p.top.x - 3.5} y={p.top.y} width={7} height={p.bottom.y - p.top.y} fill={c.post} />
          <Circle cx={p.top.x} cy={p.top.y - 8} r={48} fill="url(#ex-lamp)" />
          <Rect x={p.top.x - 9} y={p.top.y - 18} width={18} height={20} rx={3} fill={c.warmCore} />
        </G>
      ))}
      {[-1, 1].map((sd) => {
        const b = project(sd * 4.6, 0, 6)
        return (
          <G key={sd}>
            <Rect x={b.x - 5} y={b.y - 120} width={10} height={120} fill={c.leaf} />
            <Ellipse cx={b.x} cy={b.y - 170} rx={78} ry={96} fill={c.leaf} />
            <Ellipse cx={b.x - sd * 40} cy={b.y - 120} rx={60} ry={64} fill={c.leaf} />
          </G>
        )
      })}
    </G>
  )
}

/** Qapı tayları (RN görünüşləri: perspektivlə açılır). Fasad qatının içindədir, onunla birlikdə böyüyür. */
function Leaves({ open }: { open: Animated.Value }) {
  const m = useToScreen()
  const a = project(DOOR.x0, DOOR.y1, FACADE_Z), b = project(DOOR.x1, 0, FACADE_Z)
  const left = m.x(a.x), top = m.y(a.y), w = m.x(b.x) - left, h = m.y(b.y) - top
  const half = w / 2
  const rotL = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-82deg'] })
  const rotR = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '82deg'] })
  const leaf = [st.leaf, { width: half, height: h }]
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width: w, height: h, flexDirection: 'row' }}>
      <Animated.View style={[leaf, { transform: [{ perspective: 400 }, { translateX: -half / 2 }, { rotateY: rotL }, { translateX: half / 2 }] }]}>
        <View style={[st.knob, { right: 2 }]} />
      </Animated.View>
      <Animated.View style={[leaf, { transform: [{ perspective: 400 }, { translateX: half / 2 }, { rotateY: rotR }, { translateX: -half / 2 }] }]}>
        <View style={[st.knob, { left: 2 }]} />
      </Animated.View>
    </View>
  )
}

export function Exterior({ onDone }: { onDone: () => void }) {
  const p = useRef(new Animated.Value(0)).current
  const open = useRef(new Animated.Value(0)).current
  const title = useRef(new Animated.Value(0)).current
  const flash = useRef(new Animated.Value(0)).current
  const fadeIn = useRef(new Animated.Value(1)).current
  const done = useRef(false)

  useEffect(() => {
    const finish = () => { if (!done.current) { done.current = true; onDone() } }
    const anim = Animated.parallel([
      Animated.timing(fadeIn, { toValue: 0, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
      Animated.timing(p, { toValue: 1, duration: DOLLY, easing: Easing.linear, useNativeDriver: nativeDriver }),
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(title, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
        Animated.delay(2100),
        Animated.timing(title, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver }),
      ]),
      Animated.sequence([
        Animated.delay(DOLLY - 900),
        Animated.timing(open, { toValue: 1, duration: OPEN, easing: Easing.inOut(Easing.cubic), useNativeDriver: nativeDriver }),
      ]),
      Animated.sequence([
        Animated.delay(DOLLY + OPEN - 1100),
        Animated.timing(flash, { toValue: 1, duration: 650, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver }),
      ]),
    ])
    anim.start(({ finished }) => { if (finished) finish() })
    return () => anim.stop()
  }, [])

  const titleY = title.interpolate({ inputRange: [0, 1], outputRange: [10, 0] })

  return (
    <Stage bg={c.skyTop} testID="scene-exterior">
      <Layer><Sky /></Layer>
      <Layer progress={p} path={path} zl={FACADE_Z}
        overlay={<>
          <SceneText x={400} y={project(0, 7.68, FACADE_Z).y} size={17} width={220} style={st.sign}>{t.brand}</SceneText>
          <Leaves open={open} />
        </>}>
        <Building />
      </Layer>
      <Layer progress={p} path={path} zl={4.4} opacity={p.interpolate({ inputRange: [0, 0.55, 0.75], outputRange: [1, 1, 0] })}>
        <Foreground />
      </Layer>

      {/* Titr: oyun girişi kimi ad və bir cümlə */}
      <Animated.View pointerEvents="none" style={[st.title, { opacity: title, transform: [{ translateY: titleY }] }]}>
        <Wordmark size={40} align="center" />
        <Text style={st.tagline}>{t.scene.tagline}</Text>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.nightDeep, opacity: fadeIn }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.warmCore, opacity: flash }]} />
    </Stage>
  )
}

const st = StyleSheet.create({
  sign: { color: c.signText, fontFamily: type.displayBold, letterSpacing: 0.4 },
  leaf: { backgroundColor: c.doorLeaf, borderWidth: 1, borderColor: c.doorFrame },
  knob: { position: 'absolute', top: '52%', width: 3, height: 3, borderRadius: 2, backgroundColor: colors.gold },
  title: { position: 'absolute', left: space.lg, right: space.lg, bottom: '9%', alignItems: 'center', gap: space.sm },
  tagline: { color: colors.ivoryDim, fontFamily: type.displayItalic, fontSize: 17, textAlign: 'center', maxWidth: 320 },
})
