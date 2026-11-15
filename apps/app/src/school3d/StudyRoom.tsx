/**
 * 3D fənn otağı (özünü öyrənmə): tələbə içəridə özü gəzir, istədiyi partaya oturur, pəncərə partada açılır.
 * Lövhə, saat, pəncərələr və parta hissələri canlı sinifdəki (Classroom3D) ilə eynidir.
 * Toxunula bilən əşyalar `userData.act` daşıyır: 'desk:N', 'board', 'exit', 'shelf'.
 */
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { Loading } from '../components/ui'
import { t } from '../i18n/az'
import { at, Board, Clock, DESK_METAL, DESK_WOOD, sharedMats, Window } from './Classroom3D'
import { approach } from './layout'
import { Boxes, type BoxPart } from './parts'
import { Rig } from './Rig'
import { mat, plateTex, useSurfaces, type SurfaceKey } from './textures'
import { DESKS, ROOM, type Desk, type PickFn, type Target, type Walker } from './walk'

const NEEDED: SurfaceKey[] = ['planks', 'plaster', 'grain', 'darkGrain', 'ceiling', 'board', 'cork', 'window']
const W = ROOM.halfW * 2, H = 4.5
const DEPTH = ROOM.back - ROOM.front, ZC = (ROOM.back + ROOM.front) / 2

const BOOK_COLORS = ['#8b2f2a', '#2f5d7a', '#c9a14a', '#3f6b4a', '#6b4a7a'] as const

/** Kitab şkafı: gövdə və rəflər taxta, kitablar rəng üzrə qruplaşdırılıb (hər rəng bir çəkiliş çağırışı). */
function Bookcase({ x, z }: { x: number; z: number }) {
  const m = sharedMats()
  const { frame, books } = useMemo(() => {
    const frame: BoxPart[] = [
      { p: [0, 1.1, 0.24], s: [2.2, 2.2, 0.04] },
      { p: [-1.08, 1.1, 0], s: [0.05, 2.2, 0.46] }, { p: [1.08, 1.1, 0], s: [0.05, 2.2, 0.46] },
      { p: [0, 2.18, 0], s: [2.2, 0.05, 0.46] }, { p: [0, 0.06, 0], s: [2.2, 0.12, 0.46] },
      ...[0.58, 1.02, 1.46, 1.9].map((y): BoxPart => ({ p: [0, y, 0], s: [2.1, 0.03, 0.42] })),
    ]
    const books: BoxPart[][] = BOOK_COLORS.map(() => [])
    let seed = 7
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (const y of [0.13, 0.6, 1.04, 1.48]) {
      let bx = -1.0
      while (bx < 0.98) {
        const w = 0.045 + rnd() * 0.05, h = 0.24 + rnd() * 0.12
        books[Math.floor(rnd() * BOOK_COLORS.length)]!.push({ p: [bx + w / 2, y + h / 2, -0.02], s: [w, h, 0.24] })
        bx += w + 0.008
      }
    }
    return { frame, books }
  }, [])
  const bookMats = useMemo(() => BOOK_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 })), [])
  useEffect(() => () => bookMats.forEach((b) => b.dispose()), [bookMats])
  return (
    <group position={[x, 0, z]} userData={{ act: 'shelf' }}>
      <Boxes parts={frame} material={m.darkWood} />
      {books.map((b, i) => <Boxes key={i} parts={b} material={bookMats[i]!} receive={false} />)}
    </group>
  )
}

