// PDF su nişanı ölçməsi (docs/PERFORMANCE.md): node --experimental-transform-types tests/load/stamp-bench.mts
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { randomBytes } from 'node:crypto'
import { stampPdf, stampText } from '../../supabase/functions/_shared/stamp.ts'
// Realistik konspekt: 120 səhifə mətn.
const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.Helvetica)
for (let p = 0; p < 120; p++) {
  const page = doc.addPage([595, 842])
  for (let l = 0; l < 45; l++) page.drawText(`Setir ${l} - Konstitusiya madde ${p}.${l} haqqinda qeyd metn`, { x: 40, y: 800 - l * 17, size: 10, font })
}
let bytes = await doc.save()
console.log('PDF MB', (bytes.byteLength / 1e6).toFixed(2), 'pages', doc.getPageCount())
const runs = [] as number[]
for (let i = 0; i < 3; i++) { const t = performance.now(); await stampPdf(bytes, stampText(1152, new Date())); runs.push(Math.round(performance.now() - t)) }
console.log('stamp ms', runs.join(', '))
// Böyük fayl: skan edilmiş şəkillər kimi sıxılmayan 14 MB məlumat (limitə yaxın)
const big = await PDFDocument.load(bytes)
const stream = big.context.stream(randomBytes(14_000_000))
big.context.register(stream)
const bigBytes = await big.save()
console.log('Big MB', (bigBytes.byteLength / 1e6).toFixed(2))
const t = performance.now(); await stampPdf(bigBytes, 'x'); console.log('big stamp ms', Math.round(performance.now() - t))
console.log('heap MB', Math.round(process.memoryUsage().heapUsed / 1e6), 'rss MB', Math.round(process.memoryUsage().rss / 1e6))
