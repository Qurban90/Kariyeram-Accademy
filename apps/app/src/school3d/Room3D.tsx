/**
 * 3D fənn otağı: tam ekran sinif. Tələbə özü gəzir, istədiyi partaya oturur və pəncərə (mövzular, test, konspekt) açılır.
 * Pəncərə bağlananda tələbə partada oturmuş qalır, ətrafa baxa və ya ayağa qalxa bilər.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '../components/Text'
import { Button, Icon, Loading, P, RoomTheme, Sheet, usePalette, useSheet } from '../components/ui'
import { t } from '../i18n/az'
import { colors as night, font, materials, radius, space, touch, type, type Palette } from '../theme'
import { GLBoundary } from './Corridor3D'
import { finePointer, Hud, HudButton, Rise, useToast } from './Hud'
import { WalkPad } from './WalkPad'
import { deskAisle, DESKS, deskSeat, ROOM, roomTargets, roomWalk, ROOM_START, routeToDesk, Walker, type Desk, type PickFn } from './walk'

const StudyRoom = lazy(() => import('./StudyRoom').then((m) => ({ default: m.StudyRoom })))

const deskOf = (id: string | null): Desk | null => (id?.startsWith('desk:') ? DESKS.find((d) => d.no === Number(id.slice(5))) ?? null : null)

export function Room3D({ roomNo, name, active, children, onExit, onSimple, onFail }: {
  roomNo: string; name: string
  /** Ekran fokusdadır (test açıq olanda çəkiliş dayanır). */
  active: boolean
  /** Pəncərənin içi (otağın məzmunu). */
  children: ReactNode
  onExit: () => void; onSimple: () => void; onFail: () => void
}) {
  const walker = useMemo(() => { const w = roomWalk(); return new Walker(ROOM_START, w.areas, w.blocks) }, [])
  const targets = useMemo(() => roomTargets(), [])
  const pick = useRef<PickFn | null>(null)
  const [near, setNear] = useState<string | null>(null)
  const [seat, setSeat] = useState<Desk | null>(null)
  const [busy, setBusy] = useState(false)
  const [win, setWin] = useState(false)
  const [menu, setMenu] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [low, setLow] = useState(false)
  const [coach, setCoach] = useState(true)
  const [toast, showToast] = useToast()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { const id = setTimeout(() => setCoach(false), 7000); return () => { clearTimeout(id); if (timer.current) clearTimeout(timer.current) } }, [])
  useEffect(() => { walker.frozen = win || menu }, [win, menu, walker])

  const nearDesk = deskOf(near)
  const sitAt = (d: Desk) => {
    if (walker.mode !== 'walk' || busy) return
    setMenu(false); setBusy(true)
    walker.walkTo(routeToDesk(walker, d), undefined, () => walker.sit(deskSeat(d), () => { setSeat(d); setBusy(false); setWin(true) }))
  }
  const closest = () => DESKS.reduce((a, b) => (Math.hypot(b.x - walker.x, b.z - walker.z) < Math.hypot(a.x - walker.x, a.z - walker.z) ? b : a))
  const standUp = (then?: () => void) => {
    if (!seat || busy) return
    setWin(false); setBusy(true)
    walker.stand(deskAisle(seat), () => { setSeat(null); setBusy(false); then?.() })
  }
  /** Qapıya gedir və dəhlizə çıxır. Oturubsa əvvəl ayağa qalxır. */
  const exit = () => {
    if (busy) return
    setMenu(false)
    if (seat) standUp(walkOut)
    else walkOut()
  }
  // Yalnız oyunçunun canlı vəziyyətinə baxır (ayağa qalxandan sonra köhnə render-in dəyərləri ilə çağırıla bilər).
  const walkOut = () => {
    if (walker.mode !== 'walk') return
    setBusy(true)
    walker.walkTo([{ x: ROOM.doorX, z: ROOM.back - 0.95 }], Math.PI, () => {
      setExitOpen(true)
      timer.current = setTimeout(() => { onExit(); setExitOpen(false); setBusy(false) }, 600)
    })
  }
  const shelf = () => {
    if (seat) { setWin(true); return }
    if (walker.mode !== 'walk' || busy) return
    setBusy(true)
    walker.walkTo([{ x: -1.0, z: ROOM.back - 1.7 }, { x: -2.6, z: ROOM.back - 1.45 }], Math.PI, () => { setBusy(false); setWin(true) })
  }
  const onTap = (nx: number, ny: number) => {
    const act = pick.current?.(nx, ny)
    if (!act) return
    if (act === 'exit') exit()
    else if (act === 'shelf') shelf()
    else if (seat) setWin(true) // oturanda lövhəyə və ya partaya toxunmaq pəncərəni açır
    else if (act === 'board') sitAt(nearDesk ?? closest())
    else { const d = deskOf(act); if (d) sitAt(d) }
  }

  const hint = seat ? t.walk.seatedHint : finePointer ? t.walk.roomHintKeys : t.walk.roomHintTouch
  return (
    <View style={st.wrap}>
      <View style={StyleSheet.absoluteFill} testID="room-3d">
        <GLBoundary onFail={onFail}>
          <Suspense fallback={<Loading label={t.walk.building} />}>
            <StudyRoom roomNo={roomNo} mark={busy ? null : nearDesk} seat={seat} exitOpen={exitOpen} walker={walker} targets={targets}
              onNear={setNear} pick={pick} low={low} active={active} onSlow={() => { setLow(true); showToast(t.walk.lowAuto) }} />
          </Suspense>
        </GLBoundary>
      </View>
      <WalkPad walker={walker} onTap={onTap} enabled={active && !win && !menu} testID="room-pad" />
      {!win ? (
        <Hud menuTestID="room-menu-open" hint={hint} onMenu={() => setMenu(true)} toast={toast} showStick={coach && !finePointer && !seat}>
          {busy ? null : seat ? (<>
            <HudButton testID="stand-up" ghost icon="stairs" label={t.walk.stand} onPress={() => standUp()} />
            <HudButton testID="open-window" icon="book" sub={t.walk.windowSub} label={t.walk.window} onPress={() => setWin(true)} />
          </>) : (<>
            {near === 'exit' ? <HudButton testID="exit-room" ghost icon="exit" label={t.walk.exit} onPress={exit} /> : null}
            {near === 'shelf' ? <HudButton testID="open-shelf" ghost icon="book" sub={t.walk.shelfSub} label={t.walk.shelf} onPress={shelf} /> : null}
            {nearDesk
              ? <HudButton testID="sit-desk" icon="door" sub={t.walk.desk(nearDesk.no)} label={t.walk.sit} onPress={() => sitAt(nearDesk)} />
              : <HudButton testID="sit-desk" icon="compass" sub={t.walk.nearestDesk} label={t.walk.goDesk} onPress={() => sitAt(closest())} />}
          </>)}
        </Hud>
      ) : null}

      <DeskWindow visible={win} keep={!!seat} kicker={`${t.walk.room(roomNo)}${seat ? ` · ${t.walk.desk(seat.no)}` : ''}`} title={name} onClose={() => setWin(false)}>
        {children}
      </DeskWindow>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={`${roomNo} · ${name}`} testID="room-menu">
        <P dim small>{t.walk.roomMenuLead}</P>
        <Button testID="menu-exit" icon="exit" label={t.walk.exit} onPress={exit} />
        <View style={st.row}>
          <Button testID="room-toggle-low" small variant="ghost" style={{ flex: 1 }} label={low ? t.walk.lowOn : t.walk.lowOff} onPress={() => setLow(!low)} />
          <Button testID="room-toggle-3d" small variant="ghost" style={{ flex: 1 }} label={t.hall.view2d} onPress={() => { setMenu(false); onSimple() }} />
        </View>
        <P dim small>{t.walk.lowNote}</P>
      </Sheet>
    </View>
  )
}

