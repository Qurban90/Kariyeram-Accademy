/** Native: WebRTC kadrlarını expo-gl teksturasına ötürmək bu versiyada yoxdur; 3D lövhə boş qalır, 2D səhnə videonu göstərir. */
import type { VideoTrack } from 'livekit-client'
import type * as THREE from 'three'

export function useVideoTexture(_track: VideoTrack | undefined): THREE.Texture | null {
  return null
}
