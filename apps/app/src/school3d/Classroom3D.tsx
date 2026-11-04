/**
 * 3D oxu zalı / sinif: müəllim lövhənin yanında, tələbələr partalarda (yer nömrəsi serverdən).
 * Danışan avatar işıqlanır və yüngül tərpənir, əl qaldıranın əli qalxır. Vebdə müəllimin ekranı/kamerası lövhəyə tekstura kimi çəkilir.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Peer } from '../live/useLiveRoom'
import { useVideoTexture } from '../live/videoTexture'
import { classroomSeat, colorFor, CLASS_PER_ROW } from './layout'

const WOOD = '#8a6342', BOARD = '#1d3b2f', WALL = '#e7dcc4', FLOOR = '#6e4b2e', BRASS = '#d4af5a'

function Avatar({ color, speaking, hand, me, host }: { color: string; speaking: boolean; hand: boolean; me: boolean; host?: boolean }) {
  const body = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime()
    if (body.current) body.current.position.y = speaking ? Math.abs(Math.sin(t * 9)) * 0.04 : 0
    if (arm.current) {
      const target = hand ? Math.PI * 0.95 : 0.15
      arm.current.rotation.z += (target - arm.current.rotation.z) * (1 - Math.exp(-8 * dt))
    }
    if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = speaking ? 0.55 + Math.sin(t * 8) * 0.25 : 0
  })
  return (
    <group ref={body}>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.2, 0.26, 0.6, 14]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.0, 0]}><sphereGeometry args={[0.17, 18, 18]} /><meshStandardMaterial color="#f1d3b3" /></mesh>
      <mesh ref={arm} position={[0.24, 0.72, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.07, 0.42, 0.07]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={glow} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.42, 32]} />
        <meshBasicMaterial color="#6cc28a" transparent opacity={0} />
      </mesh>
      {(me || host) && (
        <mesh position={[0, 1.32, 0]}><coneGeometry args={[0.07, 0.14, 4]} /><meshStandardMaterial color={host ? BRASS : '#ffffff'} emissive={host ? '#7a5a10' : '#555555'} /></mesh>
      )}
    </group>
  )
}

function Desk({ x, z, peer, hand }: { x: number; z: number; peer: Peer | null; hand: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.72, -0.35]}><boxGeometry args={[0.9, 0.05, 0.45]} /><meshStandardMaterial color={WOOD} /></mesh>
      {[-0.4, 0.4].map((dx) => (
        <mesh key={dx} position={[dx, 0.36, -0.35]}><boxGeometry args={[0.05, 0.72, 0.4]} /><meshStandardMaterial color="#5b4029" /></mesh>
      ))}
      <mesh position={[0, 0.42, 0.15]}><boxGeometry args={[0.45, 0.05, 0.4]} /><meshStandardMaterial color="#5b4029" /></mesh>
      {peer
        ? <group position={[0, 0.1, 0.15]} rotation={[0, Math.PI, 0]}><Avatar color={colorFor(peer.identity)} speaking={peer.speaking} hand={hand} me={peer.isLocal} /></group>
        : null}
    </group>
  )
}

/** Kamera: ekranın eninə görə uzaqlaşır ki, dar telefonda da bütün sıra görünsün. */
function CameraRig({ backZ }: { backZ: number }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const halfWidth = 4.4
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (size.width / Math.max(1, size.height)))
    const dist = Math.max(halfWidth / Math.tan(hHalf), 6)
    // Ön sıra (z = -1.5) bütün eni ilə görünməlidir; arxa sıralar perspektivlə daha da daralır.
    cam.position.set(0, 3.4 + Math.min(2, dist * 0.08), Math.max(backZ, -1.5 + dist))
    cam.lookAt(0, 1.1, -3)
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height, backZ])
  return null
}

