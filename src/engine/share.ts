export type Mark = 'stone' | 'crack' | 'none'

export interface CardData {
  dayNo: number
  week: Mark[]
  correct: boolean
}

/** Günün sualı nəticə kartı (1080×1350). Wordle kimi paylaşıla bilər. */
export async function drawShareCard(data: CardData, dark = true): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready
  const W = 1080
  const H = 1350
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const bg = dark ? ['#0A1620', '#16303F'] : ['#D9E6EA', '#EFE7D2']
  const ink = dark ? '#EDE8DA' : '#10222B'
  const stone = dark ? '#D2C8AE' : '#C7BC9E'
  const lamp = '#F4B942'
  const crack = dark ? '#EE6A80' : '#B4233F'
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, bg[0])
  grad.addColorStop(1, bg[1])
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)

  g.fillStyle = ink
  g.font = '700 64px Unbounded, Onest, sans-serif'
  g.fillText('Pillə', 90, 150)
  g.font = '500 40px Onest, sans-serif'
  g.globalAlpha = 0.7
  g.fillText(`Günün sualı · gün ${data.dayNo}`, 90, 215)
  g.globalAlpha = 1

  // Qala parçası: 7 gün = 7 daş
  const size = 120
  const gap = 18
  const x0 = (W - (7 * size + 6 * gap)) / 2
  const y0 = 520
  data.week.forEach((m, i) => {
    const x = x0 + i * (size + gap)
    g.lineWidth = 6
    g.strokeStyle = ink
    if (m === 'none') {
      g.setLineDash([14, 12])
      g.globalAlpha = 0.4
      g.strokeRect(x, y0, size, size)
      g.setLineDash([])
      g.globalAlpha = 1
    } else {
      g.fillStyle = stone
      g.fillRect(x, y0, size, size)
      g.strokeRect(x, y0, size, size)
      if (m === 'crack') {
        g.strokeStyle = crack
        g.lineWidth = 8
        g.beginPath()
        g.moveTo(x + 28, y0 + 6)
        g.lineTo(x + 52, y0 + 48)
        g.lineTo(x + 38, y0 + 70)
        g.lineTo(x + 70, y0 + size - 6)
        g.stroke()
      }
    }
  })

  g.fillStyle = data.correct ? lamp : crack
  g.font = '700 150px Unbounded, Onest, sans-serif'
  g.textAlign = 'center'
  g.fillText(data.correct ? 'Daş qoydum' : 'Çat açıldı', W / 2, 900)
  g.fillStyle = ink
  g.globalAlpha = 0.75
  g.font = '500 44px Onest, sans-serif'
  g.fillText('Sən də bir daş qoy', W / 2, 1010)
  g.textAlign = 'left'
  g.globalAlpha = 1

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('canvas'))), 'image/png'))
}

export function weekText(data: CardData): string {
  const sq = data.week.map((m) => (m === 'stone' ? '🧱' : m === 'crack' ? '🟥' : '⬜')).join('')
  return `Pillə · Günün sualı ${data.dayNo}\n${data.correct ? 'Daş qoydum' : 'Çat açıldı'}\n${sq}`
}

export async function shareCard(data: CardData, dark: boolean): Promise<'shared' | 'downloaded'> {
  const blob = await drawShareCard(data, dark)
  const file = new File([blob], `pille-gun-${data.dayNo}.png`, { type: 'image/png' })
  const text = weekText(data)
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch {
      /* istifadəçi ləğv etdi */
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return 'downloaded'
}