/**
 * Partada açılan pəncərə: taxta çərçivəli vərəq. Telefonda aşağıdan qalxır, enli ekranda mərkəzdə dayanır.
 * `keep`: bağlı olanda da içi yaddaşda qalır (seçilmiş mövzular itməsin).
 */
function DeskWindow({ visible, keep, kicker, title, onClose, children }: {
  visible: boolean; keep: boolean; kicker: string; title: string; onClose: () => void; children: ReactNode
}) {
  const { width } = useWindowDimensions()
  const ins = useSafeAreaInsets()
  const wide = width >= 720
  if (!visible && !keep) return null
  return (
    <View style={[StyleSheet.absoluteFill, st.scrim, wide ? { justifyContent: 'center', alignItems: 'center', padding: space.xl } : { justifyContent: 'flex-end' }, !visible && { display: 'none' }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
      {visible ? (
        <Rise style={[st.frame, wide ? st.frameWide : [st.frameNarrow, { paddingBottom: 0 }]]}>
          <RoomTheme><WindowBody kicker={kicker} title={title} onClose={onClose} bottom={wide ? 0 : ins.bottom}>{children}</WindowBody></RoomTheme>
        </Rise>
      ) : (
        <View style={st.frame}><RoomTheme><WindowBody kicker={kicker} title={title} onClose={onClose} bottom={0}>{children}</WindowBody></RoomTheme></View>
      )}
    </View>
  )
}

function WindowBody({ kicker, title, onClose, bottom, children }: { kicker: string; title: string; onClose: () => void; bottom: number; children: ReactNode }) {
  const colors = usePalette()
  const s = useSheet(makeW)
  return (
    <View testID="desk-window" style={s.paper} role="dialog" aria-modal aria-label={title} accessibilityViewIsModal>
      <View style={s.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.kicker}>{kicker}</Text>
          <Text style={s.title} accessibilityRole="header" numberOfLines={2}>{title}</Text>
        </View>
        <Pressable testID="window-close" accessibilityRole="button" accessibilityLabel={t.common.close} onPress={onClose} hitSlop={8}
          style={({ pressed }) => [s.close, pressed && { backgroundColor: colors.line }]}>
          <Icon name="x" size={18} color={colors.ivoryDim} />
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, paddingBottom: space.xl + bottom }} style={{ flexShrink: 1 }}>
        {children}
      </ScrollView>
    </View>
  )
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: night.nightDeep },
  row: { flexDirection: 'row', gap: 12 },
  scrim: { backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 12%, rgba(0,0,0,0.5) 100%)' },
  // Taxta çərçivə: sinifdəki lövhənin çərçivəsi ilə eyni ağac.
  frame: {
    maxHeight: '86%', padding: 6, backgroundColor: materials.walnut,
    backgroundImage: `linear-gradient(175deg, ${materials.walnutLight} 0%, ${materials.walnut} 40%, ${materials.walnutDeep} 100%)`,
    boxShadow: '0px -12px 44px rgba(0,0,0,0.55)',
  },
  frameNarrow: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, width: '100%' },
  frameWide: { borderRadius: radius.lg + 4, width: '100%', maxWidth: 580 },
})

const makeW = (c: Palette) => StyleSheet.create({
  paper: { flexShrink: 1, backgroundColor: c.night, borderRadius: radius.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  kicker: { color: c.goldBright, fontSize: font.tiny, letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: type.bold },
  title: { color: c.ivory, fontFamily: type.displayBold, fontSize: font.h2, lineHeight: 27 },
  close: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceHi },
})
