/** Veb video: livekit-client treki <video> elementinə bağlanır. */
import type { VideoTrack } from 'livekit-client'
import { useEffect, useRef } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

export function VideoTile({ track, style, mirror, fit = 'cover' }: { track: VideoTrack; style?: StyleProp<ViewStyle>; mirror?: boolean; fit?: 'cover' | 'contain' }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    track.attach(el)
    return () => { track.detach(el) }
  }, [track])
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <video ref={ref} autoPlay playsInline muted
        style={{ width: '100%', height: '100%', objectFit: fit, transform: mirror ? 'scaleX(-1)' : undefined, display: 'block' }} />
    </View>
  )
}
