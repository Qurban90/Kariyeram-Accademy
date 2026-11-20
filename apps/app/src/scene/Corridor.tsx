/**
 * Dəhliz (2.5D): isti lampalar, ceviz panellər, hər sinfin qapısı və divardan çıxan nömrə lövhəsi,
 * dəhlizin sonunda oxu zalının ikiqat qapısı. Aşağıda qapıların siyahısı (barmaqla rahat seçim).
 * Fənn seçiləndə kamera özü o qapıya yeriyir, qapı açılır və sinfə keçilir: tələbə yalnız bir dəfə toxunur.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Circle, Defs, Ellipse, G, Line, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg'
import { Icon } from '../components/Icon'
import { Text } from '../components/Text'
import { t } from '../i18n/az'
import { colors, radius, scene as c, space, touch, type } from '../theme'
import { cameraPath, doorCamera, doorSlots, FOCAL, HALL, project, quad, type DoorSlot } from './plan'
import { DoorFront } from './DoorFront'
import { Layer, nativeDriver, SceneText, Stage, useToScreen } from './Stage'

export interface CorridorDoor { key: string; number: string; title: string; status?: string; live?: boolean }

const SHELL_Z = 14
const LAMPS = [1.8, 4.4, 7.0, 9.6, 12.2]
const WALK = 2300
const OPEN = 950

function Shell() {
  const { halfW: W, height: H, end: E } = HALL
  const near = 0.35
  const floorLines = useMemo(() => {
    const out: [number, number, number, number][] = []
    for (let x = -W + 0.5; x < W; x += 0.5) { const a = project(x, 0, near), b = project(x, 0, E); out.push([a.x, a.y, b.x, b.y]) }
    for (let z = 1; z < E; z += 1) { const a = project(-W, 0, z), b = project(W, 0, z); out.push([a.x, a.y, b.x, b.y]) }
    return out
  }, [])
  return (
    <G>
      <Defs>
        <LinearGradient id="co-wallL" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c.plasterLit} />
          <Stop offset="1" stopColor={c.plaster} />
        </LinearGradient>
        <LinearGradient id="co-wallR" x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor={c.plasterLit} />
          <Stop offset="1" stopColor={c.plaster} />
        </LinearGradient>
        <LinearGradient id="co-floor" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={c.floor} />
          <Stop offset="1" stopColor={c.plasterDark} />
        </LinearGradient>
        <RadialGradient id="co-pool" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.lamp} stopOpacity="0.32" />
          <Stop offset="1" stopColor={c.lamp} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="co-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.lamp} stopOpacity="0.45" />
          <Stop offset="1" stopColor={c.lamp} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Polygon points={quad([[-W, H, near], [W, H, near], [W, H, E], [-W, H, E]])} fill={c.ceiling} />
      <Polygon points={quad([[-W, 0, near], [W, 0, near], [W, 0, E], [-W, 0, E]])} fill="url(#co-floor)" />
      {floorLines.map(([x1, y1, x2, y2], i) => <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.floorLine} strokeWidth={1} />)}
      <Polygon points={quad([[-W, 0, near], [-W, H, near], [-W, H, E], [-W, 0, E]])} fill="url(#co-wallL)" />
      <Polygon points={quad([[W, 0, near], [W, H, near], [W, H, E], [W, 0, E]])} fill="url(#co-wallR)" />
      {/* Ceviz panel (aşağı divar) və tutacaq */}
      {[-1, 1].map((sd) => (
        <G key={sd}>
          <Polygon points={quad([[sd * W, 0, near], [sd * W, 1.0, near], [sd * W, 1.0, E], [sd * W, 0, E]])} fill={c.wainscot} />
          <Polygon points={quad([[sd * W, 1.0, near], [sd * W, 1.07, near], [sd * W, 1.07, E], [sd * W, 1.0, E]])} fill={c.rail} />
        </G>
      ))}
      {LAMPS.map((z) => {
        const f = project(0, 0, z)
        const rx = (FOCAL * 1.5) / z
        const ry = Math.max(4, project(0, 0, z - 1).y - project(0, 0, z + 1).y) / 2
        const h = project(0, H, z)
        return (
          <G key={z}>
            <Ellipse cx={f.x} cy={f.y} rx={rx} ry={ry} fill="url(#co-pool)" />
            <Ellipse cx={h.x} cy={h.y + 4} rx={(FOCAL * 0.9) / z} ry={(FOCAL * 0.3) / z} fill="url(#co-halo)" />
            <Polygon points={quad([[-0.32, H - 0.01, z - 0.22], [0.32, H - 0.01, z - 0.22], [0.32, H - 0.01, z + 0.22], [-0.32, H - 0.01, z + 0.22]])} fill={c.lamp} />
          </G>
        )
      })}
    </G>
  )
}

