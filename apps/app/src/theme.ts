/**
 * Vizual dil loqodan gəlir: gecə fonu, fil sümüyü mətn və tək vurğu kimi qızılı işıq
 * (müəllimin tələbənin yoluna tutduğu fənər). Qızılı yalnız "növbəti addım"ı göstərən yerlərdə işlənir.
 * Kontrast WCAG AA (mətn ≥ 4.5:1) üçün seçilib.
 */
export const colors = {
  night: '#0B0A09',          // əsas fon
  nightDeep: '#060505',      // giriş sahələri, çökək səthlər
  surface: '#141210',        // kart
  surfaceHi: '#1C1916',      // qaldırılmış səth, seçilmiş sətir
  surfaceTop: '#26221C',     // ən üst qat (modal)
  line: '#2B2620',           // incə xətt
  lineStrong: '#3F382E',
  ivory: '#F6EDE0',          // əsas mətn (night üzərində 16.6:1)
  ivoryDim: '#BDB2A2',       // ikinci dərəcəli mətn (9.3:1)
  ivoryFaint: '#8F8577',     // üçüncü dərəcəli mətn (5.4:1)
  gold: '#E9B23C',           // işıq: əsas düymə, seçim, irəliləyiş
  goldBright: '#F7CE73',
  goldDeep: '#B5801A',
  goldWash: 'rgba(233,178,60,0.12)',
  goldLine: 'rgba(233,178,60,0.42)',
  onGold: '#1B1305',         // qızılı üzərində mətn
  ok: '#8CCBA0',
  okWash: 'rgba(140,203,160,0.12)',
  bad: '#EC8272',
  badWash: 'rgba(236,130,114,0.12)',
  badSolid: '#A63A2C',       // təhlükəli düymə (ağ mətn 6:1)
  warn: '#E89A5B',
  trap: '#C8A2E8',           // tələli sual
  live: '#EF6351',
  overlay: 'rgba(4,3,2,0.78)',

  // Köhnə adlar (ekranlar tədricən yeni adlara keçir).
  board: '#0B0A09',
  boardDeep: '#060505',
  boardLine: '#2B2620',
  panel: '#141210',
  chalk: '#F6EDE0',
  chalkDim: '#BDB2A2',
  brass: '#E9B23C',
  brassDeep: '#B5801A',
  wood: '#1C1916',
  woodLight: '#3F382E',
  ink: '#1B1305',
} as const

export type Palette = { readonly [K in keyof typeof colors]: string }

/**
 * İşıqlı sinif palitrası: qapının arxası. Dəhliz gecədir, otağın içi isə lampa işığında isti divar,
 * kağız və taxtadır. Fənn otağı, test, nəticə və konspekt ekranları bu palitra ilə açılır (bax components/Theme.tsx).
 * Açar adları `colors` ilə eynidir: "ivory" burada tünd mürəkkəb, "night" isə divardır.
 */
export const roomColors: Palette = {
  night: '#F0E7D6',          // divar
  nightDeep: '#FCF8F0',      // giriş sahələri (ağ kağız)
  surface: '#FBF6EC',        // kağız vərəq
  surfaceHi: '#F3EADA',
  surfaceTop: '#FFFDF8',
  line: '#E1D5BF',
  lineStrong: '#C9B998',
  ivory: '#221B11',          // əsas mətn (divar üzərində 13.9:1)
  ivoryDim: '#5A4F3F',       // 6.6:1
  ivoryFaint: '#75684F',     // 4.6:1
  gold: '#B07A12',           // seçim, ikon (qrafik element: 3.4:1)
  goldBright: '#7E5507',     // qızılı mətn (6.1:1)
  goldDeep: '#7E5507',
  goldWash: 'rgba(176,122,18,0.13)',
  goldLine: 'rgba(176,122,18,0.5)',
  onGold: '#1B1305',
  ok: '#256E45',
  okWash: 'rgba(37,110,69,0.12)',
  bad: '#A8392A',
  badWash: 'rgba(168,57,42,0.1)',
  badSolid: '#A63A2C',
  warn: '#9A5516',
  trap: '#6E44A6',
  live: '#C8402F',
  overlay: 'rgba(34,27,17,0.55)',

  board: '#F0E7D6',
  boardDeep: '#FCF8F0',
  boardLine: '#E1D5BF',
  panel: '#FBF6EC',
  chalk: '#221B11',
  chalkDim: '#5A4F3F',
  brass: '#B07A12',
  brassDeep: '#7E5507',
  wood: '#F3EADA',
  woodLight: '#C9B998',
  ink: '#1B1305',
}

/** Sinifdəki real materiallar (yazı lövhəsi, taxta, mis): illüstrasiyalar üçün. */
export const materials = {
  slate: '#22362E', slateDeep: '#182821', slateLine: 'rgba(240,236,224,0.16)',
  chalk: '#F2EEE3', chalkDim: 'rgba(242,238,227,0.72)',
  walnut: '#6B4426', walnutLight: '#8A5C36', walnutDeep: '#42270F',
  wallLight: '#F7F0E2', wallShade: '#E4D8C2',
  brass: '#C9A14A', brassDeep: '#8E6B21',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const
export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 } as const

/** Şrift ailələri: başlıqlar Fraunces (loqodakı serif xarakteri), mətn Hanken Grotesk. Hər çəki ayrı fayldır. */
export const type = {
  display: 'Fraunces_500Medium',
  displayBold: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_500Medium_Italic',
  body: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semibold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
} as const

export const font = {
  display: 34, title: 28, h2: 22, h3: 17, body: 16, small: 14, tiny: 12,
  serif: type.display as string,
} as const

/** Toxunma hədəfi ən azı 44×44 (iOS HIG, WCAG 2.5.5). */
export const touch = 44

