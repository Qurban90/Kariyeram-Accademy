/** Ustanın səsi: qısa, yetkin, yumşaq yumorlu. Heç vaxt danlamır. */
const pick = <T,>(a: readonly T[], seed: number) => a[Math.abs(seed) % a.length]

export function greeting(hour: number, cracks: number, done: boolean, seed = 0): string {
  if (done) return pick(['Bu gün pəncərə yanıb. Qalan vaxtı dincəl.', 'Bu günlük bəsdir. Divarlar da bir az qurumalıdır.'], seed)
  if (cracks > 0) return pick([`Divarda ${cracks} çat var. Bir az harç, bir az səbir.`, `${cracks} çat gözləyir. Beş dəqiqəyə düzələr.`], seed)
  if (hour >= 21 || hour < 5) return pick(['Gecə növbəsi? Qala gecələr daha gözəl görünür.', 'Gec də olsa gəldin. Beş dəqiqə yetər.'], seed)
  if (hour < 12) return pick(['Sabahın xeyir. Gəl bir daş qoyaq.', 'Səhər hörgüsü ən möhkəm olur.'], seed)
  return pick(['Salam. Qala səni gözləyirdi.', 'Gəl, bu gün bir pəncərə yandıraq.'], seed)
}

export const rightLine = (seed: number) =>
  pick(['Daş yerini tutdu.', 'Düz oturdu.', 'Bu daş uzun müddət dayanar.', 'Əla hörgü.'], seed)
export const wrongLine = (seed: number) =>
  pick(['Divarda çat açıldı. Qorxma, təmir edərik.', 'Bu daş yırğalandı. Sabah yenidən baxarıq.', 'Səhv ustanın yaxşı müəllimidir.'], seed)

export function endLine(stones: number, repaired: number, cracked: number, seed = 0): string {
  if (repaired > 0 && cracked === 0) return pick(['Çatlar bağlandı. Divar yenə bütövdür.', 'Yaxşı təmirdir. Harç quruyana qədər toxunma.'], seed)
  if (cracked > stones) return pick(['Bu gün çətin daşlar gəldi. Çatları sabah birlikdə bağlarıq.', 'Çox çat? Qala belə tikilir.'], seed)
  if (stones > 0) return pick(['Qalaya yeni daşlar əlavə olundu. Pəncərə yanır.', 'Bu gün möhkəm iş gördün.'], seed)
  return 'Bu seans qısa idi, amma pəncərə yandı.'
}

export const emptyLine = {
  noCracks: 'Divarda çat yoxdur. Gözümə yaxşı görünür.',
  doorLocked: 'Qapı hələ bağlıdır. Hər mərtəbə yarıya çatmalıdır.',
  doorOpen: 'Komissiya otağı açıqdır. Hazır olanda gir.',
}
