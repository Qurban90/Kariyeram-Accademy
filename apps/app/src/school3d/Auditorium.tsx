/**
 * Oxu zalı: universitet auditoriyası kimi pilləli (amfiteatr) zal. Səhnə və böyük lövhə öndə, sıralar arxaya doğru qalxır,
 * giriş yuxarıdakı meydançadandır. Eyni interyer üç yerdə işlənir: zalda gəzinti (HallWalk), canlı dərsin 3D görünüşü (HallLive)
 * və dəhlizdə açılan zal qapısının arxasında (HallInterior).
 * Performans: pillələr, masalar və oturacaqlar InstancedMesh ilə çəkilir (126 yer = bir neçə çəkiliş çağırışı).
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { Loading } from '../components/ui'
import { t } from '../i18n/az'
import type { Peer } from '../live/useLiveRoom'
import { useVideoTexture } from '../live/videoTexture'
import { approach } from './layout'
import { Avatar, Boxes, type BoxPart } from './parts'
import { Rig } from './Rig'
import { mat, useSurfaces, type SurfaceKey } from './textures'
import { HALL, HALL_SEATS, HALL_TOP, type Desk, type PickFn, type Target, type Walker } from './walk'
import { CorridorStub, HoledWall } from './walls'

export const HALL_SURFACES: SurfaceKey[] = ['planks', 'plaster', 'grain', 'darkGrain', 'ceiling', 'board', 'marble', 'runner']
const W = HALL.halfW * 2
const LAND = HALL.z0 + HALL.rows * HALL.depth
const DOOR_W = 2.3, DOOR_H = 2.75
const BLOCKS: readonly [number, number][] = [[-6.05, 3.8], [0, 5.7], [6.05, 3.8]] // sıra bloklarının mərkəzi və eni
const AISLES = [-8.5, -3.5, 3.5, 8.5] as const

function makeMats() {
  return {
    wood: new THREE.MeshStandardMaterial({ ...mat('grain'), roughness: 0.5 }),
    darkWood: new THREE.MeshStandardMaterial({ ...mat('darkGrain'), roughness: 0.55 }),
    carpet: new THREE.MeshStandardMaterial({ color: '#5b2324', roughness: 0.96 }),
    seat: new THREE.MeshStandardMaterial({ color: '#23463c', roughness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: '#d4af5a', metalness: 0.8, roughness: 0.3 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff3d6', emissiveIntensity: 1.3, side: THREE.DoubleSide }),
    sconce: new THREE.MeshStandardMaterial({ color: '#ffe9bd', emissive: '#ffcf8a', emissiveIntensity: 1.1 }),
  }
}
let cached: ReturnType<typeof makeMats> | null = null
const mats = () => (cached ??= makeMats())

/** Zalın bütün statik hissələri. `lights`: öz işıqları (dəhlizdən görünəndə dəhlizin işığı ilə kifayətlənir). */
export function HallInterior({ low, lights = true, screen = null }: { low: boolean; lights?: boolean; screen?: THREE.Texture | null }) {
  const m = mats()
  const parts = useMemo(() => {
    const tiers: BoxPart[] = [], nosing: BoxPart[] = [], wood: BoxPart[] = [], seats: BoxPart[] = []
    for (let r = 0; r < HALL.rows; r++) {
      const z = HALL.z0 + r * HALL.depth, y = r * HALL.rise
      if (r > 0) tiers.push({ p: [0, y / 2, z + HALL.depth / 2], s: [W, y, HALL.depth] })
      // Keçidlərdə pillənin qabağındakı mis zolaq (pillə aydın seçilsin).
      for (const x of AISLES) nosing.push({ p: [x, y + 0.006, z + 0.05], s: [1.0, 0.012, 0.06] })
      for (const [cx, bw] of BLOCKS) {
        wood.push({ p: [cx, y + 0.74, z + 0.22], s: [bw, 0.04, 0.4] }) // masanın üstü
        wood.push({ p: [cx, y + 0.42, z + 0.03], s: [bw, 0.84, 0.03] }) // ön panel
      }
    }
    tiers.push({ p: [0, HALL_TOP / 2, (LAND + HALL.back) / 2], s: [W, HALL_TOP, HALL.back - LAND] })
    for (const x of AISLES) nosing.push({ p: [x, HALL_TOP + 0.006, LAND + 0.05], s: [1.0, 0.012, 0.06] })
    for (const d of HALL_SEATS) {
      seats.push({ p: [d.x, d.y + 0.45, d.z], s: [0.52, 0.07, 0.44] })
      seats.push({ p: [d.x, d.y + 0.78, d.z + 0.25], s: [0.52, 0.56, 0.06] })
    }
    return { tiers, nosing, wood, seats }
  }, [])
  const surf = useMemo(() => ({
    floor: new THREE.MeshStandardMaterial({ ...mat('planks', 12, 5), roughness: 0.6, bumpScale: 1.4 }),
    ceiling: new THREE.MeshStandardMaterial({ ...mat('ceiling', 14, 15), roughness: 1 }),
    board: new THREE.MeshStandardMaterial({ ...mat('board'), roughness: 0.95 }),
  }), [])
  useEffect(() => () => Object.values(surf).forEach((x) => x.dispose()), [surf])
  const L = HALL.back - HALL.front, ZC = (HALL.back + HALL.front) / 2
  const H = HALL.height

  return (
    <>
      {lights ? (<>
        <ambientLight intensity={0.42} />
        <hemisphereLight args={['#fff6e6', '#4a3628', 0.62]} />
        <directionalLight position={[-6, 12, 4]} intensity={0.9} color="#fff0d8" />
        <pointLight position={[0, 6.2, HALL.front + 3]} intensity={low ? 26 : 20} distance={20} decay={1.5} color="#fff3dc" />
        {low ? null : <pointLight position={[0, H - 0.6, 1]} intensity={16} distance={20} decay={1.5} color="#fff3dc" />}
        {low ? null : <pointLight position={[0, H - 0.6, LAND + 1]} intensity={12} distance={16} decay={1.5} color="#ffeccc" />}
      </>) : <pointLight position={[0, 5.5, 2]} intensity={24} distance={26} decay={1.4} color="#fff3dc" />}

      {/* Səhnənin döşəməsi (ilk sıra da bu səviyyədədir), tavan */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (HALL.front + HALL.z0 + HALL.depth) / 2]} material={surf.floor}>
        <planeGeometry args={[W, HALL.z0 + HALL.depth - HALL.front]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, ZC]} material={surf.ceiling}><planeGeometry args={[W, L]} /></mesh>
      {[-5, 0, 5].flatMap((x) => [HALL.front + 4, -1, 4, 8].map((z) => (
        <mesh key={`${x}:${z}`} position={[x, H - 0.02, z]} rotation={[Math.PI / 2, 0, 0]} material={m.lamp}><planeGeometry args={[2.2, 0.5]} /></mesh>
      )))}

      {/* Divarlar: ön və yanlar bütöv, arxa divarda (yuxarı meydançada) giriş qapısının yeri açıqdır */}
      <group position={[0, 0, HALL.front]}><HoledWall u0={-HALL.halfW} u1={HALL.halfW} height={H} /></group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * HALL.halfW, 0, ZC]} rotation={[0, -s * Math.PI / 2, 0]}>
          <HoledWall u0={-L / 2} u1={L / 2} height={H} panel={false} />
          {/* Divar çıraqları */}
          {[-7, -2.5, 2, 6.5].map((u) => <mesh key={u} position={[u, 4.6, 0.07]} material={m.sconce}><boxGeometry args={[0.28, 0.7, 0.12]} /></mesh>)}
        </group>
      ))}
      <group position={[0, HALL_TOP, HALL.back]} rotation={[0, Math.PI, 0]}>
        <HoledWall u0={-HALL.halfW} u1={HALL.halfW} height={H - HALL_TOP} openings={[{ at: -HALL.doorX, width: DOOR_W, height: DOOR_H }]} />
      </group>

      {/* Pillələr, masalar, oturacaqlar */}
      <Boxes parts={parts.tiers} material={m.carpet} cast={false} />
      <Boxes parts={parts.nosing} material={m.brass} cast={false} receive={false} />
      <Boxes parts={parts.wood} material={m.wood} />
      <Boxes parts={parts.seats} material={m.seat} />

      {/* Səhnə: böyük lövhə (canlı dərsdə müəllimin ekranı), kafedra, müəllim masası */}
      <group position={[0, 3.25, HALL.front + 0.1]}>
        <mesh material={m.darkWood}><boxGeometry args={[8.4, 4.1, 0.1]} /></mesh>
        <mesh position={[0, 0, 0.056]}>
          <planeGeometry args={[8.0, 3.7]} />
          {screen ? <meshBasicMaterial map={screen} toneMapped={false} /> : <primitive object={surf.board} attach="material" />}
        </mesh>
        <mesh position={[0, -2.1, 0.12]} material={m.darkWood}><boxGeometry args={[8.0, 0.05, 0.16]} /></mesh>
      </group>
      <group position={[-1.75, 0, HALL.front + 2.25]}>
        <mesh position={[0, 0.55, 0]} material={m.darkWood}><boxGeometry args={[0.9, 1.1, 0.6]} /></mesh>
        <mesh position={[0, 1.13, 0.03]} rotation={[-0.25, 0, 0]} material={m.wood}><boxGeometry args={[0.96, 0.04, 0.66]} /></mesh>
        <mesh position={[0, 0.7, 0.305]} material={m.brass}><planeGeometry args={[0.36, 0.36]} /></mesh>
      </group>
      <group position={[3.2, 0, HALL.front + 2.4]}>
        <mesh position={[0, 0.76, 0]} material={m.darkWood}><boxGeometry args={[2.4, 0.06, 0.8]} /></mesh>
        <mesh position={[0, 0.38, 0.36]} material={m.darkWood}><boxGeometry args={[2.34, 0.72, 0.04]} /></mesh>
        {[-1.17, 1.17].map((x) => <mesh key={x} position={[x, 0.38, 0]} material={m.darkWood}><boxGeometry args={[0.05, 0.72, 0.76]} /></mesh>)}
      </group>
      {/* Giriş qapısının çərçivəsi (arxa divar, yuxarı meydança) */}
      <group position={[HALL.doorX, HALL_TOP, HALL.back - 0.04]}>
        {[[-(DOOR_W / 2 + 0.09), DOOR_H / 2, 0.18, DOOR_H + 0.18], [DOOR_W / 2 + 0.09, DOOR_H / 2, 0.18, DOOR_H + 0.18], [0, DOOR_H + 0.09, DOOR_W + 0.36, 0.18]].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x!, y!, 0]} material={m.darkWood}><boxGeometry args={[w!, h!, 0.1]} /></mesh>
        ))}
      </group>
    </>
  )
}

