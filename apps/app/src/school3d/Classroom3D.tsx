/**
 * 3D oxu zalı / sinif: müəllim lövhənin yanında, tələbələr partalarda (yer nömrəsi serverdən).
 * Danışan avatarın ayağı altında halqa yanır və başı tərpənir, əl qaldıranın əli qalxır. Vebdə müəllimin ekranı/kamerası lövhəyə tekstura kimi çəkilir.
 *
 * Görünüş: prosedur teksturalar (parket, suvaq, taxta, şifer lövhə, tavan), sol divarda pəncərələr və oradan düşən günəş işığı (kölgə ilə).
 * Performans: bütün partalar və stullar 2 çəkiliş çağırışı ilə (InstancedMesh), teksturalar yaddaşda bir dəfə.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Loading } from '../components/ui'
import type { Peer } from '../live/useLiveRoom'
import { useVideoTexture } from '../live/videoTexture'
import { classroomSeat, CLASS_PER_ROW } from './layout'
import { Avatar, Boxes, SeatedCrowd, type BoxPart } from './parts'
import { mat, useSurfaces, type SurfaceKey } from './textures'

const NEEDED: SurfaceKey[] = ['planks', 'plaster', 'grain', 'darkGrain', 'ceiling', 'board', 'cork', 'window']
const W = 10, H = 4.5 // otağın eni və hündürlüyü

/** Parta + stul hissələri (parta mərkəzinə nisbətən). Tələbə +Z tərəfdə oturur, -Z-yə (lövhəyə) baxır. */
export const DESK_WOOD: BoxPart[] = [
  { p: [0, 0.745, -0.35], s: [1.0, 0.04, 0.52] }, // üst
  { p: [0, 0.56, -0.6], s: [0.94, 0.3, 0.02] }, // ön panel
  { p: [0, 0.455, 0.2], s: [0.42, 0.035, 0.4] }, // stulun oturacağı
  { p: [0, 0.8, 0.39], s: [0.42, 0.26, 0.025] }, // stulun söykənəcəyi
]
export const DESK_METAL: BoxPart[] = [
  ...[-0.46, 0.46].flatMap((x) => [-0.56, -0.14].map((z): BoxPart => ({ p: [x, 0.36, z], s: [0.035, 0.72, 0.035] }))),
  ...[-0.18, 0.18].flatMap((x) => [0.03, 0.37].map((z): BoxPart => ({ p: [x, 0.22, z], s: [0.03, 0.44, 0.03] }))),
  ...[-0.18, 0.18].map((x): BoxPart => ({ p: [x, 0.64, 0.39], s: [0.03, 0.4, 0.03] })),
]
export const at = (parts: BoxPart[], x: number, z: number): BoxPart[] => parts.map((b) => ({ p: [b.p[0] + x, b.p[1], b.p[2] + z], s: b.s }))

/** Kamera: ekranın eninə görə uzaqlaşır ki, dar telefonda da bütün sıra görünsün. */
function CameraRig({ backZ }: { backZ: number }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const halfWidth = 4.4
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (size.width / Math.max(1, size.height)))
    const dist = Math.max(halfWidth / Math.tan(hHalf), 6)
    // Ön sıra (z = -1.5) bütün eni ilə görünməlidir; arxa sıralar perspektivlə daha da daralır.
    // Telefonun şaquli ekranında kamera aşağı enir və lövhəyə baxır, yoxsa kadrın yarısını döşəmə tutur.
    const portrait = size.width < size.height * 0.9
    cam.position.set(0, portrait ? 2.5 : 3.2 + Math.min(1.1, dist * 0.06), Math.max(backZ, -1.5 + dist))
    cam.lookAt(0, portrait ? 1.8 : 1.3, -3)
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height, backZ])
  return null
}

export function Board({ texture, mats }: { texture: THREE.Texture | null; mats: Mats }) {
  return (
    <group position={[0, 2.05, -4.55]}>
      <mesh material={mats.darkWood}><boxGeometry args={[4.75, 2.85, 0.08]} /></mesh>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[4.45, 2.5]} />
        {texture ? <meshBasicMaterial map={texture} toneMapped={false} /> : <meshStandardMaterial {...mat('board')} roughness={0.95} />}
      </mesh>
      {/* Təbaşir rəfi və təbaşirlər */}
      <mesh position={[0, -1.36, 0.1]} material={mats.metal}><boxGeometry args={[4.45, 0.035, 0.14]} /></mesh>
      {[-1.4, -1.25, 0.9].map((x, i) => (
        <mesh key={x} position={[x, -1.325, 0.12]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.09, 6]} />
          <meshStandardMaterial color={i === 2 ? '#f0c6c6' : '#f6f3ea'} />
        </mesh>
      ))}
      <mesh position={[1.7, -1.32, 0.12]}><boxGeometry args={[0.16, 0.05, 0.06]} /><meshStandardMaterial color="#3a3a42" /></mesh>
    </group>
  )
}

