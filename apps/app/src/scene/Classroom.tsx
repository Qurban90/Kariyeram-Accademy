/**
 * Sinif (2.5D): lövhədə fənnin adı, müəllim lövhənin yanında, partalarda tələbələr (arxadan görünür).
 * Tələbə qapıdan girir, kamera özü onun adı yazılmış boş partaya yeriyir və oturur; sonra partanın üstü açılır.
 */
import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'
import { Circle, Defs, Ellipse, G, Line, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg'
import { scene as c, type } from '../theme'
import { cameraPath, classmates, FOCAL, mySeat, project, quad, ROOM, seatCamera, type Figure, type Seat } from './plan'
import { Layer, nativeDriver, SceneText, Stage } from './Stage'

const W = ROOM.halfW, H = ROOM.height, B = ROOM.board
const DESK = { hw: 0.62, d: 0.5, top: 0.76 }

function Shell() {
  const planks = useMemo(() => {
    const out: [number, number, number, number][] = []
    for (let x = -W + 0.35; x < W; x += 0.35) { const a = project(x, 0, 0.3), b = project(x, 0, B); out.push([a.x, a.y, b.x, b.y]) }
    return out
  }, [])
  const bd0 = project(-2.3, 2.35, B), bd1 = project(2.3, 0.95, B)
  const clock = project(0, 2.82, B)
  return (
    <G>
      <Defs>
        <LinearGradient id="cl-wall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.roomCeiling} />
          <Stop offset="1" stopColor={c.roomWall} />
        </LinearGradient>
        <LinearGradient id="cl-side" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c.roomWallShade} />
          <Stop offset="1" stopColor={c.roomWall} />
        </LinearGradient>
        <LinearGradient id="cl-sideR" x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor={c.roomWallShade} />
          <Stop offset="1" stopColor={c.roomWall} />
        </LinearGradient>
        <LinearGradient id="cl-floor" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={c.roomFloor} />
          <Stop offset="1" stopColor={c.roomFloorDark} />
        </LinearGradient>
        <RadialGradient id="cl-lamp" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.white} stopOpacity="0.55" />
          <Stop offset="1" stopColor={c.white} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Polygon points={quad([[-W, H, 0.3], [W, H, 0.3], [W, H, B], [-W, H, B]])} fill={c.roomCeiling} />
      <Polygon points={quad([[-W, 0, 0.3], [W, 0, 0.3], [W, 0, B], [-W, 0, B]])} fill="url(#cl-floor)" />
      {planks.map(([x1, y1, x2, y2], i) => <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,0,0,0.12)" strokeWidth={1} />)}
      <Polygon points={quad([[-W, 0, 0.3], [-W, H, 0.3], [-W, H, B], [-W, 0, B]])} fill="url(#cl-side)" />
      <Polygon points={quad([[W, 0, 0.3], [W, H, 0.3], [W, H, B], [W, 0, B]])} fill="url(#cl-sideR)" />
      {/* Sol divarda gecə pəncərələri */}
      {[2.2, 4.6, 7.0].map((z) => (
        <G key={z}>
          <Polygon points={quad([[-W, 1.05, z - 0.05], [-W, 2.65, z - 0.05], [-W, 2.65, z + 1.45], [-W, 1.05, z + 1.45]])} fill={c.chair} />
          <Polygon points={quad([[-W, 1.1, z], [-W, 2.6, z], [-W, 2.6, z + 1.4], [-W, 1.1, z + 1.4]])} fill={c.window} />
          <Polygon points={quad([[-W, 1.1, z + 0.68], [-W, 2.6, z + 0.68], [-W, 2.6, z + 0.72], [-W, 1.1, z + 0.72]])} fill={c.chair} />
        </G>
      ))}
      {/* Ön divar: yazı lövhəsi, saat */}
      <Polygon points={quad([[-W, 0, B], [-W, H, B], [W, H, B], [W, 0, B]])} fill="url(#cl-wall)" />
      <Rect x={bd0.x - 5} y={bd0.y - 5} width={bd1.x - bd0.x + 10} height={bd1.y - bd0.y + 10} rx={2} fill={c.boardRim} />
      <Rect x={bd0.x} y={bd0.y} width={bd1.x - bd0.x} height={bd1.y - bd0.y} fill={c.board} />
      <Rect x={bd0.x - 2} y={bd1.y + 3} width={bd1.x - bd0.x + 4} height={3} fill={c.boardRim} />
      <Circle cx={clock.x} cy={clock.y} r={9} fill={c.white} stroke={c.deskDark} strokeWidth={2} />
      <Line x1={clock.x} y1={clock.y} x2={clock.x} y2={clock.y - 6} stroke={c.ink} strokeWidth={1.4} />
      <Line x1={clock.x} y1={clock.y} x2={clock.x + 4} y2={clock.y + 2} stroke={c.ink} strokeWidth={1.4} />
      {/* Tavan lampaları */}
      {[2.5, 5.5, 8.5].map((z) => {
        const p = project(0, H - 0.02, z)
        return (
          <G key={`l${z}`}>
            <Ellipse cx={p.x} cy={p.y + 6} rx={(FOCAL * 1.4) / z} ry={(FOCAL * 0.35) / z} fill="url(#cl-lamp)" />
            <Polygon points={quad([[-1.1, H - 0.02, z - 0.12], [1.1, H - 0.02, z - 0.12], [1.1, H - 0.02, z + 0.12], [-1.1, H - 0.02, z + 0.12]])} fill={c.white} />
          </G>
        )
      })}
      {/* Müəllim masası */}
      <Polygon points={quad([[0.9, 0.78, B - 1.4], [2.9, 0.78, B - 1.4], [2.9, 0.78, B - 0.8], [0.9, 0.78, B - 0.8]])} fill={c.deskTop} />
      <Polygon points={quad([[0.9, 0, B - 1.4], [0.9, 0.78, B - 1.4], [2.9, 0.78, B - 1.4], [2.9, 0, B - 1.4]])} fill={c.desk} />
    </G>
  )
}

