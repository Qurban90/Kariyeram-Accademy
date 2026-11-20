/**
 * LiveKit otağına qoşulma və vəziyyətin React-ə ötürülməsi. livekit-client həm vebdə, həm native-də işləyir
 * (native-də əvvəlcə registerGlobals çağırılır). İcazələr serverdə verilir: klient yalnız tokenin icazə verdiyini edə bilər.
 */
import { t } from '../i18n/az'
import {
  ConnectionState, DisconnectReason, Room, RoomEvent, Track,
  type Participant, type RemoteAudioTrack, type RemoteTrack, type VideoTrack,
} from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isHostRole, parseMeta, type LiveRole, type PeerMeta } from './model'
import { attachAudio, detachAudio, setupLiveKit, startAudioSession, stopAudioSession } from './platform'

export interface Peer {
  identity: string
  name: string
  role: LiveRole
  seat: number | null
  isLocal: boolean
  speaking: boolean
  micOn: boolean
  camera?: VideoTrack
  screen?: VideoTrack
}

export type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'removed' | 'error'

export interface LiveRoomState {
  status: Status
  error: string | null
  peers: Peer[]
  me: Peer | null
  canPublish: boolean
  canScreen: boolean
  audioBlocked: boolean
}

const initial: LiveRoomState = { status: 'idle', error: null, peers: [], me: null, canPublish: false, canScreen: false, audioBlocked: false }

function videoOf(p: Participant, source: Track.Source): VideoTrack | undefined {
  const pub = p.getTrackPublication(source)
  const tr = pub && !pub.isMuted ? pub.track : undefined
  return tr && tr.kind === Track.Kind.Video ? (tr as VideoTrack) : undefined
}

export function useLiveRoom() {
  const roomRef = useRef<Room | null>(null)
  const metaCache = useRef(new Map<string, PeerMeta>())
  const [state, setState] = useState<LiveRoomState>(initial)
  // Token vaxtı bitəndə avtomatik yenidən qoşulma: serverdən təzə token alan funksiya (çağırışçı verir).
  const rejoinRef = useRef<(() => Promise<{ url: string; token: string }>) | null>(null)
  const autoTried = useRef(false)

  const snapshot = useCallback((status?: Status) => {
    const room = roomRef.current
    if (!room) return
    const speaking = new Set(room.activeSpeakers.map((p) => p.identity))
    const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()]
    const peers: Peer[] = all.map((p) => {
      const meta = parseMeta(p.metadata, metaCache.current.get(p.identity))
      metaCache.current.set(p.identity, meta)
      return {
        identity: p.identity, name: p.name || t.system.participant, role: meta.role, seat: meta.seat,
        isLocal: p === room.localParticipant, speaking: speaking.has(p.identity), micOn: p.isMicrophoneEnabled,
        camera: videoOf(p, Track.Source.Camera), screen: videoOf(p, Track.Source.ScreenShare),
      }
    })
    const me = peers.find((p) => p.isLocal) ?? null
    const perms = room.localParticipant.permissions
    setState((s) => ({
      ...s,
      status: status ?? s.status,
      peers, me,
      canPublish: perms?.canPublish ?? false,
      canScreen: !!me && isHostRole(me.role) && (perms?.canPublish ?? false),
      audioBlocked: !room.canPlaybackAudio,
    }))
  }, [])

  const connect = useCallback(async (url: string, token: string, rejoin?: () => Promise<{ url: string; token: string }>): Promise<void> => {
    if (roomRef.current) return
    if (rejoin) rejoinRef.current = rejoin
    setupLiveKit()
    setState({ ...initial, status: 'connecting' })
    const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true })
    roomRef.current = room
    const refresh = () => snapshot()
    room
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, (p) => { metaCache.current.delete(p.identity); refresh() })
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => { if (track.kind === Track.Kind.Audio) attachAudio(track as RemoteAudioTrack); refresh() })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => { if (track.kind === Track.Kind.Audio) detachAudio(track as RemoteAudioTrack); refresh() })
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, refresh)
      .on(RoomEvent.ParticipantMetadataChanged, refresh)
      .on(RoomEvent.ParticipantNameChanged, refresh)
      .on(RoomEvent.ParticipantPermissionsChanged, refresh)
      .on(RoomEvent.AudioPlaybackStatusChanged, refresh)
      .on(RoomEvent.ConnectionStateChanged, (cs: ConnectionState) => {
        if (cs === ConnectionState.Reconnecting) snapshot('reconnecting')
        else if (cs === ConnectionState.Connected) snapshot('connected')
      })
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (roomRef.current === room) roomRef.current = null // yenidən qoşulmağa imkan ver
        room.removeAllListeners()
        const status: Status = reason === DisconnectReason.PARTICIPANT_REMOVED ? 'removed'
          : reason === DisconnectReason.ROOM_DELETED ? 'ended'
          : reason === DisconnectReason.CLIENT_INITIATED ? 'idle' : 'error'
        // Token müddəti bitibsə (uzun dərs, şəbəkə qopması): bir dəfə təzə tokenlə avtomatik qayıt.
        if (status === 'error' && rejoinRef.current && !autoTried.current) {
          autoTried.current = true
          setState((s) => ({ ...s, status: 'reconnecting', error: null }))
          void (async () => {
            try {
              const c = await rejoinRef.current!()
              await connect(c.url, c.token)
            } catch {
              setState({ ...initial, status: 'error', error: t.system.disconnected })
            }
          })()
          return
        }
        setState((s) => ({ ...s, status, error: status === 'error' ? t.system.disconnected : null }))
      })
    try {
      await startAudioSession()
      await room.connect(url, token, { autoSubscribe: true })
      autoTried.current = false
      snapshot('connected')
    } catch (e) {
      roomRef.current = null
      await stopAudioSession().catch(() => {})
      // İlk qoşulma tokenə görə uğursuz olduysa bir dəfə təzə tokenlə yoxla.
      if (rejoinRef.current && !autoTried.current) {
        autoTried.current = true
        try {
          const c = await rejoinRef.current()
          await connect(c.url, c.token)
          return
        } catch { /* aşağıdakı xəta ekranı */ }
      }
      setState({ ...initial, status: 'error', error: t.system.liveConnectFailed((e as Error).message) })
    }
  }, [snapshot])

  const disconnect = useCallback(async () => {
    const room = roomRef.current
    roomRef.current = null
    if (room) await room.disconnect()
    await stopAudioSession().catch(() => {})
  }, [])

  useEffect(() => () => { void disconnect() }, [disconnect])

  const run = useCallback(async (f: (room: Room) => Promise<unknown>) => {
    const room = roomRef.current
    if (!room) return
    try { await f(room) } catch (e) { setState((s) => ({ ...s, error: (e as Error).message })) }
    snapshot()
  }, [snapshot])

  return {
    state,
    connect,
    disconnect,
    toggleMic: () => run((r) => r.localParticipant.setMicrophoneEnabled(!r.localParticipant.isMicrophoneEnabled)),
    toggleCamera: () => run((r) => r.localParticipant.setCameraEnabled(!r.localParticipant.isCameraEnabled)),
    toggleScreen: () => run((r) => r.localParticipant.setScreenShareEnabled(!r.localParticipant.isScreenShareEnabled, { audio: false })),
    startAudio: () => run((r) => r.startAudio()),
    clearError: () => setState((s) => ({ ...s, error: null })),
  }
}