function EndWall({ live }: { live: boolean }) {
  const { halfW: W, height: H, end: E } = HALL
  const d0 = project(-0.95, 2.45, E), d1 = project(0.95, 0, E)
  const sign = project(0, 2.85, E - 0.02)
  return (
    <G>
      <Polygon points={quad([[-W, 0, E], [-W, H, E], [W, H, E], [W, 0, E]])} fill={c.plasterLit} />
      <Polygon points={quad([[-W, 0, E], [-W, 1.0, E], [W, 1.0, E], [W, 0, E]])} fill={c.wainscot} />
      <Rect x={d0.x - 3} y={d0.y - 3} width={d1.x - d0.x + 6} height={d1.y - d0.y + 3} fill={c.doorFrame} />
      <Rect x={d0.x} y={d0.y} width={(d1.x - d0.x) / 2 - 0.5} height={d1.y - d0.y} fill={c.doorLeaf} />
      <Rect x={(d0.x + d1.x) / 2 + 0.5} y={d0.y} width={(d1.x - d0.x) / 2 - 0.5} height={d1.y - d0.y} fill={c.doorLeaf} />
      <Rect x={d0.x} y={d1.y - 1.5} width={d1.x - d0.x} height={1.5} fill={live ? c.live : c.lamp} opacity={0.9} />
      <Rect x={sign.x - 26} y={sign.y - 6} width={52} height={12} rx={1.5} fill={c.sign} />
      {live ? <Circle cx={sign.x + 21} cy={sign.y} r={1.8} fill={c.live} /> : null}
    </G>
  )
}

/** Divardakı qapı və ona perpendikulyar nömrə lövhəsi (lövhə kameraya baxır). */
function SideDoor({ slot, lit, live }: { slot: DoorSlot; lit: boolean; live: boolean }) {
  const x = slot.side * HALL.halfW
  const z0 = slot.z, z1 = slot.z + HALL.doorW, h = HALL.doorH
  const fr = 0.07
  const sx = slot.side * (HALL.halfW - 0.62)
  return (
    <G>
      <Polygon points={quad([[x, 0, z0 - fr], [x, h + fr, z0 - fr], [x, h + fr, z1 + fr], [x, 0, z1 + fr]])} fill={c.doorFrame} />
      <Polygon points={quad([[x, 0, z0], [x, h, z0], [x, h, z1], [x, 0, z1]])} fill={c.doorLeaf} />
      <Polygon points={quad([[x, 0.25, z0 + 0.12], [x, 1.0, z0 + 0.12], [x, 1.0, z1 - 0.12], [x, 0.25, z1 - 0.12]])} fill="none" stroke={c.doorFrame} strokeWidth={1} />
      <Polygon points={quad([[x, 1.15, z0 + 0.12], [x, h - 0.15, z0 + 0.12], [x, h - 0.15, z1 - 0.12], [x, 1.15, z1 - 0.12]])} fill="none" stroke={c.doorFrame} strokeWidth={1} />
      {lit ? <Polygon points={quad([[x - slot.side * 0.01, 0, z0], [x - slot.side * 0.01, 0.025, z0], [x - slot.side * 0.01, 0.025, z1], [x - slot.side * 0.01, 0, z1]])} fill={live ? c.live : c.lamp} /> : null}
      {/* Lövhənin qolu və özü */}
      <Polygon points={quad([[x, 2.78, z0 + 0.05], [sx, 2.78, z0 + 0.05], [sx, 2.8, z0 + 0.05], [x, 2.8, z0 + 0.05]])} fill={c.rail} />
      <Polygon points={quad([[x - slot.side * 0.04, 2.35, z0 + 0.04], [sx, 2.35, z0 + 0.04], [sx, 2.78, z0 + 0.04], [x - slot.side * 0.04, 2.78, z0 + 0.04]])} fill={c.sign} />
    </G>
  )
}

function SignText({ slot, number, title }: { slot: DoorSlot; number: string; title: string }) {
  const x = slot.side * HALL.halfW
  const sx = slot.side * (HALL.halfW - 0.62)
  const z = slot.z + 0.04
  const a = project(x, 2.78, z), b = project(sx, 2.35, z)
  const cx = (a.x + b.x) / 2, w = Math.abs(b.x - a.x)
  const hgt = b.y - a.y
  return (
    <>
      <SceneText x={cx} y={a.y + hgt * 0.34} size={hgt * 0.42} width={w} style={st.signNo}>{number}</SceneText>
      <SceneText x={cx} y={a.y + hgt * 0.74} size={hgt * 0.2} width={w * 0.94} style={st.signName}>{title}</SceneText>
    </>
  )
}

