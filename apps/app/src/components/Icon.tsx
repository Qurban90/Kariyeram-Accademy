/**
 * Xətt ikonları (24 px tor, 1.75 xətt). Emoji əvəzinə işlənir: hər cihazda eyni görünür və rəngi mətndən gəlir.
 * Dekorativdir: ekran oxuyucusu üçün gizlidir, mənanı yanındakı mətn və ya düymənin etiketi daşıyır.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { usePalette } from './Theme'

type Shape = ['p', string] | ['c', number, number, number] | ['r', number, number, number, number, number]

const ICONS = {
  back: [['p', 'M15 5l-7 7 7 7']],
  chevron: [['p', 'M9 5l7 7-7 7']],
  plus: [['p', 'M12 5v14M5 12h14']],
  check: [['p', 'M5 12.5l4.5 4.5L19 7.5']],
  x: [['p', 'M6 6l12 12M18 6L6 18']],
  minus: [['p', 'M6 12h12']],
  compass: [['c', 12, 12, 9], ['p', 'M15.5 8.5l-2 5-5 2 2-5z']],
  door: [['p', 'M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17M4 21h16M14.5 12h.01']],
  stairs: [['p', 'M4 20h4v-4h4v-4h4V8h4']],
  book: [['p', 'M5 4.5A1.5 1.5 0 016.5 3H19v15H6.5A1.5 1.5 0 005 19.5v-15zM5 19.5A1.5 1.5 0 006.5 21H19']],
  bookOpen: [['p', 'M12 6c-2-1.5-4.5-2-8-2v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4c-3.5 0-6 .5-8 2zM12 6v14']],
  file: [['p', 'M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h6']],
  shuffle: [['p', 'M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 3.8c1.1 1.6 2.3 2.6 4.3 2.6H21M18 14l3 3-3 3M21 7h-3.5c-1.2 0-2.1.4-2.9 1.1M18 4l3 3-3 3M3 17h3.5c1.2 0 2.1-.4 2.9-1.1']],
  repeat: [['p', 'M4 11V9a3 3 0 013-3h12M16 3l3 3-3 3M20 13v2a3 3 0 01-3 3H5M8 21l-3-3 3-3']],
  timer: [['c', 12, 13, 8], ['p', 'M12 9v4l2.5 2M9.5 2.5h5']],
  lock: [['r', 5, 11, 14, 9, 2], ['p', 'M8 11V8a4 4 0 018 0v3']],
  trophy: [['p', 'M8 4h8v5a4 4 0 01-8 0V4zM8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M8.5 20h7']],
  medal: [['c', 12, 15, 5], ['p', 'M9.2 10.8L6.5 3h4L12 6.5 13.5 3h4l-2.7 7.8']],
  flame: [['p', 'M12 3c.6 3-1.4 4.6-3 6.6C7.8 11.1 7 12.7 7 14.6A5 5 0 0012 20a5 5 0 005-5.4c0-2-1-3.5-2-4.6-.3 1.2-1 2-2 2.5.4-3.2-.2-6.6-1-9.5z']],
  notebook: [['r', 6, 3, 13, 18, 2], ['p', 'M4 7h3M4 12h3M4 17h3M11 8h5M11 12h5']],
  key: [['c', 8, 15, 4], ['p', 'M11 12l8-8M16 7l2.5 2.5']],
  user: [['c', 12, 8, 4], ['p', 'M4.5 20a7.5 7.5 0 0115 0']],
  users: [['c', 9, 8, 3.5], ['p', 'M2.5 20a6.5 6.5 0 0113 0M16 4.8a3.5 3.5 0 010 6.4M18 14.2a6.5 6.5 0 013.5 5.8']],
  bell: [['p', 'M6 16v-5a6 6 0 0112 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 004 0']],
  alert: [['p', 'M12 4l9 16H3l9-16zM12 10v4.5M12 17.5h.01']],
  mic: [['r', 9, 3, 6, 11, 3], ['p', 'M5.5 11a6.5 6.5 0 0013 0M12 17.5V21']],
  micOff: [['r', 9, 3, 6, 11, 3], ['p', 'M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M4 4l16 16']],
  camera: [['r', 3, 7, 13, 10, 2], ['p', 'M16 10.5l5-2.5v8l-5-2.5']],
  screen: [['r', 3, 4, 18, 12, 2], ['p', 'M8 20h8M12 16v4']],
  hand: [['p', 'M8 12V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v8a7 7 0 01-7 7c-2.5 0-4-1-5.5-3.5L4 14.5a1.5 1.5 0 012.5-1.5L8 15']],
  chat: [['p', 'M4 5h16v11H9l-5 4V5z']],
  sliders: [['p', 'M5 4v6M5 14v6M12 4v2M12 10v10M19 4v9M19 17v3M3 12h4M10 8h4M17 15h4']],
  exit: [['p', 'M10 4H6a1 1 0 00-1 1v14a1 1 0 001 1h4M15 8l4 4-4 4M19 12H9']],
  phone: [['r', 7, 3, 10, 18, 2], ['p', 'M11 18h2']],
  mail: [['r', 3, 5, 18, 14, 2], ['p', 'M3.5 7l8.5 6 8.5-6']],
  volume: [['p', 'M4 10v4h3.5L12 18V6L7.5 10H4zM15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11']],
  ban: [['c', 12, 12, 9], ['p', 'M5.7 5.7l12.6 12.6']],
} as const satisfies Record<string, readonly Shape[]>

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 20, color, strokeWidth = 1.75 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const palette = usePalette()
  const shapes = ICONS[name] as readonly Shape[]
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? palette.ivory} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      {shapes.map((s, i) => s[0] === 'p' ? <Path key={i} d={s[1]} />
        : s[0] === 'c' ? <Circle key={i} cx={s[1]} cy={s[2]} r={s[3]} />
        : <Rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />)}
    </Svg>
  )
}
