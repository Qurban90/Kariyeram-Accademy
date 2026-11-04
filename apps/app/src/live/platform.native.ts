/**
 * Native (iOS/Android): LiveKit WebRTC qlobal obyektlərini qeydiyyatdan keçirir və audio sessiyanı idarə edir.
 * Uzaq səs native-də avtomatik oynayır; ekran paylaşma bu versiyada native-də yoxdur (ayrıca broadcast extension tələb edir).
 */
import { AudioSession, registerGlobals } from '@livekit/react-native'
import type { RemoteAudioTrack } from 'livekit-client'

export const supportsScreenShare = false

let registered = false
export function setupLiveKit(): void {
  if (registered) return
  registerGlobals()
  registered = true
}
export async function startAudioSession(): Promise<void> { await AudioSession.startAudioSession() }
export async function stopAudioSession(): Promise<void> { await AudioSession.stopAudioSession() }
export function attachAudio(_track: RemoteAudioTrack): void { /* native: avtomatik */ }
export function detachAudio(_track: RemoteAudioTrack): void { /* native: avtomatik */ }