/** Çıxış qapısı (arxa divarda). Seçiləndə açılır, arxasında dəhlizin işığı görünür. */
function ExitDoor({ x, z, open }: { x: number; z: number; open: boolean }) {
  const m = sharedMats()
  const leaf = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (leaf.current) leaf.current.rotation.y = approach(leaf.current.rotation.y, open ? -1.25 : 0, dt, 4) })
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI, 0]} userData={{ act: 'exit' }}>
      {[[-0.6, 1.15, 0.12, 2.36], [0.6, 1.15, 0.12, 2.36], [0, 2.36, 1.32, 0.14]].map(([px, py, w, h], i) => (
        <mesh key={i} position={[px!, py!, 0.04]} material={m.darkWood}><boxGeometry args={[w!, h!, 0.08]} /></mesh>
      ))}
      <mesh position={[0, 1.1, 0.012]}><planeGeometry args={[1.08, 2.22]} /><meshStandardMaterial color="#3a2a1a" emissive="#ffcf8a" emissiveIntensity={0.5} /></mesh>
      <group ref={leaf} position={[0.54, 0, 0.05]}>
        <group position={[-0.54, 0, 0]}>
          <mesh position={[0, 1.1, 0]} material={m.wood}><boxGeometry args={[1.06, 2.2, 0.05]} /></mesh>
          <mesh position={[0, 0.55, 0.03]} material={m.darkWood}><boxGeometry args={[0.78, 0.7, 0.015]} /></mesh>
          <mesh position={[0, 1.55, 0.03]} material={m.darkWood}><boxGeometry args={[0.78, 0.9, 0.015]} /></mesh>
          <mesh position={[-0.4, 1.05, 0.05]}><boxGeometry args={[0.05, 0.16, 0.03]} /><meshStandardMaterial color="#d4af5a" metalness={0.85} roughness={0.25} /></mesh>
        </group>
      </group>
    </group>
  )
}

/** Seçiləcək partanın stulu altında döyünən qızılı halqa: "bura oturacaqsan". */
function DeskMark({ desk }: { desk: Desk | null }) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ring.current) return
    const k = 0.5 + Math.sin(clock.getElapsedTime() * 4) * 0.25
    ;(ring.current.material as THREE.MeshBasicMaterial).opacity = k
    ring.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 4) * 0.04)
  })
  if (!desk) return null
  return (
    <mesh ref={ring} position={[desk.x, 0.02, desk.z + 0.2]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noRay: true }}>
      <ringGeometry args={[0.42, 0.52, 40]} />
      <meshBasicMaterial color="#e9b23c" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Oturduğun partanın üstü: gündəlik dəftəri, vərəq və qələm. */
function DeskTop({ desk }: { desk: Desk }) {
  return (
    <group position={[desk.x, 0.768, desk.z - 0.33]} userData={{ noRay: true }}>
      <mesh position={[0.2, 0.012, 0]} rotation={[0, 0.12, 0]}><boxGeometry args={[0.24, 0.022, 0.18]} /><meshStandardMaterial color="#8a2f2a" roughness={0.7} /></mesh>
      <mesh position={[-0.2, 0.004, 0.02]} rotation={[0, -0.08, 0]}><boxGeometry args={[0.22, 0.006, 0.3]} /><meshStandardMaterial color="#fbf6ec" roughness={0.9} /></mesh>
      <mesh position={[0.0, 0.012, 0.06]} rotation={[0, 0.5, Math.PI / 2]}><cylinderGeometry args={[0.006, 0.006, 0.15, 8]} /><meshStandardMaterial color="#e9b23c" /></mesh>
    </group>
  )
}

