/** Veb: LiveKit video trekini Three.js teksturasına çevirir (3D lövhə üçün). */
import type { VideoTrack } from 'livekit-client'
import { useEffect, useState } from 'react'
import * as THREE from 'three'

export function useVideoTexture(track: VideoTrack | undefined): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!track || typeof document === 'undefined') { setTex(null); return }
    const el = document.createElement('video')
    el.muted = true; el.playsInline = true; el.autoplay = true
    // LiveKit adaptiveStream görünməyən (DOM-da olmayan / 0 ölçülü) elementə yayımı dayandırır.
    // Element ekranda, şəffaf və toxunulmaz saxlanılır ki, keyfiyyət seçimi 320×180 ölçüsünə görə aparılsın.
    Object.assign(el.style, { position: 'fixed', right: '0', bottom: '0', width: '320px', height: '180px', opacity: '0', pointerEvents: 'none', zIndex: '-1' })
    el.setAttribute('aria-hidden', 'true')
    document.body.appendChild(el)
    track.attach(el)
    el.play().catch(() => {})
    const t = new THREE.VideoTexture(el)
    t.colorSpace = THREE.SRGBColorSpace
    setTex(t)
    return () => { track.detach(el); el.remove(); t.dispose(); setTex(null) }
  }, [track])
  return tex
}