/** Müəllim: lövhənin yanında, sinfə baxır, bir əli lövhəyə doğru. */
function Teacher() {
  const z = B - 0.7, x = -2.75
  const P = (dx: number, y: number) => project(x + dx, y, z)
  const head = P(0, 1.62), r = (FOCAL * 0.12) / z
  return (
    <G>
      <Polygon points={[P(-0.13, 0), P(-0.04, 0), P(-0.03, 0.85), P(-0.14, 0.85)].map((p) => `${p.x},${p.y}`).join(' ')} fill={c.trousers} />
      <Polygon points={[P(0.04, 0), P(0.13, 0), P(0.14, 0.85), P(0.03, 0.85)].map((p) => `${p.x},${p.y}`).join(' ')} fill={c.trousers} />
      <Polygon points={[P(-0.22, 0.82), P(0.22, 0.82), P(0.2, 1.45), P(0.07, 1.5), P(-0.07, 1.5), P(-0.2, 1.45)].map((p) => `${p.x},${p.y}`).join(' ')} fill={c.suit} />
      <Polygon points={[P(-0.05, 1.47), P(0.05, 1.47), P(0, 1.3)].map((p) => `${p.x},${p.y}`).join(' ')} fill={c.shirt} />
      {/* Lövhəyə uzanan qol */}
      <Line x1={P(0.2, 1.4).x} y1={P(0.2, 1.4).y} x2={P(0.62, 1.62).x} y2={P(0.62, 1.62).y} stroke={c.suit} strokeWidth={(FOCAL * 0.08) / z} strokeLinecap="round" />
      <Circle cx={P(0.64, 1.63).x} cy={P(0.64, 1.63).y} r={(FOCAL * 0.04) / z} fill={c.skin} />
      <Line x1={P(-0.2, 1.4).x} y1={P(-0.2, 1.4).y} x2={P(-0.25, 0.95).x} y2={P(-0.25, 0.95).y} stroke={c.suit} strokeWidth={(FOCAL * 0.08) / z} strokeLinecap="round" />
      <Rect x={P(-0.04, 1.47).x} y={P(0, 1.55).y} width={P(0.04, 0).x - P(-0.04, 0).x} height={P(0, 1.47).y - P(0, 1.55).y} fill={c.skin} />
      <Circle cx={head.x} cy={head.y} r={r} fill={c.skin} />
      <Ellipse cx={head.x} cy={head.y - r * 0.45} rx={r * 1.02} ry={r * 0.62} fill={c.hairDark} />
      <Ellipse cx={(P(0, 0).x)} cy={P(0, 0).y} rx={(FOCAL * 0.3) / z} ry={(FOCAL * 0.05) / z} fill="rgba(0,0,0,0.18)" />
    </G>
  )
}