const Static = function StaticRoom({ low, roomNo }: { low: boolean; roomNo: string }) {
  const m = sharedMats()
  const L = DEPTH
  const desks = useMemo(() => {
    const wood: BoxPart[] = [], metal: BoxPart[] = []
    for (const d of DESKS) { wood.push(...at(DESK_WOOD, d.x, d.z)); metal.push(...at(DESK_METAL, d.x, d.z)) }
    return { wood, metal }
  }, [])
  const surf = useMemo(() => {
    const wall = (len: number) => new THREE.MeshStandardMaterial({ ...mat('plaster', Math.round(len / 2.5), 1), roughness: 0.95, bumpScale: 0.6 })
    return {
      floor: new THREE.MeshStandardMaterial({ ...mat('planks', W / 1.2, Math.round(L / 1.2)), roughness: 0.62, bumpScale: 1.5 }),
      side: wall(L), end: wall(W),
      ceiling: new THREE.MeshStandardMaterial({ ...mat('ceiling', Math.round(W / 1.2), Math.round(L / 1.2)), roughness: 1 }),
      panel: new THREE.MeshStandardMaterial({ ...mat('grain', Math.round(L / 1.5), 1), roughness: 0.6 }),
    }
  }, [L])
  useEffect(() => () => Object.values(surf).forEach((x) => x.dispose()), [surf])
  const sun = useRef<THREE.DirectionalLight>(null)
  useEffect(() => { if (sun.current) { sun.current.target.position.set(0, 0, 1); sun.current.target.updateMatrixWorld() } }, [])
  const plate = roomNo ? plateTex(roomNo) : null

  return (
    <>
      <color attach="background" args={['#13261f']} />
      <ambientLight intensity={0.38} />
      <hemisphereLight args={['#fff6e6', '#5a4230', 0.6]} />
      {/* Pəncərədən düşən günəş: yalnız bu işıq kölgə salır. */}
      <directionalLight ref={sun} position={[-9, 8, -1]} intensity={1.6} color="#fff0d8" castShadow={!low}
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-near={1} shadow-camera-far={30} />
      {(low ? [1] : [-2, 3.4]).map((z) => <pointLight key={z} position={[0, H - 0.4, z]} intensity={low ? 8 : 5} distance={low ? 16 : 11} decay={1.6} color="#fff3dc" />)}
      {[-2, 3.4].flatMap((z) => [-2.2, 2.2].map((x) => (
        <mesh key={`${x}${z}`} position={[x, H - 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 0.3]} /><meshStandardMaterial color="#ffffff" emissive="#fff6dc" emissiveIntensity={1.2} side={THREE.DoubleSide} />
        </mesh>
      )))}

      {/* Döşəmə, tavan, dörd divar */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ZC]} material={surf.floor} receiveShadow><planeGeometry args={[W, L]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, ZC]} material={surf.ceiling}><planeGeometry args={[W, L]} /></mesh>
      <mesh position={[0, H / 2, ROOM.front]} material={surf.end} receiveShadow><planeGeometry args={[W, H]} /></mesh>
      <mesh position={[0, H / 2, ROOM.back]} rotation={[0, Math.PI, 0]} material={surf.end}><planeGeometry args={[W, H]} /></mesh>
      <mesh position={[-W / 2, H / 2, ZC]} rotation={[0, Math.PI / 2, 0]} material={surf.side}><planeGeometry args={[L, H]} /></mesh>
      <mesh position={[W / 2, H / 2, ZC]} rotation={[0, -Math.PI / 2, 0]} material={surf.side} receiveShadow><planeGeometry args={[L, H]} /></mesh>
      {/* Taxta panel, plintus, kornis */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (W / 2 - 0.02), 0.5, ZC]} rotation={[0, -s * Math.PI / 2, 0]} material={surf.panel}><planeGeometry args={[L, 1]} /></mesh>
          <mesh position={[s * (W / 2 - 0.035), 1.02, ZC]} material={m.trim}><boxGeometry args={[0.05, 0.05, L]} /></mesh>
          <mesh position={[s * (W / 2 - 0.03), 0.05, ZC]} material={m.trim}><boxGeometry args={[0.04, 0.1, L]} /></mesh>
          <mesh position={[s * (W / 2 - 0.03), H - 0.05, ZC]} material={m.frame}><boxGeometry args={[0.06, 0.1, L]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.5, ROOM.front + 0.02]} material={surf.panel}><planeGeometry args={[W, 1]} /></mesh>
      <mesh position={[0, 1.02, ROOM.front + 0.05]} material={m.trim}><boxGeometry args={[W, 0.05, 0.05]} /></mesh>
      <mesh position={[0, 0.5, ROOM.back - 0.02]} rotation={[0, Math.PI, 0]} material={surf.panel}><planeGeometry args={[W, 1]} /></mesh>
      <mesh position={[0, 1.02, ROOM.back - 0.05]} material={m.trim}><boxGeometry args={[W, 0.05, 0.05]} /></mesh>

      {[-2.6, 0.6, 3.8].map((z) => <Window key={z} z={z} mats={m} />)}
      {/* Sağ divarda elan lövhəsi */}
      <group position={[W / 2 - 0.02, 2.2, 0.5]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={m.darkWood}><boxGeometry args={[2.2, 1.3, 0.04]} /></mesh>
        <mesh position={[0, 0, 0.025]}><planeGeometry args={[2.05, 1.15]} /><meshStandardMaterial {...mat('cork', 2, 1)} roughness={1} /></mesh>
        {[[-0.6, 0.2, '#fff8d6', 0.08], [0.1, 0.25, '#ffffff', -0.05], [0.65, -0.1, '#d8ecff', 0.04], [-0.25, -0.25, '#ffe1e1', -0.07]].map(([x, y, c, r], i) => (
          <mesh key={i} position={[x as number, y as number, 0.03]} rotation={[0, 0, r as number]}><planeGeometry args={[0.42, 0.5]} /><meshStandardMaterial color={c as string} /></mesh>
        ))}
      </group>
      <group userData={{ act: 'board' }}><Board texture={null} mats={m} /></group>
      <Clock />
      {/* Lövhənin yanında otaq nömrəsi */}
      {plate ? <mesh position={[-3.4, 2.9, ROOM.front + 0.06]}><planeGeometry args={[0.6, 0.23]} /><meshStandardMaterial map={plate} metalness={0.5} roughness={0.35} /></mesh> : null}
      {/* Müəllim masası */}
      <group position={[2.7, 0, -3.15]}>
        <mesh position={[0, 0.76, 0]} material={m.darkWood} castShadow receiveShadow><boxGeometry args={[1.6, 0.06, 0.75]} /></mesh>
        <mesh position={[0, 0.38, 0.33]} material={m.darkWood} castShadow><boxGeometry args={[1.55, 0.72, 0.04]} /></mesh>
        {[-0.77, 0.77].map((x) => <mesh key={x} position={[x, 0.38, 0]} material={m.darkWood} castShadow><boxGeometry args={[0.05, 0.72, 0.7]} /></mesh>)}
        <mesh position={[-0.4, 0.82, -0.05]} rotation={[0, 0.3, 0]}><boxGeometry args={[0.3, 0.05, 0.22]} /><meshStandardMaterial color="#8b2f2a" /></mesh>
        <mesh position={[0.45, 0.86, 0]}><cylinderGeometry args={[0.05, 0.04, 0.14, 12]} /><meshStandardMaterial color="#e8e3d8" /></mesh>
      </group>
      <Boxes parts={desks.wood} material={m.wood} />
      <Boxes parts={desks.metal} material={m.metal} receive={false} />
      {/* Partaların toxunma sahəsi (görünmür, yalnız seçim üçün) */}
      {DESKS.map((d) => (
        <mesh key={d.no} position={[d.x, 0.55, d.z - 0.1]} visible={false} userData={{ act: `desk:${d.no}` }}><boxGeometry args={[1.0, 1.1, 1.1]} /></mesh>
      ))}
      <Bookcase x={-2.6} z={ROOM.back - 0.3} />
    </>
  )
}

