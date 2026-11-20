/**
 * Kursun binası (çöldən): gecə meydançası, işıqlı pəncərələr, fənərlər və giriş qapısı.
 * Avtomatik rejim: kamera özü binaya yaxınlaşır (GTA tərzi giriş), qapı açılır və dəhlizə keçid verilir.
 * Yüngül səhnə: ~40 mesh, 2 nöqtəvi işıq; emissiv pəncərələr işıq əvəzi görünür.
 */
import { useFrame } from '@react-three/fiber'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { colors, materials } from '../theme'

const WIN_COLS = [-6.4, -4.4, -2.4, 2.4, 4.4, 6.4]
const WIN_ROWS = [3.4, 5.6]

function Facade({ doorOpen }: { doorOpen: MutableRefObject<number> }) {
  const door = useRef<THREE.Group>(null)
  useFrame(() => { if (door.current) door.current.rotation.y = -doorOpen.current * 1.25 })
  const winMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2018', emissive: '#ffdf9e', emissiveIntensity: 1.15 }), [])
  const winDark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#171310', emissive: '#3a2c1c', emissiveIntensity: 0.35 }), [])
  useEffect(() => () => { winMat.dispose(); winDark.dispose() }, [winMat, winDark])
  return (
    <group>
      {/* Əsas kütlə */}
      <mesh position={[0, 4, -1.2]}><boxGeometry args={[16, 8, 2.4]} /><meshStandardMaterial color="#241b12" roughness={0.95} /></mesh>
      {/* Ön pilləkən */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.12 + i * 0.12, 1.6 - i * 0.5]}><boxGeometry args={[5 - i * 0.6, 0.24, 1.4 - i * 0.3]} /><meshStandardMaterial color="#3a2e20" roughness={0.9} /></mesh>
      ))}
      {/* Pəncərələr: bəziləri işıqlı */}
      {WIN_ROWS.flatMap((y, r) => WIN_COLS.map((x, c) => (
        <mesh key={`${r}-${c}`} position={[x, y, 0.02]} material={(r + c) % 3 === 0 ? winDark : winMat}><planeGeometry args={[1.3, 1.5]} /></mesh>
      )))}
      {/* Giriş portalı + qapı */}
      <mesh position={[0, 1.5, 0.06]}><boxGeometry args={[2.6, 3, 0.18]} /><meshStandardMaterial color={materials.walnut} roughness={0.8} /></mesh>
      <group position={[-0.95, 0, 0.16]} ref={door}>
        <mesh position={[0.95, 1.4, 0]}><boxGeometry args={[1.9, 2.8, 0.1]} /><meshStandardMaterial color={materials.walnutLight} roughness={0.7} /></mesh>
        <mesh position={[1.65, 1.4, 0.07]}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color={colors.gold} metalness={0.8} roughness={0.3} /></mesh>
      </group>
      {/* Fənərlər */}
      {([-1.9, 1.9] as const).map((x) => (
        <group key={x} position={[x, 2.6, 0.3]}>
          <mesh><sphereGeometry args={[0.14, 12, 10]} /><meshStandardMaterial color="#fff6da" emissive="#ffca66" emissiveIntensity={2.2} /></mesh>
          <pointLight intensity={5} distance={9} decay={1.6} color="#ffca66" />
        </group>
      ))}
      {/* Lövhə: ad (emissiv zolaq) */}
      <mesh position={[0, 7.1, 0.05]}><boxGeometry args={[9, 0.9, 0.12]} /><meshStandardMaterial color="#1d1710" emissive="#e9b23c" emissiveIntensity={0.5} /></mesh>
    </group>
  )
}

function Dolly({ onDone, onReady }: { onDone: () => void; onReady?: () => void }) {
  const t = useRef(0)
  const fired = useRef(false)
  const ready = useRef(0)
  const doorOpen = useRef(0)
  useFrame((state, delta) => {
    if (++ready.current === 2) onReady?.()
    const dt = Math.min(delta, 0.1)
    t.current += dt
    const T = 6.2
    const k = Math.min(1, t.current / T)
    const e = k * k * (3 - 2 * k) // smoothstep
    const cam = state.camera
    cam.position.set(Math.sin(k * 1.6) * 1.2 * (1 - e), 2.4 - e * 0.8, 16 - e * 12.6)
    cam.lookAt(0, 2.6 - e * 1.0, 0)
    if (k >= 1) doorOpen.current = Math.min(1, doorOpen.current + dt * 1.4)
    if (doorOpen.current >= 1 && !fired.current) { fired.current = true; onDone() }
  })
  return <Facade doorOpen={doorOpen} />
}

export function Exterior3D({ active, onDone, onReady, low }: { active: boolean; onDone: () => void; onReady?: () => void; low?: boolean }) {
  return (
    <Canvas frameloop={active ? 'always' : 'never'} dpr={low ? 1 : [1, 1.5]} camera={{ fov: 62, near: 0.1, far: 90, position: [0, 2.4, 16] }} gl={{ antialias: !low, powerPreference: 'low-power' }}>
      <color attach="background" args={['#0b0a09']} />
      <fog attach="fog" args={['#0b0a09', 20, 60]} />
      <ambientLight intensity={0.22} />
      <hemisphereLight args={['#2a2418', '#0b0a09', 0.5]} />
      <directionalLight position={[6, 12, 8]} intensity={0.5} color="#bcd0ff" />
      {/* Meydança */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 8]}><planeGeometry args={[70, 50]} /><meshStandardMaterial color="#151009" roughness={1} /></mesh>
      {/* Yol zolağı */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 8]}><planeGeometry args={[3, 26]} /><meshStandardMaterial color="#241b12" roughness={0.95} /></mesh>
      <Dolly onDone={onDone} onReady={onReady} />
    </Canvas>
  )
}