function Desk({ x, z }: { x: number; z: number }) {
  const { hw, d, top } = DESK
  return (
    <G>
      {[-1, 1].map((s) => (
        <Polygon key={s} points={quad([[x + s * (hw - 0.05), 0, z + 0.02], [x + s * (hw - 0.05), top, z + 0.02], [x + s * (hw - 0.09), top, z + 0.02], [x + s * (hw - 0.09), 0, z + 0.02]])} fill={c.deskDark} />
      ))}
      <Polygon points={quad([[x - hw, top - 0.32, z], [x - hw, top, z], [x + hw, top, z], [x + hw, top - 0.32, z]])} fill={c.desk} />
      <Polygon points={quad([[x - hw, top, z], [x + hw, top, z], [x + hw, top, z + d], [x - hw, top, z + d]])} fill={c.deskTop} />
    </G>
  )
}

/** Partada oturan tələbə (arxadan): stul, gövdə, boyun, baş və saç. */
function Student({ x, z, f }: { x: number; z: number; f: Figure }) {
  const sz = z - 0.32
  const P = (dx: number, y: number) => project(x + dx, y, sz)
  const head = P(0, 1.27)
  const r = (FOCAL * 0.115) / sz
  const pts = (a: { x: number; y: number }[]) => a.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <G transform={`rotate(${f.tilt * 0.5} ${head.x} ${P(0, 0.5).y})`}>
      <Polygon points={pts([P(-0.24, 0.48), P(0.24, 0.48), P(0.22, 1.02), P(0.1, 1.1), P(-0.1, 1.1), P(-0.22, 1.02)])} fill={f.top} />
      <Rect x={P(-0.045, 0).x} y={P(0, 1.18).y} width={P(0.045, 0).x - P(-0.045, 0).x} height={P(0, 1.08).y - P(0, 1.18).y} fill={f.skin} />
      <Circle cx={head.x} cy={head.y} r={r} fill={f.hair} />
      {f.style === 1 ? <Rect x={head.x - r * 0.98} y={head.y} width={r * 1.96} height={r * 1.55} rx={r * 0.5} fill={f.hair} /> : null}
      {f.style === 2 ? <Circle cx={head.x} cy={head.y - r * 0.95} r={r * 0.42} fill={f.hair} /> : null}
      {/* Stulun söykənəcəyi */}
      <Polygon points={quad([[x - 0.22, 0.5, z - 0.5], [x - 0.22, 0.86, z - 0.5], [x + 0.22, 0.86, z - 0.5], [x + 0.22, 0.5, z - 0.5]])} fill={c.chair} />
      <Polygon points={quad([[x - 0.2, 0, z - 0.5], [x - 0.2, 0.5, z - 0.5], [x - 0.17, 0.5, z - 0.5], [x - 0.17, 0, z - 0.5]])} fill={c.chair} />
      <Polygon points={quad([[x + 0.17, 0, z - 0.5], [x + 0.17, 0.5, z - 0.5], [x + 0.2, 0.5, z - 0.5], [x + 0.2, 0, z - 0.5]])} fill={c.chair} />
    </G>
  )
}