/** Zalın giriş qapısı (içəridən): çıxanda qanadlar çölə, dəhlizə doğru açılır. */
function HallExit({ open }: { open: boolean }) {
  const m = mats()
  const l = useRef<THREE.Group>(null), r = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (l.current) l.current.rotation.y = approach(l.current.rotation.y, open ? -1.15 : 0, dt, 3.5)
    if (r.current) r.current.rotation.y = approach(r.current.rotation.y, open ? 1.15 : 0, dt, 3.5)
  })
  return (
    <group position={[HALL.doorX, HALL_TOP, HALL.back - 0.02]} userData={{ act: 'exit' }}>
      {[[-1, l] as const, [1, r] as const].map(([s, ref]) => (
        <group key={s} ref={ref} position={[s * (DOOR_W / 2), 0, 0]}>
          <mesh position={[-s * (DOOR_W / 4), DOOR_H / 2, 0]} material={m.darkWood}><boxGeometry args={[DOOR_W / 2 - 0.01, DOOR_H, 0.06]} /></mesh>
          <mesh position={[-s * (DOOR_W / 4), 1.9, -0.035]} material={m.wood}><boxGeometry args={[0.78, 1.1, 0.012]} /></mesh>
          <mesh position={[-s * (DOOR_W / 4), 0.72, -0.035]} material={m.wood}><boxGeometry args={[0.78, 0.9, 0.012]} /></mesh>
          <mesh position={[-s * (DOOR_W / 2 - 0.1), 1.3, -0.06]} material={m.brass}><boxGeometry args={[0.03, 0.5, 0.03]} /></mesh>
        </group>
      ))}
    </group>
  )
}