/** Divar saatı: əqrəblər real vaxtı göstərir. */
export function Clock() {
  const hr = useRef<THREE.Group>(null), mn = useRef<THREE.Group>(null)
  useFrame(() => {
    const d = new Date()
    const m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60
    if (mn.current) mn.current.rotation.z = -(m / 60) * Math.PI * 2
    if (hr.current) hr.current.rotation.z = -(h / 12) * Math.PI * 2
  })
  return (
    <group position={[0, 3.95, -4.58]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.28, 0.28, 0.05, 32]} /><meshStandardMaterial color="#2b2b2b" metalness={0.4} roughness={0.4} /></mesh>
      <mesh position={[0, 0, 0.027]}><circleGeometry args={[0.25, 32]} /><meshStandardMaterial color="#fbf8f0" /></mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[Math.sin((i / 12) * Math.PI * 2) * 0.21, Math.cos((i / 12) * Math.PI * 2) * 0.21, 0.03]}>
          <circleGeometry args={[i % 3 === 0 ? 0.018 : 0.01, 8]} /><meshBasicMaterial color="#222" />
        </mesh>
      ))}
      {/* Əqrəb mərkəzdən fırlanır: qrup mərkəzdədir, həndəsə yarı uzunluq qədər yuxarıdadır. */}
      <group ref={hr} position={[0, 0, 0.032]}><mesh position={[0, 0.06, 0]}><planeGeometry args={[0.02, 0.13]} /><meshBasicMaterial color="#1a1a1a" /></mesh></group>
      <group ref={mn} position={[0, 0, 0.034]}><mesh position={[0, 0.09, 0]}><planeGeometry args={[0.014, 0.19]} /><meshBasicMaterial color="#1a1a1a" /></mesh></group>
    </group>
  )
}

export function Window({ z, mats }: { z: number; mats: Mats }) {
  return (
    <group position={[-W / 2 + 0.01, 2.35, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.01]}><planeGeometry args={[1.5, 1.9]} /><meshBasicMaterial map={mat('window').map} toneMapped={false} color="#e9f0f2" /></mesh>
      {/* Çərçivə və ara tirlər */}
      {[[0, 0.98, 1.62, 0.08], [0, -0.98, 1.62, 0.08], [-0.78, 0, 0.08, 2.0], [0.78, 0, 0.08, 2.0], [0, 0.2, 1.5, 0.05], [0, 0, 0.05, 1.9]].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x!, y!, 0.04]} material={mats.frame}><boxGeometry args={[w!, h!, 0.07]} /></mesh>
      ))}
      <mesh position={[0, -1.03, 0.1]} material={mats.frame}><boxGeometry args={[1.7, 0.05, 0.2]} /></mesh>
    </group>
  )
}

