/** Cari ekran seqmenti (Gate yeniləyir). API fon sorğuları istifadəçini testin ortasında razılıq ekranına atmasın deyə. */
let segment = ''
export function setNavSegment(s: string) { segment = s }
export function getNavSegment(): string { return segment }