/** Tələbənin öz partası: boş stul, partada ad kartı və iki əşya, üstündə zəif qızılı işıq. */
function MyDesk({ seat }: { seat: Seat }) {
  const { x, z } = seat
  const glow = project(x, DESK.top, z + 0.25)
  return (
    <G>
      <Defs>
        <RadialGradient id="cl-mine" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.mine} stopOpacity="0.55" />
          <Stop offset="1" stopColor={c.mine} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={glow.x} cy={glow.y} rx={(FOCAL * 1.2) / z} ry={(FOCAL * 0.45) / z} fill="url(#cl-mine)" />
      <Desk x={x} z={z} />
      {/* Partanın üstündəki dəftər və test vərəqi */}
      <Polygon points={quad([[x - 0.48, DESK.top + 0.005, z + 0.1], [x - 0.08, DESK.top + 0.005, z + 0.1], [x - 0.08, DESK.top + 0.005, z + 0.42], [x - 0.48, DESK.top + 0.005, z + 0.42]])} fill={c.paper} />
      <Polygon points={quad([[x + 0.06, DESK.top + 0.005, z + 0.08], [x + 0.46, DESK.top + 0.005, z + 0.08], [x + 0.46, DESK.top + 0.005, z + 0.44], [x + 0.06, DESK.top + 0.005, z + 0.44]])} fill={c.paperShade} />
      {/* Ad kartı (bükülmüş) */}
      <Polygon points={quad([[x - 0.2, DESK.top, z + 0.04], [x - 0.2, DESK.top + 0.13, z + 0.06], [x + 0.2, DESK.top + 0.13, z + 0.06], [x + 0.2, DESK.top, z + 0.04]])} fill={c.paper} stroke={c.mine} strokeWidth={0.8} />
      {/* Boş, bir az geri çəkilmiş stul */}
      <Polygon points={quad([[x - 0.22, 0.5, z - 0.62], [x - 0.22, 0.86, z - 0.62], [x + 0.22, 0.86, z - 0.62], [x + 0.22, 0.5, z - 0.62]])} fill={c.chair} />
      <Polygon points={quad([[x - 0.22, 0.46, z - 0.6], [x + 0.22, 0.46, z - 0.6], [x + 0.22, 0.46, z - 0.2], [x - 0.22, 0.46, z - 0.2]])} fill={c.deskDark} />
    </G>
  )
}

/** Sinif yoldaşı olan partalar (tələbənin öz yeri istisna). */
function Row({ row, seat, people }: { row: number; seat: Seat; people: Figure[] }) {
  const z = ROOM.rows[row]!
  return (
    <G>
      {ROOM.cols.map((x, col) => (row === seat.row && col === seat.col ? <MyDesk key={col} seat={seat} /> : (
        <G key={col}>
          <Desk x={x} z={z} />
          <Student x={x} z={z} f={people[row * ROOM.cols.length + col]!} />
        </G>
      )))}
    </G>
  )
}

export function Classroom({ studentNo, firstName, subject, quiet, onSeated }: {
  studentNo: number | null | undefined
  firstName: string
  subject: string
  /** Animasiyasız: dərhal oturmuş vəziyyət. */
  quiet: boolean
  onSeated: () => void
}) {
  const seat = useMemo(() => mySeat(studentNo), [studentNo])
  const people = useMemo(() => classmates(7 + subject.length * 31 + (studentNo ?? 0), ROOM.rows.length * ROOM.cols.length), [subject, studentNo])
  const path = useMemo(() => cameraPath(seatCamera(seat), 0.8), [seat])
  const p = useRef(new Animated.Value(0)).current
  const veil = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (quiet) { onSeated(); return }
    const a = Animated.parallel([
      Animated.timing(veil, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(p, { toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: nativeDriver }),
      ]),
    ])
    a.start(({ finished }) => { if (finished) onSeated() })
    return () => a.stop()
  }, [quiet])

  const board = project(0, 1.7, B)
  const card = project(seat.x, DESK.top + 0.065, seat.z + 0.05)
  return (
    <Stage bg={c.roomWall} testID="scene-classroom">
      <Layer progress={p} path={path} zl={B} overlay={
        <SceneText x={board.x} y={board.y} size={15} width={150} lines={2} style={st.chalk}>{subject}</SceneText>
      }><Shell /></Layer>
      <Layer progress={p} path={path} zl={B - 0.7}><Teacher /></Layer>
      {[2, 1, 0].map((row) => (
        <Layer key={row} progress={p} path={path} zl={ROOM.rows[row]! + 0.1}
          overlay={row === seat.row ? <SceneText x={card.x} y={card.y} size={(FOCAL * 0.06) / seat.z} width={(FOCAL * 0.38) / seat.z} style={st.card}>{firstName}</SceneText> : undefined}>
          <Row row={row} seat={seat} people={people} />
        </Layer>
      ))}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.roomWall, opacity: veil }]} />
    </Stage>
  )
}

const st = StyleSheet.create({
  chalk: { color: c.chalk, fontFamily: type.displayItalic, opacity: 0.95 },
  card: { color: c.ink, fontFamily: type.semibold },
})