/** Seçiləcək yerin altında döyünən qızılı halqa. */
function SeatMark({ seat }: { seat: Desk | null }) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ring.current) return
    const k = Math.sin(clock.getElapsedTime() * 4)
    ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + k * 0.25
    ring.current.scale.setScalar(1 + k * 0.05)
  })
  if (!seat) return null
  return (
    <mesh ref={ring} position={[seat.x, seat.y + 0.5, seat.z]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noRay: true }}>
      <ringGeometry args={[0.2, 0.27, 32]} />
      <meshBasicMaterial color="#e9b23c" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Zalda gəzinti: tələbə yuxarıdan girir, keçidlə enir, istədiyi yerə oturur. */
export function HallWalk({ mark, seat, exitOpen, walker, targets, onNear, pick, onSlow, onReady, low, active }: {
  mark: Desk | null; seat: Desk | null; exitOpen: boolean
  walker: Walker; targets: readonly Target[]; onNear: (id: string | null) => void; pick: MutableRefObject<PickFn | null>
  onSlow: () => void; onReady?: () => void; low: boolean; active: boolean
}) {
  const ready = useSurfaces(HALL_SURFACES)
  if (!ready) return <Loading label={t.walk.building} />
  return (
    <Canvas frameloop={active ? 'always' : 'never'} dpr={low ? 1 : [1, 1.5]}
      camera={{ fov: 70, near: 0.05, far: 80, position: [walker.x, walker.eye + walker.floor, walker.z] }} gl={{ antialias: !low, powerPreference: 'low-power' }}>
      <color attach="background" args={['#161210']} />
      <HallInterior low={low} />
      <HallExit open={exitOpen} />
      {exitOpen ? <group position={[HALL.doorX, HALL_TOP, HALL.back]}><CorridorStub along="z" /></group> : null}
      {/* Oturacaqların toxunma sahəsi (görünmür, yalnız seçim üçün) */}
      {HALL_SEATS.map((d) => (
        <mesh key={d.no} position={[d.x, d.y + 0.6, d.z - 0.05]} visible={false} userData={{ act: `desk:${d.no}` }}><boxGeometry args={[0.9, 1.2, 1.0]} /></mesh>
      ))}
      <SeatMark seat={seat ? null : mark} />
      <Rig walker={walker} targets={targets} onNear={onNear} pick={pick} onSlow={onSlow} onReady={onReady} />
    </Canvas>
  )
}