export function Classroom3D({ peers, raised, capacity }: { peers: Peer[]; raised: Set<string>; capacity: number }) {
  const ready = useSurfaces(NEEDED)
  const host = peers.find((p) => p.role === 'host') ?? peers.find((p) => p.role === 'cohost')
  const boardTrack = peers.find((p) => (p.role === 'host' || p.role === 'cohost') && p.screen)?.screen ?? host?.camera
  const texture = useVideoTexture(boardTrack)
  const seated = peers.filter((p) => p.role !== 'host' && p.role !== 'cohost' && p.seat !== null)
  const maxSeat = Math.max(0, ...seated.map((p) => p.seat!))
  const total = Math.min(Math.max(12, Math.ceil((maxSeat + 1) / CLASS_PER_ROW) * CLASS_PER_ROW), Math.max(capacity, maxSeat), 60)
  const bySeat = useMemo(() => new Map(seated.map((p) => [p.seat!, p])), [seated])
  // Detallı avatarlar limitlənir (hər biri ~15 mesh): mən, danışanlar və əl qaldıranlar həmişə detallıdır,
  // qalan yerlər sıra ilə dolur; artıq qalan tələbələr instanced "kütlə" kimi çəkilir (2 çəkiliş çağırışı).
  const DETAILED_MAX = 24
  const detailed = useMemo(() => {
    const prio = (p: Peer) => (p.isLocal ? 0 : p.speaking ? 1 : raised.has(p.identity) ? 2 : 3)
    const sorted = [...seated].sort((a, b) => prio(a) - prio(b) || a.seat! - b.seat!)
    return new Set(sorted.slice(0, DETAILED_MAX).map((p) => p.identity))
  }, [seated, raised])
  const crowd = useMemo(() => seated.filter((p) => !detailed.has(p.identity)).map((p) => {
    const pos = classroomSeat(p.seat!)
    return { id: p.identity, x: pos.x, z: pos.z + 0.2 }
  }), [seated, detailed])
  const rows = Math.ceil(total / CLASS_PER_ROW)
  // Otaq kameranın arxasına qədər uzanır (dar ekranda kamera geri çəkilir).
  const depth = 6 + rows * 1.5 + 14
  const backZ = -1.5 + rows * 1.5 + 2.6

  if (!ready) return <Loading />
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 55, position: [0, 3.6, backZ], near: 0.05, far: 80 }} gl={{ antialias: true, powerPreference: 'low-power' }}>
      <CameraRig backZ={backZ} />
      <Room depth={depth} total={total} />
      <Board texture={texture} mats={sharedMats()} />
      {host ? <group position={[2.55, 0, -3.75]} rotation={[0, Math.PI - 0.35, 0]}><Avatar id={host.identity} speaking={host.speaking} hand={false} me={host.isLocal} host standing /></group> : null}
      {Array.from({ length: total }, (_, i) => {
        const seat = i + 1
        const peer = bySeat.get(seat)
        if (!peer || !detailed.has(peer.identity)) return null
        const pos = classroomSeat(seat)
        return (
          <group key={peer.identity} position={[pos.x, 0, pos.z + 0.2]}>
            <Avatar id={peer.identity} speaking={peer.speaking} hand={raised.has(peer.identity)} me={peer.isLocal} />
          </group>
        )
      })}
      <SeatedCrowd people={crowd} />
    </Canvas>
  )
}

function makeMats() {
  return {
    wood: new THREE.MeshStandardMaterial({ ...mat('grain'), roughness: 0.55 }),
    darkWood: new THREE.MeshStandardMaterial({ ...mat('darkGrain'), roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: '#4a4f57', metalness: 0.7, roughness: 0.35 }),
    frame: new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.5 }),
    trim: new THREE.MeshStandardMaterial({ ...mat('darkGrain', 6, 1), roughness: 0.55 }),
  }
}
export type Mats = ReturnType<typeof makeMats>
let cachedMats: Mats | null = null
/** Səhnənin sabit materialları (bir dəfə yaradılır, səhnələr arasında paylaşılır). */
export function sharedMats(): Mats {
  return (cachedMats ??= makeMats())
}

