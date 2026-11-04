/** Semver müqayisəsi (yalnız MAJOR.MINOR.PATCH). "1.10.0" > "1.9.9". Formatı pozuq versiya 0.0.0 sayılır. Serverdəki config.ts ilə eyni qayda. */
export function compareVersions(a: string, b: string): number {
  const p = (v: string) => (/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v) ? v.split('.').map(Number) : [0, 0, 0])
  const x = p(a), y = p(b)
  for (let i = 0; i < 3; i++) if (x[i]! !== y[i]!) return x[i]! < y[i]! ? -1 : 1
  return 0
}