/** Səhnədəki qapıya toxunmaq (siyahıdan əlavə). Ekran oxuyucusu siyahını işlədir. */
function DoorHit({ slot, onPress }: { slot: DoorSlot | 'end'; onPress: () => void }) {
  const m = useToScreen()
  let a, b
  if (slot === 'end') { a = project(-0.95, 2.9, HALL.end); b = project(0.95, 0, HALL.end) }
  else {
    const x = slot.side * HALL.halfW
    const pts = [project(x, HALL.doorH, slot.z), project(x, 0, slot.z + HALL.doorW), project(x, 0, slot.z), project(slot.side * (HALL.halfW - 0.62), 2.8, slot.z)]
    a = { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) }
    b = { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) }
  }
  return (
    <Pressable onPress={onPress} accessible={false} importantForAccessibility="no"
      style={{ position: 'absolute', left: m.x(a.x), top: m.y(a.y), width: Math.max(touch, (b.x - a.x) * m.s), height: Math.max(touch, (b.y - a.y) * m.s) }} />
  )
}

export function Corridor({ doors, hallLive, hallTitle, arrive, top, resume, onEnter }: {
  doors: CorridorDoor[]
  hallLive: number
  hallTitle: string
  /** Girişdən yenicə gəlib: kamera bir addım irəli gəlir. */
  arrive?: boolean
  /** Üst zolaq (brend, menyu). */
  top: ReactNode
  /** Yarımçıq test varsa siyahının üstündə düymə. */
  resume?: ReactNode
  onEnter: (key: string) => void
}) {
  const ins = useSafeAreaInsets()
  const { height: winH, width: winW } = useWindowDimensions()
  // Enli ekranda siyahı solda üzən panel olur, səhnə bütün ekranı tutur.
  const wide = winW >= 760
  const slots = useMemo(() => doorSlots(doors.length), [doors.length])
  const [target, setTarget] = useState<{ key: string; slot: DoorSlot | 'end'; number: string; title: string } | null>(null)
  const walk = useRef(new Animated.Value(0)).current
  const open = useRef(new Animated.Value(0)).current
  const front = useRef(new Animated.Value(0)).current
  const intro = useRef(new Animated.Value(arrive ? 0 : 1)).current
  const ui = useRef(new Animated.Value(1)).current
  // Səhnə siyahının üstündəki hissəni tutur (dəhlizin özü görünsün, siyahının arxasında qalmasın).
  const [panelH, setPanelH] = useState(0)

  useEffect(() => {
    if (!arrive) return
    Animated.timing(intro, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start()
  }, [])

  const path = useMemo(() => cameraPath(target ? doorCamera(target.slot) : { dz: 0, cx: 0, sit: false }, 1), [target])

  const go = (key: string, slot: DoorSlot | 'end', number: string, title: string) => {
    if (target) return
    setTarget({ key, slot, number, title })
    Animated.sequence([
      Animated.parallel([
        Animated.timing(ui, { toValue: 0, duration: 260, useNativeDriver: nativeDriver }),
        Animated.timing(walk, { toValue: 1, duration: WALK, easing: Easing.linear, useNativeDriver: nativeDriver }),
        Animated.sequence([
          Animated.delay(WALK - 420),
          Animated.timing(front, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
        ]),
      ]),
      Animated.timing(open, { toValue: 1, duration: OPEN, easing: Easing.inOut(Easing.cubic), useNativeDriver: nativeDriver }),
    ]).start(({ finished }) => { if (finished) onEnter(key) })
  }

  const arriveScale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] })
  const arriveFade = intro.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0.4, 0] })
  const uiY = ui.interpolate({ inputRange: [0, 1], outputRange: [60, 0] })
  // Siyahı açıq olanda səhnə yalnız siyahının üstündəki hissəni tutur; yeriyəndə siyahı gedir və səhnə yuxarıdan
  // böyüyərək bütün ekranı örtür (irəli addım kimi görünür, ölçü dəyişmədiyi üçün yenidən çəkilmir).
  const stageH = wide ? winH : Math.max(200, winH - Math.max(0, panelH - radius.xl))
  const k = winH / stageH
  const grow = {
    k: ui.interpolate({ inputRange: [0, 1], outputRange: [k, 1] }),
    y: ui.interpolate({ inputRange: [0, 1], outputRange: [((k - 1) * stageH) / 2, 0] }),
  }
  const prog = target ? walk : undefined

  return (
    <View style={st.wrap} testID="scene-corridor">
      <Animated.View style={[st.stage, { height: stageH, transform: [{ translateY: grow.y }, { scale: grow.k }, { scale: arriveScale }] }]}>
        <Stage bg={c.plasterDark}>
          <Layer progress={prog} path={path} zl={SHELL_Z}><Shell /></Layer>
          <Layer progress={prog} path={path} zl={HALL.end} pointerEvents="box-none"
            overlay={<>
              <SceneText x={400} y={project(0, 2.85, HALL.end).y} size={7} width={52} style={st.signName}>{hallTitle}</SceneText>
              {!target ? <DoorHit slot="end" onPress={() => go('hall', 'end', '', hallTitle)} /> : null}
            </>}>
            <EndWall live={hallLive > 0} />
          </Layer>
          {doors.map((d, i) => ({ d, slot: slots[i]! })).reverse().map(({ d, slot }) => (
            <Layer key={d.key} progress={prog} path={path} zl={slot.z + HALL.doorW / 2} pointerEvents="box-none"
              overlay={<>
                <SignText slot={slot} number={d.number} title={d.title} />
                {!target ? <DoorHit slot={slot} onPress={() => go(d.key, slot, d.number, d.title)} /> : null}
              </>}>
              <SideDoor slot={slot} lit={!!d.status} live={!!d.live} />
            </Layer>
          ))}
        </Stage>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.warmCore, opacity: arriveFade }]} />

      {target ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: front }]}>
          <DoorFront number={target.number} title={target.title} open={open} wide={target.slot === 'end'} />
        </Animated.View>
      ) : null}

      <Animated.View pointerEvents={target ? 'none' : 'box-none'} style={[st.top, { paddingTop: ins.top + space.sm, opacity: ui }]}>{top}</Animated.View>

      <Animated.View onLayout={(e) => setPanelH(e.nativeEvent.layout.height)} pointerEvents={target ? 'none' : 'auto'} style={[st.panel, wide && st.panelWide, { paddingBottom: (wide ? 0 : ins.bottom) + space.md, opacity: ui, transform: [{ translateY: uiY }] }]}>
        {resume}
        <Text style={st.ask} accessibilityRole="header">{t.scene.ask}</Text>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={st.list} showsVerticalScrollIndicator={false}>
          {doors.map((d, i) => (
            <DoorRow key={d.key} testID={`room-door-${d.key}`} number={d.number} title={d.title} status={d.status} live={d.live}
              onPress={() => go(d.key, slots[i]!, d.number, d.title)} />
          ))}
          <DoorRow testID="room-door-hall" number="" icon="users" title={hallTitle} status={hallLive ? t.scene.liveNow(hallLive) : t.scene.hallSub} live={hallLive > 0}
            onPress={() => go('hall', 'end', '', hallTitle)} />
        </ScrollView>
      </Animated.View>
    </View>
  )
}