/** Canlı dərsdə kamera: yuxarı meydançadan bütün zala və səhnəyə baxır; dar (şaquli) ekranda baxış bucağı böyüyür. */
function OverviewCamera() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const asp = size.width / Math.max(1, size.height)
    cam.fov = asp < 1 ? Math.min(88, (2 * Math.atan(Math.tan((62 * Math.PI) / 360) / asp) * 180) / Math.PI) : 52
    cam.position.set(0, HALL_TOP + 2.6, HALL.back - 0.8)
    cam.lookAt(0, 1.6, HALL.front + 2)
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

/** Canlı dərsin 3D görünüşü (zal): müəllim səhnədə, tələbələr serverin verdiyi yerlərdə, müəllimin ekranı böyük lövhədə. */
export function HallLive({ peers, raised }: { peers: Peer[]; raised: Set<string> }) {
  const ready = useSurfaces(HALL_SURFACES)
  const host = peers.find((p) => p.role === 'host') ?? peers.find((p) => p.role === 'cohost')
  const boardTrack = peers.find((p) => (p.role === 'host' || p.role === 'cohost') && p.screen)?.screen ?? host?.camera
  const texture = useVideoTexture(boardTrack)
  const seated = peers.filter((p) => p.role !== 'host' && p.role !== 'cohost' && p.seat !== null)
  if (!ready) return <Loading />
  return (
    <Canvas dpr={[1, 1.5]} camera={{ fov: 52, near: 0.05, far: 80, position: [0, HALL_TOP + 2.6, HALL.back - 0.8] }} gl={{ antialias: true, powerPreference: 'low-power' }}>
      <color attach="background" args={['#161210']} />
      <OverviewCamera />
      <HallInterior low={false} screen={texture} />
      {host ? <group position={[-0.3, 0, HALL.front + 2.6]} rotation={[0, Math.PI, 0]}><Avatar id={host.identity} speaking={host.speaking} hand={false} me={host.isLocal} host standing /></group> : null}
      {seated.map((p) => {
        // Zalın tutumundan böyük yer nömrəsi olarsa sonuncu sıralara dövr edir (görünməz qalmasın).
        const d = HALL_SEATS[(p.seat! - 1) % HALL_SEATS.length]!
        return (
          <group key={p.identity} position={[d.x, d.y, d.z]}>
            <Avatar id={p.identity} speaking={p.speaking} hand={raised.has(p.identity)} me={p.isLocal} />
          </group>
        )
      })}
    </Canvas>
  )
}