export function StudyRoom({ roomNo, mark, seat, exitOpen, walker, targets, onNear, pick, onSlow, low, active }: {
  roomNo: string
  /** Yaxınlaşdığın (seçiləcək) parta və oturduğun parta. */
  mark: Desk | null; seat: Desk | null; exitOpen: boolean
  walker: Walker; targets: readonly Target[]; onNear: (id: string | null) => void; pick: MutableRefObject<PickFn | null>
  onSlow: () => void; low: boolean; active: boolean
}) {
  const ready = useSurfaces(NEEDED)
  if (!ready) return <Loading label={t.walk.building} />
  return (
    <Canvas shadows={!low} frameloop={active ? 'always' : 'never'} dpr={low ? 1 : [1, 1.5]}
      camera={{ fov: 70, near: 0.05, far: 60, position: [walker.x, walker.eye, walker.z] }} gl={{ antialias: !low, powerPreference: 'low-power' }}>
      <Static low={low} roomNo={roomNo} />
      <ExitDoor x={ROOM.doorX} z={ROOM.back - 0.01} open={exitOpen} />
      <DeskMark desk={seat ? null : mark} />
      {seat ? <DeskTop desk={seat} /> : null}
      <Rig walker={walker} targets={targets} onNear={onNear} pick={pick} onSlow={onSlow} />
    </Canvas>
  )
}