function DoorRow({ number, title, status, live, onPress, testID, icon }: {
  number: string; title: string; status?: string; live?: boolean; onPress: () => void; testID: string; icon?: 'users'
}) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${number ? `${number}. ` : ''}${title}${status ? `, ${status}` : ''}`}
      style={({ pressed }) => [st.row, pressed && st.rowPressed]}>
      <View style={st.plate}>
        {icon ? <Icon name={icon} size={18} color={colors.gold} /> : <Text style={st.plateNo}>{number}</Text>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.rowTitle} numberOfLines={1}>{title}</Text>
        {status ? (
          <View style={st.statusRow}>
            {live ? <View style={st.liveDot} /> : null}
            <Text style={[st.rowSub, live && { color: colors.live }]} numberOfLines={1}>{status}</Text>
          </View>
        ) : null}
      </View>
      <Icon name="chevron" size={18} color={colors.ivoryFaint} />
    </Pressable>
  )
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.nightDeep },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: space.lg },
  stage: { position: 'absolute', left: 0, right: 0, top: 0 },
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '58%', alignSelf: 'center', width: '100%', maxWidth: 560,
    paddingTop: space.lg, paddingHorizontal: space.lg, gap: space.md,
    backgroundColor: colors.night, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.line,
    boxShadow: '0px -18px 40px rgba(0,0,0,0.45)',
  },
  panelWide: { left: space.xl, right: undefined, bottom: space.xl, width: 380, maxHeight: '72%', borderRadius: radius.xl, borderBottomWidth: 1 },
  ask: { color: colors.ivory, fontFamily: type.display, fontSize: 22, lineHeight: 28 },
  list: { gap: space.sm, paddingBottom: space.xs },
  row: {
    minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm,
    borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  rowPressed: { backgroundColor: colors.surfaceHi, borderColor: colors.goldLine },
  plate: {
    width: 52, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.nightDeep, borderWidth: 1, borderColor: colors.goldLine,
  },
  plateNo: { color: colors.gold, fontFamily: type.display, fontSize: 18, fontVariant: ['tabular-nums'] },
  rowTitle: { color: colors.ivory, fontFamily: type.semibold, fontSize: 16 },
  rowSub: { color: colors.ivoryDim, fontSize: 13 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live },
  signNo: { color: c.signText, fontFamily: type.displayBold },
  signName: { color: c.signText, fontFamily: type.medium, opacity: 0.85 },
})
