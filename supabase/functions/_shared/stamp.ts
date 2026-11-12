/**
 * PDF su nişanı (R-13): hər səhifəyə tələbə nömrəsi və tarix. Sızan PDF-in kimdən çıxdığı görünür.
 * Standart Helvetica yalnız WinAnsi simvollarını yazır, ona görə mətn ASCII-dir ("Telebe No").
 * Mətn həm səhifəyə (diaqonal, solğun, 3 dəfə + aşağıda aydın sətir), həm də sənəd metadatasına yazılır.
 */
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { ApiError } from './errors.ts'

export function stampText(studentNo: number | string, at: Date): string {
  const d = `${String(at.getUTCDate()).padStart(2, '0')}.${String(at.getUTCMonth() + 1).padStart(2, '0')}.${at.getUTCFullYear()}`
  return `Karyeram Accademy - Telebe No ${String(studentNo).replace(/[^0-9]/g, '')} - ${d}`
}

export async function stampPdf(src: Uint8Array, text: string): Promise<Uint8Array> {
  let doc: PDFDocument
  try {
    // Şifrəli PDF-i açmırıq: su nişanı qoyula bilmirsə, faylı da vermirik.
    doc = await PDFDocument.load(src, { updateMetadata: false })
  } catch {
    throw new ApiError('pdf_unreadable', 422)
  }
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const size = Math.max(10, Math.min(width, height) / 24)
    for (const k of [0.2, 0.5, 0.8]) {
      page.drawText(text, { x: width * 0.06, y: height * k, size, font, color: rgb(0.45, 0.45, 0.45), opacity: 0.16, rotate: degrees(28) })
    }
    page.drawText(text, { x: 18, y: 10, size: 7, font, color: rgb(0.3, 0.3, 0.3), opacity: 0.75 })
  }
  doc.setSubject(text)
  doc.setProducer('Karyeram Accademy')
  return doc.save({ useObjectStreams: true })
}
