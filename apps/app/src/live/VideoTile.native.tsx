/** Native video: @livekit/react-native VideoView. */
import { VideoView } from '@livekit/react-native'
import type { VideoTrack } from 'livekit-client'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

export function VideoTile({ track, style, mirror, fit = 'cover' }: { track: VideoTrack; style?: StyleProp<ViewStyle>; mirror?: boolean; fit?: 'cover' | 'contain' }) {
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <VideoView videoTrack={track} style={StyleSheet.absoluteFill} objectFit={fit} mirror={mirror} />
    </View>
  )
}