function Board({ texture }: { texture: THREE.Texture | null }) {
  return (
    <group position={[0, 1.9, -4.5]}>
      <mesh><boxGeometry args={[4.6, 2.75, 0.1]} /><meshStandardMaterial color={WOOD} /></mesh>
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[4.3, 2.42]} />
        {texture ? <meshBasicMaterial map={texture} toneMapped={false} /> : <meshStandardMaterial color={BOARD} roughness={0.9} />}
      </mesh>
      <mesh position={[0, -1.42, 0.12]}><boxGeometry args={[4.3, 0.06, 0.16]} /><meshStandardMaterial color={WOOD} /></mesh>
    </group>
  )
}

export function Classroom3D({ peers, raised, capacity }: { peers: Peer[]; raised: Set<string>; capacity: number }) {
  const host = peers.find((p) => p.role === 'host') ?? peers.find((p) => p.role === 'cohost')
  const boardTrack = peers.find((p) => (p.role === 'host' || p.role === 'cohost') && p.screen)?.screen ?? host?.camera
  const texture = useVideoTexture(boardTrack)
  const seated = peers.filter((p) => p.role !== 'host' && p.role !== 'cohost' && p.seat !== null)
  const maxSeat = Math.max(0, ...seated.map((p) => p.seat!))
  const total = Math.min(Math.max(12, Math.ceil((maxSeat + 1) / CLASS_PER_ROW) * CLASS_PER_ROW), Math.max(capacity, maxSeat), 60)
  const bySeat = useMemo(() => new Map(seated.map((p) => [p.seat!, p])), [seated])
  const rows = Math.ceil(total / CLASS_PER_ROW)
  // Otaq kameranın arxasına qədər uzanır (dar ekranda kamera geri çəkilir).
  const depth = 6 + rows * 1.5 + 14

  return (
    <Canvas dpr={[1, 1.5]} camera={{ fov: 55, position: [0, 3.6, -1.5 + rows * 1.5 + 2.6], near: 0.05, far: 80 }} gl={{ antialias: true, powerPreference: 'low-power' }}>
      <CameraRig backZ={-1.5 + rows * 1.5 + 2.6} />
      <color attach="background" args={['#13261f']} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#fff4dc', '#3b2a1c', 0.5]} />
      <pointLight position={[0, 3.2, -2]} intensity={10} distance={14} color="#fff1d0" />
      <pointLight position={[0, 3.2, 3]} intensity={8} distance={14} color="#fff1d0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, depth / 2 - 5]}><planeGeometry args={[10, depth + 2]} /><meshStandardMaterial color={FLOOR} /></mesh>
      <mesh position={[0, 2.25, -4.65]}><planeGeometry args={[10, 4.5]} /><meshStandardMaterial color={WALL} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4.5, depth / 2 - 5]}><planeGeometry args={[10, depth + 2]} /><meshStandardMaterial color="#f3ecdc" side={THREE.DoubleSide} /></mesh>
      <mesh position={[-5, 2.25, depth / 2 - 5]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[depth + 2, 4.5]} /><meshStandardMaterial color={WALL} /></mesh>
      <mesh position={[5, 2.25, depth / 2 - 5]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[depth + 2, 4.5]} /><meshStandardMaterial color={WALL} /></mesh>
      <Board texture={texture} />
      {/* Müəllim masası və müəllim */}
      <mesh position={[2.9, 0.4, -3.2]}><boxGeometry args={[1.4, 0.8, 0.6]} /><meshStandardMaterial color={WOOD} /></mesh>
      {host ? <group position={[2.9, 0, -3.8]}><Avatar color={BRASS} speaking={host.speaking} hand={false} me={host.isLocal} host /></group> : null}
      {Array.from({ length: total }, (_, i) => {
        const seat = i + 1
        const pos = classroomSeat(seat)
        const peer = bySeat.get(seat) ?? null
        return <Desk key={seat} x={pos.x} z={pos.z} peer={peer} hand={!!peer && raised.has(peer.identity)} />
      })}
    </Canvas>
  )
}
