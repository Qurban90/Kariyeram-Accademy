// Quraşdırma ikonlarını favicon.svg-dən çıxarır. Playwright tələb edir (dev vasitəsi).
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const targets = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.18],
  ['apple-touch-icon.png', 180, 0],
]
const b = await chromium.launch()
const p = await b.newPage()
for (const [name, size, pad] of targets) {
  const inner = Math.round(size * (1 - pad * 2))
  await p.setViewportSize({ width: size, height: size })
  await p.setContent(`<body style="margin:0;background:#0a1620;display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`)
  await p.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname })
}
await b.close()