/** Statik otaq: döşəmə, divarlar, tavan, pəncərələr, işıqlar, partalar. Peers dəyişəndə yenidən qurulmur. */
function Room({ depth, total }: { depth: number; total: number }) {
  const m = sharedMats()
  const zc = depth / 2 - 5, L = depth + 2
  const desks = useMemo(() => {
    const wood: BoxPart[] = [], metal: BoxPart[] = []
    for (let s = 1; s <= total; s++) { const { x, z } = classroomSeat(s); wood.push(...at(DESK_WOOD, x, z)); metal.push(...at(DESK_METAL, x, z)) }
    return { wood, metal }
  }, [total])
  const floor = useMemo(() => new THREE.MeshStandardMaterial({ ...mat('planks', W / 1.2, Math.round(L / 1.2)), roughness: 0.62, bumpScale: 1.5 }), [L])
  const wall = (len: number) => new THREE.MeshStandardMaterial({ ...mat('plaster', Math.round(len / 2.5), 1), roughness: 0.95, bumpScale: 0.6 })
  const sideWall = useMemo(() => wall(L), [L])
  const frontWall = useMemo(() => wall(W), [])
  const ceiling = useMemo(() => new THREE.MeshStandardMaterial({ ...mat('ceiling', Math.round(W / 1.2), Math.round(L / 1.2)), roughness: 1 }), [L])
  const panel = useMemo(() => new THREE.MeshStandardMaterial({ ...mat('grain', Math.round(L / 1.5), 1), roughness: 0.6 }), [L])
  useEffect(() => () => { [floor, sideWall, ceiling, panel].forEach((x) => x.dispose()) }, [floor, sideWall, ceiling, panel])
  useEffect(() => () => frontWall.dispose(), [frontWall])
  const sun = useRef<THREE.DirectionalLight>(null)
  useEffect(() => { if (sun.current) { sun.current.target.position.set(0, 0, 1); sun.current.target.updateMatrixWorld() } }, [])

  return (
    <>
      <color attach="background" args={['#13261f']} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#fff6e6', '#5a4230', 0.55]} />
      {/* Pəncərədən düşən günəş: yalnız bu işıq kölgə salır (kölgə xəritəsi 1024). */}
      <directionalLight ref={sun} position={[-9, 8, -1]} intensity={1.6} color="#fff0d8" castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-near={1} shadow-camera-far={30} />
      {[-2, 3, 8].map((z) => <pointLight key={z} position={[0, H - 0.4, z]} intensity={5} distance={11} decay={1.6} color="#fff3dc" />)}
      {[-2, 3, 8].flatMap((z) => [-2.2, 2.2].map((x) => (
        <mesh key={`${x}${z}`} position={[x, H - 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 0.3]} /><meshStandardMaterial color="#ffffff" emissive="#fff6dc" emissiveIntensity={1.2} side={THREE.DoubleSide} />
        </mesh>
      )))}

      {/* Döşəmə, tavan, divarlar */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, zc]} material={floor} receiveShadow><planeGeometry args={[W, L]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, zc]} material={ceiling}><planeGeometry args={[W, L]} /></mesh>
      <mesh position={[0, H / 2, -4.65]} material={frontWall} receiveShadow><planeGeometry args={[W, H]} /></mesh>
      <mesh position={[-W / 2, H / 2, zc]} rotation={[0, Math.PI / 2, 0]} material={sideWall}><planeGeometry args={[L, H]} /></mesh>
      <mesh position={[W / 2, H / 2, zc]} rotation={[0, -Math.PI / 2, 0]} material={sideWall} receiveShadow><planeGeometry args={[L, H]} /></mesh>
      {/* Taxta haşiyə (panel), qrunt plintus, kornis */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (W / 2 - 0.02), 0.5, zc]} rotation={[0, -s * Math.PI / 2, 0]} material={panel}><planeGeometry args={[L, 1]} /></mesh>
          <mesh position={[s * (W / 2 - 0.035), 1.02, zc]} material={m.trim}><boxGeometry args={[0.05, 0.05, L]} /></mesh>
          <mesh position={[s * (W / 2 - 0.03), 0.05, zc]} material={m.trim}><boxGeometry args={[0.04, 0.1, L]} /></mesh>
          <mesh position={[s * (W / 2 - 0.03), H - 0.05, zc]} material={m.frame}><boxGeometry args={[0.06, 0.1, L]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.5, -4.63]} material={panel}><planeGeometry args={[W, 1]} /></mesh>
      <mesh position={[0, 1.02, -4.6]} material={m.trim}><boxGeometry args={[W, 0.05, 0.05]} /></mesh>

      {/* Sol divarda pəncərələr */}
      {[-2.6, 0.6, 3.8, 7].map((z) => <Window key={z} z={z} mats={m} />)}
      {/* Sağ divarda elan lövhəsi */}
      <group position={[W / 2 - 0.02, 2.2, 0.5]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={m.darkWood}><boxGeometry args={[2.2, 1.3, 0.04]} /></mesh>
        <mesh position={[0, 0, 0.025]}><planeGeometry args={[2.05, 1.15]} /><meshStandardMaterial {...mat('cork', 2, 1)} roughness={1} /></mesh>
        {[[-0.6, 0.2, '#fff8d6', 0.08], [0.1, 0.25, '#ffffff', -0.05], [0.65, -0.1, '#d8ecff', 0.04], [-0.25, -0.25, '#ffe1e1', -0.07]].map(([x, y, c, r], i) => (
          <mesh key={i} position={[x as number, y as number, 0.03]} rotation={[0, 0, r as number]}><planeGeometry args={[0.42, 0.5]} /><meshStandardMaterial color={c as string} /></mesh>
        ))}
      </group>

      <Clock />
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
    </>
  )
}
