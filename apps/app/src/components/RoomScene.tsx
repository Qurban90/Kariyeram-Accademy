/**
 * Sinfin divarı: lampa işığında isti divar, taxta çərçivəli yazı lövhəsi, təbaşir rəfi və taxta panel.
 * Fənnin adı lövhəyə təbaşirlə yazılıb, otağın nömrəsi çərçivədəki mis lövhəcikdədir.
 * Şəkil faylı yoxdur: hamısı qradiyent və kölgə ilə çəkilir, ona görə hər ekranda kəskin qalır.
 */
import { StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { materials as m, radius, space, type } from '../theme'
import { Text } from './Text'

export function RoomScene({ number, name, note }: { number?: string; name: string; note?: string }) {
  return (
    <View style={st.wall} accessible accessibilityRole="header" accessibilityLabel={`${number ? `${number}. ` : ''}${name}${note ? `, ${note}` : ''}`}>
      <View style={st.lampGlow} />
      <View style={st.frame}>
        {number ? <View style={st.plate}><Text style={st.plateTxt}>{number}</Text></View> : null}
        <View style={st.slate}>
          <View style={[st.smudge, { top: '12%', left: '-8%', width: '62%', height: '46%', transform: [{ rotate: '-9deg' }] }]} />
          <View style={[st.smudge, { bottom: '4%', right: '-10%', width: '70%', height: '52%', transform: [{ rotate: '7deg' }] }]} />
          <Text style={st.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{name}</Text>
          <Svg width={132} height={10} viewBox="0 0 132 10" style={{ opacity: 0.78 }} aria-hidden>
            <Path d="M3 6.2C22 2.6 41 7.6 60 4.8S101 2.4 129 5.4" stroke={m.chalk} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          </Svg>
          {note ? <Text style={st.note} numberOfLines={2}>{note}</Text> : null}
        </View>
      </View>
      <View style={st.tray}>
        <View style={[st.chalkStick, { backgroundColor: m.chalk, width: 26 }]} />
        <View style={[st.chalkStick, { backgroundColor: '#F1D98A', width: 18 }]} />
        <View style={st.eraser}><View style={st.eraserFelt} /></View>
      </View>
      <View style={st.wainscot}>
        <View style={st.molding} />
        <View style={st.panels}>
          {[0, 1, 2, 3].map((i) => <View key={i} style={st.panel} />)}
        </View>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  wall: {
    borderRadius: radius.lg, overflow: 'hidden', paddingTop: space.xl + 6, alignItems: 'center',
    backgroundColor: m.wallShade,
    backgroundImage: `radial-gradient(ellipse at 50% -10%, #FFFBF0 0%, ${m.wallLight} 38%, ${m.wallShade} 78%, #D6C8AD 100%)`,
    boxShadow: '0px 1px 2px rgba(74,52,18,0.14), 0px 14px 30px rgba(74,52,18,0.14)',
  },
  lampGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 90, backgroundImage: 'linear-gradient(180deg, rgba(255,214,128,0.28) 0%, rgba(255,214,128,0) 100%)' },
  frame: {
    width: '88%', padding: 9, borderRadius: 6,
    backgroundColor: m.walnut,
    backgroundImage: `linear-gradient(175deg, ${m.walnutLight} 0%, ${m.walnut} 38%, #5A3719 72%, ${m.walnutDeep} 100%)`,
    boxShadow: '0px 2px 3px rgba(40,24,8,0.35), 0px 16px 26px rgba(40,24,8,0.30)',
  },
  plate: {
    position: 'absolute', top: -11, alignSelf: 'center', zIndex: 2, paddingHorizontal: 12, paddingVertical: 2, borderRadius: 3,
    backgroundColor: m.brass, backgroundImage: `linear-gradient(180deg, #E6C676 0%, ${m.brass} 45%, ${m.brassDeep} 100%)`,
    borderWidth: 1, borderColor: 'rgba(60,40,6,0.55)', boxShadow: '0px 2px 4px rgba(40,24,8,0.4)',
  },
  plateTxt: { color: '#2A1D05', fontFamily: type.displayBold, fontSize: 13, letterSpacing: 1.2, fontVariant: ['tabular-nums'] },
  slate: {
    minHeight: 138, borderRadius: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: space.lg, paddingVertical: space.xl,
    backgroundColor: m.slate,
    backgroundImage: `linear-gradient(158deg, #2C463B 0%, ${m.slate} 42%, ${m.slateDeep} 100%)`,
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.42)',
    boxShadow: 'inset 0px 3px 10px rgba(0,0,0,0.45)',
  },
  smudge: { position: 'absolute', borderRadius: 999, backgroundImage: 'radial-gradient(ellipse at 50% 50%, rgba(242,238,227,0.085) 0%, rgba(242,238,227,0) 70%)' },
  name: { color: m.chalk, fontFamily: type.displayItalic, fontSize: 31, lineHeight: 37, textAlign: 'center', textShadowColor: 'rgba(242,238,227,0.28)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  note: { color: m.chalkDim, fontFamily: type.medium, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 2 },
  tray: {
    width: '88%', height: 10, marginTop: -1, flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingLeft: '14%',
    backgroundColor: m.walnutDeep, backgroundImage: `linear-gradient(180deg, ${m.walnutLight} 0%, ${m.walnut} 35%, ${m.walnutDeep} 100%)`,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4, boxShadow: '0px 7px 10px rgba(40,24,8,0.28)',
  },
  chalkStick: { height: 5, marginTop: -4, borderRadius: 2.5, boxShadow: '0px 1px 1px rgba(0,0,0,0.35)' },
  eraser: { width: 34, height: 9, marginTop: -8, marginLeft: 'auto', marginRight: '12%', borderRadius: 2, backgroundColor: '#3A2A1A', boxShadow: '0px 1px 2px rgba(0,0,0,0.4)' },
  eraserFelt: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: '#B9B2A2' },
  wainscot: {
    alignSelf: 'stretch', height: 46, marginTop: space.xl,
    backgroundColor: m.walnut, backgroundImage: `linear-gradient(180deg, ${m.walnutLight} 0%, ${m.walnut} 30%, #57351A 100%)`,
  },
  molding: { height: 5, backgroundImage: 'linear-gradient(180deg, #B98556 0%, #8A5C36 55%, #3B220D 100%)' },
  panels: { flex: 1, flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  panel: { flex: 1, borderRadius: 2, borderWidth: 1, borderTopColor: 'rgba(30,16,4,0.5)', borderLeftColor: 'rgba(30,16,4,0.45)', borderRightColor: 'rgba(214,170,120,0.22)', borderBottomColor: 'rgba(214,170,120,0.25)', backgroundColor: 'rgba(40,22,8,0.10)' },
})
