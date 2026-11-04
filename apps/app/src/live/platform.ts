/**
 * Veb platforması: brauzerdə LiveKit üçün əlavə qurulum lazım deyil.
 * Uzaq səs treklərini gizli <audio> elementinə bağlayırıq (brauzer avtomatik oynatmır).
 */
import type { RemoteAudioTrack } from 'livekit-client'

export const supportsScreenShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices

export function setupLiveKit(): void { /* veb: lazım deyil */ }
export async function startAudioSession(): Promise<void> { /* veb: lazım deyil */ }
export async function stopAudioSession(): Promise<void> { /* veb: lazım deyil */ }

let holder: HTMLDivElement | null = null
export function attachAudio(track: RemoteAudioTrack): void {
  if (typeof document === 'undefined') return
  if (!holder) {
    holder = document.createElement('div')
    holder.style.display = 'none'
    holder.setAttribute('aria-hidden', 'true')
    document.body.appendChild(holder)
  }
  const el = track.attach()
  el.dataset.lk = track.sid ?? ''
  holder.appendChild(el)
}
export function detachAudio(track: RemoteAudioTrack): void {
  track.detach().forEach((el) => el.remove())
}
