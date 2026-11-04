/** Token bucket: hər tələbə üçün sual açma limiti (server tərəfində də eyni məntiq var). */
export class TokenBucket {
  private tokens: number
  private last: number
  constructor(private capacity: number, private refillPerSec: number, now: number) {
    this.tokens = capacity
    this.last = now
  }
  take(now: number, cost = 1): boolean {
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec)
    this.last = now
    if (this.tokens < cost) return false
    this.tokens -= cost
    return true
  }
}

/** Çox sürətli ardıcıl cavablar: bank köçürmə (skreyp) əlaməti. */
export function paceSuspicion(answerMs: number[], minCount = 15, medianBelowMs = 1500): boolean {
  if (answerMs.length < minCount) return false
  const s = [...answerMs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  const median = s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
  return median < medianBelowMs
}
