/**
 * Turns the single-file build into page content for publishing: the host
 * adds its own doctype, html, head and body, so only the title, styles,
 * scripts and the root element are kept.
 *
 *   npm run build:single && node scripts/artifact.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const html = readFileSync('dist-single/index.html', 'utf8')
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'))
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
const keep = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
const title = /<title>[\s\S]*?<\/title>/i.exec(keep)?.[0] ?? '<title>Nen World</title>'
const rest = keep.replace(title, '')
mkdirSync('dist-artifact', { recursive: true })
writeFileSync('dist-artifact/nen-world.html', `${title}\n${rest.trim()}\n${body.trim()}\n`)
console.log('dist-artifact/nen-world.html', (readFileSync('dist-artifact/nen-world.html').length / 1024).toFixed(0), 'KB')
