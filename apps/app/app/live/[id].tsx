/**
 * Oxu zalı (canlı dərs). Müəllim (host) səhnədə/lövhədə: kamera və ya ekran paylaşma.
 * Tələbələr partalarda (oturacaq nömrəsi serverdə verilir). Əl qaldırma, söz vermə, "yalnız host danışır", chat.
 * Bütün icazələr serverdə dəyişir (Edge API → DB → LiveKit); klient yalnız göstərir.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, ErrorBox, Loading, P } from '../../src/components/ui'
import { t } from '../../src/i18n/az'
import { deskCount, initials, isHostRole, seatMap } from '../../src/live/model'
import { supportsScreenShare } from '../../src/live/platform'
import { useLiveRoom, type Peer } from '../../src/live/useLiveRoom'
import { VideoTile } from '../../src/live/VideoTile'
import { api, ApiFailure, type Hand, type LiveJoin } from '../../src/lib/api'
import { useAuth } from '../../src/lib/auth'
import { supabase } from '../../src/lib/supabase'
import { colors, font, radius, space, touch } from '../../src/theme'

interface ChatMsg { id: number; user_id: string | null; body: string; created_at: string }

export default function LiveRoom() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session: auth } = useAuth()
  const me = auth?.user.id
  const qc = useQueryClient()
  const lk = useLiveRoom()
  const { width } = useWindowDimensions()
  const wide = width >= 900

  const [join, setJoin] = useState<LiveJoin | null>(null)
  const [joinErr, setJoinErr] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hand, setHand] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [panel, setPanel] = useState<'none' | 'chat' | 'host'>('none')
  const [onlyHost, setOnlyHost] = useState(true)
  const [chatOn, setChatOn] = useState(true)

  const info = useQuery({
    queryKey: ['live-session', id],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('live_sessions')
        .select('id, title, state, host_id, starts_at, only_host_audio, chat_enabled, venues(capacity, name)').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return data as { id: string; title: string; state: string; host_id: string | null; starts_at: string; only_host_audio: boolean; chat_enabled: boolean; venues: { capacity: number; name: string } | null } | null
    },
  })

  // Qoşulma: server icazəni yoxlayır və LiveKit tokeni verir.
  const doJoin = useCallback(async () => {
    setJoinErr(null)
    try {
      const j = await api.liveJoin(id)
      setJoin(j); setOnlyHost(j.onlyHostAudio); setChatOn(j.chatEnabled)
      await lk.connect(j.url, j.token)
    } catch (e) {
      setJoinErr(e instanceof ApiFailure ? e.message : String(e))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useEffect(() => { void doJoin() }, [doJoin])

  const leave = useCallback(async () => {
    await lk.disconnect()
    await api.liveLeave(id).catch(() => {})
    await qc.invalidateQueries({ queryKey: ['live-sessions'] })
    if (router.canGoBack()) router.back(); else router.replace('/live')
  }, [id, lk, qc])

  const myRole = lk.state.me?.role ?? join?.role ?? 'audience'
  const amHost = isHostRole(myRole)
  const isMainHost = info.data?.host_id === me

  // Rol dəyişəndə (söz verildi/alındı) bildiriş və əl vəziyyəti.
  const prevRole = useRef(myRole)
  useEffect(() => {
    if (prevRole.current !== myRole) {
      if (myRole === 'speaker') { setNotice(t.live.youCanSpeak); setHand(false) }
      if (myRole === 'audience' && prevRole.current === 'speaker') setNotice(null)
      prevRole.current = myRole
    }
  }, [myRole])

  // Öz əlimin vəziyyəti (host rədd edə bilər): qaldırılıbsa hər 5 saniyədən bir yoxla.
  useEffect(() => {
    if (!hand || !me) return
    const tick = setInterval(async () => {
      const { data } = await supabase.from('live_hands').select('id').eq('session_id', id).eq('user_id', me).is('resolved_at', null).limit(1)
      if (data && data.length === 0) setHand(false)
    }, 5000)
    return () => clearInterval(tick)
  }, [hand, id, me])

  // Host: əl qaldıranlar növbəsi
  const hands = useQuery({
    queryKey: ['hands', id],
    enabled: amHost && lk.state.status === 'connected',
    refetchInterval: 3000,
    queryFn: async () => (await api.hands(id)).hands,
  })

  const act = async (f: () => Promise<unknown>) => {
    setErr(null)
    try { await f() } catch (e) { setErr(e instanceof ApiFailure ? e.message : String(e)) }
  }

  const toggleHand = () => act(async () => {
    if (hand) { await api.lowerHand(id); setHand(false) } else { await api.raiseHand(id); setHand(true) }
  })

  const state = info.data?.state ?? join?.state ?? 'scheduled'
  const capacity = info.data?.venues?.capacity ?? 30

  if (joinErr) {
    return (
      <SafeAreaView style={st.screen}>
        <View style={{ padding: space.lg, gap: space.lg }}>
          <ErrorBox message={joinErr} onRetry={doJoin} />
          <Button variant="quiet" label={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/live'))} />
        </View>
      </SafeAreaView>
    )
  }
  if (!join || lk.state.status === 'connecting' || lk.state.status === 'idle') return <SafeAreaView style={st.screen}><Loading /></SafeAreaView>

  if (lk.state.status === 'ended' || lk.state.status === 'removed' || state === 'ended' || state === 'cancelled') {
    return (
      <SafeAreaView style={st.screen}>
        <View style={{ padding: space.xl, gap: space.lg, alignItems: 'center' }}>
          <Text style={{ fontSize: 48 }}>{lk.state.status === 'removed' ? '🚪' : '🔔'}</Text>
          <P>{lk.state.status === 'removed' ? t.live.removed : t.live.ended}</P>
          <Button label={t.common.back} onPress={leave} />
        </View>
      </SafeAreaView>
    )
  }

  const peers = lk.state.peers
  const hostPeer = peers.find((p) => p.role === 'host') ?? peers.find((p) => p.role === 'cohost')
  const screenPeer = peers.find((p) => isHostRole(p.role) && p.screen)
  const seated = peers.filter((p) => !isHostRole(p.role))
  const desks = seatMap(seated, deskCount(capacity, seated.map((p) => p.seat ?? 0).filter(Boolean)))
  const raised = new Set((hands.data ?? []).map((h) => h.user_id))
  if (hand && me) raised.add(me)

  const stage = (
    <View style={st.board} accessibilityLabel={t.live.title}>
      {screenPeer?.screen ? (
        <VideoTile track={screenPeer.screen} fit="contain" style={StyleSheet.absoluteFill} />
      ) : hostPeer?.camera ? (
        <VideoTile track={hostPeer.camera} mirror={hostPeer.isLocal} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={st.boardEmpty}>
          <Text style={st.boardTitle}>{join.title}</Text>
          <Text style={st.boardSub}>{hostPeer ? t.live.stageEmpty : t.live.waitingHost}</Text>
        </View>
      )}
      {screenPeer?.screen && hostPeer?.camera ? (
        <VideoTile track={hostPeer.camera} mirror={hostPeer.isLocal} style={st.pip} />
      ) : null}
      {hostPeer && (
        <View style={[st.hostTag, hostPeer.speaking && { borderColor: colors.brass }]}>
          <Text style={st.hostTagTxt}>{hostPeer.micOn ? '🎙' : '🔇'} {hostPeer.name} · {t.live.host}</Text>
        </View>
      )}
      {state === 'live' && <View style={st.liveDot}><Text style={st.liveDotTxt}>● {t.live.liveNow}</Text></View>}
    </View>
  )

  const seats = (
    <View style={st.floor}>
      <View style={st.desks}>
        {desks.map(({ seat, peer }) => (
          <Desk key={seat} seat={seat} peer={peer} raised={!!peer && raised.has(peer.identity)} />
        ))}
      </View>
    </View>
  )

  return (
    <SafeAreaView style={st.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={st.top}>
        <Text style={st.title} numberOfLines={1}>{join.title}</Text>
        <Text style={st.count}>{peers.length} 👤</Text>
      </View>
      {lk.state.status === 'reconnecting' && <Banner text={t.live.reconnecting} />}
      {state === 'scheduled' && !amHost && <Banner text="Dərs hələ başlamayıb. Müəllim başladanda səs və görüntü gələcək." />}
      {lk.state.audioBlocked && <Pressable onPress={lk.startAudio} accessibilityRole="button" style={st.audioBtn}><Text style={{ color: colors.ink, fontWeight: '800' }}>🔊 Səsi aç</Text></Pressable>}
      {notice && <Banner text={notice} tone="ok" />}
      {(err || lk.state.error) && <View style={{ paddingHorizontal: space.md }}><ErrorBox message={err || lk.state.error} onRetry={err ? undefined : lk.clearError} /></View>}

      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
          {stage}
          {seats}
        </ScrollView>
        {panel !== 'none' && (
          <View style={[st.side, wide ? { width: 360, borderLeftWidth: 1 } : { height: 320, borderTopWidth: 1 }]}>
            {panel === 'chat' ? (
              <ChatPanel session={id} enabled={chatOn} peers={peers} me={me} />
            ) : (
              <HostPanel
                session={id} state={state} isMainHost={isMainHost} onlyHost={onlyHost} chatOn={chatOn} hands={hands.data ?? []} peers={peers}
                onState={(s) => act(async () => { await api.setState(id, s); await info.refetch() })}
                onSettings={(x) => act(async () => { const r = await api.settings(id, x); setOnlyHost(r.onlyHostAudio); setChatOn(r.chatEnabled) })}
                onRole={(target, role) => act(async () => { await api.setRole(id, target, role); await hands.refetch() })}
                onBan={(target) => act(async () => { await api.ban(id, target); await hands.refetch() })}
              />
            )}
          </View>
        )}
      </View>

      <View style={st.controls} accessibilityRole="toolbar">
        {lk.state.canPublish && (
          <Ctl testID="ctl-mic" icon={lk.state.me?.micOn ? '🎙' : '🔇'} label={lk.state.me?.micOn ? t.live.mic : t.live.micOff} on={!!lk.state.me?.micOn} onPress={lk.toggleMic} />
        )}
        {amHost && <Ctl testID="ctl-cam" icon="📷" label={t.live.cam} on={!!lk.state.me?.camera} onPress={lk.toggleCamera} />}
        {amHost && supportsScreenShare && <Ctl testID="ctl-screen" icon="🖥" label={t.live.screen} on={!!lk.state.me?.screen} onPress={lk.toggleScreen} />}
        {!amHost && <Ctl testID="ctl-hand" icon="✋" label={hand ? t.live.lower : t.live.raise} on={hand} onPress={toggleHand} />}
        <Ctl testID="ctl-chat" icon="💬" label={t.live.chat} on={panel === 'chat'} onPress={() => setPanel(panel === 'chat' ? 'none' : 'chat')} />
        {amHost && <Ctl testID="ctl-host" icon="🎛" label={t.live.host} on={panel === 'host'} onPress={() => setPanel(panel === 'host' ? 'none' : 'host')} badge={(hands.data ?? []).length} />}
        <Ctl testID="ctl-leave" icon="🚪" label={t.live.leave} danger onPress={leave} />
      </View>
    </SafeAreaView>
  )
}

function Banner({ text, tone = 'warn' }: { text: string; tone?: 'warn' | 'ok' }) {
  return (
    <View style={[st.banner, { borderColor: tone === 'ok' ? colors.ok : colors.warn }]} accessibilityLiveRegion="polite">
      <Text style={{ color: colors.chalk, fontSize: font.small }}>{text}</Text>
    </View>
  )
}

function Ctl({ icon, label, on, onPress, danger, testID, badge }: { icon: string; label: string; on?: boolean; onPress: () => void; danger?: boolean; testID?: string; badge?: number }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} aria-selected={!!on}
      style={({ pressed }) => [st.ctl, on && { backgroundColor: '#2f5a45' }, danger && { backgroundColor: '#7a2a22' }, pressed && { opacity: 0.8 }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={st.ctlTxt} numberOfLines={1}>{label}</Text>
      {badge ? <View style={st.badge}><Text style={{ color: colors.ink, fontSize: 11, fontWeight: '900' }}>{badge}</Text></View> : null}
    </Pressable>
  )
}

function Desk({ seat, peer, raised }: { seat: number; peer: Peer | null; raised: boolean }) {
  return (
    <View style={st.desk} accessibilityLabel={peer ? `${t.live.seat(seat)}: ${peer.name}${peer.isLocal ? ` (${t.live.you})` : ''}` : t.live.seat(seat)}>
      <View style={[st.avatar, !peer && st.avatarEmpty, peer?.speaking && st.speaking, peer?.isLocal && { borderColor: colors.brass }]}>
        {peer ? <Text style={st.avatarTxt}>{initials(peer.name)}</Text> : <Text style={st.seatNo}>{seat}</Text>}
        {raised && <Text style={st.handIcon}>✋</Text>}
        {peer?.role === 'speaker' && <Text style={st.micIcon}>{peer.micOn ? '🎙' : '🔇'}</Text>}
      </View>
      <View style={st.deskTop} />
      <Text style={st.deskName} numberOfLines={1}>{peer ? (peer.isLocal ? t.live.you : peer.name.split(' ')[0]) : ''}</Text>
    </View>
  )
}

function HostPanel({ state, isMainHost, onlyHost, chatOn, hands, peers, onState, onSettings, onRole, onBan }: {
  session: string; state: string; isMainHost: boolean; onlyHost: boolean; chatOn: boolean; hands: Hand[]; peers: Peer[]
  onState: (s: 'live' | 'ended') => void; onSettings: (x: { onlyHostAudio?: boolean; chatEnabled?: boolean }) => void
  onRole: (target: string, role: 'speaker' | 'audience' | 'cohost') => void; onBan: (target: string) => void
}) {
  const others = peers.filter((p) => !p.isLocal && p.role !== 'host')
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      {state === 'scheduled' && <Button testID="host-start" label={t.live.start} onPress={() => onState('live')} />}
      {state === 'live' && <Button testID="host-end" variant="danger" label={t.live.end} onPress={() => onState('ended')} />}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button testID="host-onlyhost" small variant={onlyHost ? 'primary' : 'quiet'} label={`${t.live.onlyHost}: ${onlyHost ? t.common.yes : t.common.no}`} onPress={() => onSettings({ onlyHostAudio: !onlyHost })} />
        <Button small variant={chatOn ? 'primary' : 'quiet'} label={`${t.live.chatOn}: ${chatOn ? t.common.yes : t.common.no}`} onPress={() => onSettings({ chatEnabled: !chatOn })} />
      </View>
      {onlyHost && <P dim small>"Yalnız host danışır" açıq olanda söz verilmiş tələbə də danışa bilmir. Söz vermək üçün əvvəlcə bunu söndürün.</P>}

      <Text style={st.panelH}>{t.live.hands} ({hands.length})</Text>
      {hands.length === 0 && <P dim small>{t.live.noHands}</P>}
      {hands.map((h, i) => (
        <View key={h.user_id} style={st.row} testID={`hand-${i}`}>
          <Text style={st.rowTxt} numberOfLines={1}>{i + 1}. {h.name}{h.seat ? ` · ${t.live.seat(h.seat)}` : ''}</Text>
          <Button small label={t.live.grant} onPress={() => onRole(h.user_id, 'speaker')} />
          <Button small variant="quiet" label={t.live.dismiss} onPress={() => onRole(h.user_id, 'audience')} />
        </View>
      ))}

      <Text style={st.panelH}>{t.live.participants} ({others.length})</Text>
      {others.map((p) => (
        <View key={p.identity} style={st.row}>
          <Text style={st.rowTxt} numberOfLines={1}>{p.name}{p.seat ? ` · ${p.seat}` : ''}{p.role !== 'audience' ? ` · ${p.role}` : ''}</Text>
          {p.role === 'speaker' && <Button small variant="quiet" label={t.live.revoke} onPress={() => onRole(p.identity, 'audience')} />}
          {isMainHost && p.role !== 'cohost' && <Button small variant="quiet" label="Köməkçi" onPress={() => onRole(p.identity, 'cohost')} />}
          {p.role !== 'host' && <Button small variant="danger" label={t.live.remove} onPress={() => onBan(p.identity)} />}
        </View>
      ))}
    </ScrollView>
  )
}

function ChatPanel({ session, enabled, peers, me }: { session: string; enabled: boolean; peers: Peer[]; me?: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const names = useMemo(() => new Map(peers.map((p) => [p.identity, p.isLocal ? t.live.you : p.name])), [peers])

  const merge = useCallback((list: ChatMsg[]) => {
    setMsgs((prev) => {
      const by = new Map(prev.map((m) => [m.id, m]))
      for (const m of list) by.set(m.id, m)
      return [...by.values()].sort((a, b) => a.id - b.id).slice(-200)
    })
  }, [])

  useEffect(() => {
    let alive = true
    const load = () => supabase.from('live_chat').select('id, user_id, body, created_at').eq('session_id', session).order('id', { ascending: false }).limit(50)
      .then(({ data }) => { if (alive && data) merge(data as ChatMsg[]) })
    void load()
    // Realtime: RLS tətbiq olunur, yalnız iştirakçılar alır. Abunə qurulanda aradakı mesajları yenidən oxuyuruq (yarış boşluğu).
    const ch = supabase.channel(`chat:${session}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat', filter: `session_id=eq.${session}` }, (payload) => {
        merge([payload.new as ChatMsg])
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') void load() })
    return () => { alive = false; void supabase.removeChannel(ch) }
  }, [session, merge])

  const send = async () => {
    const b = text.trim()
    if (!b) return
    setErr(null)
    try {
      const r = await api.chat(session, b)
      setText('')
      // Öz mesajımızı dərhal göstəririk (realtime gecikə bilər); eyni id gələndə təkrarlanmır.
      if (typeof r.id === 'number' && me) merge([{ id: r.id, user_id: me, body: b, created_at: new Date().toISOString() }])
    } catch (e) { setErr(e instanceof ApiFailure ? e.message : String(e)) }
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={msgs} keyExtractor={(m) => String(m.id)} contentContainerStyle={{ padding: space.md, gap: space.sm }}
        renderItem={({ item }) => (
          <View>
            <Text style={{ color: colors.brass, fontSize: font.tiny, fontWeight: '700' }}>{(item.user_id && names.get(item.user_id)) || 'İştirakçı'}</Text>
            <Text style={{ color: colors.chalk, fontSize: font.small }}>{item.body}</Text>
          </View>
        )}
      />
      {err ? <View style={{ paddingHorizontal: space.sm }}><ErrorBox message={err} /></View> : null}
      <View style={st.chatBar}>
        <TextInput testID="chat-input" style={st.chatInput} value={text} onChangeText={setText} placeholder={enabled ? t.live.chatPh : t.live.chatOn + ': ' + t.common.no}
          placeholderTextColor="#7f8f86" editable={enabled} maxLength={500} onSubmitEditing={send} accessibilityLabel={t.live.chatPh} />
        <Button testID="chat-send" small label={t.live.send} onPress={send} disabled={!enabled || !text.trim()} />
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.boardDeep },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, minHeight: 48, gap: space.sm },
  title: { flex: 1, color: colors.chalk, fontWeight: '800', fontSize: font.h3 },
  count: { color: colors.chalkDim, fontWeight: '700' },
  banner: { marginHorizontal: space.md, marginBottom: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.panel },
  audioBtn: { alignSelf: 'center', backgroundColor: colors.brass, paddingHorizontal: space.lg, minHeight: touch, justifyContent: 'center', borderRadius: radius.pill, marginBottom: space.sm },
  board: { aspectRatio: 16 / 9, width: '100%', maxWidth: 1100, alignSelf: 'center', backgroundColor: '#1d3b2f', borderWidth: 10, borderColor: colors.woodLight, borderRadius: radius.sm, overflow: 'hidden' },
  boardEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.sm },
  boardTitle: { color: colors.chalk, fontSize: font.h2, fontFamily: font.serif, textAlign: 'center' },
  boardSub: { color: colors.chalkDim, fontSize: font.small, textAlign: 'center' },
  pip: { position: 'absolute', right: 8, bottom: 8, width: '24%', aspectRatio: 4 / 3, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.brass },
  hostTag: { position: 'absolute', left: 8, bottom: 8, backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4, borderWidth: 2, borderColor: 'transparent' },
  hostTagTxt: { color: colors.chalk, fontSize: font.tiny, fontWeight: '700' },
  liveDot: { position: 'absolute', left: 8, top: 8, backgroundColor: colors.bad, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  liveDotTxt: { color: '#fff', fontSize: font.tiny, fontWeight: '900' },
  floor: { backgroundColor: '#3a2a1c', borderRadius: radius.md, padding: space.md, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  desks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md },
  desk: { width: 72, alignItems: 'center', gap: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.panel, borderWidth: 3, borderColor: colors.boardLine, alignItems: 'center', justifyContent: 'center' },
  avatarEmpty: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: '#6b5440' },
  speaking: { borderColor: colors.ok, shadowColor: colors.ok, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  avatarTxt: { color: colors.chalk, fontWeight: '800' },
  seatNo: { color: '#8f7660', fontSize: font.tiny },
  handIcon: { position: 'absolute', top: -10, right: -12, fontSize: 18 },
  micIcon: { position: 'absolute', bottom: -6, right: -10, fontSize: 13 },
  deskTop: { width: 64, height: 10, backgroundColor: colors.woodLight, borderRadius: 2 },
  deskName: { color: colors.chalkDim, fontSize: 11, maxWidth: 72 },
  side: { backgroundColor: colors.board, borderColor: colors.boardLine },
  panelH: { color: colors.chalk, fontWeight: '800', fontSize: font.body, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  rowTxt: { color: colors.chalk, flex: 1, minWidth: 120, fontSize: font.small },
  controls: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: space.sm, padding: space.sm, borderTopWidth: 1, borderTopColor: colors.boardLine, backgroundColor: colors.board },
  ctl: { minWidth: 64, minHeight: 56, paddingHorizontal: space.sm, borderRadius: radius.md, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  ctlTxt: { color: colors.chalk, fontSize: 11, fontWeight: '600' },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brass, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  chatBar: { flexDirection: 'row', gap: space.sm, padding: space.sm, borderTopWidth: 1, borderTopColor: colors.boardLine, alignItems: 'center' },
  chatInput: { flex: 1, minHeight: touch, color: colors.chalk, backgroundColor: colors.boardDeep, borderRadius: radius.md, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.boardLine },
})
