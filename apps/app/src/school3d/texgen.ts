/**
 * Prosedur teksturalar: saf funksiyalar (DOM, Canvas və WebGL-siz). Vebdə və native-də (expo-gl) eyni nəticə verir,
 * şəkil faylı yükləmir, ona görə tətbiqin ölçüsü artmır və şəbəkə gözlənmir. Hamısı deterministikdir (eyni toxum = eyni piksel).
 *
 * Piksel sətirləri WebGL qaydası ilə aşağıdan yuxarı yazılır (sətir 0 = şəklin altı), ona görə DataTexture-da flipY lazım deyil.
 * Təkrarlanan teksturalar (döşəmə, divar) "plitəli"dir: sol və sağ, alt və üst kənar bir-birinə uyur, tikiş görünmür.
 */
export interface Pixels { width: number; height: number; data: Uint8Array }
export interface Surface { color: Pixels; bump?: Pixels }

type RGB = [number, number, number]

/** Toxumlu PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Plitəli dəyər küyü: qəfəs (px, py) periodu ilə bükülür. Nəticə [0, 1]. */
export function tileNoise(px: number, py: number, seed: number): (x: number, y: number) => number {
  const r = rng(seed)
  const lat = new Float32Array(px * py)
  for (let i = 0; i < lat.length; i++) lat[i] = r()
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const fx = x - xi, fy = y - yi
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const a = lat[y0 * px + x0]!, b = lat[y0 * px + x1]!, c = lat[y1 * px + x0]!, d = lat[y1 * px + x1]!
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

/** Fraktal küy (u, v ∈ [0,1) koordinatlarında, plitəli). bx, by: ilk oktavanın hüceyrə sayı. */
export function fbm(bx: number, by: number, octaves: number, seed: number): (u: number, v: number) => number {
  const layers = Array.from({ length: octaves }, (_, i) => ({ n: tileNoise(bx << i, by << i, seed + i * 101), fx: bx << i, fy: by << i, amp: 0.5 ** i }))
  const norm = layers.reduce((s, l) => s + l.amp, 0)
  return (u, v) => {
    let s = 0
    for (const l of layers) s += l.n(u * l.fx, v * l.fy) * l.amp
    return s / norm
  }
}

export function hex(c: string): RGB {
  const n = parseInt(c.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k]
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

function canvas(width: number, height: number): Pixels {
  return { width, height, data: new Uint8Array(width * height * 4) }
}
function put(p: Pixels, x: number, y: number, c: RGB, a = 255) {
  const i = (y * p.width + x) * 4
  p.data[i] = Math.max(0, Math.min(255, Math.round(c[0])))
  p.data[i + 1] = Math.max(0, Math.min(255, Math.round(c[1])))
  p.data[i + 2] = Math.max(0, Math.min(255, Math.round(c[2])))
  p.data[i + 3] = a
}
/** Hər piksel üçün (u, v) mərkəzdən hesablanır; v aşağıdan yuxarı artır. */
function paint(width: number, height: number, f: (u: number, v: number, x: number, y: number) => RGB): Pixels {
  const p = canvas(width, height)
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height
    for (let x = 0; x < width; x++) put(p, x, y, f((x + 0.5) / width, v, x, y))
  }
  return p
}
const gray = (k: number): RGB => [k * 255, k * 255, k * 255]

/** Taxta parket: lövhələr, uc birləşmələri, damar, lövhələr arası ara. bump: aralar çökük. */
export function woodPlanks(size = 512, seed = 7, light = '#b9834f', dark = '#6f4424'): Surface {
  const rows = 8
  const r = rng(seed)
  const joints = Array.from({ length: rows }, () => r())
  const tones = Array.from({ length: rows * 2 }, () => r())
  const grain = fbm(2, 16, 4, seed + 1)
  const fine = fbm(32, 128, 2, seed + 2)
  const L = hex(light), D = hex(dark), GAP: RGB = hex('#2e1c10')
  const height: number[] = new Array(size * size)
  const color = paint(size, size, (u, v, x, y) => {
    const row = Math.min(rows - 1, Math.floor(v * rows))
    const ly = v * rows - row
    const j = joints[row]!
    // Bir sırada iki lövhə: uc birləşmələri j və j+0.5-də.
    const du = (((u - j) % 1) + 1) % 1
    const seg = du < 0.5 ? 0 : 1
    const nearJoint = Math.min(du, Math.abs(du - 0.5), 1 - du) * size < 1.2
    const gap = ly * size / rows < 1.4 || nearJoint
    height[y * size + x] = gap ? 0 : 1
    if (gap) return GAP
    const tone = tones[row * 2 + seg]!
    const g = grain(u, v)
    const lines = 0.5 + 0.5 * Math.sin((ly * 3 + g * 5 + tone * 7) * Math.PI * 2)
    const k = clamp01(0.25 + tone * 0.35 + lines * 0.22 + (g - 0.5) * 0.4)
    const c = mix(D, L, k)
    return scale(c, 0.9 + fine(u, v) * 0.18)
  })
  return { color, bump: heightPixels(size, size, height) }
}

/** Suvaq: isti krem rəngi, yumşaq ləkələr və incə dən. */
export function plaster(size = 256, seed = 11, base = '#eadfc8'): Surface {
  const low = fbm(3, 3, 4, seed)
  const grain = fbm(48, 48, 2, seed + 5)
  const B = hex(base)
  const h: number[] = new Array(size * size)
  const color = paint(size, size, (u, v, x, y) => {
    const g = grain(u, v)
    h[y * size + x] = g
    return scale(B, 0.93 + low(u, v) * 0.1 + (g - 0.5) * 0.06)
  })
  return { color, bump: heightPixels(size, size, h) }
}

/** Taxta damarı (parta, qapı, panel): uzununa damarlar və illik halqalar. */
export function woodGrain(size = 256, seed = 23, light = '#a8703f', dark = '#5e3a1f'): Surface {
  const warp = fbm(2, 6, 4, seed)
  const fine = fbm(16, 96, 2, seed + 3)
  const L = hex(light), D = hex(dark)
  const color = paint(size, size, (u, v) => {
    const w = warp(u, v)
    const rings = 0.5 + 0.5 * Math.sin((v * 9 + w * 4) * Math.PI * 2)
    const k = clamp01(0.3 + rings * 0.35 + (w - 0.5) * 0.6)
    return scale(mix(D, L, k), 0.9 + fine(u, v) * 0.16)
  })
  return { color }
}

/** Mərmər plitə (dəhliz döşəməsi): 2×2 plitə, iki ton şahmat, damarlar, ara xətləri. */
export function marbleTiles(size = 512, seed = 31, a = '#ddd2bb', b = '#c4b394'): Surface {
  const vein = fbm(3, 3, 5, seed)
  const cloud = fbm(4, 4, 3, seed + 9)
  const vein2 = fbm(5, 5, 4, seed + 17)
  const A = hex(a), Bc = hex(b), GROUT: RGB = hex('#8f846f'), VEIN: RGB = hex('#8a7a5e')
  const h: number[] = new Array(size * size)
  const color = paint(size, size, (u, v, x, y) => {
    const tu = u * 2, tv = v * 2
    const fu = tu - Math.floor(tu), fv = tv - Math.floor(tv)
    const edge = Math.min(fu, 1 - fu, fv, 1 - fv) * (size / 2)
    if (edge < 1.3) { h[y * size + x] = 0; return GROUT }
    h[y * size + x] = 1
    const base = (Math.floor(tu) + Math.floor(tv)) % 2 === 0 ? A : Bc
    // Damar: küyün 0.5 səviyyə xətti boyunca nazik, yumşaq, intensivliyi dəyişən xətt ("ridge").
    const n = vein(u, v)
    const ridge = Math.abs(n - 0.5)
    const ridge2 = Math.abs(vein2(u, v) - 0.5)
    const veinK = Math.max(0, 1 - ridge / 0.012) * (0.25 + cloud(v, u) * 0.35) + Math.max(0, 1 - ridge2 / 0.008) * 0.14
    const c = mix(scale(base, 0.94 + cloud(u, v) * 0.1), VEIN, veinK)
    // Plitənin kənarı bir az tünd (fas).
    return scale(c, edge < 4 ? 0.93 : 1)
  })
  return { color, bump: heightPixels(size, size, h) }
}

/** Dəhliz xalçası: tünd qırmızı, qızılı haşiyə, xovlu dən. u eninə, v uzununa (təkrarlanır). */
export function runner(width = 128, height = 256, seed = 41): Surface {
  const fiber = fbm(32, 64, 2, seed)
  const mott = fbm(2, 4, 3, seed + 4)
  const RED: RGB = hex('#7d1f22'), DEEP: RGB = hex('#561417'), GOLD: RGB = hex('#c9a04e')
  const color = paint(width, height, (u, v) => {
    const d = Math.min(u, 1 - u)
    let c: RGB
    if (d < 0.05) c = DEEP
    else if (d < 0.085) c = GOLD
    else if (d < 0.11) c = DEEP
    else if (d > 0.13 && d < 0.145) c = GOLD
    else {
      // Mərkəzdə təkrarlanan romb naxışı.
      const cx = Math.abs(u - 0.5) * 4, cy = Math.abs(((v * 4) % 1) - 0.5) * 2
      c = cx + cy < 0.55 && cx + cy > 0.45 ? mix(RED, GOLD, 0.55) : RED
    }
    return scale(c, 0.85 + fiber(u, v) * 0.2 + (mott(u, v) - 0.5) * 0.1)
  })
  return { color }
}

/** Tavan plitələri: 2×2 akustik plitə, nöqtəli dən, metal karkas. */
export function ceilingTiles(size = 256, seed = 53): Surface {
  const soft = fbm(3, 3, 3, seed + 2)
  const r = rng(seed)
  // Kiçik, seyrək nöqtələr (akustik plitənin dəlikləri): hər piksel üçün toxumlu ehtimal.
  const dots = new Uint8Array(size * size)
  for (let i = 0; i < dots.length; i++) dots[i] = r() < 0.07 ? 1 : 0
  const T: RGB = hex('#f4efe4'), GRID: RGB = hex('#cfc6b4')
  const color = paint(size, size, (u, v, x, y) => {
    const fu = (u * 2) % 1, fv = (v * 2) % 1
    const e = Math.min(fu, 1 - fu, fv, 1 - fv) * (size / 2)
    if (e < 1.6) return GRID
    return scale(T, (dots[y * size + x] ? 0.9 : 1) * (e < 3.5 ? 0.95 : 1) * (0.96 + soft(u, v) * 0.05))
  })
  return { color }
}

/** Yazı lövhəsi (şifer): tünd yaşıl, silinmiş təbaşir izləri, incə dən. */
export function chalkboard(width = 512, height = 288, seed = 67): Surface {
  const smudge = fbm(4, 3, 5, seed)
  const swirl = fbm(2, 2, 3, seed + 7)
  const grain = fbm(96, 64, 1, seed + 3)
  const S: RGB = hex('#1f3d33'), CHALK: RGB = hex('#5d7b70')
  const color = paint(width, height, (u, v) => {
    // Silgi izləri: yumşaq qövslər.
    const arc = Math.abs(Math.sin((u * 5 + swirl(u, v) * 3) * Math.PI)) * Math.abs(Math.sin((v * 3 + swirl(v, u) * 2) * Math.PI))
    const k = clamp01((smudge(u, v) - 0.45) * 0.9) * 0.55 + Math.pow(arc, 6) * 0.12
    return scale(mix(S, CHALK, k), 0.94 + grain(u, v) * 0.1)
  })
  return { color }
}

/** Mantar (elan lövhəsi). */
export function cork(size = 128, seed = 71): Surface {
  const n = fbm(24, 24, 3, seed)
  const C: RGB = hex('#b58a5a'), D: RGB = hex('#7d5733')
  const color = paint(size, size, (u, v) => mix(D, C, clamp01(n(u, v) * 1.4 - 0.15)))
  return { color }
}

/** Pəncərə arxası: səma qradiyenti, üfüqdə ağaclar (yumşaq yaşıl), sonra şüşə əksi. */
export function windowView(width = 128, height = 192, seed = 83): Surface {
  const trees = fbm(6, 1, 3, seed)
  const cloud = fbm(3, 2, 4, seed + 1)
  const TOP: RGB = hex('#8fb8de'), HOR: RGB = hex('#e4eef2'), TREE: RGB = hex('#5f7f4f'), TREE2: RGB = hex('#3f5c3a')
  const color = paint(width, height, (u, v) => {
    const line = 0.22 + trees(u, 0.5) * 0.18
    if (v < line) return mix(TREE2, TREE, clamp01(v / line + (trees(u * 3 % 1, v) - 0.5) * 0.6))
    const sky = mix(HOR, TOP, clamp01((v - line) / (1 - line)))
    const c = cloud(u, v)
    return mix(sky, [250, 250, 248], clamp01((c - 0.55) * 2.2) * 0.7)
  })
  return { color }
}

/** Hündürlük massivini (0..1) boz rəngli bump teksturasına çevirir. */
function heightPixels(w: number, h: number, heights: number[]): Pixels {
  const p = canvas(w, h)
  for (let i = 0; i < w * h; i++) {
    const k = clamp01(heights[i] ?? 1)
    put(p, i % w, Math.floor(i / w), gray(k))
  }
  return p
}

// 5×7 bitmap şrift: otaq nömrələri və "ZAL" üçün. Hər sətir 5 bit (soldan sağa), yuxarıdan aşağı.
const GLYPHS: Record<string, number[]> = {
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  'A': [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  'Z': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
}

/** Mis lövhəcik üzərində həkk olunmuş yazı (yalnız rəqəmlər və Z, A, L; qalan simvollar boşluq). */
export function plate(text: string, width = 128, height = 48, seed = 97): Surface {
  const brush = fbm(2, 16, 2, seed)
  const B1: RGB = hex('#e2c06a'), B2: RGB = hex('#a07c2c'), INK: RGB = hex('#2b1d0e')
  const p = paint(width, height, (u, v) => {
    const border = Math.min(u * width, (1 - u) * width, v * height, (1 - v) * height)
    if (border < 2) return B2
    if (border < 4) return INK
    // Fırçalanmış mis: yuxarı açıq, aşağı tünd.
    return scale(mix(B2, B1, 0.35 + v * 0.45), 0.92 + brush(u, v) * 0.14)
  })
  const chars = [...text.toUpperCase()].slice(0, 6)
  if (chars.length === 0) return { color: p }
  const cell = Math.max(1, Math.floor(Math.min((height - 16) / 7, (width - 16) / (chars.length * 6))))
  const textW = chars.length * 6 * cell - cell
  const x0 = Math.floor((width - textW) / 2), top = Math.floor((height - 7 * cell) / 2)
  chars.forEach((ch, ci) => {
    const g = GLYPHS[ch]
    if (!g) return
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      if (!((g[r]! >> (4 - c)) & 1)) continue
      for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) {
        const x = x0 + (ci * 6 + c) * cell + dx
        const yTop = top + r * cell + dy
        if (x >= 0 && x < width && yTop >= 0 && yTop < height) put(p, x, height - 1 - yTop, INK)
      }
    }
  })
  return { color: p }
}