export const motion = { fast: 120, base: 200, slow: 360 } as const

/** Təkrar işlənən işıq və kölgə effektləri (RN 0.88 və veb: backgroundImage, boxShadow). */
export const fx = {
  goldFill: 'linear-gradient(180deg, #F5CB6A 0%, #E2A62E 100%)',
  goldGlow: '0px 10px 28px rgba(233,178,60,0.22)',
  /** Fənər şüası: kartın küncündən düşən isti işıq. */
  beam: 'linear-gradient(135deg, rgba(233,178,60,0.22) 0%, rgba(233,178,60,0.05) 42%, rgba(233,178,60,0) 68%)',
  lamp: 'radial-gradient(ellipse at 50% 0%, rgba(233,178,60,0.16) 0%, rgba(233,178,60,0.04) 45%, rgba(233,178,60,0) 70%)',
  sheen: 'linear-gradient(180deg, rgba(246,237,224,0.045) 0%, rgba(246,237,224,0) 46%)',
  lift: '0px 14px 40px rgba(0,0,0,0.55)',
} as const

/** Palitraya görə səth effektləri: gecədə işıq parıltısı, işıqlı otaqda kağızın yumşaq kölgəsi. */
export function fxOf(c: Palette) {
  const light = c === roomColors
  return {
    light,
    sheen: light ? 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 60%)' : fx.sheen,
    beam: light ? 'linear-gradient(135deg, rgba(233,178,60,0.3) 0%, rgba(233,178,60,0.08) 46%, rgba(233,178,60,0) 72%)' : fx.beam,
    cardShadow: light ? '0px 1px 2px rgba(74,52,18,0.10), 0px 10px 24px rgba(74,52,18,0.09)' : 'none',
    goldGlow: light ? '0px 6px 16px rgba(160,108,10,0.28)' : fx.goldGlow,
    lift: light ? '0px 18px 48px rgba(52,36,12,0.28)' : fx.lift,
    focusRing: light ? '0px 0px 0px 3px rgba(176,122,18,0.22)' : '0px 0px 0px 3px rgba(233,178,60,0.16)',
  }
}

type Weight = string | number | undefined

function weightNum(w: Weight): number {
  if (w === 'bold') return 700
  if (w === 'normal' || w === undefined) return 400
  const n = Number(w)
  return Number.isFinite(n) ? n : 400
}

/**
 * Xüsusi şriftlərdə hər çəki ayrı ailədir: `fontWeight` brauzerə saxta qalınlıq çəkdirir,
 * native-də isə ümumiyyətlə işləmir. Bu funksiya (ailə, çəki, kursiv) üçlüyünü düzgün fayla çevirir.
 * Tanımadığı ailəyə (məs. monospace) toxunmur.
 */
export function resolveFont(family: string | undefined, weight: Weight, italic?: boolean): { fontFamily: string; fontWeight: 'normal'; fontStyle: 'normal' } | null {
  const w = weightNum(weight)
  const isDisplay = family?.startsWith('Fraunces')
  const isBody = !family || family.startsWith('HankenGrotesk') || family === 'System'
  if (!isDisplay && !isBody) return null
  const fontFamily = isDisplay
    ? (italic ? type.displayItalic : w >= 600 ? type.displayBold : type.display)
    : (w >= 700 ? type.bold : w >= 600 ? type.semibold : w >= 500 ? type.medium : type.body)
  return { fontFamily, fontWeight: 'normal', fontStyle: 'normal' }
}

/**
 * 2.5D məktəb səhnəsinin rəngləri (bina, dəhliz, sinif). Gecə: soyuq göy və isti fənər işığı;
 * içəri: lampa işığında isti divar, ceviz taxta, yaşıl yazı lövhəsi. Yalnız illüstrasiya üçündür, mətn rəngi deyil.
 */
export const scene = {
  skyTop: '#070A14', skyMid: '#111626', skyLow: '#2A2117', star: '#F3E9D6', moon: '#F6EDE0',
  stone: '#2B241C', stoneLit: '#3A3024', stoneDark: '#1A1511', cornice: '#463A2C', column: '#3C3226',
  glass: '#FFD98C', glassDim: '#5A4630', glassOff: '#1E1913', warm: '#FFC768', warmCore: '#FFF1CF',
  ground: '#120F0C', path: '#2A2219', leaf: '#0A0C0A', post: '#15120F',
  plaster: '#3B3127', plasterLit: '#5A4A38', plasterDark: '#241D16', wainscot: '#2E2017', rail: '#6B4426',
  floor: '#3A2A1C', floorLine: 'rgba(0,0,0,0.28)', ceiling: '#2A231C', lamp: '#FFE7B0', doorLeaf: '#4A2F1B', doorFrame: '#2A1A0E',
  sign: '#1E1712', signText: '#F6EDE0', live: '#EF6351',
  roomWall: '#EFE4CF', roomWallShade: '#D9C9AC', roomFloor: '#8A6744', roomFloorDark: '#6E5034', roomCeiling: '#F6EEDF',
  board: '#22362E', boardRim: '#6B4426', chalk: '#F2EEE3', desk: '#9A6B40', deskTop: '#B27D4B', deskDark: '#5E3E22', chair: '#4A3423',
  inkDim: '#5A4F3F', stickyInk: '#3E3424', spine: '#7A4B3A',
  suit: '#33424F', trousers: '#2A2A33', shirt: '#F2EEE3', skin: '#D9A982', hairDark: '#3A2A1E', white: '#FFFDF5', mine: '#FFD27A',
  window: '#1B2436', windowLit: '#2E3B57', paper: '#FFFDF6', paperShade: '#EDE4D2', sticky: '#F7DC74', stickyShade: '#E9C64E', ink: '#221B11',
} as const
