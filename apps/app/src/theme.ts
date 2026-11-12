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
